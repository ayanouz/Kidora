// ══════════════════════════════════════════════════════════════════
//  KIDORA — Gamification : application d'un résultat VALIDÉ
//
//  Après validation anti-cheat, ce service :
//   1. enregistre score + session + progression (transaction)
//   2. calcule et attribue XP / points / niveau (formules serveur)
//   3. évalue et débloque les achievements
//
//  Règle : TOUT est calculé côté serveur. Le client n'envoie qu'un
//  score brut de partie, jamais de points ni d'XP.
// ══════════════════════════════════════════════════════════════════

import { prisma } from "../lib/prisma";
import { computeSessionXp, levelFromXp, starsFromScore } from "../lib/xp";
import {
  evaluateAchievements,
  type AchievementDef,
  type PlayerStats,
} from "./achievements-evaluator";

export interface ApplyResultInput {
  sessionId: string;
  profileId: string;
  gameId: string;
  /** Propriétaire du profil (pour les agrégats utilisateur). */
  userId: string;
  difficulty: string;
  score: number;
  durationMs: number;
  isWin: boolean;
  levelReached: number;
  categorySlug: string;
  /** Plafond de score du jeu/difficulté (calcul des étoiles). */
  maxScoreForStars: number;
  levelBefore: number;
}

export interface UnlockedAchievementDto {
  code: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface ApplyResultOutput {
  stars: number;
  xpGain: number;
  bestScore: number;
  isNewBest: boolean;
  levelUp: boolean;
  profile: { xp: number; level: number; points: number };
  unlockedAchievements: UnlockedAchievementDto[];
  /** XP bonus gagné via les achievements débloqués. */
  achievementXp: number;
}

interface MinimalLogger {
  warn: (msg: string) => void;
}

export async function applyValidatedResult(
  input: ApplyResultInput,
  log: MinimalLogger,
): Promise<ApplyResultOutput> {
  const stars = starsFromScore(input.score, input.maxScoreForStars);
  const xpGain = computeSessionXp({
    score: input.score,
    isWin: input.isWin,
    difficulty: input.difficulty,
    durationMs: input.durationMs,
  });

  // ── 1. Persistance atomique : session + score + progression ────
  const result = await prisma.$transaction(async (tx) => {
    await tx.gameSession.update({
      where: { id: input.sessionId },
      data: {
        status: "FINISHED",
        finishedAt: new Date(),
        score: input.score,
        durationMs: input.durationMs,
        isWin: input.isWin,
        levelReached: input.levelReached,
        stars,
      },
    });

    await tx.score.create({
      data: {
        profileId: input.profileId,
        gameId: input.gameId,
        sessionId: input.sessionId,
        score: input.score,
        durationMs: input.durationMs,
        difficulty: input.difficulty as never,
        isWin: input.isWin,
        stars,
      },
    });

    const previous = await tx.progress.findUnique({
      where: { profileId_gameId: { profileId: input.profileId, gameId: input.gameId } },
    });
    const previousBest = previous?.bestScore ?? 0;
    const isNewBest = input.score > previousBest;
    const bestScore = Math.max(previousBest, input.score);

    await tx.progress.upsert({
      where: { profileId_gameId: { profileId: input.profileId, gameId: input.gameId } },
      update: {
        plays: { increment: 1 },
        wins: input.isWin ? { increment: 1 } : undefined,
        totalTimeMs: { increment: input.durationMs },
        bestScore,
        level: Math.max(previous?.level ?? 1, input.levelReached),
        lastPlayedAt: new Date(),
      },
      create: {
        profileId: input.profileId,
        gameId: input.gameId,
        level: Math.max(1, input.levelReached),
        bestScore,
        plays: 1,
        wins: input.isWin ? 1 : 0,
        totalTimeMs: input.durationMs,
        lastPlayedAt: new Date(),
      },
    });

    // XP / points / niveau — profil puis agrégat utilisateur
    const profile = await tx.profile.findUniqueOrThrow({ where: { id: input.profileId } });
    const newXp = profile.xp + xpGain;
    const newLevel = levelFromXp(newXp);

    const updatedProfile = await tx.profile.update({
      where: { id: input.profileId },
      data: {
        xp: newXp,
        level: newLevel,
        points: { increment: input.score },
      },
    });

    await tx.user.update({
      where: { id: input.userId },
      data: {
        xp: { increment: xpGain },
        points: { increment: input.score },
      },
    });

    await tx.game.update({
      where: { id: input.gameId },
      data: { playCount: { increment: 1 } },
    });

    return {
      stars,
      xpGain,
      bestScore,
      isNewBest,
      levelUp: newLevel > input.levelBefore,
      profile: {
        xp: updatedProfile.xp,
        level: updatedProfile.level,
        points: updatedProfile.points,
      },
    };
  });

  // ── 2. Achievements (hors transaction principale, best-effort) ─
  let unlockedAchievements: UnlockedAchievementDto[] = [];
  let achievementXp = 0;

  try {
    const unlocked = await evaluateAndUnlockAchievements(
      {
        profileId: input.profileId,
        userId: input.userId,
        gameId: input.gameId,
        categorySlug: input.categorySlug,
        isWin: input.isWin,
        durationMs: input.durationMs,
        stars,
        score: input.score,
        difficulty: input.difficulty,
      },
      log,
    );
    unlockedAchievements = unlocked.achievements;
    achievementXp = unlocked.xp;

    if (unlockedAchievements.length > 0) {
      const refreshed = await prisma.profile.findUniqueOrThrow({
        where: { id: input.profileId },
      });
      result.profile = {
        xp: refreshed.xp,
        level: refreshed.level,
        points: refreshed.points,
      };
    }
  } catch (err) {
    log.warn(`[achievements] échec d'évaluation : ${(err as Error).message}`);
  }

  return { ...result, unlockedAchievements, achievementXp };
}

// ══════════════════════════════════════════════════════════════════
//  Évaluation des achievements
// ══════════════════════════════════════════════════════════════════

interface EvaluateInput {
  profileId: string;
  userId: string;
  gameId: string;
  categorySlug: string;
  isWin: boolean;
  durationMs: number;
  stars: number;
  score: number;
  difficulty: string;
}

async function evaluateAndUnlockAchievements(
  input: EvaluateInput,
  log: MinimalLogger,
): Promise<{ achievements: UnlockedAchievementDto[]; xp: number }> {
  // Définitions pas encore débloquées par ce profil
  const allDefs = await prisma.achievement.findMany({ orderBy: { sortOrder: "asc" } });
  const already = await prisma.userAchievement.findMany({
    where: { profileId: input.profileId },
    select: { achievementId: true },
  });
  const alreadyIds = new Set(already.map((a) => a.achievementId));
  const pending = allDefs.filter((d) => !alreadyIds.has(d.id));
  if (pending.length === 0) return { achievements: [], xp: 0 };

  // ── Statistiques du joueur (partie courante incluse) ───────────
  const [gamesFinished, profile, progresses, lastSessions, threeStarGroups] =
    await Promise.all([
      prisma.gameSession.count({
        where: { profileId: input.profileId, status: "FINISHED" },
      }),
      prisma.profile.findUniqueOrThrow({ where: { id: input.profileId } }),
      prisma.progress.findMany({
        where: { profileId: input.profileId, plays: { gt: 0 } },
        include: { game: { include: { category: true } } },
      }),
      prisma.gameSession.findMany({
        where: { profileId: input.profileId, status: "FINISHED" },
        orderBy: { finishedAt: "desc" },
        take: 20,
        select: { isWin: true, gameId: true },
      }),
      prisma.score.groupBy({
        by: ["gameId"],
        where: { profileId: input.profileId, stars: 3 },
      }),
    ]);

  // Série de victoires consécutives (la partie courante est la plus récente)
  let streak = 0;
  for (const s of lastSessions) {
    if (s.isWin) streak++;
    else break;
  }
  const currentWinStreak = input.isWin && streak === 0 ? 1 : streak;

  const winsByCategory: Record<string, number> = {};
  for (const p of progresses) {
    const slug = p.game.category.slug;
    winsByCategory[slug] = (winsByCategory[slug] ?? 0) + p.wins;
  }

  const stats: PlayerStats = {
    gamesFinished,
    totalPoints: profile.points,
    currentWinStreak,
    winsByCategory,
    distinctGames: progresses.length,
    threeStarGames: threeStarGroups.length,
  };

  const defs: AchievementDef[] = pending.map((d) => ({
    id: d.id,
    code: d.code,
    criteria: (d.criteria ?? {}) as AchievementDef["criteria"],
  }));

  const codes = evaluateAchievements(defs, stats, {
    isWin: input.isWin,
    durationMs: input.durationMs,
    stars: input.stars,
    score: input.score,
    difficulty: input.difficulty.toLowerCase() as "easy" | "medium" | "hard",
    categorySlug: input.categorySlug,
    gameId: input.gameId,
  });

  if (codes.length === 0) return { achievements: [], xp: 0 };

  const newly = allDefs.filter((d) => codes.includes(d.code));
  let totalXp = 0;
  const dtos: UnlockedAchievementDto[] = [];

  for (const def of newly) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.userAchievement.create({
          data: {
            profileId: input.profileId,
            achievementId: def.id,
            gameId: input.gameId,
          },
        });
        await tx.profile.update({
          where: { id: input.profileId },
          data: { xp: { increment: def.xpReward } },
        });
        await tx.user.update({
          where: { id: input.userId },
          data: { xp: { increment: def.xpReward } },
        });
      });
      totalXp += def.xpReward;
      dtos.push({
        code: def.code,
        title: def.title,
        description: def.description,
        icon: def.icon,
        xpReward: def.xpReward,
      });
    } catch (err) {
      // Contrainte unique (double unlock concurrent) → on ignore proprement
      log.warn(`[achievement:${def.code}] ${(err as Error).message}`);
    }
  }

  return { achievements: dtos, xp: totalXp };
}

// ══════════════════════════════════════════════════════════════════
//  Agrégats pour le dashboard parent (§25)
// ══════════════════════════════════════════════════════════════════

export interface SkillStats {
  category: string;
  emoji: string;
  color: string;
  played: number;
  wins: number;
  winRate: number;
  bestScore: number;
  totalTimeMs: number;
}

export async function computeSkillStats(profileId: string): Promise<SkillStats[]> {
  const rows = await prisma.progress.findMany({
    where: { profileId, plays: { gt: 0 } },
    include: { game: { include: { category: true } } },
  });

  const byCategory = new Map<string, SkillStats>();
  for (const row of rows) {
    const c = row.game.category;
    const entry =
      byCategory.get(c.slug) ??
      {
        category: c.name,
        emoji: c.emoji,
        color: c.color,
        played: 0,
        wins: 0,
        winRate: 0,
        bestScore: 0,
        totalTimeMs: 0,
      };
    entry.played += row.plays;
    entry.wins += row.wins;
    entry.bestScore = Math.max(entry.bestScore, row.bestScore);
    entry.totalTimeMs += row.totalTimeMs;
    byCategory.set(c.slug, entry);
  }

  return [...byCategory.values()]
    .map((e) => ({ ...e, winRate: e.played > 0 ? Math.round((e.wins / e.played) * 100) : 0 }))
    .sort((a, b) => b.played - a.played);
}
