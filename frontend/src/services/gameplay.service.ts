// ══════════════════════════════════════════════════════════════════
//  KIDORA — Services de gameplay
//  sessions (start/finish/abandon), scores, progression,
//  favoris, achievements, classement.
// ══════════════════════════════════════════════════════════════════

import { api, toQuery } from "./api";
import type {
  AchievementsResponse,
  FinishSessionResponse,
  FavoriteEntry,
  LeaderboardPeriod,
  LeaderboardResponse,
  ProgressOverview,
  ScoreEntry,
  StartSessionResponse,
} from "../types";

// ── Sessions de jeu (§40/§41/§44) ─────────────────────────────────

export interface FinishPayload {
  score: number;
  durationMs: number;
  isWin: boolean;
  levelReached: number;
  clientMeta?: Record<string, unknown>;
}

export const sessionsService = {
  start(gameSlug: string, difficulty: "easy" | "medium" | "hard") {
    return api<StartSessionResponse>("/sessions/start", {
      method: "POST",
      body: { gameSlug, difficulty },
    });
  },

  finish(sessionId: string, payload: FinishPayload) {
    return api<FinishSessionResponse>(`/sessions/${sessionId}/finish`, {
      method: "POST",
      body: payload,
    });
  },

  abandon(sessionId: string) {
    return api<{ abandoned: boolean }>(`/sessions/${sessionId}/abandon`, {
      method: "POST",
      body: {},
    });
  },

  resume(gameSlug: string) {
    return api<{
      hasActiveSession: boolean;
      activeSessionId: string | null;
      level: number;
      bestScore: number;
      plays: number;
    }>(`/sessions/resume/${encodeURIComponent(gameSlug)}`);
  },
};

// ── Scores ────────────────────────────────────────────────────────

export const scoresService = {
  recent(options: { gameId?: string; limit?: number; offset?: number } = {}) {
    const query = toQuery({
      gameId: options.gameId,
      limit: options.limit,
      offset: options.offset,
    });
    return api<{ total: number; scores: ScoreEntry[] }>(`/scores${query}`);
  },

  best(limit = 12) {
    return api<{
      best: {
        gameId: string;
        bestScore: number;
        plays: number;
        wins: number;
        level: number;
        lastPlayedAt: string | null;
        game: {
          slug: string;
          title: string;
          emoji: string;
          color: string;
          maxScoreHint: number;
          category: { slug: string; name: string };
        };
      }[];
    }>(`/scores/best${toQuery({ limit })}`);
  },
};

// ── Progression ───────────────────────────────────────────────────

export const progressService = {
  overview() {
    return api<ProgressOverview>("/progress");
  },
};

// ── Favoris (§39) ─────────────────────────────────────────────────

export const favoritesService = {
  list() {
    return api<{ favorites: FavoriteEntry[] }>("/favorites");
  },

  add(gameId: string) {
    return api<{ favorite: boolean; gameId: string }>(`/favorites/${gameId}`, {
      method: "POST",
      body: {},
    });
  },

  remove(gameId: string) {
    return api<{ favorite: boolean; gameId: string }>(`/favorites/${gameId}`, {
      method: "DELETE",
    });
  },
};

// ── Achievements ──────────────────────────────────────────────────

export const achievementsService = {
  list() {
    return api<AchievementsResponse>("/achievements");
  },

  recent(limit = 5) {
    return api<{
      recent: {
        unlockedAt: string;
        achievement: {
          code: string;
          title: string;
          description: string;
          icon: string;
          xpReward: number;
        };
        game: { slug: string; title: string; emoji: string } | null;
      }[];
    }>("/achievements/recent", { skipRefresh: true });
  },
};

// ── Classement (§38) ──────────────────────────────────────────────

export const leaderboardService = {
  get(period: LeaderboardPeriod, limit = 20) {
    return api<LeaderboardResponse>(`/leaderboard${toQuery({ period, limit })}`);
  },
};
