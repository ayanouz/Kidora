// ══════════════════════════════════════════════════════════════════
//  KIDORA — Game Engine : types communs
//  Tout jeu respecte ce contrat (démarrage, pause, reprise,
//  restart, fin de partie) et utilise les composants partagés.
// ══════════════════════════════════════════════════════════════════

import type { DifficultyKey } from "../../config";
import type { FinishSessionResponse, Game } from "../../types";

export type GamePhase = "ready" | "playing" | "paused" | "over";

/** Résultat local d'une partie, avant validation serveur. */
export interface LocalResult {
  score: number;
  durationMs: number;
  isWin: boolean;
  levelReached: number;
  clientMeta?: Record<string, unknown>;
}

/** Résultat affiché sur l'écran de fin (§41). */
export interface GameOverData {
  result: LocalResult;
  /** Résultat validé par le serveur (null si hors-ligne / non connecté). */
  server: FinishSessionResponse | null;
  /** true pendant la vérification serveur du score. */
  pending?: boolean;
  /** Explication éventuelle (score rejeté, hors-ligne…). */
  notice?: "offline" | "rejected";
  bestScore: number;
  isNewRecord: boolean;
}

/** API audio exposée aux jeux. */
export interface SoundApi {
  play: (name: SoundName) => void;
  enabled: boolean;
  toggle: () => void;
}

export type SoundName =
  | "click"
  | "correct"
  | "wrong"
  | "win"
  | "level"
  | "achievement"
  | "bonus"
  | "pop"
  | "tick"
  | "flip";

/** Contexte passé aux jeux par le GameShell. */
export interface GameContext {
  game: Game;
  difficulty: DifficultyKey;
  phase: GamePhase;
  /** true seulement quand la partie tourne (playing, non pausé). */
  running: boolean;
  score: number;
  setScore: (n: number) => void;
  addScore: (n: number) => void;
  combo: number;
  setCombo: (n: number) => void;
  lives: number | null;
  setLives: (n: number | null) => void;
  timeLeft: number | null;
  setTimeLeft: (n: number | null) => void;
  level: number;
  setLevel: (n: number) => void;
  roundsTotal: number | null;
  setRoundsTotal: (n: number | null) => void;
  bestScore: number;
  sound: SoundApi;
  pause: () => void;
  resume: () => void;
  /** Termine la partie (le shell s'occupe du serveur et de l'écran de fin). */
  finish: (result?: Partial<LocalResult>) => void;
  /** Signal de bonne réponse : son + combo + feedback. */
  signalCorrect: (points?: number) => void;
  /** Signal de mauvaise réponse : son + combo remis à zéro. */
  signalWrong: () => void;
}
