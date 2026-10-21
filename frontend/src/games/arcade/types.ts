// ══════════════════════════════════════════════════════════════════
//  KIDORA — Framework des jeux d'arcade
//  Chaque « mode » = une petite machine à états dessinée sur canvas.
//  Le shell gère : boucle requestAnimationFrame, pause, chrono, vies,
//  clavier, tactile, budget de points et fin de partie unique.
// ══════════════════════════════════════════════════════════════════

import type { DifficultyKey } from "../../config";
import type { SoundName } from "../engine/types";

export interface ModeApi {
  award: (points: number) => void;
  loseLife: () => void;
  /** Termine la partie ; sans argument, la victoire dépend du score. */
  finish: (won?: boolean) => void;
  sound: (name: SoundName) => void;
  difficulty: DifficultyKey;
}

export interface ArcadeMode<S = unknown> {
  /** Durée de la manche (secondes). */
  time: number;
  /** Nombre de vies affichées (null = pas de vies). */
  lives: number | null;
  init: (w: number, h: number, api: ModeApi) => S;
  update: (state: S, dt: number, api: ModeApi, w: number, h: number) => void;
  draw: (state: S, canvas: CanvasRenderingContext2D, api: ModeApi, w: number, h: number) => void;
  pointer?: (state: S, x: number, y: number, type: "down" | "move", api: ModeApi, w: number, h: number) => void;
  key?: (state: S, key: string, down: boolean, api: ModeApi, w: number, h: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyArcadeMode = ArcadeMode<any>;

// ── Outils de dessin / calcul ────────────────────────────────────

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export function drawEmoji(
  canvas: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  size: number,
): void {
  canvas.save();
  canvas.font = `${size}px ${EMOJI_FONT}`;
  canvas.textAlign = "center";
  canvas.textBaseline = "middle";
  canvas.fillText(emoji, x, y);
  canvas.restore();
}

export function roundRect(
  canvas: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  canvas.beginPath();
  canvas.moveTo(x + r, y);
  canvas.arcTo(x + w, y, x + w, y + h, r);
  canvas.arcTo(x + w, y + h, x, y + h, r);
  canvas.arcTo(x, y + h, x, y, r);
  canvas.arcTo(x, y, x + w, y, r);
  canvas.closePath();
}

export function near(px: number, py: number, x: number, y: number, radius: number): boolean {
  const dx = px - x;
  const dy = py - y;
  return dx * dx + dy * dy <= radius * radius;
}

/** 0 = facile, 1 = moyen, 2 = difficile. */
export function tier(difficulty: string): 0 | 1 | 2 {
  return difficulty === "easy" ? 0 : difficulty === "medium" ? 1 : 2;
}

export function choice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
