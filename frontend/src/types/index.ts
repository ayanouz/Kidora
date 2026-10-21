// ══════════════════════════════════════════════════════════════════
//  KIDORA — Types partagés (miroir exact des DTO de l'API)
//  Source de vérité côté backend : backend/src/lib/serializers.ts
// ══════════════════════════════════════════════════════════════════

import type { AgeTierValue, DifficultyKey } from "../config";

// ── Erreurs API ───────────────────────────────────────────────────

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[] | unknown;
  };
}

// ── Utilisateur & profils ─────────────────────────────────────────

export type UserRole = "PARENT" | "CHILD" | "ADMIN";

export interface XpProgressDto {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  percent: number;
}

export interface Profile {
  id: string;
  displayName: string;
  avatar: string;
  ageTier: AgeTierValue;
  ageLabel: string;
  xp: number;
  level: number;
  points: number;
  progress: XpProgressDto;
  leaderboardOptIn: boolean;
  isDefault: boolean;
  hasPin: boolean;
  isActive: boolean;
}

export interface User {
  id: string;
  email: string | null;
  role: UserRole;
  displayName: string;
  avatar: string;
  ageTier: AgeTierValue | null;
  level: number;
  xp: number;
  points: number;
  leaderboardOptIn: boolean;
  activeProfileId: string | null;
  createdAt: string;
}

export interface MeResponse {
  user: User;
  profiles: Profile[];
}

// ── Jeux & catégories ─────────────────────────────────────────────

export interface Category {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  gameCount: number;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  description: string;
  engine: string;
  emoji: string;
  color: string;
  minAge: number;
  maxAge: number | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  maxScoreHint: number;
  playCount: number;
  premium: boolean;
  config: GameConfig;
  category: { slug: string; name: string; emoji: string; color: string };
  createdAt: string;
}

export interface GameConfig {
  levels?: number;
  settings?: Record<string, unknown>;
  minDurationMs?: Partial<Record<DifficultyKey, number>>;
  maxScore?: Partial<Record<DifficultyKey, number>>;
}

export interface PersonalGameStats {
  bestScore: number;
  plays: number;
  level: number;
  stars: number;
  isFavorite: boolean;
  lastPlayedAt: string | null;
}

export interface GameCardData extends Game {
  personal?: PersonalGameStats;
}

export interface GamesListResponse {
  games: GameCardData[];
  total: number;
  page: number;
  pages: number;
}

export interface GameDetailResponse {
  game: GameCardData;
  recentScores: { score: number; stars: number; isWin: boolean; createdAt: string }[];
  leaderboard: { rank: number; displayName: string; avatar: string; score: number }[];
}

// ── Scores & progression ──────────────────────────────────────────

export interface ScoreEntry {
  id: string;
  score: number;
  durationMs: number;
  difficulty: string;
  isWin: boolean;
  stars: number;
  createdAt: string;
  game: { slug: string; title: string; emoji: string; color?: string };
}

export interface SkillStat {
  category: string;
  emoji: string;
  color: string;
  played: number;
  wins: number;
  winRate: number;
  bestScore: number;
  totalTimeMs: number;
}

export interface ProgressOverview {
  profile: Profile;
  totals: {
    gamesPlayed: number;
    sessionsFinished: number;
    wins: number;
    plays: number;
    winRate: number;
    totalTimeMs: number;
    avgDurationMs: number;
    achievementsUnlocked: number;
  };
  skills: SkillStat[];
  recentGames: {
    gameId: string;
    level: number;
    bestScore: number;
    plays: number;
    wins: number;
    lastPlayedAt: string | null;
    game: {
      slug: string;
      title: string;
      emoji: string;
      color: string;
      maxScoreHint: number;
      category: { slug: string; name: string; emoji: string; color: string };
    };
  }[];
  bestScores: {
    gameId: string;
    bestScore: number;
    game: { slug: string; title: string; emoji: string; color: string; maxScoreHint: number };
  }[];
  recentSessions: {
    id: string;
    score: number;
    isWin: boolean;
    stars: number;
    durationMs: number;
    finishedAt: string | null;
    game: { slug: string; title: string; emoji: string };
  }[];
}

// ── Sessions de jeu ───────────────────────────────────────────────

export interface StartSessionResponse {
  sessionId: string;
  startedAt: string;
  serverTimeMs: number;
  game: { slug: string; title: string; config: GameConfig; maxScoreHint: number };
  profile: { id: string; displayName: string; level: number; xp: number };
}

export interface UnlockedAchievement {
  code: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface FinishSessionResponse {
  accepted: true;
  stars: number;
  xpGain: number;
  bestScore: number;
  isNewBest: boolean;
  levelUp: boolean;
  profile: { xp: number; level: number; points: number };
  unlockedAchievements: UnlockedAchievement[];
  achievementXp: number;
}

// ── Achievements ──────────────────────────────────────────────────

export interface Achievement {
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

export interface AchievementsResponse {
  achievements: Achievement[];
  summary: { unlocked: number; total: number; totalXpAvailable: number; xpEarned: number };
}

// ── Favoris ───────────────────────────────────────────────────────

export interface FavoriteEntry {
  createdAt: string;
  game: Game;
}

// ── Classement ────────────────────────────────────────────────────

export type LeaderboardPeriod = "day" | "week" | "month" | "all";

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avatar: string;
  level: number;
  points: number;
  isMe?: boolean;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

// ── Espace parent ─────────────────────────────────────────────────

export interface Playtime {
  today: number;
  week: number;
  month: number;
  all: number;
}

export interface ChildSummary {
  profile: Profile;
  stats: {
    sessionsFinished: number;
    wins: number;
    winRate: number;
    achievements: number;
    lastPlayedAt: string | null;
    playtime: Playtime;
  };
}

export interface ChildActivity {
  game: {
    slug: string;
    title: string;
    emoji: string;
    color: string;
    category: string;
  };
  plays: number;
  wins: number;
  winRate: number;
  bestScore: number;
  avgScore: number;
  lastPlayedAt: string | null;
}

export interface ChildDashboard {
  profile: Profile;
  playtime: Playtime;
  skills: SkillStat[];
  activity: ChildActivity[];
  recentSessions: {
    id: string;
    score: number;
    isWin: boolean;
    stars: number;
    durationMs: number;
    finishedAt: string | null;
    game: { slug: string; title: string; emoji: string };
  }[];
  achievements: { unlockedAt: string; title: string; icon: string; xpReward: number }[];
}

// ── Admin ─────────────────────────────────────────────────────────

export interface AdminStats {
  users: { total: number; new7d: number; childProfiles: number; active7d: number };
  sessions: { total: number; last7d: number; avgDurationMs: number; totalScores: number };
  games: { total: number; published: number };
  security: { scoreAnomalies30d: number };
  topPlayed: { slug: string; title: string; emoji: string; color: string; playCount: number }[];
  topWinRates: { id: string; slug: string; title: string; emoji: string; wins: number; total: number; winRate: number }[];
  topAbandoned: { id: string; slug: string; title: string; emoji: string; abandoned: number }[];
}

export interface AdminUser {
  id: string;
  email: string | null;
  role: UserRole;
  displayName: string;
  avatar: string;
  isActive: boolean;
  locked: boolean;
  profilesCount: number;
  createdAt: string;
}

export interface AdminGame {
  id: string;
  slug: string;
  title: string;
  description: string;
  engine: string;
  emoji: string;
  color: string;
  minAge: number;
  maxAge: number | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  maxScoreHint: number;
  isPublished: boolean;
  playCount: number;
  categoryId: string;
  category: { slug: string; name: string; emoji: string };
  config: Record<string, unknown>;
}

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  _count: { games: number };
}

export interface SecurityLogEntry {
  id: string;
  type: string;
  createdAt: string;
  user: { displayName: string; role: string } | null;
  ipHash: string | null;
  detail: Record<string, unknown>;
}

// ── Abonnements Premium ───────────────────────────────────────────

export type BillingInterval = "MONTH" | "YEAR";
export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "EXPIRED" | "PAST_DUE";
export type BillingProvider = "STRIPE" | "DEMO";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export interface BillingPlan {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  priceCents: number;
  currency: string;
  interval: BillingInterval;
  trialDays: number;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
}

export interface BillingContext {
  stripeEnabled: boolean;
  demoMode: boolean;
  currency: string;
  trialDays: number;
}

export interface BillingPlansResponse {
  plans: BillingPlan[];
  billing: BillingContext;
}

export interface BillingSubscription {
  id: string;
  status: SubscriptionStatus;
  provider: BillingProvider;
  plan: BillingPlan;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

export interface BillingPayment {
  id: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  provider: BillingProvider;
  createdAt: string;
  plan: { slug: string; name: string };
}

export interface BillingOverview {
  premium: boolean;
  premiumSource: "free" | "subscription" | "admin";
  subscription: BillingSubscription | null;
  payments: BillingPayment[];
  billing: BillingContext;
}

export type CheckoutResponse =
  | { mode: "demo"; activated: true; overview: BillingOverview }
  | { mode: "stripe"; url: string; sessionId: string };
