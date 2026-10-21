// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Espace Parent (§25)
//  Le parent consulte la progression de SES enfants uniquement.
//  Aucune donnée sensible d'un autre compte n'est accessible.
// ══════════════════════════════════════════════════════════════════

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { xpProgress } from "../../lib/xp";
import { toPublicProfile } from "../../lib/serializers";
import { computeSkillStats } from "../../services/gamification.service";
import { assertProfileAccess } from "../profiles/profiles.service";

// ── Fenêtres de temps ─────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfWeek(): Date {
  const d = startOfToday();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}
function startOfMonth(): Date {
  const d = startOfToday();
  d.setDate(1);
  return d;
}

async function playtimeFor(profileIds: string[]): Promise<Map<string, { today: number; week: number; month: number; all: number }>> {
  const [all, today, week, month] = await Promise.all([
    prisma.gameSession.groupBy({
      by: ["profileId"],
      where: { profileId: { in: profileIds }, status: "FINISHED" },
      _sum: { durationMs: true },
    }),
    prisma.gameSession.groupBy({
      by: ["profileId"],
      where: { profileId: { in: profileIds }, status: "FINISHED", finishedAt: { gte: startOfToday() } },
      _sum: { durationMs: true },
    }),
    prisma.gameSession.groupBy({
      by: ["profileId"],
      where: { profileId: { in: profileIds }, status: "FINISHED", finishedAt: { gte: startOfWeek() } },
      _sum: { durationMs: true },
    }),
    prisma.gameSession.groupBy({
      by: ["profileId"],
      where: { profileId: { in: profileIds }, status: "FINISHED", finishedAt: { gte: startOfMonth() } },
      _sum: { durationMs: true },
    }),
  ]);

  const map = new Map<string, { today: number; week: number; month: number; all: number }>();
  const ensure = (id: string) =>
    map.get(id) ?? (map.set(id, { today: 0, week: 0, month: 0, all: 0 }), map.get(id)!);

  for (const row of all) ensure(row.profileId).all = row._sum.durationMs ?? 0;
  for (const row of today) ensure(row.profileId).today = row._sum.durationMs ?? 0;
  for (const row of week) ensure(row.profileId).week = row._sum.durationMs ?? 0;
  for (const row of month) ensure(row.profileId).month = row._sum.durationMs ?? 0;
  return map;
}

// ── Liste des enfants + résumé ────────────────────────────────────

export async function listChildren(authUserId: string) {
  const profiles = await prisma.profile.findMany({
    where: {
      isActive: true,
      OR: [{ userId: authUserId }, { guardianLinks: { some: { parentId: authUserId } } }],
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  if (profiles.length === 0) return { children: [] };

  const ids = profiles.map((p) => p.id);

  const [sessions, wins, playtime, achievements] = await Promise.all([
    prisma.gameSession.groupBy({
      by: ["profileId"],
      where: { profileId: { in: ids }, status: "FINISHED" },
      _count: { _all: true },
      _max: { finishedAt: true },
    }),
    prisma.gameSession.groupBy({
      by: ["profileId"],
      where: { profileId: { in: ids }, status: "FINISHED", isWin: true },
      _count: { _all: true },
    }),
    playtimeFor(ids),
    prisma.userAchievement.groupBy({
      by: ["profileId"],
      where: { profileId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const sessionsMap = new Map(sessions.map((s) => [s.profileId, s]));
  const winsMap = new Map(wins.map((w) => [w.profileId, w._count._all]));
  const achMap = new Map(achievements.map((a) => [a.profileId, a._count._all]));

  return {
    children: profiles.map((p) => {
      const s = sessionsMap.get(p.id);
      const played = s?._count._all ?? 0;
      const w = winsMap.get(p.id) ?? 0;
      return {
        profile: { ...toPublicProfile(p), progress: xpProgress(p.xp) },
        stats: {
          sessionsFinished: played,
          wins: w,
          winRate: played > 0 ? Math.round((w / played) * 100) : 0,
          achievements: achMap.get(p.id) ?? 0,
          lastPlayedAt: s?._max.finishedAt?.toISOString() ?? null,
          playtime: playtime.get(p.id) ?? { today: 0, week: 0, month: 0, all: 0 },
        },
      };
    }),
  };
}

// ── Dashboard détaillé d'un enfant ────────────────────────────────

export async function getChildDashboard(authUserId: string, profileId: string) {
  // Anti-IDOR : le parent doit être propriétaire ou tuteur du profil.
  const profile = await assertProfileAccess(profileId, authUserId);
  if (profile.userId !== authUserId) {
    const link = await prisma.parentChild.findUnique({
      where: { parentId_profileId: { parentId: authUserId, profileId } },
    });
    if (!link) throw new NotFoundError("Profil introuvable.");
  }

  const [skills, progresses, recentSessions, unlocked, playtime] = await Promise.all([
    computeSkillStats(profileId),
    prisma.progress.findMany({
      where: { profileId, plays: { gt: 0 } },
      include: {
        game: {
          select: { slug: true, title: true, emoji: true, color: true, category: { select: { name: true, slug: true } } },
        },
      },
      orderBy: { plays: "desc" },
    }),
    prisma.gameSession.findMany({
      where: { profileId, status: "FINISHED" },
      orderBy: { finishedAt: "desc" },
      take: 10,
      include: { game: { select: { slug: true, title: true, emoji: true } } },
    }),
    prisma.userAchievement.findMany({
      where: { profileId },
      orderBy: { unlockedAt: "desc" },
      take: 5,
      include: { achievement: { select: { title: true, icon: true, xpReward: true } } },
    }),
    playtimeFor([profileId]),
  ]);

  // Moyenne de score par jeu (pour la page Activité)
  const gameIds = progresses.map((p) => p.gameId);
  const avgByGame = new Map<string, number>();
  if (gameIds.length > 0) {
    const avgs = await prisma.score.groupBy({
      by: ["gameId"],
      where: { profileId, gameId: { in: gameIds } },
      _avg: { score: true },
    });
    for (const a of avgs) avgByGame.set(a.gameId, Math.round(a._avg.score ?? 0));
  }

  const activity = progresses.map((p) => ({
    game: {
      slug: p.game.slug,
      title: p.game.title,
      emoji: p.game.emoji,
      color: p.game.color,
      category: p.game.category.name,
    },
    plays: p.plays,
    wins: p.wins,
    winRate: p.plays > 0 ? Math.round((p.wins / p.plays) * 100) : 0,
    bestScore: p.bestScore,
    avgScore: avgByGame.get(p.gameId) ?? 0,
    lastPlayedAt: p.lastPlayedAt?.toISOString() ?? null,
  }));

  return {
    profile: { ...toPublicProfile(profile), progress: xpProgress(profile.xp) },
    playtime: playtime.get(profileId) ?? { today: 0, week: 0, month: 0, all: 0 },
    skills,
    activity,
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      score: s.score ?? 0,
      isWin: s.isWin ?? false,
      stars: s.stars ?? 0,
      durationMs: s.durationMs ?? 0,
      finishedAt: s.finishedAt?.toISOString() ?? null,
      game: s.game,
    })),
    achievements: unlocked.map((u) => ({
      unlockedAt: u.unlockedAt.toISOString(),
      title: u.achievement.title,
      icon: u.achievement.icon,
      xpReward: u.achievement.xpReward,
    })),
  };
}
