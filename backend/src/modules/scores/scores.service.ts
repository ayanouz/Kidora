// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Scores (lecture seule — l'écriture passe
//  exclusivement par sessions/finish, validée anti-cheat)
// ══════════════════════════════════════════════════════════════════

import { prisma } from "../../lib/prisma";
import { getActiveProfile } from "../profiles/profiles.service";

export async function listRecentScores(
  authUserId: string,
  options: { gameId?: string; limit: number; offset: number },
) {
  const profile = await getActiveProfile(authUserId);

  const [total, scores] = await Promise.all([
    prisma.score.count({
      where: { profileId: profile.id, ...(options.gameId ? { gameId: options.gameId } : {}) },
    }),
    prisma.score.findMany({
      where: { profileId: profile.id, ...(options.gameId ? { gameId: options.gameId } : {}) },
      orderBy: { createdAt: "desc" },
      skip: options.offset,
      take: options.limit,
      include: { game: { select: { slug: true, title: true, emoji: true, color: true } } },
    }),
  ]);

  return {
    total,
    scores: scores.map((s) => ({
      id: s.id,
      score: s.score,
      durationMs: s.durationMs,
      difficulty: s.difficulty,
      isWin: s.isWin,
      stars: s.stars,
      createdAt: s.createdAt.toISOString(),
      game: {
        slug: s.game.slug,
        title: s.game.title,
        emoji: s.game.emoji,
        color: s.game.color,
      },
    })),
  };
}

/** Meilleur score du profil actif pour chaque jeu déjà joué. */
export async function listBestScores(authUserId: string, limit = 12) {
  const profile = await getActiveProfile(authUserId);

  const rows = await prisma.progress.findMany({
    where: { profileId: profile.id, plays: { gt: 0 } },
    orderBy: { bestScore: "desc" },
    take: limit,
    include: {
      game: {
        select: {
          slug: true,
          title: true,
          emoji: true,
          color: true,
          maxScoreHint: true,
          category: { select: { slug: true, name: true } },
        },
      },
    },
  });

  return rows.map((p) => ({
    gameId: p.gameId,
    bestScore: p.bestScore,
    plays: p.plays,
    wins: p.wins,
    level: p.level,
    lastPlayedAt: p.lastPlayedAt?.toISOString() ?? null,
    game: {
      slug: p.game.slug,
      title: p.game.title,
      emoji: p.game.emoji,
      color: p.game.color,
      maxScoreHint: p.game.maxScoreHint,
      category: p.game.category,
    },
  }));
}
