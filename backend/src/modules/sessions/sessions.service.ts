// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Sessions de jeu (cœur de l'anti-cheat)
//
//  Cycle obligatoire :
//    1. POST /api/sessions/start   → le serveur horodate le début
//    2. POST /api/sessions/:id/finish → le serveur VALIDE le résultat
//  Un score sans session démarrée est impossible à enregistrer.
// ══════════════════════════════════════════════════════════════════

import type { Difficulty } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { hashIp } from "../../lib/crypto";
import { AppError, NotFoundError } from "../../lib/errors";
import { normalizeDifficulty } from "../../lib/xp";
import { assertProfileAccess, getActiveProfile } from "../profiles/profiles.service";
import { assertPremiumAccess } from "../billing/billing.service";
import { logSecurityEvent } from "../../services/security-log.service";
import {
  pickMaxScore,
  validateSessionResult,
  type GameAntiCheatConfig,
} from "../../services/anticheat/score-validator";
import {
  applyValidatedResult,
  type ApplyResultOutput,
} from "../../services/gamification.service";

const MAX_ACTIVE_SESSIONS = 5;

export interface StartSessionInput {
  gameSlug: string;
  difficulty: string;
}

export interface StartSessionResult {
  sessionId: string;
  startedAt: string;
  serverTimeMs: number;
  game: { slug: string; title: string; config: unknown; maxScoreHint: number };
  profile: { id: string; displayName: string; level: number; xp: number };
}

export async function startSession(
  authUserId: string,
  input: StartSessionInput,
  meta: { ip?: string },
): Promise<StartSessionResult> {
  const game = await prisma.game.findUnique({ where: { slug: input.gameSlug } });
  if (!game || !game.isPublished) {
    throw new NotFoundError("Ce jeu n'existe pas (ou plus).");
  }

  // Accès Premium vérifié côté serveur : masquer le bouton ne suffit pas.
  if (game.premium) {
    await assertPremiumAccess(authUserId, game.slug);
  }

  const profile = await getActiveProfile(authUserId);
  const difficulty = normalizeDifficulty(input.difficulty).toUpperCase() as Difficulty;

  // Nettoyage : trop de sessions actives → on abandonne les plus anciennes.
  const activeSessions = await prisma.gameSession.findMany({
    where: { profileId: profile.id, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (activeSessions.length >= MAX_ACTIVE_SESSIONS) {
    await prisma.gameSession.updateMany({
      where: { id: { in: activeSessions.slice(MAX_ACTIVE_SESSIONS - 1).map((s) => s.id) } },
      data: { status: "ABANDONED" },
    });
  }

  const session = await prisma.gameSession.create({
    data: {
      profileId: profile.id,
      gameId: game.id,
      difficulty,
      status: "ACTIVE",
      ipHash: hashIp(meta.ip),
    },
  });

  return {
    sessionId: session.id,
    startedAt: session.startedAt.toISOString(),
    serverTimeMs: Date.now(),
    game: {
      slug: game.slug,
      title: game.title,
      config: game.config,
      maxScoreHint: game.maxScoreHint,
    },
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      level: profile.level,
      xp: profile.xp,
    },
  };
}

// ══════════════════════════════════════════════════════════════════
//  FIN DE SESSION — validation anti-cheat puis gamification
// ══════════════════════════════════════════════════════════════════

export interface FinishSessionInput {
  score: number;
  durationMs: number;
  isWin: boolean;
  levelReached: number;
  clientMeta?: Record<string, unknown>;
}

export interface FinishSessionResult extends ApplyResultOutput {
  accepted: true;
  stars: number;
}

export class ScoreRejectedError extends AppError {
  constructor() {
    super(
      422,
      "SCORE_REJECTED",
      "Ton score n'a pas pu être validé cette fois-ci. Réessaie !",
    );
  }
}

export async function finishSession(
  authUserId: string,
  sessionId: string,
  input: FinishSessionInput,
  meta: { ip?: string; log: { warn: (msg: string) => void } },
): Promise<FinishSessionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      game: { include: { category: true } },
      profile: true,
    },
  });
  if (!session) throw new NotFoundError("Session de jeu introuvable.");

  // Anti-IDOR : le profil doit appartenir à l'utilisateur (ou être son enfant)
  await assertProfileAccess(session.profileId, authUserId);

  if (session.status !== "ACTIVE") {
    throw new AppError(409, "SESSION_INVALID", "Cette session de jeu est déjà terminée.");
  }

  // ── Contexte de validation ─────────────────────────────────────
  const now = Date.now();
  const elapsedSinceStartMs = now - session.startedAt.getTime();
  const sessionsLastHour = await prisma.gameSession.count({
    where: {
      profileId: session.profileId,
      startedAt: { gte: new Date(now - 60 * 60 * 1000) },
    },
  });

  const cfg = (session.game.config ?? {}) as GameAntiCheatConfig;
  const validation = validateSessionResult(
    cfg,
    {
      score: input.score,
      durationMs: input.durationMs,
      isWin: input.isWin,
      stars: 0, // recalculé serveur
      difficulty: session.difficulty,
      levelReached: input.levelReached,
    },
    {
      elapsedSinceStartMs,
      sessionsLastHour,
      maxSessionsPerHour: env.MAX_SESSIONS_PER_HOUR,
    },
  );

  if (!validation.ok) {
    // Log technique complet, réponse générique au client.
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: "FINISHED",
        finishedAt: new Date(),
        anomalyFlags: { flags: validation.flags, at: new Date().toISOString() },
        clientMeta: (input.clientMeta ?? {}) as never,
      },
    });
    await logSecurityEvent({
      type: "SCORE_ANOMALY",
      userId: authUserId,
      ipHash: hashIp(meta.ip),
      detail: {
        sessionId,
        gameSlug: session.game.slug,
        flags: validation.flags,
        score: input.score,
        durationMs: input.durationMs,
        elapsedSinceStartMs,
      },
    });
    throw new ScoreRejectedError();
  }

  // ── Résultat validé → gamification serveur ─────────────────────
  const maxScoreForStars = pickMaxScore(cfg, session.difficulty);

  const result = await applyValidatedResult(
    {
      sessionId,
      profileId: session.profileId,
      gameId: session.gameId,
      userId: session.profile.userId,
      difficulty: session.difficulty,
      score: input.score,
      durationMs: input.durationMs,
      isWin: input.isWin,
      levelReached: input.levelReached,
      categorySlug: session.game.category.slug,
      maxScoreForStars,
      levelBefore: session.profile.level,
    },
    meta.log,
  );

  return { accepted: true, ...result };
}

// ══════════════════════════════════════════════════════════════════
//  ABANDON
// ══════════════════════════════════════════════════════════════════

export async function abandonSession(authUserId: string, sessionId: string): Promise<void> {
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new NotFoundError("Session introuvable.");
  await assertProfileAccess(session.profileId, authUserId);

  if (session.status === "ACTIVE") {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: "ABANDONED", finishedAt: new Date() },
    });
  }
}

// ══════════════════════════════════════════════════════════════════
//  HISTORIQUE (pour la reprise de partie §40)
// ══════════════════════════════════════════════════════════════════

export async function getResumeState(authUserId: string, gameSlug: string) {
  const profile = await getActiveProfile(authUserId);
  const game = await prisma.game.findUnique({
    where: { slug: gameSlug },
    select: { id: true },
  });
  if (!game) throw new NotFoundError("Jeu introuvable.");

  const progress = await prisma.progress.findUnique({
    where: { profileId_gameId: { profileId: profile.id, gameId: game.id } },
  });

  const active = await prisma.gameSession.findFirst({
    where: { profileId: profile.id, gameId: game.id, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });

  return {
    hasActiveSession: active !== null,
    activeSessionId: active?.id ?? null,
    level: progress?.level ?? 1,
    bestScore: progress?.bestScore ?? 0,
    plays: progress?.plays ?? 0,
  };
}
