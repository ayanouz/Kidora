// ══════════════════════════════════════════════════════════════════
//  KIDORA — Sérialiseurs : forme PUBLIQUE des entités
//  Règle : on n'expose JAMAIS passwordHash, tokenHash, email des
//  enfants, ni aucune donnée sensible via l'API.
// ══════════════════════════════════════════════════════════════════

import type {
  Achievement,
  Category,
  Game,
  Profile,
  Progress,
  Score,
  User,
  UserAchievement,
} from "@prisma/client";
import { xpProgress, type XpProgress } from "./xp";
import { tierLabel } from "./age";

export interface PublicProfile {
  id: string;
  displayName: string;
  avatar: string;
  ageTier: string;
  ageLabel: string;
  xp: number;
  level: number;
  points: number;
  progress: XpProgress;
  leaderboardOptIn: boolean;
  isDefault: boolean;
  hasPin: boolean;
  isActive: boolean;
}

export function toPublicProfile(profile: Profile): PublicProfile {
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatar: profile.avatar,
    ageTier: profile.ageTier,
    ageLabel: tierLabel(profile.ageTier),
    xp: profile.xp,
    level: profile.level,
    points: profile.points,
    progress: xpProgress(profile.xp),
    leaderboardOptIn: profile.leaderboardOptIn,
    isDefault: profile.isDefault,
    hasPin: profile.pinHash !== null,
    isActive: profile.isActive,
  };
}

export interface PublicUser {
  id: string;
  email: string | null;
  role: string;
  displayName: string;
  avatar: string;
  ageTier: string | null;
  level: number;
  xp: number;
  points: number;
  leaderboardOptIn: boolean;
  activeProfileId: string | null;
  createdAt: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    avatar: user.avatar,
    ageTier: user.ageTier,
    level: user.level,
    xp: user.xp,
    points: user.points,
    leaderboardOptIn: user.leaderboardOptIn,
    activeProfileId: user.activeProfileId,
    createdAt: user.createdAt.toISOString(),
  };
}

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  gameCount: number;
}

export function toPublicCategory(
  category: Category & { _count?: { games: number } },
): PublicCategory {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    emoji: category.emoji,
    color: category.color,
    gameCount: category._count?.games ?? 0,
  };
}

export interface PublicGame {
  id: string;
  slug: string;
  title: string;
  description: string;
  engine: string;
  emoji: string;
  color: string;
  minAge: number;
  maxAge: number | null;
  difficulty: string;
  maxScoreHint: number;
  playCount: number;
  premium: boolean;
  config: unknown;
  category: { slug: string; name: string; emoji: string; color: string };
  createdAt: string;
}

export type GameWithCategory = Game & {
  category: Pick<Category, "slug" | "name" | "emoji" | "color">;
};

export function toPublicGame(game: GameWithCategory): PublicGame {
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    description: game.description,
    engine: game.engine,
    emoji: game.emoji,
    color: game.color,
    minAge: game.minAge,
    maxAge: game.maxAge,
    difficulty: game.difficulty,
    maxScoreHint: game.maxScoreHint,
    playCount: game.playCount,
    premium: game.premium,
    config: game.config,
    category: {
      slug: game.category.slug,
      name: game.category.name,
      emoji: game.category.emoji,
      color: game.category.color,
    },
    createdAt: game.createdAt.toISOString(),
  };
}

export function toPublicScore(score: Score & { game?: { slug: string; title: string; emoji: string } }) {
  return {
    id: score.id,
    score: score.score,
    durationMs: score.durationMs,
    difficulty: score.difficulty,
    isWin: score.isWin,
    stars: score.stars,
    createdAt: score.createdAt.toISOString(),
    game: score.game
      ? { slug: score.game.slug, title: score.game.title, emoji: score.game.emoji }
      : undefined,
  };
}

export function toPublicProgress(
  progress: Progress & { game?: GameWithCategory },
) {
  return {
    gameId: progress.gameId,
    level: progress.level,
    bestScore: progress.bestScore,
    plays: progress.plays,
    wins: progress.wins,
    totalTimeMs: progress.totalTimeMs,
    lastPlayedAt: progress.lastPlayedAt?.toISOString() ?? null,
    game: progress.game ? toPublicGame(progress.game) : undefined,
  };
}

export type AchievementWithUnlock = Achievement & { unlocked: boolean; unlockedAt: string | null };

export function toPublicAchievement(a: AchievementWithUnlock) {
  return {
    id: a.id,
    code: a.code,
    title: a.title,
    description: a.description,
    icon: a.icon,
    category: a.category,
    xpReward: a.xpReward,
    unlocked: a.unlocked,
    unlockedAt: a.unlockedAt,
  };
}

export function toPublicUserAchievement(ua: UserAchievement & { achievement: Achievement }) {
  return {
    id: ua.id,
    unlockedAt: ua.unlockedAt.toISOString(),
    gameId: ua.gameId,
    achievement: {
      code: ua.achievement.code,
      title: ua.achievement.title,
      description: ua.achievement.description,
      icon: ua.achievement.icon,
      category: ua.achievement.category,
      xpReward: ua.achievement.xpReward,
    },
  };
}
