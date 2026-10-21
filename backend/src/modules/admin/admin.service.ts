// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Administration (§26)
//  Toutes les actions sont réservées au rôle ADMIN (garde de route)
//  et journalisées (security_logs → ADMIN_ACTION).
// ══════════════════════════════════════════════════════════════════

import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { logSecurityEvent } from "../../services/security-log.service";

// ══════════════════════════════════════════════════════════════════
//  DASHBOARD / KPI
// ══════════════════════════════════════════════════════════════════

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getStats() {
  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);

  const [
    totalUsers,
    newUsers7d,
    childProfiles,
    totalSessions,
    sessions7d,
    avgSession,
    totalScores,
    totalGames,
    publishedGames,
    anomalies30d,
    activeProfiles7d,
    topPlayed,
    topWins,
    abandoned,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
    prisma.profile.count({ where: { isActive: true } }),
    prisma.gameSession.count({ where: { status: "FINISHED" } }),
    prisma.gameSession.count({ where: { status: "FINISHED", finishedAt: { gte: weekAgo } } }),
    prisma.gameSession.aggregate({
      where: { status: "FINISHED" },
      _avg: { durationMs: true },
    }),
    prisma.score.count(),
    prisma.game.count(),
    prisma.game.count({ where: { isPublished: true } }),
    prisma.securityLog.count({ where: { type: "SCORE_ANOMALY", createdAt: { gte: monthAgo } } }),
    prisma.gameSession.groupBy({
      by: ["profileId"],
      where: { status: "FINISHED", finishedAt: { gte: weekAgo } },
    }),
    prisma.game.findMany({
      orderBy: { playCount: "desc" },
      take: 5,
      select: { slug: true, title: true, emoji: true, color: true, playCount: true },
    }),
    prisma.gameSession.groupBy({
      by: ["gameId"],
      where: { status: "FINISHED", isWin: true },
      _count: { _all: true },
      orderBy: { _count: { gameId: "desc" } },
      take: 8,
    }),
    prisma.gameSession.groupBy({
      by: ["gameId"],
      where: { status: "ABANDONED" },
      _count: { _all: true },
      orderBy: { _count: { gameId: "desc" } },
      take: 5,
    }),
  ]);

  // Taux de réussite par jeu (parmi les plus gagnés)
  const winIds = topWins.map((w) => w.gameId);
  const [winGames, totalByGame] = await Promise.all([
    prisma.game.findMany({
      where: { id: { in: winIds } },
      select: { id: true, slug: true, title: true, emoji: true },
    }),
    prisma.gameSession.groupBy({
      by: ["gameId"],
      where: { status: "FINISHED", gameId: { in: winIds } },
      _count: { _all: true },
    }),
  ]);
  const winGameMap = new Map(winGames.map((g) => [g.id, g]));
  const totalMap = new Map(totalByGame.map((t) => [t.gameId, t._count._all]));
  const topWinRates = topWins
    .map((w) => {
      const g = winGameMap.get(w.gameId);
      const total = totalMap.get(w.gameId) ?? 0;
      return g
        ? {
            ...g,
            wins: w._count._all,
            total,
            winRate: total > 0 ? Math.round((w._count._all / total) * 100) : 0,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5);

  // Jeux abandonnés
  const abandonedIds = abandoned.map((a) => a.gameId);
  const abandonedGames = await prisma.game.findMany({
    where: { id: { in: abandonedIds } },
    select: { id: true, slug: true, title: true, emoji: true },
  });
  const abandonedMap = new Map(abandonedGames.map((g) => [g.id, g]));
  const topAbandoned = abandoned
    .map((a) => {
      const g = abandonedMap.get(a.gameId);
      return g ? { ...g, abandoned: a._count._all } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    users: {
      total: totalUsers,
      new7d: newUsers7d,
      childProfiles,
      active7d: activeProfiles7d.length,
    },
    sessions: {
      total: totalSessions,
      last7d: sessions7d,
      avgDurationMs: Math.round(avgSession._avg.durationMs ?? 0),
      totalScores,
    },
    games: { total: totalGames, published: publishedGames },
    security: { scoreAnomalies30d: anomalies30d },
    topPlayed,
    topWinRates,
    topAbandoned,
  };
}

// ══════════════════════════════════════════════════════════════════
//  GESTION DES UTILISATEURS
// ══════════════════════════════════════════════════════════════════

export interface ListUsersParams {
  search?: string;
  role?: "PARENT" | "CHILD" | "ADMIN";
  page: number;
  limit: number;
}

export async function listUsers(params: ListUsersParams) {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (params.role) where.role = params.role;
  if (params.search) {
    where.OR = [
      { email: { contains: params.search, mode: "insensitive" } },
      { displayName: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        avatar: true,
        isActive: true,
        failedLogins: true,
        lockedUntil: true,
        createdAt: true,
        _count: { select: { profiles: true } },
      },
    }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      displayName: u.displayName,
      avatar: u.avatar,
      isActive: u.isActive,
      locked: u.lockedUntil !== null && u.lockedUntil > new Date(),
      profilesCount: u._count.profiles,
      createdAt: u.createdAt.toISOString(),
    })),
    total,
    page: params.page,
    pages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export async function setUserActive(adminId: string, userId: string, isActive: boolean) {
  if (adminId === userId) {
    throw new ForbiddenError("Impossible de modifier ton propre compte admin.");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new NotFoundError("Utilisateur introuvable.");
  if (user.role === "ADMIN" && !isActive) {
    throw new ForbiddenError("Impossible de désactiver un administrateur.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive,
      // Désactivation → révocation immédiate des sessions
      ...(isActive ? {} : { tokensValidAfter: new Date() }),
    },
  });

  await logSecurityEvent({
    type: "ADMIN_ACTION",
    userId: adminId,
    detail: { action: isActive ? "user_enable" : "user_disable", targetId: userId },
  });
}

export async function deleteUser(adminId: string, userId: string) {
  if (adminId === userId) throw new ForbiddenError("Impossible de supprimer ton propre compte.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new NotFoundError("Utilisateur introuvable.");
  if (user.role === "ADMIN") throw new ForbiddenError("Impossible de supprimer un administrateur.");

  await prisma.$transaction(async (tx) => {
    await tx.profile.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: null,
        passwordHash: null,
        displayName: "Compte supprimé",
        avatar: "👋",
        isActive: false,
        deletedAt: new Date(),
        tokensValidAfter: new Date(),
        activeProfileId: null,
      },
    });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  await logSecurityEvent({
    type: "ADMIN_ACTION",
    userId: adminId,
    detail: { action: "user_delete", targetId: userId },
  });
}

// ══════════════════════════════════════════════════════════════════
//  GESTION DES JEUX
// ══════════════════════════════════════════════════════════════════

export async function listGamesAdmin(params: { search?: string; page: number; limit: number }) {
  const where: Prisma.GameWhereInput = {};
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { slug: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [total, games] = await Promise.all([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: { category: { select: { slug: true, name: true, emoji: true } } },
    }),
  ]);

  return { games, total, page: params.page, pages: Math.max(1, Math.ceil(total / params.limit)) };
}

export interface GameInput {
  slug: string;
  title: string;
  description?: string;
  engine: string;
  categoryId: string;
  minAge: number;
  maxAge?: number | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  emoji: string;
  color: string;
  config?: Record<string, unknown>;
  maxScoreHint?: number;
  isPublished?: boolean;
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError("Catégorie introuvable.");
}

export async function createGame(adminId: string, input: GameInput) {
  await assertCategoryExists(input.categoryId);

  const existing = await prisma.game.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ConflictError("CONFLICT", "Un jeu utilise déjà ce slug.");

  const game = await prisma.game.create({
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description ?? "",
      engine: input.engine,
      categoryId: input.categoryId,
      minAge: input.minAge,
      maxAge: input.maxAge ?? null,
      difficulty: input.difficulty,
      emoji: input.emoji,
      color: input.color,
      config: (input.config ?? {}) as never,
      maxScoreHint: input.maxScoreHint ?? 1000,
      isPublished: input.isPublished ?? false,
    },
  });

  await logSecurityEvent({
    type: "ADMIN_ACTION",
    userId: adminId,
    detail: { action: "game_create", gameId: game.id, slug: game.slug },
  });
  return game;
}

export async function updateGame(adminId: string, gameId: string, input: Partial<GameInput>) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new NotFoundError("Jeu introuvable.");
  if (input.categoryId) await assertCategoryExists(input.categoryId);

  const data: Prisma.GameUpdateInput = {};
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.engine !== undefined) data.engine = input.engine;
  if (input.categoryId !== undefined) data.category = { connect: { id: input.categoryId } };
  if (input.minAge !== undefined) data.minAge = input.minAge;
  if (input.maxAge !== undefined) data.maxAge = input.maxAge;
  if (input.difficulty !== undefined) data.difficulty = input.difficulty;
  if (input.emoji !== undefined) data.emoji = input.emoji;
  if (input.color !== undefined) data.color = input.color;
  if (input.config !== undefined) data.config = input.config as never;
  if (input.maxScoreHint !== undefined) data.maxScoreHint = input.maxScoreHint;
  if (input.isPublished !== undefined) data.isPublished = input.isPublished;

  const updated = await prisma.game.update({ where: { id: gameId }, data });

  await logSecurityEvent({
    type: "ADMIN_ACTION",
    userId: adminId,
    detail: { action: "game_update", gameId, fields: Object.keys(data) },
  });
  return updated;
}

export async function deleteGame(adminId: string, gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new NotFoundError("Jeu introuvable.");

  // Suppression en cascade : scores, sessions, progression, favoris.
  await prisma.game.delete({ where: { id: gameId } });

  await logSecurityEvent({
    type: "ADMIN_ACTION",
    userId: adminId,
    detail: { action: "game_delete", slug: game.slug },
  });
}

// ══════════════════════════════════════════════════════════════════
//  GESTION DES CATÉGORIES
// ══════════════════════════════════════════════════════════════════

export async function listCategoriesAdmin() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { games: true } } },
  });
}

export interface CategoryInput {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createCategory(adminId: string, input: CategoryInput) {
  const existing = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ConflictError("CONFLICT", "Ce slug de catégorie existe déjà.");

  const category = await prisma.category.create({ data: input });
  await logSecurityEvent({
    type: "ADMIN_ACTION",
    userId: adminId,
    detail: { action: "category_create", slug: input.slug },
  });
  return category;
}

export async function updateCategory(adminId: string, categoryId: string, input: Partial<CategoryInput>) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError("Catégorie introuvable.");

  const updated = await prisma.category.update({ where: { id: categoryId }, data: input });
  await logSecurityEvent({
    type: "ADMIN_ACTION",
    userId: adminId,
    detail: { action: "category_update", categoryId },
  });
  return updated;
}

export async function deleteCategory(adminId: string, categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { games: true } } },
  });
  if (!category) throw new NotFoundError("Catégorie introuvable.");
  if (category._count.games > 0) {
    throw new ConflictError(
      "CONFLICT",
      "Impossible de supprimer : des jeux utilisent cette catégorie.",
    );
  }

  await prisma.category.delete({ where: { id: categoryId } });
  await logSecurityEvent({
    type: "ADMIN_ACTION",
    userId: adminId,
    detail: { action: "category_delete", slug: category.slug },
  });
}

// ══════════════════════════════════════════════════════════════════
//  LOGS DE SÉCURITÉ
// ══════════════════════════════════════════════════════════════════

export async function listSecurityLogs(limit: number) {
  const logs = await prisma.securityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { displayName: true, role: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    type: l.type,
    createdAt: l.createdAt.toISOString(),
    user: l.user ? { displayName: l.user.displayName, role: l.user.role } : null,
    ipHash: l.ipHash ? `${l.ipHash.slice(0, 8)}…` : null,
    detail: l.detail,
  }));
}
