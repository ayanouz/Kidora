// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service d'authentification
//
//  Sécurité :
//   • bcrypt cost 12 — jamais de mot de passe en clair
//   • Verrouillage progressif du compte après échecs (anti brute-force)
//   • Messages génériques (anti-énumération) + timing constant
//   • Refresh tokens opaques, hachés en base, rotatifs et révocables
//   • Anti-énumération sur mot de passe oublié
// ══════════════════════════════════════════════════════════════════

import type { AgeTier, Role, User } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import {
  hashPassword,
  hashIp,
  randomToken,
  sha256,
  verifyPassword,
} from "../../lib/crypto";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "../../lib/errors";
import { ageTierFromBirthYear } from "../../lib/age";
import { daysToMs, minutesToMs } from "../../lib/duration";
import { logSecurityEvent } from "../../services/security-log.service";
import {
  passwordResetMail,
  maskEmail,
  sendMail,
} from "../../lib/mailer";
import {
  signAccessToken,
  type AuthUser,
} from "../../plugins/auth.plugin";
import type { LoginInput, RegisterInput } from "./auth.schemas";
import { toPublicProfile, toPublicUser, type PublicProfile } from "../../lib/serializers";

// ── Politique de verrouillage ─────────────────────────────────────
const LOCK_THRESHOLD = 5; // échecs avant verrouillage

// Hash factice pour vérifier le mot de passe même si l'utilisateur
// n'existe pas → temps de réponse constant (anti-énumération par timing).
const DUMMY_HASH =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpXGjFzEuz3gLb2pFOdiV7Brs4CpC";

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
}

export interface AuthMeResult {
  user: ReturnType<typeof toPublicUser>;
  profiles: PublicProfile[];
}

// ══════════════════════════════════════════════════════════════════
//  INSCRIPTION
// ══════════════════════════════════════════════════════════════════

export async function register(
  input: RegisterInput,
  meta: SessionMeta,
): Promise<{ user: User; session: AuthSessionResult }> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("EMAIL_TAKEN", "Un compte existe déjà avec cet email.");
  }

  const passwordHash = await hashPassword(input.password);

  // Enfant (3-12 ans) → compte CHILD ; adolescent/adulte → PARENT.
  const ageTier: AgeTier | undefined =
    input.ageTier ?? (input.birthYear ? ageTierFromBirthYear(input.birthYear) : undefined);
  const role: Role =
    ageTier && (ageTier === "AGE_3_5" || ageTier === "AGE_6_8" || ageTier === "AGE_9_12")
      ? "CHILD"
      : "PARENT";

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        role,
        displayName: input.displayName,
        birthYear: input.birthYear ?? null,
        ageTier: ageTier ?? null,
        consentAcceptedAt: new Date(),
      },
    });

    // Profil joueur par défaut (tout utilisateur peut jouer)
    const profile = await tx.profile.create({
      data: {
        userId: created.id,
        displayName: input.displayName,
        avatar: role === "CHILD" ? "🐼" : "🦊",
        ageTier: ageTier ?? "AGE_6_8",
        isDefault: true,
      },
    });

    await tx.user.update({
      where: { id: created.id },
      data: { activeProfileId: profile.id },
    });

    // Si l'inscription est faite par un parent "pour" un enfant, le lien tuteur
    // est créé automatiquement (le parent peut ajouter d'autres enfants ensuite).
    if (role === "PARENT") {
      await tx.parentChild.create({
        data: { parentId: created.id, profileId: profile.id },
      });
    }

    return created;
  });

  await logSecurityEvent({
    type: "ACCOUNT_CREATED",
    userId: user.id,
    ipHash: hashIp(meta.ip),
    detail: { role, maskedEmail: maskEmail(input.email) },
  });

  const session = await createSession(user, meta);
  return { user, session };
}

// ══════════════════════════════════════════════════════════════════
//  CONNEXION
// ══════════════════════════════════════════════════════════════════

export async function login(
  input: LoginInput,
  meta: SessionMeta,
): Promise<{ user: User; session: AuthSessionResult }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Compte inexistant : on fait quand même un bcrypt.compare (timing constant)
  if (!user || user.deletedAt) {
    await verifyPassword(input.password, DUMMY_HASH);
    await logSecurityEvent({
      type: "LOGIN_FAILED",
      ipHash: hashIp(meta.ip),
      detail: { reason: "unknown_email" },
    });
    throw new UnauthorizedError("Email ou mot de passe incorrect.");
  }

  if (!user.isActive) {
    throw new ForbiddenError("Ce compte est désactivé.");
  }

  // Verrouillage progressif actif ?
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await logSecurityEvent({
      type: "LOGIN_LOCKED",
      userId: user.id,
      ipHash: hashIp(meta.ip),
      detail: { minutes },
    });
    throw new ForbiddenError(
      `Trop de tentatives. Réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
    );
  }

  const valid = await verifyPassword(input.password, user.passwordHash ?? DUMMY_HASH);

  if (!valid) {
    const failedLogins = user.failedLogins + 1;
    // 5 échecs → 15 min ; doublement à chaque échec supplémentaire (max 24h)
    const lockMinutes =
      failedLogins >= LOCK_THRESHOLD
        ? Math.min(15 * Math.pow(2, failedLogins - LOCK_THRESHOLD), 24 * 60)
        : 0;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins,
        lockedUntil:
          lockMinutes > 0 ? new Date(Date.now() + lockMinutes * 60 * 1000) : null,
      },
    });

    await logSecurityEvent({
      type: failedLogins >= LOCK_THRESHOLD ? "BRUTE_FORCE_SUSPECTED" : "LOGIN_FAILED",
      userId: user.id,
      ipHash: hashIp(meta.ip),
      detail: { failedLogins, lockMinutes },
    });

    if (lockMinutes > 0) {
      throw new ForbiddenError(
        `Trop de tentatives. Compte bloqué ${lockMinutes} minutes par sécurité.`,
      );
    }
    throw new UnauthorizedError("Email ou mot de passe incorrect.");
  }

  // Succès → réinitialise le compteur d'échecs
  if (user.failedLogins > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  }

  const session = await createSession(user, meta);
  return { user, session };
}

// ══════════════════════════════════════════════════════════════════
//  SESSIONS (access + refresh)
// ══════════════════════════════════════════════════════════════════

async function createSession(user: User, meta: SessionMeta): Promise<AuthSessionResult> {
  const refreshToken = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + daysToMs(env.REFRESH_TOKEN_TTL_DAYS)),
      userAgent: meta.userAgent?.slice(0, 200) ?? null,
      ipHash: hashIp(meta.ip),
    },
  });
  return {
    accessToken: signAccessToken(user.id, user.role),
    refreshToken,
  };
}

/** Rotation du refresh token : l'ancien est révoqué, un nouveau est émis. */
export async function refreshSession(
  rawToken: string | undefined,
  meta: SessionMeta,
): Promise<{ user: User; session: AuthSessionResult }> {
  if (!rawToken) throw new UnauthorizedError("Session expirée. Reconnecte-toi.");

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { user: true },
  });

  if (
    !record ||
    record.revokedAt !== null ||
    record.expiresAt < new Date() ||
    record.user.deletedAt !== null ||
    !record.user.isActive
  ) {
    if (record && !record.revokedAt) {
      // Token probablement volé/rejoué → on révoque tout par sécurité
      await prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw new UnauthorizedError("Session expirée. Reconnecte-toi.");
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const session = await createSession(record.user, meta);
  return { user: record.user, session };
}

/** Déconnexion : révoque le refresh token présenté (+ option toutes sessions). */
export async function logout(
  rawToken: string | undefined,
  allSessions: boolean,
  userId: string | undefined,
): Promise<void> {
  if (allSessions && userId) {
    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { tokensValidAfter: new Date() },
      }),
    ]);
    return;
  }
  if (rawToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

// ══════════════════════════════════════════════════════════════════
//  MOT DE PASSE OUBLIÉ / RÉINITIALISATION
// ══════════════════════════════════════════════════════════════════

/**
 * Anti-énumération : répond toujours la même chose, que l'email existe ou non.
 */
export async function requestPasswordReset(
  email: string,
  meta: SessionMeta,
  log: { info: (m: string) => void; warn: (m: string) => void },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.deletedAt && user.isActive) {
    const rawToken = randomToken(48);
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: sha256(rawToken),
        expiresAt: new Date(Date.now() + minutesToMs(env.PASSWORD_RESET_TTL_MINUTES)),
      },
    });

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await sendMail({ to: email, ...passwordResetMail(resetUrl) }, log);

    await logSecurityEvent({
      type: "PASSWORD_RESET",
      userId: user.id,
      ipHash: hashIp(meta.ip),
      detail: { step: "requested", maskedEmail: maskEmail(email) },
    });
  }
}

export async function resetPassword(
  token: string,
  newPassword: string,
  meta: SessionMeta,
): Promise<void> {
  const record = await prisma.passwordReset.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new UnauthorizedError(
      "Ce lien de réinitialisation est invalide ou expiré. Refais une demande.",
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
        tokensValidAfter: new Date(), // invalide toutes les sessions existantes
      },
    }),
    prisma.passwordReset.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logSecurityEvent({
    type: "PASSWORD_RESET",
    userId: record.userId,
    ipHash: hashIp(meta.ip),
    detail: { step: "completed" },
  });
}

// ══════════════════════════════════════════════════════════════════
//  PROFIL DE SESSION (GET /api/auth/me)
// ══════════════════════════════════════════════════════════════════

export async function getMe(authUser: AuthUser): Promise<AuthMeResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });

  const profiles = await prisma.profile.findMany({
    where: { userId: user.id, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  // Côté enfant autonome, un seul profil existe ; côté parent, ses enfants.
  return {
    user: toPublicUser(user),
    profiles: profiles.map(toPublicProfile),
  };
}
