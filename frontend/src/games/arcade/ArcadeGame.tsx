// ══════════════════════════════════════════════════════════════════
//  KIDORA — Moteur « arcade » (13 jeux canvas)
//  Boucle 60 fps, pause propre, chrono, vies, tactile + clavier,
//  budget de points anti-triche, fin de partie unique.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef } from "react";
import { useCanvas } from "../engine/hooks";
import type { GameProps } from "../registry";
import { useAward, useCtxRef } from "../shared/kit";
import { whackAMole, fruitSlice, flappyBalloon, snakeGame } from "./modes-a";
import { breakout, stackTower, dinoRunner, spaceShooter } from "./modes-b";
import { pongGame, pianoTiles, drumBeat, reactionTime, fruitCatcher } from "./modes-c";
import { type AnyArcadeMode, type ModeApi } from "./types";

export const ARCADE_MODES: Record<string, AnyArcadeMode> = {
  "whack-a-mole": whackAMole,
  "fruit-slice": fruitSlice,
  "flappy-balloon": flappyBalloon,
  snake: snakeGame,
  breakout,
  "stack-tower": stackTower,
  "dino-runner": dinoRunner,
  "space-shooter": spaceShooter,
  pong: pongGame,
  "piano-tiles": pianoTiles,
  "drum-beat": drumBeat,
  "reaction-time": reactionTime,
  "fruit-catcher": fruitCatcher,
};

export function ArcadeGame({ ctx }: GameProps) {
  const mode = ARCADE_MODES[ctx.game.slug] ?? whackAMole;
  const { canvasRef, size } = useCanvas(4 / 3);
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const awardRef = useRef(award);
  awardRef.current = award;
  const scoreRef = useRef(0);
  const stateRef = useRef<unknown>(null);
  const finishedRef = useRef(false);
  const livesRef = useRef<number | null>(null);
  const timeRef = useRef(mode.time);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const awardPoints = useCallback((points: number) => {
    const awarded = awardRef.current(points);
    scoreRef.current += awarded;
  }, []);

  const finish = useCallback((won?: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const current = ctxRef.current;
    const max = current.game.config.maxScore?.[current.difficulty] ?? current.game.maxScoreHint;
    const isWin = won ?? scoreRef.current >= max * 0.15;
    current.finish({
      isWin,
      levelReached: 1,
      clientMeta: { game: current.game.slug, score: scoreRef.current },
    });
  }, []);

  const loseLife = useCallback(() => {
    if (finishedRef.current) return;
    const current = ctxRef.current;
    if (livesRef.current === null) return;
    livesRef.current = Math.max(0, livesRef.current - 1);
    current.setLives(livesRef.current);
    if (livesRef.current <= 0) finish(false);
  }, [finish]);

  const api = useRef<ModeApi>({
    award: awardPoints,
    loseLife,
    finish,
    sound: (name) => ctxRef.current.sound.play(name),
    difficulty: ctx.difficulty,
  });
  api.current = {
    award: awardPoints,
    loseLife,
    finish,
    sound: (name) => ctxRef.current.sound.play(name),
    difficulty: ctx.difficulty,
  };

  // ── Initialisation / taille du canvas ──────────────────────────
  useEffect(() => {
    if (size.width < 40 || size.height < 40) return;
    stateRef.current = mode.init(size.width, size.height, api.current);
  }, [mode, size.width, size.height]);

  // ── Chrono, vies, affichage HUD ────────────────────────────────
  useEffect(() => {
    finishedRef.current = false;
    scoreRef.current = 0;
    livesRef.current = mode.lives ?? null;
    timeRef.current = mode.time;
    ctxRef.current.setLives(mode.lives);
    ctxRef.current.setTimeLeft(mode.time);
    ctxRef.current.setRoundsTotal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = ctxRef.current;
      if (!current.running || finishedRef.current) return;
      timeRef.current -= 1;
      current.setTimeLeft(Math.max(0, timeRef.current));
      if (timeRef.current <= 5 && timeRef.current > 0) current.sound.play("tick");
      if (timeRef.current <= 0) finish();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [finish]);

  // ── Boucle de jeu ──────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const canvas = canvasRef.current;
      const state = stateRef.current;
      if (canvas && state) {
        const c = canvas.getContext("2d");
        if (c) {
          if (ctxRef.current.running && !finishedRef.current) {
            mode.update(state, dt, api.current, size.width, size.height);
          }
          c.clearRect(0, 0, size.width, size.height);
          mode.draw(state, c, api.current, size.width, size.height);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, size.width, size.height, canvasRef]);

  // ── Clavier ────────────────────────────────────────────────────
  useEffect(() => {
    const relevant = new Set([
      " ",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Enter",
      "w",
      "a",
      "s",
      "d",
      "z",
      "q",
      "1",
      "2",
      "3",
      "4",
    ]);
    const onDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!stateRef.current || !ctxRef.current.running || finishedRef.current) return;
      if (relevant.has(event.key)) event.preventDefault();
      mode.key?.(stateRef.current, event.key, true, api.current, sizeRef.current.width, sizeRef.current.height);
    };
    const onUp = (event: KeyboardEvent) => {
      if (!relevant.has(event.key)) return;
      mode.key?.(stateRef.current, event.key, false, api.current, sizeRef.current.width, sizeRef.current.height);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [mode]);

  // ── Pointeur / tactile ─────────────────────────────────────────
  const pointer = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>, type: "down" | "move") => {
      const current = ctxRef.current;
      if (!stateRef.current || !current.running || finishedRef.current) return;
      if (type === "down") event.preventDefault();
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = ((event.clientX - rect.left) / rect.width) * sizeRef.current.width;
      const y = ((event.clientY - rect.top) / rect.height) * sizeRef.current.height;
      mode.pointer?.(stateRef.current, x, y, type, api.current, sizeRef.current.width, sizeRef.current.height);
    },
    [mode],
  );

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center py-2">
      <canvas
        ref={canvasRef}
        role="application"
        aria-label={ctx.game.title}
        tabIndex={0}
        className="max-h-[calc(100vh-190px)] w-full max-w-3xl touch-none rounded-card border-4 border-white bg-primary-soft shadow-card outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          pointer(event, "down");
        }}
        onPointerMove={(event) => pointer(event, "move")}
      />
      <p className="mt-2 text-center text-xs font-semibold text-ink-faint" aria-hidden="true">
        👆 / ⌨️ ← ↑ ↓ → · ␣
      </p>
    </div>
  );
}
