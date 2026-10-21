// ══════════════════════════════════════════════════════════════════
//  KIDORA — Tests : difficulté adaptative (§20) et étoiles (§40)
//  Logique pure, aucun DOM nécessaire.
// ══════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import {
  canGoDown,
  canGoUp,
  createLevel,
  difficultyRank,
  initialStreak,
  levelAfterWin,
  nextDifficulty,
  recordOutcome,
  shouldDecrease,
  shouldIncrease,
  starsForScore,
} from "../games/engine/difficulty";

describe("difficulté — navigation entre les crans", () => {
  it("classe les difficultés dans l'ordre easy < medium < hard", () => {
    expect(difficultyRank("easy")).toBe(0);
    expect(difficultyRank("medium")).toBe(1);
    expect(difficultyRank("hard")).toBe(2);
  });

  it("monte et descend d'un cran", () => {
    expect(nextDifficulty("easy", 1)).toBe("medium");
    expect(nextDifficulty("medium", 1)).toBe("hard");
    expect(nextDifficulty("hard", -1)).toBe("medium");
  });

  it("reste borné aux extrémités", () => {
    expect(nextDifficulty("hard", 1)).toBe("hard");
    expect(nextDifficulty("easy", -1)).toBe("easy");
  });

  it("canGoUp / canGoDown respectent les bords", () => {
    expect(canGoUp("easy")).toBe(true);
    expect(canGoUp("hard")).toBe(false);
    expect(canGoDown("easy")).toBe(false);
    expect(canGoDown("hard")).toBe(true);
  });
});

describe("difficulté — suivi de performance", () => {
  it("deux victoires d'affilée → proposition de monter", () => {
    const once = recordOutcome(initialStreak, true);
    expect(shouldIncrease(once)).toBe(false);
    const twice = recordOutcome(once, true);
    expect(shouldIncrease(twice)).toBe(true);
  });

  it("deux défaites d'affilée → proposition de redescendre", () => {
    const once = recordOutcome(initialStreak, false);
    expect(shouldDecrease(once)).toBe(false);
    const twice = recordOutcome(once, false);
    expect(shouldDecrease(twice)).toBe(true);
  });

  it("une victoire remet le compteur de défaites à zéro (et inversement)", () => {
    const losses = recordOutcome(recordOutcome(initialStreak, false), false);
    expect(losses.consecutiveLosses).toBe(2);
    const win = recordOutcome(losses, true);
    expect(win).toEqual({ consecutiveWins: 1, consecutiveLosses: 0 });
  });
});

describe("niveaux — createLevel / levelAfterWin", () => {
  it("borne le niveau entre 1 et maxLevel", () => {
    expect(createLevel(0, 3).level).toBe(1);
    expect(createLevel(9, 3).level).toBe(3);
  });

  it("signale le dernier niveau", () => {
    expect(createLevel(2, 3).isLast).toBe(false);
    expect(createLevel(3, 3).isLast).toBe(true);
  });

  it("ne dépasse jamais maxLevel après une victoire", () => {
    expect(levelAfterWin(1, 3)).toBe(2);
    expect(levelAfterWin(3, 3)).toBe(3);
  });
});

describe("étoiles — seuils 40 / 70 / 90 %", () => {
  it("0 étoile en dessous de 40 %", () => {
    expect(starsForScore(0, 100)).toBe(0);
    expect(starsForScore(39, 100)).toBe(0);
  });

  it("1 étoile dès 40 %", () => {
    expect(starsForScore(40, 100)).toBe(1);
    expect(starsForScore(69, 100)).toBe(1);
  });

  it("2 étoiles dès 70 %", () => {
    expect(starsForScore(70, 100)).toBe(2);
    expect(starsForScore(89, 100)).toBe(2);
  });

  it("3 étoiles dès 90 %", () => {
    expect(starsForScore(90, 100)).toBe(3);
    expect(starsForScore(100, 100)).toBe(3);
  });

  it("une partie parfaite d'un jeu plafonné à 95 % atteint 3 étoiles", () => {
    const cap = 1000;
    expect(starsForScore(Math.floor(cap * 0.95), cap)).toBe(3);
  });

  it("score maximal nul → 0 étoile (pas de division par zéro)", () => {
    expect(starsForScore(50, 0)).toBe(0);
    expect(starsForScore(0, 0)).toBe(0);
  });
});
