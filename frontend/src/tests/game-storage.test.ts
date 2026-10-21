// ══════════════════════════════════════════════════════════════════
//  KIDORA — Tests : GameStorage (§40)
//  Meilleur score local, migration du streak, robustesse JSON cassé.
// ══════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import { GameStorage } from "../games/engine/GameStorage";

const SLUG = "test-game";

describe("GameStorage — lecture / écriture", () => {
  it("retourne un état par défaut quand rien n'est sauvegardé", () => {
    const state = GameStorage.get(SLUG);
    expect(state.bestScore).toBe(0);
    expect(state.level).toBe(1);
    expect(state.difficulty).toBe("easy");
    expect(state.streak).toEqual({ consecutiveWins: 0, consecutiveLosses: 0 });
  });

  it("sauvegarde et relit un état", () => {
    GameStorage.save(SLUG, { bestScore: 250, level: 2, difficulty: "medium" });
    const state = GameStorage.get(SLUG);
    expect(state.bestScore).toBe(250);
    expect(state.level).toBe(2);
    expect(state.difficulty).toBe("medium");
    expect(GameStorage.bestScore(SLUG)).toBe(250);
  });

  it("ne régresse jamais le meilleur score (max conservé)", () => {
    GameStorage.save(SLUG, { bestScore: 500 });
    GameStorage.save(SLUG, { bestScore: 120 });
    expect(GameStorage.bestScore(SLUG)).toBe(500);
  });

  it("met à jour le streak sans perdre le reste", () => {
    GameStorage.save(SLUG, { bestScore: 300 });
    GameStorage.save(SLUG, { streak: { consecutiveWins: 2, consecutiveLosses: 0 } });
    const state = GameStorage.get(SLUG);
    expect(state.bestScore).toBe(300);
    expect(state.streak.consecutiveWins).toBe(2);
  });

  it("migre une ancienne sauvegarde sans champ streak", () => {
    // Simule une sauvegarde de la version précédente (sans streak).
    window.localStorage.setItem(
      `kidora_game_${SLUG}`,
      JSON.stringify({ bestScore: 90, level: 3, difficulty: "hard" }),
    );
    const state = GameStorage.get(SLUG);
    expect(state.bestScore).toBe(90);
    expect(state.streak).toEqual({ consecutiveWins: 0, consecutiveLosses: 0 });
  });

  it("survit à un JSON corrompu (valeur par défaut)", () => {
    window.localStorage.setItem(`kidora_game_${SLUG}`, "{pas-du-json!!");
    expect(GameStorage.get(SLUG).bestScore).toBe(0);
  });

  it("clear efface la sauvegarde du jeu", () => {
    GameStorage.save(SLUG, { bestScore: 100 });
    GameStorage.clear(SLUG);
    expect(GameStorage.bestScore(SLUG)).toBe(0);
  });
});
