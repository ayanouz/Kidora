// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Catalogue de jeux
//  Recherche, filtres (catégorie, âge, difficulté), tris, pagination
//  + personnalisation (meilleur score, favoris, progression du profil)
// ══════════════════════════════════════════════════════════════════

import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError } from "../../lib/errors";
import { toPublicGame, type GameWithCategory, type PublicGame } from "../../lib/serializers";

export type GameSort = "popular" | "newest" | "score" | "name";

export interface ListGamesParams {
  search?: string;
  categorySlug?: string;
  age?: number;
  difficulty?: string;
  sort: GameSort;
  page: number;
  limit: number;
  favoritesOnly?: boolean;
  /** Profil actif (personnalisation) — optionnel. */
  profileId?: string;
}

export interface GameCard extends PublicGame {
  personal?: {
    bestScore: number;
    plays: number;
    level: number;
    stars: number;
    isFavorite: boolean;
    lastPlayedAt: string | null;
  };
}

export interface ListGamesResult {
  games: GameCard[];
  total: number;
  page: number;
  pages: number;
}

function buildOrderBy(sort: GameSort): Prisma.GameOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }];
    case "score":
      // Les plus actifs au scoring (nombre de scores enregistrés)
      return [{ scores: { _count: "desc" } }, { playCount: "desc" }];
    case "name":
      return [{ title: "asc" }];
    case "popular":
    default:
      return [{ playCount: "desc" }, { createdAt: "desc" }];
  }
}

export async function listGames(params: ListGamesParams): Promise<ListGamesResult> {
  const conditions: Prisma.GameWhereInput[] = [{ isPublished: true }];

  if (params.search) {
    conditions.push({
      OR: [
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ],
    });
  }
  if (params.categorySlug) {
    conditions.push({ category: { slug: params.categorySlug, isActive: true } });
  }
  if (params.age !== undefined) {
    conditions.push({ minAge: { lte: params.age } });
    conditions.push({ OR: [{ maxAge: null }, { maxAge: { gte: params.age } }] });
  }
  if (params.difficulty) {
    conditions.push({ difficulty: params.difficulty.toUpperCase() as never });
  }

  // Favoris : nécessite un profil (connecté)
  let favoriteGameIds: string[] | null = null;
  if (params.favoritesOnly) {
    if (!params.profileId) {
      throw new ForbiddenError("Connecte-toi pour voir tes favoris.");
    }
    const favorites = await prisma.favorite.findMany({
      where: { profileId: params.profileId },
      select: { gameId: true },
    });
    favoriteGameIds = favorites.map((f) => f.gameId);
    conditions.push({ id: { in: favoriteGameIds } });
  }

  const where: Prisma.GameWhereInput = { AND: conditions };

  const [total, rows] = await Promise.all([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      include: { category: true },
      orderBy: buildOrderBy(params.sort),
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
  ]);

  // ── Personnalisation (1 + 1 requête, jamais N+1) ────────────────
  let personalByGame = new Map<
    string,
    { bestScore: number; plays: number; level: number; lastPlayedAt: Date | null }
  >();
  let favoritesSet = new Set<string>();

  if (params.profileId && rows.length > 0) {
    const gameIds = rows.map((g) => g.id);
    const [progressRows, favoriteRows] = await Promise.all([
      prisma.progress.findMany({
        where: { profileId: params.profileId, gameId: { in: gameIds } },
      }),
      prisma.favorite.findMany({
        where: { profileId: params.profileId, gameId: { in: gameIds } },
        select: { gameId: true },
      }),
    ]);
    personalByGame = new Map(
      progressRows.map((p) => [
        p.gameId,
        { bestScore: p.bestScore, plays: p.plays, level: p.level, lastPlayedAt: p.lastPlayedAt },
      ]),
    );
    favoritesSet = new Set(favoriteRows.map((f) => f.gameId));
  }

  const games: GameCard[] = rows.map((g) => {
    const base = toPublicGame(g as GameWithCategory);
    if (!params.profileId) return base;
    const p = personalByGame.get(g.id);
    const maxScore = g.maxScoreHint;
    const stars = p?.bestScore ? starsFor(p.bestScore, maxScore) : 0;
    return {
      ...base,
      personal: {
        bestScore: p?.bestScore ?? 0,
        plays: p?.plays ?? 0,
        level: p?.level ?? 1,
        stars,
        isFavorite: favoritesSet.has(g.id),
        lastPlayedAt: p?.lastPlayedAt?.toISOString() ?? null,
      },
    };
  });

  return {
    games,
    total,
    page: params.page,
    pages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

function starsFor(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  const ratio = score / maxScore;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}

// ── Détail d'un jeu ────────────────────────────────────────────────

export interface GameDetailResult {
  game: GameCard;
  recentScores: { score: number; stars: number; isWin: boolean; createdAt: string }[];
  leaderboard: { rank: number; displayName: string; avatar: string; score: number }[];
}

export async function getGameBySlug(
  slug: string,
  profileId?: string,
  includeUnpublished = false,
): Promise<GameDetailResult> {
  const game = await prisma.game.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!game || (!game.isPublished && !includeUnpublished)) {
    throw new NotFoundError("Ce jeu n'existe pas (ou plus).");
  }

  const base = toPublicGame(game as GameWithCategory);

  // Top 5 des scores du jeu (pseudonymes uniquement, profils opt-in)
  const topScores = await prisma.score.findMany({
    where: { gameId: game.id, profile: { leaderboardOptIn: true } },
    orderBy: { score: "desc" },
    take: 5,
    include: {
      profile: { select: { displayName: true, avatar: true } },
    },
  });
  const leaderboard = topScores.map((s, i) => ({
    rank: i + 1,
    displayName: s.profile.displayName,
    avatar: s.profile.avatar,
    score: s.score,
  }));

  if (!profileId) {
    return { game: base, recentScores: [], leaderboard };
  }

  const [progress, favorite, recent] = await Promise.all([
    prisma.progress.findUnique({
      where: { profileId_gameId: { profileId, gameId: game.id } },
    }),
    prisma.favorite.findUnique({
      where: { profileId_gameId: { profileId, gameId: game.id } },
    }),
    prisma.score.findMany({
      where: { profileId, gameId: game.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { score: true, stars: true, isWin: true, createdAt: true },
    }),
  ]);

  const stars = progress?.bestScore ? starsFor(progress.bestScore, game.maxScoreHint) : 0;

  return {
    game: {
      ...base,
      personal: {
        bestScore: progress?.bestScore ?? 0,
        plays: progress?.plays ?? 0,
        level: progress?.level ?? 1,
        stars,
        isFavorite: favorite !== null,
        lastPlayedAt: progress?.lastPlayedAt?.toISOString() ?? null,
      },
    },
    recentScores: recent.map((s) => ({
      score: s.score,
      stars: s.stars,
      isWin: s.isWin,
      createdAt: s.createdAt.toISOString(),
    })),
    leaderboard,
  };
}

// ── Sitemap (§36) ──────────────────────────────────────────────────

export async function getSitemapEntries(): Promise<
  { loc: string; lastmod: string; changefreq: string; priority: string }[]
> {
  const [games, categories] = await Promise.all([
    prisma.game.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true },
    }),
  ]);

  const entries = [
    { loc: "/", lastmod: new Date().toISOString(), changefreq: "daily", priority: "1.0" },
    { loc: "/games", lastmod: new Date().toISOString(), changefreq: "daily", priority: "0.9" },
    { loc: "/categories", lastmod: new Date().toISOString(), changefreq: "weekly", priority: "0.8" },
    { loc: "/leaderboard", lastmod: new Date().toISOString(), changefreq: "daily", priority: "0.6" },
    { loc: "/about", lastmod: new Date().toISOString(), changefreq: "monthly", priority: "0.4" },
    { loc: "/help", lastmod: new Date().toISOString(), changefreq: "monthly", priority: "0.4" },
  ];

  for (const g of games) {
    entries.push({
      loc: `/games/${g.slug}`,
      lastmod: g.updatedAt.toISOString(),
      changefreq: "weekly",
      priority: "0.8",
    });
  }
  for (const c of categories) {
    entries.push({
      loc: `/category/${c.slug}`,
      lastmod: new Date().toISOString(),
      changefreq: "weekly",
      priority: "0.6",
    });
  }
  return entries;
}
