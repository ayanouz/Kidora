// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Compte utilisateur (paramètres + RGPD)
//  • Export des données (portabilité)
//  • Suppression de compte (droit à l'effacement) : anonymisation +
//    effacement réel des données personnelles, conservation des
//    agrégats anonymes uniquement.
// ══════════════════════════════════════════════════════════════════

import { prisma } from "../../lib/prisma";
import { hashPassword, sha256, verifyPassword } from "../../lib/crypto";
import { UnauthorizedError, ValidationError } from "../../lib/errors";
import { toPublicProfile, toPublicUser, type PublicProfile } from "../../lib/serializers";
import { logSecurityEvent } from "../../services/security-log.service";
import type { User } from "@prisma/client";

// ── Paramètres du compte ───────────────────────────────────────────

export interface UpdateAccountInput {
  displayName?: string;
  avatar?: string;
  leaderboardOptIn?: boolean;
}

export async function updateAccount(userId: string, input: UpdateAccountInput) {
  const data: Record<string, unknown> = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.avatar !== undefined) data.avatar = input.avatar;
  if (input.leaderboardOptIn !== undefined) data.leaderboardOptIn = input.leaderboardOptIn;

  const user = await prisma.user.update({ where: { id: userId }, data });

  // La préférence de classement se propage aux profils détenus.
  if (input.leaderboardOptIn !== undefined) {
    await prisma.profile.updateMany({
      where: { userId },
      data: { leaderboardOptIn: input.leaderboardOptIn },
    });
  }

  return toPublicUser(user);
}

// ── Changement de mot de passe ────────────────────────────────────

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentRefreshTokenHash: string | null,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) throw new ValidationError([{ path: "password", message: "Compte sans mot de passe." }]);

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Mot de passe actuel incorrect.");

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, tokensValidAfter: new Date() },
    });
    // Révoque toutes les autres sessions, conserve la session courante.
    await tx.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentRefreshTokenHash ? { tokenHash: { not: currentRefreshTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  });
}

// ── Export RGPD ────────────────────────────────────────────────────

export async function exportUserData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const profiles = await prisma.profile.findMany({ where: { userId } });
  const profileIds = profiles.map((p) => p.id);

  const [scores, sessions, progress, achievements, favorites, guardians] =
    await Promise.all([
      prisma.score.findMany({
        where: { profileId: { in: profileIds } },
        include: { game: { select: { slug: true, title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.gameSession.findMany({
        where: { profileId: { in: profileIds } },
        select: {
          id: true,
          profileId: true,
          gameId: true,
          difficulty: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          score: true,
          durationMs: true,
          isWin: true,
        },
        orderBy: { startedAt: "desc" },
      }),
      prisma.progress.findMany({ where: { profileId: { in: profileIds } } }),
      prisma.userAchievement.findMany({
        where: { profileId: { in: profileIds } },
        include: { achievement: { select: { code: true, title: true } } },
      }),
      prisma.favorite.findMany({ where: { profileId: { in: profileIds } } }),
      prisma.parentChild.findMany({
        where: { OR: [{ parentId: userId }, { profileId: { in: profileIds } }] },
      }),
    ]);

  await logSecurityEvent({
    type: "RGPD_EXPORT",
    userId,
    detail: { profiles: profiles.length, scores: scores.length },
  });

  return {
    exportedAt: new Date().toISOString(),
    format: "kidora-export-v1",
    account: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      avatar: user.avatar,
      ageTier: user.ageTier,
      birthYear: user.birthYear,
      xp: user.xp,
      level: user.level,
      points: user.points,
      createdAt: user.createdAt,
      consentAcceptedAt: user.consentAcceptedAt,
    },
    profiles: profiles.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      avatar: p.avatar,
      ageTier: p.ageTier,
      xp: p.xp,
      level: p.level,
      points: p.points,
      createdAt: p.createdAt,
    })),
    scores,
    sessions,
    progress,
    achievements,
    favorites,
    guardianLinks: guardians,
  };
}

// ── Suppression de compte (droit à l'effacement) ──────────────────

export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.passwordHash) {
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Mot de passe incorrect.");
  }

  await prisma.$transaction(async (tx) => {
    // 1. Effacement réel des données enfants (profils → cascade scores,
    //    sessions, progress, favoris, achievements).
    await tx.profile.deleteMany({ where: { userId } });

    // 2. Anonymisation du compte : plus aucune donnée identifiante.
    await tx.user.update({
      where: { id: userId },
      data: {
        email: null,
        passwordHash: null,
        displayName: "Compte supprimé",
        avatar: "👋",
        birthYear: null,
        ageTier: null,
        isActive: false,
        deletedAt: new Date(),
        tokensValidAfter: new Date(),
        activeProfileId: null,
      },
    });

    // 3. Révocation de toutes les sessions.
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  await logSecurityEvent({
    type: "RGPD_DELETE",
    userId,
    detail: { method: "self_service" },
  });
}

// ── Utilitaires ────────────────────────────────────────────────────

export async function getAccount(user: User) {
  const profiles = await prisma.profile.findMany({
    where: { userId: user.id, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  const [scoresCount, sessionsCount] = await Promise.all([
    prisma.score.count({ where: { profileId: { in: profiles.map((p) => p.id) } } }),
    prisma.gameSession.count({
      where: { profileId: { in: profiles.map((p) => p.id) }, status: "FINISHED" },
    }),
  ]);

  return {
    user: toPublicUser(user),
    profiles: profiles.map(toPublicProfile) as PublicProfile[],
    stats: { scoresCount, sessionsCount },
  };
}

/** Empreinte du refresh token courant (pour ne pas le révoquer au changement de mdp). */
export function hashRefreshToken(rawToken: string | undefined): string | null {
  return rawToken ? sha256(rawToken) : null;
}
