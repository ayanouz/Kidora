// ══════════════════════════════════════════════════════════════════
//  KIDORA — GameStorage (§40)
//  Sauvegarde locale (localStorage) : meilleur score hors-ligne,
//  niveau atteint, difficulté choisie → reprise de partie.
//  La source de vérité des scores reste le serveur.
// ══════════════════════════════════════════════════════════════════

import type { DifficultyKey } from "../../config";
import { initialStreak, type StreakState } from "./difficulty";

const PREFIX = "kidora_game_";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // stockage plein / navigation privée → silencieux
  }
}

export interface SavedGameState {
  bestScore: number;
  level: number;
  difficulty: DifficultyKey;
  /** Suivi des réussites/échecs pour l'adaptation de difficulté (§20). */
  streak: StreakState;
  updatedAt: string;
}

function defaultState(): SavedGameState {
  return {
    bestScore: 0,
    level: 1,
    difficulty: "easy",
    streak: { ...initialStreak },
    updatedAt: new Date(0).toISOString(),
  };
}

export const GameStorage = {
  get(slug: string): SavedGameState {
    const raw = read<Partial<SavedGameState>>(slug, {});
    return {
      ...defaultState(),
      ...raw,
      // Migration douce : les anciennes sauvegardes n'ont pas de streak.
      streak: { ...initialStreak, ...raw.streak },
    };
  },

  save(slug: string, patch: Partial<Omit<SavedGameState, "updatedAt">>): SavedGameState {
    const current = this.get(slug);
    const next: SavedGameState = {
      ...current,
      ...patch,
      streak: { ...current.streak, ...patch.streak },
      bestScore: Math.max(current.bestScore, patch.bestScore ?? 0),
      updatedAt: new Date().toISOString(),
    };
    write(slug, next);
    return next;
  },

  bestScore(slug: string): number {
    return this.get(slug).bestScore;
  },

  clear(slug: string): void {
    try {
      window.localStorage.removeItem(`${PREFIX}${slug}`);
    } catch {
      /* silencieux */
    }
  },
};
