// ══════════════════════════════════════════════════════════════════
//  KIDORA — Tests unitaires : validateur anti-cheat (§13/§44)
//  Le réseau et la DB n'existent pas ici : uniquement la logique.
// ══════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import {
  pickMaxScore,
  pickMinDuration,
  validateSessionResult,
  type GameAntiCheatConfig,
  type SessionFinishInput,
} from "./score-validator";

const cfg: GameAntiCheatConfig = {
  minDurationMs: { easy: 12_000, medium: 25_000, hard: 40_000 },
  maxScore: { easy: 2_000, medium: 4_000, hard: 6_000 },
  levels: 3,
};

function input(overrides: Partial<SessionFinishInput> = {}): SessionFinishInput {
  return {
    score: 1_500,
    durationMs: 60_000,
    isWin: true,
    stars: 2,
    difficulty: "EASY",
    levelReached: 2,
    ...overrides,
  };
}

const ctx = {
  elapsedSinceStartMs: 62_000,
  sessionsLastHour: 3,
  maxSessionsPerHour: 60,
};

describe("pickMinDuration / pickMaxScore", () => {
  it("retourne les bornes par difficulté", () => {
    expect(pickMinDuration(cfg, "easy")).toBe(12_000);
    expect(pickMinDuration(cfg, "MEDIUM")).toBe(25_000);
    expect(pickMaxScore(cfg, "hard")).toBe(6_000);
  });

  it("applique une durée minimale absolue", () => {
    expect(pickMinDuration({}, "easy")).toBe(2_000);
  });

  it("utilise des défauts sûrs si la config est absente", () => {
    expect(pickMaxScore({}, "easy")).toBe(100_000);
  });
});

describe("validateSessionResult", () => {
  it("accepte un résultat plausible", () => {
    const result = validateSessionResult(cfg, input(), ctx);
    expect(result.ok).toBe(true);
    expect(result.flags).toHaveLength(0);
  });

  it("rejette un score au-dessus du plafond", () => {
    const result = validateSessionResult(cfg, input({ score: 999_999 }), ctx);
    expect(result.ok).toBe(false);
    expect(result.flags).toContain("score_above_cap");
  });

  it("rejette une partie trop rapide", () => {
    const result = validateSessionResult(cfg, input({ durationMs: 3_000 }), {
      ...ctx,
      elapsedSinceStartMs: 3_500,
    });
    expect(result.ok).toBe(false);
    expect(result.flags).toContain("too_fast");
  });

  it("rejette une durée incohérente avec le temps serveur", () => {
    const result = validateSessionResult(cfg, input({ durationMs: 600_000 }), {
      ...ctx,
      elapsedSinceStartMs: 60_000,
    });
    expect(result.ok).toBe(false);
    expect(result.flags).toContain("duration_mismatch");
  });

  it("rejette un score sans temps de jeu", () => {
    const result = validateSessionResult(cfg, input({ score: 500, durationMs: 500 }), {
      ...ctx,
      elapsedSinceStartMs: 1_000,
    });
    expect(result.ok).toBe(false);
    expect(result.flags).toContain("score_without_playtime");
  });

  it("rejette des valeurs invalides", () => {
    const result = validateSessionResult(
      cfg,
      input({ score: -50, durationMs: -1, stars: 9, levelReached: 99 }),
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.flags).toEqual(
      expect.arrayContaining([
        "invalid_score",
        "invalid_duration",
        "invalid_stars",
        "invalid_level",
      ]),
    );
  });

  it("rejette quand le rythme de sessions est dépassé", () => {
    const result = validateSessionResult(cfg, input(), { ...ctx, sessionsLastHour: 999 });
    expect(result.ok).toBe(false);
    expect(result.flags).toContain("session_rate_exceeded");
  });

  it("tolère la latence réseau raisonnable", () => {
    const result = validateSessionResult(cfg, input({ durationMs: 70_000 }), {
      ...ctx,
      elapsedSinceStartMs: 60_000, // 10s de dérive < 15s de marge
    });
    expect(result.ok).toBe(true);
  });
});
