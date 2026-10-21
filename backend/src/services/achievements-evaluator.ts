// ══════════════════════════════════════════════════════════════════
//  KIDORA — Évaluateur d'achievements (logique PURE, testable)
//  Reçoit les définitions + les statistiques du joueur + les faits de
//  la dernière partie, et retourne les codes nouvellement débloqués.
// ══════════════════════════════════════════════════════════════════

import type { DifficultyKey } from "../lib/xp";

export interface AchievementDef {
  id: string;
  code: string;
  criteria: {
    type: string;
    count?: number;
    categorySlug?: string;
    maxDurationMs?: number;
    minDifficulty?: string;
  };
}

export interface PlayerStats {
  gamesFinished: number;
  totalPoints: number;
  /** Victoires consécutives, en incluant la partie qui vient de finir. */
  currentWinStreak: number;
  /** Victoires par slug de catégorie (inclut la partie courante). */
  winsByCategory: Record<string, number>;
  distinctGames: number;
  /** Nombre de jeux différents où le joueur a déjà obtenu 3 étoiles. */
  threeStarGames: number;
}

export interface SessionFacts {
  isWin: boolean;
  durationMs: number;
  stars: number;
  score: number;
  difficulty: DifficultyKey;
  categorySlug: string;
  gameId: string;
}

const DIFFICULTY_RANK: Record<DifficultyKey, number> = { easy: 1, medium: 2, hard: 3 };

function meetsDifficulty(actual: DifficultyKey, required?: string): boolean {
  if (!required) return true;
  const key = required.toLowerCase() as DifficultyKey;
  return DIFFICULTY_RANK[actual] >= (DIFFICULTY_RANK[key] ?? 1);
}

/**
 * @param defs      Achievements PAS ENCORE débloqués par ce profil.
 * @param stats     Statistiques agrégées (partie courante déjà incluse).
 * @param session   Faits de la partie qui vient de se terminer.
 * @returns         Codes des achievements à débloquer.
 */
export function evaluateAchievements(
  defs: AchievementDef[],
  stats: PlayerStats,
  session: SessionFacts,
): string[] {
  const unlocked: string[] = [];

  for (const def of defs) {
    const c = def.criteria;
    const count = c.count ?? 1;
    let ok = false;

    switch (c.type) {
      case "games_finished":
        ok = stats.gamesFinished >= count;
        break;

      case "points":
        ok = stats.totalPoints >= count;
        break;

      case "streak":
        ok = stats.currentWinStreak >= count;
        break;

      case "distinct_games":
        ok = stats.distinctGames >= count;
        break;

      case "category_wins":
        ok = (stats.winsByCategory[c.categorySlug ?? ""] ?? 0) >= count;
        break;

      case "speed_win":
        ok = session.isWin && session.durationMs <= (c.maxDurationMs ?? 30_000);
        break;

      case "perfect_stars":
        ok = session.stars >= 3 && meetsDifficulty(session.difficulty, c.minDifficulty);
        break;

      case "three_star_games":
        ok = stats.threeStarGames >= count;
        break;

      default:
        ok = false; // critère inconnu → jamais débloqué (sûr par défaut)
    }

    if (ok) unlocked.push(def.code);
  }

  return unlocked;
}
