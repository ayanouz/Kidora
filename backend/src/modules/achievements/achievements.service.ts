// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Achievements (§21)
//  Les définitions sont publiques ; le déblocage est calculé
//  EXCLUSIVEMENT côté serveur (voir gamification.service).
// ══════════════════════════════════════════════════════════════════

import { prisma } from "../../lib/prisma";
import { getActiveProfile } from "../profiles/profiles.service";

export interface AchievementListItem {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  sortOrder: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export async function listAchievements(authUserId: string): Promise<{
  achievements: AchievementListItem[];
  summary: { unlocked: number; total: number; totalXpAvailable: number; xpEarned: number };
}> {
  const profile = await getActiveProfile(authUserId);

  const [definitions, unlocked] = await Promise.all([
    prisma.achievement.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.userAchievement.findMany({
      where: { profileId: profile.id },
      select: { achievementId: true, unlockedAt: true },
    }),
  ]);

  const unlockedMap = new Map(
    unlocked.map((u) => [u.achievementId, u.unlockedAt.toISOString()]),
  );

  const achievements: AchievementListItem[] = definitions.map((d) => ({
    id: d.id,
    code: d.code,
    title: d.title,
    description: d.description,
    icon: d.icon,
    category: d.category,
    xpReward: d.xpReward,
    sortOrder: d.sortOrder,
    unlocked: unlockedMap.has(d.id),
    unlockedAt: unlockedMap.get(d.id) ?? null,
  }));

  const xpEarned = definitions
    .filter((d) => unlockedMap.has(d.id))
    .reduce((acc, d) => acc + d.xpReward, 0);

  return {
    achievements,
    summary: {
      unlocked: unlockedMap.size,
      total: definitions.length,
      totalXpAvailable: definitions.reduce((acc, d) => acc + d.xpReward, 0),
      xpEarned,
    },
  };
}

/** Derniers achievements débloqués (profil actif). */
export async function listRecentUnlocks(authUserId: string, limit = 5) {
  const profile = await getActiveProfile(authUserId);
  const rows = await prisma.userAchievement.findMany({
    where: { profileId: profile.id },
    orderBy: { unlockedAt: "desc" },
    take: limit,
    include: { achievement: true, game: { select: { slug: true, title: true, emoji: true } } },
  });
  return rows.map((r) => ({
    unlockedAt: r.unlockedAt.toISOString(),
    achievement: {
      code: r.achievement.code,
      title: r.achievement.title,
      description: r.achievement.description,
      icon: r.achievement.icon,
      xpReward: r.achievement.xpReward,
    },
    game: r.game,
  }));
}
