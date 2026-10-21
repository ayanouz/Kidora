// ══════════════════════════════════════════════════════════════════
//  KIDORA — Tests : utilitaires du moteur (formatMs, maxScoreFor)
// ══════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import { formatMs, maxScoreFor } from "../games/engine/components";
import type { Game } from "../types";

function fakeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "g1",
    slug: "jeu-test",
    title: "Jeu test",
    description: "",
    engine: "memory-cards",
    emoji: "🎮",
    color: "#6C5CE7",
    minAge: 3,
    maxAge: null,
    difficulty: "EASY",
    maxScoreHint: 500,
    playCount: 0,
    premium: false,
    config: {},
    category: { slug: "cat", name: "Cat", emoji: "🐾", color: "#000000" },
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("formatMs — chronomètre du HUD", () => {
  it("formate minutes:secondes avec secondes sur 2 chiffres", () => {
    expect(formatMs(0)).toBe("0:00");
    expect(formatMs(5_000)).toBe("0:05");
    expect(formatMs(65_000)).toBe("1:05");
    expect(formatMs(75_000)).toBe("1:15");
    expect(formatMs(600_000)).toBe("10:00");
  });

  it("arrondit à la seconde la plus proche", () => {
    expect(formatMs(1_400)).toBe("0:01");
    expect(formatMs(1_600)).toBe("0:02");
  });

  it("ne descend jamais sous zéro", () => {
    expect(formatMs(-5_000)).toBe("0:00");
  });
});

describe("maxScoreFor — plafond anti-triche par difficulté", () => {
  it("préfère config.maxScore[difficulty] quand il existe", () => {
    const game = fakeGame({ config: { maxScore: { hard: 2000 } } });
    expect(maxScoreFor(game, "hard")).toBe(2000);
  });

  it("retombe sur maxScoreHint pour les difficultés sans plafond dédié", () => {
    const game = fakeGame({ config: { maxScore: { hard: 2000 } }, maxScoreHint: 900 });
    expect(maxScoreFor(game, "easy")).toBe(900);
    expect(maxScoreFor(game, "medium")).toBe(900);
  });

  it("utilise maxScoreHint quand config.maxScore est absent", () => {
    const game = fakeGame({ maxScoreHint: 750 });
    expect(maxScoreFor(game, "easy")).toBe(750);
  });
});
