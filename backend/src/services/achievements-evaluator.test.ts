// ══════════════════════════════════════════════════════════════════
//  KIDORA — Tests unitaires : évaluateur d'achievements
// ══════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import {
  evaluateAchievements,
  type AchievementDef,
  type PlayerStats,
  type SessionFacts,
} from "./achievements-evaluator";

const defs: AchievementDef[] = [
  { id: "1", code: "first_game", criteria: { type: "games_finished", count: 1 } },
  { id: "2", code: "games_10", criteria: { type: "games_finished", count: 10 } },
  { id: "3", code: "points_1000", criteria: { type: "points", count: 1_000 } },
  { id: "4", code: "streak_5", criteria: { type: "streak", count: 5 } },
  { id: "5", code: "explorer", criteria: { type: "distinct_games", count: 5 } },
  {
    id: "6",
    code: "memory_master",
    criteria: { type: "category_wins", categorySlug: "memoire", count: 10 },
  },
  { id: "7", code: "speedster", criteria: { type: "speed_win", maxDurationMs: 30_000 } },
  {
    id: "8",
    code: "perfect_score",
    criteria: { type: "perfect_stars", minDifficulty: "hard", count: 1 },
  },
  { id: "9", code: "perfectionist", criteria: { type: "three_star_games", count: 5 } },
  { id: "10", code: "mystere", criteria: { type: "critere_inconnu", count: 1 } },
];

const baseStats: PlayerStats = {
  gamesFinished: 3,
  totalPoints: 500,
  currentWinStreak: 1,
  winsByCategory: { memoire: 2 },
  distinctGames: 2,
  threeStarGames: 0,
};

const baseSession: SessionFacts = {
  isWin: true,
  durationMs: 45_000,
  stars: 2,
  score: 500,
  difficulty: "easy",
  categorySlug: "memoire",
  gameId: "g1",
};

describe("evaluateAchievements", () => {
  it("débloque first_game dès 1 partie", () => {
    const unlocked = evaluateAchievements(defs, baseStats, baseSession);
    expect(unlocked).toContain("first_game");
    expect(unlocked).not.toContain("games_10");
  });

  it("débloque points_1000 au seuil exact", () => {
    const unlocked = evaluateAchievements(
      defs,
      { ...baseStats, totalPoints: 1_000 },
      baseSession,
    );
    expect(unlocked).toContain("points_1000");
  });

  it("débloque streak_5 à 5 victoires consécutives", () => {
    const unlocked = evaluateAchievements(
      defs,
      { ...baseStats, currentWinStreak: 5 },
      baseSession,
    );
    expect(unlocked).toContain("streak_5");
  });

  it("débloque speedster uniquement sur victoire rapide", () => {
    expect(
      evaluateAchievements(defs, baseStats, { ...baseSession, durationMs: 20_000 }),
    ).toContain("speedster");
    expect(
      evaluateAchievements(defs, baseStats, { ...baseSession, durationMs: 40_000 }),
    ).not.toContain("speedster");
    expect(
      evaluateAchievements(defs, baseStats, {
        ...baseSession,
        durationMs: 20_000,
        isWin: false,
      }),
    ).not.toContain("speedster");
  });

  it("perfect_score exige 3 étoiles ET difficulté suffisante", () => {
    expect(
      evaluateAchievements(defs, baseStats, { ...baseSession, stars: 3, difficulty: "hard" }),
    ).toContain("perfect_score");
    expect(
      evaluateAchievements(defs, baseStats, { ...baseSession, stars: 3, difficulty: "medium" }),
    ).not.toContain("perfect_score");
    expect(
      evaluateAchievements(defs, baseStats, { ...baseSession, stars: 3, difficulty: "easy" }),
    ).not.toContain("perfect_score");
    expect(
      evaluateAchievements(defs, baseStats, { ...baseSession, stars: 2, difficulty: "hard" }),
    ).not.toContain("perfect_score");
  });

  it("category_wins compte par catégorie", () => {
    const unlocked = evaluateAchievements(
      defs,
      { ...baseStats, winsByCategory: { memoire: 10 } },
      baseSession,
    );
    expect(unlocked).toContain("memory_master");
  });

  it("un critère inconnu ne débloque jamais", () => {
    const unlocked = evaluateAchievements(defs, baseStats, baseSession);
    expect(unlocked).not.toContain("mystere");
  });

  it("peut débloquer plusieurs achievements d'un coup", () => {
    const unlocked = evaluateAchievements(
      defs,
      {
        gamesFinished: 12,
        totalPoints: 5_000,
        currentWinStreak: 6,
        winsByCategory: { memoire: 12 },
        distinctGames: 6,
        threeStarGames: 6,
      },
      { ...baseSession, stars: 3, difficulty: "hard", durationMs: 10_000 },
    );
    expect(unlocked.length).toBeGreaterThanOrEqual(8);
  });
});
