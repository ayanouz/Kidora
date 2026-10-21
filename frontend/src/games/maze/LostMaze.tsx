// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 03 : Le Labyrinthe Perdu (moteur « maze »)
//  Guide le lapin 🐰 jusqu'à la porte 🚪 en ramassant 3 étoiles ⭐.
//  Labyrinthe parfait généré (backtracker récursif itératif) et
//  dessiné au canvas. Flèches / WASD, balayage tactile, croix tactile.
//  Zéro asset : emojis dessinés au canvas + formes vectorielles.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { maxScoreFor } from "../engine/components";
import { useCanvas } from "../engine/hooks";
import type { GameProps } from "../registry";

/** Largeur maximale du labyrinthe (impère pour rester centré). */
const MAX_COLS = 25;

interface Cell {
  r: number;
  c: number;
}

interface MazeData {
  cols: number;
  rows: number;
  /** true = mur. */
  walls: boolean[][];
  exitR: number;
  exitC: number;
}

/** Rectangle arrondi maison (compatible tous navigateurs). */
function roundedRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ── Génération du labyrinthe ──────────────────────────────────────

/** Labyrinthe parfait : backtracker récursif itératif, grille impère. */
function generateMaze(cols: number, rows: number): MazeData {
  const walls = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => true),
  );
  const stack: Cell[] = [{ r: 1, c: 1 }];
  walls[1][1] = false;
  const steps: [number, number][] = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const options: Cell[] = [];
    for (const [dr, dc] of steps) {
      const nr = current.r + dr;
      const nc = current.c + dc;
      if (nr > 0 && nc > 0 && nr < rows - 1 && nc < cols - 1 && walls[nr][nc]) {
        options.push({ r: nr, c: nc });
      }
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const next = options[Math.floor(Math.random() * options.length)];
    walls[(current.r + next.r) / 2][(current.c + next.c) / 2] = false;
    walls[next.r][next.c] = false;
    stack.push(next);
  }
  return { cols, rows, walls, exitR: rows - 2, exitC: cols - 2 };
}

/** 3 étoiles sur des cases ouvertes, loin du départ et hors sortie. */
function placeStars(maze: MazeData): number[] {
  const open: number[] = [];
  for (let r = 1; r < maze.rows - 1; r++) {
    for (let c = 1; c < maze.cols - 1; c++) {
      if (maze.walls[r][c]) continue;
      if (r <= 2 && c <= 2) continue; // rien collé au départ
      if (r === maze.exitR && c === maze.exitC) continue;
      open.push(r * maze.cols + c);
    }
  }
  for (let i = open.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [open[i], open[j]] = [open[j], open[i]];
  }
  const minimumGap = Math.max(3, Math.floor(maze.cols / 3));
  const chosen: number[] = [];
  for (const index of open) {
    const r = Math.floor(index / maze.cols);
    const c = index % maze.cols;
    const farEnough = chosen.every((other) => {
      const or = Math.floor(other / maze.cols);
      const oc = other % maze.cols;
      return Math.abs(or - r) + Math.abs(oc - c) >= minimumGap;
    });
    if (farEnough) chosen.push(index);
    if (chosen.length === 3) break;
  }
  // Filet de sécurité : complète avec n'importe quelle case libre.
  for (const index of open) {
    if (chosen.length === 3) break;
    if (!chosen.includes(index)) chosen.push(index);
  }
  return chosen;
}

// ── Le jeu ────────────────────────────────────────────────────────

const DPAD_BUTTON =
  "flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-white shadow-inset no-select transition-transform active:scale-95";

export function LostMaze({ ctx }: GameProps) {
  const settings = ctx.game.config.settings as
    | { sizes?: Partial<Record<DifficultyKey, number>> }
    | undefined;
  const baseCols = settings?.sizes?.[ctx.difficulty] ?? 11;
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);
  const level = Math.min(Math.max(1, ctx.level), maxLevel);
  const cols = Math.min(MAX_COLS, baseCols + (level - 1) * 2);
  const rows = cols;

  // Budget : une partie parfaite ≈ 95 % du plafond serveur (§3).
  const cap = maxScoreFor(ctx.game, ctx.difficulty);
  const levelPoints = Math.max(1, Math.floor((cap * 0.95) / maxLevel));

  const { canvasRef, size } = useCanvas(1);
  const [mazeStars, setMazeStars] = useState(0);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const mazeRef = useRef<MazeData | null>(null);
  const playerRef = useRef<Cell>({ r: 1, c: 1 });
  const starsRef = useRef<number[]>([]);
  const trailRef = useRef<Set<number>>(new Set());
  const starsCollectedRef = useRef(0);
  const totalStarsRef = useRef(0);
  const lockedRef = useRef(false);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  // Nouveau labyrinthe à chaque niveau (montage = début de partie).
  useEffect(() => {
    const maze = generateMaze(cols, rows);
    mazeRef.current = maze;
    playerRef.current = { r: 1, c: 1 };
    starsRef.current = placeStars(maze);
    trailRef.current = new Set([maze.cols + 1]);
    starsCollectedRef.current = 0;
    lockedRef.current = false;
    setMazeStars(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, cols]);

  const completeLevel = useCallback(() => {
    const current = ctxRef.current;
    if (lockedRef.current || finishedRef.current) return;
    lockedRef.current = true;
    const stars = starsCollectedRef.current;
    const award = Math.round(levelPoints * (0.6 + (0.4 * stars) / 3));
    current.addScore(award);
    current.sound.play("level");
    if (level >= maxLevel) {
      finishedRef.current = true;
      current.finish({ clientMeta: { stars: totalStarsRef.current } });
    } else {
      later(() => {
        const latest = ctxRef.current;
        latest.setLevel(Math.min(maxLevel, latest.level + 1));
      }, 600);
    }
  }, [later, level, levelPoints, maxLevel]);

  // Un pas de lapin (flèches, WASD, croix tactile, balayage).
  const tryMove = useCallback(
    (dr: number, dc: number) => {
      const current = ctxRef.current;
      if (!current.running || lockedRef.current || finishedRef.current) return;
      const maze = mazeRef.current;
      if (!maze) return;
      const player = playerRef.current;
      const nr = player.r + dr;
      const nc = player.c + dc;
      if (nr < 0 || nc < 0 || nr >= maze.rows || nc >= maze.cols) return;
      if (maze.walls[nr][nc]) return;

      playerRef.current = { r: nr, c: nc };
      const index = nr * maze.cols + nc;
      trailRef.current.add(index);

      const starIndex = starsRef.current.indexOf(index);
      if (starIndex >= 0) {
        starsRef.current.splice(starIndex, 1);
        starsCollectedRef.current += 1;
        totalStarsRef.current += 1;
        setMazeStars(starsCollectedRef.current);
        current.sound.play("bonus");
      }

      if (nr === maze.exitR && nc === maze.exitC) {
        completeLevel();
        return;
      }
      current.sound.play("tick");
    },
    [completeLevel],
  );

  // Flèches + WASD (une case par appui, défilement bloqué pendant la partie).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      let dr = 0;
      let dc = 0;
      switch (event.key) {
        case "ArrowUp":
        case "w":
        case "W":
          dr = -1;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          dr = 1;
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          dc = -1;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          dc = 1;
          break;
        default:
          return;
      }
      if (!ctxRef.current.running) return;
      if (event.key.startsWith("Arrow")) event.preventDefault();
      tryMove(dr, dc);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tryMove]);

  // Rendu : boucle RAF, image figée quand le jeu est en pause (§2).
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    const { width, height } = sizeRef.current;
    g.clearRect(0, 0, width, height);

    const maze = mazeRef.current;
    if (!maze) return;

    const cell = Math.min(width / maze.cols, height / maze.rows);
    const originX = (width - maze.cols * cell) / 2;
    const originY = (height - maze.rows * cell) / 2;
    const running = ctxRef.current.running;

    // Fond doux autour du labyrinthe.
    g.fillStyle = "#EEEBFF";
    roundedRect(g, originX - 3, originY - 3, maze.cols * cell + 6, maze.rows * cell + 6, 10);
    g.fill();

    // Cases : murs violets, chemins blancs, passage parcouru teinté.
    for (let r = 0; r < maze.rows; r++) {
      for (let c = 0; c < maze.cols; c++) {
        const x = originX + c * cell;
        const y = originY + r * cell;
        if (maze.walls[r][c]) {
          g.fillStyle = "#6C5CE7";
          roundedRect(g, x + 0.5, y + 0.5, cell - 1, cell - 1, Math.min(4, cell * 0.28));
          g.fill();
        } else {
          g.fillStyle = trailRef.current.has(r * maze.cols + c) ? "#FFF3DC" : "#FFFFFF";
          g.fillRect(x, y, cell + 0.6, cell + 0.6);
        }
      }
    }

    // Sortie : halo qui pulse (oscillation figée si le jeu est en pause).
    const exitX = originX + maze.exitC * cell;
    const exitY = originY + maze.exitR * cell;
    const pulse = running ? 0.5 + 0.5 * Math.abs(Math.sin(performance.now() / 320)) : 0.7;
    g.save();
    g.globalAlpha = 0.35 + 0.45 * pulse;
    g.fillStyle = "#FFB020";
    roundedRect(
      g,
      exitX + cell * 0.04,
      exitY + cell * 0.04,
      cell * 0.92,
      cell * 0.92,
      Math.min(6, cell * 0.24),
    );
    g.fill();
    g.restore();

    g.textAlign = "center";
    g.textBaseline = "middle";

    // Étoiles restantes de ce labyrinthe.
    g.font = `${cell * 0.56}px serif`;
    for (const index of starsRef.current) {
      const sr = Math.floor(index / maze.cols);
      const sc = index % maze.cols;
      g.fillText("⭐", originX + (sc + 0.5) * cell, originY + (sr + 0.56) * cell);
    }

    // Porte.
    g.font = `${cell * 0.62}px serif`;
    g.fillText("🚪", exitX + cell * 0.5, exitY + cell * 0.56);

    // Lapin.
    const player = playerRef.current;
    g.font = `${cell * 0.7}px serif`;
    g.fillText("🐰", originX + (player.c + 0.5) * cell, originY + (player.r + 0.56) * cell);
  }, [canvasRef]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // Balayage (glissement du doigt) : un pas dans la direction du geste.
  const onCanvasPointerDown = (event: { clientX: number; clientY: number }): void => {
    swipeRef.current = { x: event.clientX, y: event.clientY };
  };

  const onCanvasPointerUp = (event: { clientX: number; clientY: number }): void => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) >= Math.abs(dy)) tryMove(0, dx > 0 ? 1 : -1);
    else tryMove(dy > 0 ? 1 : -1, 0);
  };

  const onCanvasPointerCancel = (): void => {
    swipeRef.current = null;
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="chip bg-accent-soft text-ink" aria-live="polite">
        ⭐ {mazeStars} / 3
      </p>

      <div className="w-full max-w-[520px]">
        <canvas
          ref={canvasRef}
          onPointerDown={onCanvasPointerDown}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerCancel}
          className="block touch-none rounded-2xl"
          role="img"
          aria-label="🌀"
        />
      </div>

      {/* Croix tactile : toujours visible (tablette, téléphone, souris). */}
      <div className="grid grid-cols-3 place-items-center gap-2">
        <button
          type="button"
          onClick={() => tryMove(-1, 0)}
          className={`${DPAD_BUTTON} col-start-2 row-start-1`}
          aria-label="⬆️"
        >
          ⬆️
        </button>
        <button
          type="button"
          onClick={() => tryMove(0, -1)}
          className={`${DPAD_BUTTON} col-start-1 row-start-2`}
          aria-label="⬅️"
        >
          ⬅️
        </button>
        <button
          type="button"
          onClick={() => tryMove(0, 1)}
          className={`${DPAD_BUTTON} col-start-3 row-start-2`}
          aria-label="➡️"
        >
          ➡️
        </button>
        <button
          type="button"
          onClick={() => tryMove(1, 0)}
          className={`${DPAD_BUTTON} col-start-2 row-start-3`}
          aria-label="⬇️"
        >
          ⬇️
        </button>
      </div>
    </div>
  );
}
