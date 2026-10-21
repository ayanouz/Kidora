// ══════════════════════════════════════════════════════════════════
//  KIDORA — Petit Démineur (moteur « minesweeper »)
//  Première case toujours sûre. Mode 🚩 pour poser un drapeau.
// ══════════════════════════════════════════════════════════════════

import { useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { scoreCap, shuffle, useAward, useCtxRef, useTimers } from "../shared/kit";

const SIZE = 6;
const MINES: Record<DifficultyKey, number> = { easy: 4, medium: 6, hard: 8 };

interface MineState {
  mines: boolean[][];
  counts: number[][];
  revealed: boolean[][];
  flags: boolean[][];
  started: boolean;
  lost: boolean;
  won: boolean;
}

function emptyGrid<T>(value: T): T[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => value));
}

function initialState(): MineState {
  return {
    mines: emptyGrid(false),
    counts: emptyGrid(0),
    revealed: emptyGrid(false),
    flags: emptyGrid(false),
    started: false,
    lost: false,
    won: false,
  };
}

function neighbours(row: number, col: number): { r: number; c: number }[] {
  const cells: { r: number; c: number }[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) cells.push({ r, c });
    }
  }
  return cells;
}

function generate(minesCount: number, safeRow: number, safeCol: number): MineState {
  const state = initialState();
  const forbidden = new Set<string>([`${safeRow}-${safeCol}`]);
  neighbours(safeRow, safeCol).forEach(({ r, c }) => forbidden.add(`${r}-${c}`));
  const candidates: { r: number; c: number }[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!forbidden.has(`${r}-${c}`)) candidates.push({ r, c });
    }
  }
  const pool = candidates.length >= minesCount ? candidates : (() => {
    const all: { r: number; c: number }[] = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!(r === safeRow && c === safeCol)) all.push({ r, c });
    return all;
  })();
  shuffle(pool).slice(0, minesCount).forEach(({ r, c }) => {
    state.mines[r][c] = true;
  });
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      state.counts[r][c] = neighbours(r, c).filter(({ r: nr, c: nc }) => state.mines[nr][nc]).length;
    }
  }
  state.started = true;
  return state;
}

export function Minesweeper({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const minesCount = MINES[ctx.difficulty];
  const totalSafe = SIZE * SIZE - minesCount;
  const pointsPerCell = Math.max(10, Math.floor(scoreCap(ctx) / totalSafe));
  const [state, setState] = useState<MineState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [flagMode, setFlagMode] = useState(false);
  const overRef = useRef(false);

  const commit = (next: MineState) => {
    stateRef.current = next;
    setState(next);
  };

  const reveal = (base: MineState, row: number, col: number): { next: MineState; opened: number } => {
    const next: MineState = {
      ...base,
      mines: base.mines.map((line) => [...line]),
      counts: base.counts.map((line) => [...line]),
      revealed: base.revealed.map((line) => [...line]),
      flags: base.flags.map((line) => [...line]),
    };
    let opened = 0;
    const stack = [{ r: row, c: col }];
    while (stack.length > 0) {
      const cell = stack.pop();
      if (!cell) continue;
      const { r, c } = cell;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
      if (next.revealed[r][c] || next.flags[r][c]) continue;
      next.revealed[r][c] = true;
      opened += 1;
      if (next.counts[r][c] === 0) neighbours(r, c).forEach((neighbour) => stack.push(neighbour));
    }
    return { next, opened };
  };

  const onCell = (row: number, col: number, forceFlag = false) => {
    const current = ctxRef.current;
    if (!current.running || overRef.current) return;
    let base = stateRef.current;
    if (base.revealed[row][col] || base.won || base.lost) return;

    if (forceFlag || flagMode) {
      if (base.revealed[row][col]) return;
      const next: MineState = { ...base, flags: base.flags.map((line) => [...line]) };
      next.flags[row][col] = !next.flags[row][col];
      commit(next);
      current.sound.play("click");
      return;
    }

    if (base.flags[row][col]) return;
    if (!base.started) base = generate(minesCount, row, col);

    if (base.mines[row][col]) {
      const next: MineState = {
        ...base,
        lost: true,
        revealed: base.revealed.map((line, r) => line.map((value, c) => value || base.mines[r][c])),
      };
      commit(next);
      overRef.current = true;
      current.signalWrong();
      later(() => {
        ctxRef.current.finish({
          isWin: false,
          levelReached: 1,
          clientMeta: { game: "minesweeper", mines: minesCount },
        });
      }, 500);
      return;
    }

    const { next, opened } = reveal(base, row, col);
    const revealedCount = next.revealed.flat().filter(Boolean).length;
    if (revealedCount >= totalSafe) {
      next.won = true;
      commit(next);
      overRef.current = true;
      award(pointsPerCell * Math.max(1, opened));
      current.sound.play("win");
      later(() => {
        ctxRef.current.finish({
          isWin: true,
          levelReached: 1,
          clientMeta: { game: "minesweeper", mines: minesCount },
        });
      }, 500);
      return;
    }
    commit(next);
    if (opened > 0) {
      award(pointsPerCell * opened, true);
      current.sound.play("pop");
    }
  };

  const flags = state.flags.flat().filter(Boolean).length;
  const revealedCount = state.revealed.flat().filter(Boolean).length;
  const numberColors = ["", "text-blue-600", "text-green-600", "text-red-600", "text-purple-700", "text-orange-600", "text-pink-600", "text-ink", "text-ink"];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFlagMode((value) => !value);
            ctxRef.current.sound.play("click");
          }}
          aria-pressed={flagMode}
          className={cn(
            "chip border-2 transition-all",
            flagMode ? "border-danger bg-danger-soft text-danger" : "border-transparent bg-white text-ink-soft",
          )}
        >
          🚩 {flagMode ? "ON" : "OFF"}
        </button>
        <span className="chip bg-primary-soft text-primary-dark">
          💣 {minesCount - flags}
        </span>
        <span className="chip bg-white text-ink-soft">
          🔎 {revealedCount}/{totalSafe}
        </span>
      </div>

      <div
        className="grid w-full max-w-sm gap-1.5 rounded-card bg-primary/10 p-2 shadow-soft"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="💣"
      >
        {state.revealed.map((line, row) =>
          line.map((isRevealed, col) => {
            const mine = state.mines[row][col];
            const flag = state.flags[row][col];
            const count = state.counts[row][col];
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                onClick={() => onCell(row, col)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onCell(row, col, true);
                }}
                aria-label={
                  isRevealed ? (mine ? "💣" : String(count)) : flag ? "🚩" : "?"
                }
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg border-2 text-lg font-bold transition-all sm:text-xl",
                  isRevealed
                    ? mine
                      ? "border-danger/40 bg-danger-soft"
                      : "border-primary/10 bg-white"
                    : "border-white/70 bg-primary-soft shadow-sm hover:border-primary/40 hover:bg-primary-soft/70",
                )}
              >
                {isRevealed ? (
                  mine ? "💣" : count > 0 ? <span className={numberColors[count]}>{count}</span> : ""
                ) : flag ? (
                  "🚩"
                ) : (
                  ""
                )}
              </button>
            );
          }),
        )}
      </div>
      <p className="text-xs font-semibold text-ink-faint">
        {state.won ? "🎉" : state.lost ? "😊" : "👆 / clic droit 🚩"}
      </p>
    </div>
  );
}
