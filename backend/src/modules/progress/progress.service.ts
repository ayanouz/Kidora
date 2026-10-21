// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Progression (page profil & reprise §22/§40)
// ══════════════════════════════════════════════════════════════════

import { prisma } from "../../lib/prisma";
import { xpProgress } from "../../lib/xp";
import { getActiveProfile } from "../profiles/profiles.service";
import { computeSkillStats } from "../../services/gamification.service";
import { toPublicProfile } from "../../lib/serializers";

export async function getProgressOverview(authUserId: string) {
  const profile = await getActiveProfile(authUserId);

  const [progressRows, recentSessions, achievementsCount, totals] = await Promise.all([
    prisma.progress.findMany({
      where: { profileId: profile.id, plays: { gt: 0 } },
      orderBy: { lastPlayedAt: "desc" },
      include: {
        game: {
          select: {
            slug: true,
            title: true,
            emoji: true,
            color: true,
            maxScoreHint: true,
            category: { select: { slug: true, name: true, emoji: true, color: true } },
          },
        },
      },
    }),
    prisma.gameSession.findMany({
      where: { profileId: profile.id, status: "FINISHED" },
      orderBy: { finishedAt: "desc" },
      take: 10,
      include: {
        game: { select: { slug: true, title: true, emoji: true } },
      },
    }),
    prisma.userAchievement.count({ where: { profileId: profile.id } }),
    prisma.gameSession.aggregate({
      where: { profileId: profile.id, status: "FINISHED" },
      _count: { id: true },
      _sum: { durationMs: true },
      _avg: { durationMs: true },
    }),
  ]);

  const skills = await computeSkillStats(profile.id);

  const wins = progressRows.reduce((acc, p) => acc + p.wins, 0);
  const plays = progressRows.reduce((acc, p) => acc + p.plays, 0);

  return {
    profile: {
      ...toPublicProfile(profile),
      progress: xpProgress(profile.xp),
    },
    totals: {
      gamesPlayed: progressRows.length,
      sessionsFinished: totals._count.id,
      wins,
      plays,
      winRate: plays > 0 ? Math.round((wins / plays) * 100) : 0,
      totalTimeMs: totals._sum.durationMs ?? 0,
      avgDurationMs: Math.round(totals._avg.durationMs ?? 0),
      achievementsUnlocked: achievementsCount,
    },
    skills,
    /** Mes jeux récents (repris depuis progress, ordre chronologique) */
    recentGames: progressRows.slice(0, 6).map((p) => ({
      gameId: p.gameId,
      level: p.level,
      bestScore: p.bestScore,
      plays: p.plays,
      wins: p.wins,
      lastPlayedAt: p.lastPlayedAt?.toISOString() ?? null,
      game: p.game,
    })),
    /** Mes meilleurs scores */
    bestScores: [...progressRows]
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, 5)
      .map((p) => ({
        gameId: p.gameId,
        bestScore: p.bestScore,
        game: p.game,
      })),
    /** Historique de sessions */
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      score: s.score ?? 0,
      isWin: s.isWin ?? false,
      stars: s.stars ?? 0,
      durationMs: s.durationMs ?? 0,
      finishedAt: s.finishedAt?.toISOString() ?? null,
      game: s.game,
    })),
  };
}
