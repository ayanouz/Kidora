// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Classement (§38)
//
//  PRIVACY-FIRST : uniquement des pseudonymes (display_name) et des
//  avatars emoji. Jamais d'email, jamais de nom réel, jamais d'âge.
//  Les profils non opt-in (leaderboardOptIn=false) sont exclus.
// ══════════════════════════════════════════════════════════════════

import { prisma } from "../../lib/prisma";
import { getActiveProfile } from "../profiles/profiles.service";

export type LeaderboardPeriod = "day" | "week" | "month" | "all";

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avatar: string;
  level: number;
  points: number;
  isMe?: boolean;
}

function periodStart(period: LeaderboardPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "day": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "week": {
      const d = new Date(now);
      const day = (d.getDay() + 6) % 7; // lundi = 0
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "month": {
      const d = new Date(now);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "all":
    default:
      return null;
  }
}

export async function getLeaderboard(
  period: LeaderboardPeriod,
  limit: number,
  authUserId?: string,
): Promise<{ period: LeaderboardPeriod; entries: LeaderboardEntry[]; me: LeaderboardEntry | null }> {
  const start = periodStart(period);

  let entries: LeaderboardEntry[] = [];

  if (start === null) {
    // ── Général : total de points cumulés du profil ────────────────
    const profiles = await prisma.profile.findMany({
      where: { leaderboardOptIn: true, isActive: true, points: { gt: 0 } },
      orderBy: [{ points: "desc" }, { updatedAt: "asc" }],
      take: limit,
      select: { id: true, displayName: true, avatar: true, level: true, points: true },
    });
    entries = profiles.map((p, i) => ({
      rank: i + 1,
      displayName: p.displayName,
      avatar: p.avatar,
      level: p.level,
      points: p.points,
    }));
  } else {
    // ── Périodes : somme des scores validés dans la fenêtre ────────
    const grouped = await prisma.score.groupBy({
      by: ["profileId"],
      where: {
        createdAt: { gte: start },
        profile: { leaderboardOptIn: true, isActive: true },
      },
      _sum: { score: true },
      orderBy: { _sum: { score: "desc" } },
      take: limit,
    });

    const profileIds = grouped.map((g) => g.profileId);
    const profiles = await prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, displayName: true, avatar: true, level: true },
    });
    const byId = new Map(profiles.map((p) => [p.id, p]));

    entries = grouped.map((g, i) => {
      const p = byId.get(g.profileId);
      return {
        rank: i + 1,
        displayName: p?.displayName ?? "Joueur",
        avatar: p?.avatar ?? "🐼",
        level: p?.level ?? 1,
        points: g._sum.score ?? 0,
      };
    });
  }

  // ── Ma position (profil actif connecté) ─────────────────────────
  let me: LeaderboardEntry | null = null;
  if (authUserId) {
    try {
      const profile = await getActiveProfile(authUserId);
      if (!profile.leaderboardOptIn) {
        me = null;
      } else if (start === null) {
        const better = await prisma.profile.count({
          where: { leaderboardOptIn: true, isActive: true, points: { gt: profile.points } },
        });
        me = {
          rank: profile.points > 0 ? better + 1 : 0,
          displayName: profile.displayName,
          avatar: profile.avatar,
          level: profile.level,
          points: profile.points,
          isMe: true,
        };
      } else {
        const mySum = await prisma.score.aggregate({
          where: { profileId: profile.id, createdAt: { gte: start } },
          _sum: { score: true },
        });
        const myPoints = mySum._sum.score ?? 0;
        const betterGroups = await prisma.score.groupBy({
          by: ["profileId"],
          where: {
            createdAt: { gte: start },
            profile: { leaderboardOptIn: true, isActive: true },
          },
          _sum: { score: true },
          having: { score: { _sum: { gt: myPoints } } },
        });
        me = {
          rank: myPoints > 0 ? betterGroups.length + 1 : 0,
          displayName: profile.displayName,
          avatar: profile.avatar,
          level: profile.level,
          points: myPoints,
          isMe: true,
        };
      }

      // Marque l'entrée correspondante dans la liste
      for (const e of entries) {
        if (e.displayName === profile.displayName && e.avatar === profile.avatar) {
          e.isMe = true;
          break;
        }
      }
    } catch {
      me = null;
    }
  }

  return { period, entries, me };
}
