// ══════════════════════════════════════════════════════════════════
//  KIDORA — Gestion de difficulté adaptative (§20)
//  Réussites faciles → la difficulté monte.
//  Échecs répétés → elle redescend (et le jeu encourage).
//  Logique PURE et testable.
// ══════════════════════════════════════════════════════════════════

import type { DifficultyKey } from "../../config";

const ORDER: DifficultyKey[] = ["easy", "medium", "hard"];

export function difficultyRank(d: DifficultyKey): number {
  return ORDER.indexOf(d);
}

export function nextDifficulty(current: DifficultyKey, direction: 1 | -1): DifficultyKey {
  const index = difficultyRank(current) + direction;
  if (index < 0) return ORDER[0];
  if (index >= ORDER.length) return ORDER[ORDER.length - 1];
  return ORDER[index];
}

export function canGoUp(current: DifficultyKey): boolean {
  return difficultyRank(current) < ORDER.length - 1;
}

export function canGoDown(current: DifficultyKey): boolean {
  return difficultyRank(current) > 0;
}

// ── Suivi des performances pour l'adaptation ─────────────────────

export interface StreakState {
  consecutiveWins: number;
  consecutiveLosses: number;
}

export const initialStreak: StreakState = { consecutiveWins: 0, consecutiveLosses: 0 };

export function recordOutcome(state: StreakState, isWin: boolean): StreakState {
  return isWin
    ? { consecutiveWins: state.consecutiveWins + 1, consecutiveLosses: 0 }
    : { consecutiveWins: 0, consecutiveLosses: state.consecutiveLosses + 1 };
}

/** 2 réussites d'affilée → on monte d'un cran. */
export function shouldIncrease(state: StreakState): boolean {
  return state.consecutiveWins >= 2;
}

/** 2 échecs d'affilée → on propose de redescendre d'un cran. */
export function shouldDecrease(state: StreakState): boolean {
  return state.consecutiveLosses >= 2;
}

// ── LevelManager : progression par niveaux d'un jeu ──────────────

export interface LevelInfo {
  level: number;
  maxLevel: number;
  isLast: boolean;
}

export function createLevel(level: number, maxLevel: number): LevelInfo {
  return {
    level: Math.min(Math.max(1, level), maxLevel),
    maxLevel,
    isLast: level >= maxLevel,
  };
}

export function levelAfterWin(level: number, maxLevel: number): number {
  return Math.min(level + 1, maxLevel);
}

/** Étoiles selon le pourcentage du score maximal (40 / 70 / 90 — §40). */
export function starsForScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  const ratio = score / maxScore;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}
