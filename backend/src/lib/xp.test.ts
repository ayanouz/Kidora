// ══════════════════════════════════════════════════════════════════
//  KIDORA — Tests unitaires : XP, niveaux, étoiles
// ══════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import {
  computeSessionXp,
  difficultyBonus,
  levelFromXp,
  MAX_XP_PER_SESSION,
  normalizeDifficulty,
  starsFromScore,
  xpForLevel,
  xpProgress,
} from "./xp";

describe("normalizeDifficulty", () => {
  it("convertit les variantes en clé normalisée", () => {
    expect(normalizeDifficulty("EASY")).toBe("easy");
    expect(normalizeDifficulty("Medium")).toBe("medium");
    expect(normalizeDifficulty("hard")).toBe("hard");
    expect(normalizeDifficulty("inconnu")).toBe("easy");
  });
});

describe("difficultyBonus", () => {
  it("récompense la difficulté", () => {
    expect(difficultyBonus("easy")).toBe(0);
    expect(difficultyBonus("MEDIUM")).toBe(25);
    expect(difficultyBonus("HARD")).toBe(50);
  });
});

describe("computeSessionXp", () => {
  it("donne plus d'XP pour une victoire", () => {
    const win = computeSessionXp({ score: 1000, isWin: true, difficulty: "easy", durationMs: 60_000 });
    const loss = computeSessionXp({ score: 1000, isWin: false, difficulty: "easy", durationMs: 60_000 });
    expect(win).toBeGreaterThan(loss);
    // base 100 + 50 victoire + 0 difficulté + 18 rapidité (30 - 60s/5s) = 168
    expect(win).toBe(168);
    // base 100 + 10 = 110
    expect(loss).toBe(110);
  });

  it("récompense la difficulté et la rapidité", () => {
    const fast = computeSessionXp({ score: 1000, isWin: true, difficulty: "hard", durationMs: 5_000 });
    expect(fast).toBe(100 + 50 + 50 + 29); // base + victoire + hard + rapidité
  });

  it("plafonne le gain par partie", () => {
    const huge = computeSessionXp({
      score: 999_999,
      isWin: true,
      difficulty: "hard",
      durationMs: 1_000,
    });
    // base 400 (plafonnée) + 50 victoire + 50 hard + 30 rapidité = 530
    expect(huge).toBe(530);
    expect(huge).toBeLessThanOrEqual(MAX_XP_PER_SESSION);
  });

  it("donne 0 XP de base pour un score nul mais récompense la partie jouée", () => {
    expect(computeSessionXp({ score: 0, isWin: false, difficulty: "easy", durationMs: 30_000 })).toBe(10);
  });
});

describe("levelFromXp / xpForLevel", () => {
  it("niveau 1 à 0 XP", () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it("la courbe est cohérente", () => {
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(400);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(399)).toBe(2);
    expect(levelFromXp(400)).toBe(3);
  });

  it("est monotone", () => {
    let previous = 0;
    for (let xp = 0; xp < 20_000; xp += 137) {
      const level = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});

describe("xpProgress", () => {
  it("calcule un pourcentage entre 0 et 100", () => {
    const p = xpProgress(250);
    expect(p.level).toBe(2);
    expect(p.percent).toBeGreaterThanOrEqual(0);
    expect(p.percent).toBeLessThanOrEqual(100);
  });
});

describe("starsFromScore", () => {
  it("attribue les étoiles par palier", () => {
    expect(starsFromScore(0, 1000)).toBe(0);
    expect(starsFromScore(399, 1000)).toBe(0);
    expect(starsFromScore(400, 1000)).toBe(1);
    expect(starsFromScore(700, 1000)).toBe(2);
    expect(starsFromScore(900, 1000)).toBe(3);
    expect(starsFromScore(1000, 1000)).toBe(3);
  });

  it("gère les plafonds invalides", () => {
    expect(starsFromScore(10, 0)).toBe(0);
  });
});
