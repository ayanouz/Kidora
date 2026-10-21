// ══════════════════════════════════════════════════════════════════
//  KIDORA — Puissance 4 (moteur « connect-four »)
//  7 colonnes × 6 lignes contre une IA. Aligne 4 jetons !
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { useAward, useCtxRef, useTimers } from "../shared/kit";

const COLS = 7;
const ROWS = 6;
type Board = number[][];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0));
}

function drop(board: Board, col: number, mark: number): Board | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) {
      const next = board.map((line) => [...line]);
      next[row][col] = mark;
      return next;
    }
  }
  return null;
}

function wins(board: Board, mark: number): boolean {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[row][col] !== mark) continue;
      if (col + 3 < COLS && board[row][col + 1] === mark && board[row][col + 2] === mark && board[row][col + 3] === mark) return true;
      if (row + 3 < ROWS && board[row + 1][col] === mark && board[row + 2][col] === mark && board[row + 3][col] === mark) return true;
      if (row + 3 < ROWS && col + 3 < COLS && board[row + 1][col + 1] === mark && board[row + 2][col + 2] === mark && board[row + 3][col + 3] === mark) return true;
      if (row + 3 < ROWS && col - 3 >= 0 && board[row + 1][col - 1] === mark && board[row + 2][col - 2] === mark && board[row + 3][col - 3] === mark) return true;
    }
  }
  return false;
}

function availableColumns(board: Board): number[] {
  return Array.from({ length: COLS }, (_, col) => col).filter((col) => board[0][col] === 0);
}

function chooseColumn(board: Board, difficulty: DifficultyKey): number {
  const available = availableColumns(board);
  if (available.length === 0) return -1;
  if (difficulty === "easy" && Math.random() < 0.5) {
    return available[Math.floor(Math.random() * available.length)];
  }
  // Gagner tout de suite ?
  for (const col of available) {
    const next = drop(board, col, 2);
    if (next && wins(next, 2)) return col;
  }
  // Bloquer le joueur ?
  for (const col of available) {
    const next = drop(board, col, 1);
    if (next && wins(next, 1)) return col;
  }
  // Préférer le centre.
  const ordered = [...available].sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
  const random = available[Math.floor(Math.random() * available.length)];
  return difficulty === "medium" && Math.random() < 0.3 ? random : ordered[0] ?? random;
}

export function ConnectFour({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [status, setStatus] = useState<"playing" | "over">("playing");
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const finishedRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    ctxRef.current.setLives(null);
    ctxRef.current.setTimeLeft(null);
    ctxRef.current.setRoundsTotal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endGame = useCallback(
    (outcome: "win" | "lose" | "draw") => {
      if (finishedRef.current) return;
      setStatus("over");
      setResult(outcome);
      if (outcome === "win") award(400);
      else if (outcome === "draw") award(100, true);
      else ctxRef.current.sound.play("wrong");
      later(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        ctxRef.current.finish({
          isWin: outcome === "win" || outcome === "draw",
          levelReached: 1,
          clientMeta: { game: "connect-four", result: outcome },
        });
      }, 1200);
    },
    [award, later],
  );

  const playerMove = (col: number) => {
    const current = ctxRef.current;
    if (!current.running || status !== "playing" || turn !== 1 || busyRef.current) return;
    const next = drop(board, col, 1);
    if (!next) return;
    busyRef.current = true;
    setBoard(next);
    award(10, true);
    current.sound.play("flip");
    if (wins(next, 1)) {
      endGame("win");
      return;
    }
    if (availableColumns(next).length === 0) {
      endGame("draw");
      return;
    }
    setTurn(2);
  };

  useEffect(() => {
    if (status !== "playing" || turn !== 2 || !ctx.running) return;
    const id = window.setTimeout(() => {
      const current = ctxRef.current;
      if (!current.running || status !== "playing") return;
      const col = chooseColumn(board, current.difficulty);
      if (col < 0) return;
      const next = drop(board, col, 2);
      if (!next) return;
      setBoard(next);
      current.sound.play("pop");
      if (wins(next, 2)) {
        endGame("lose");
        return;
      }
      if (availableColumns(next).length === 0) {
        endGame("draw");
        return;
      }
      busyRef.current = false;
      setTurn(1);
    }, 650);
    return () => window.clearTimeout(id);
  }, [board, ctx.running, endGame, status, turn]);

  const winningCells = new Set<string>();
  if (result === "win" || result === "lose") {
    // Surlignage simple : toutes les cases du gagnant (suffisant pour un enfant).
    board.forEach((line, row) =>
      line.forEach((value, col) => {
        if (value === (result === "win" ? 1 : 2)) winningCells.add(`${row}-${col}`);
      }),
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
      <div className="flex items-center gap-2">
        <span className="chip bg-primary-soft text-primary-dark">🔴 {turn === 1 && status === "playing" ? "👈" : ""}</span>
        <span className="chip bg-white text-ink-soft">🟡</span>
        {result && (
          <span className="chip bg-accent-soft text-ink" aria-live="polite">
            {result === "win" ? "🎉" : result === "draw" ? "🤝" : "😊"}
          </span>
        )}
      </div>

      <div className="flex w-full max-w-lg items-end justify-between gap-1 rounded-card bg-primary/10 px-2 py-2">
        {Array.from({ length: COLS }, (_, col) => (
          <button
            key={col}
            type="button"
            onClick={() => playerMove(col)}
            disabled={board[0][col] !== 0 || turn !== 1 || status !== "playing"}
            aria-label={`${col + 1}`}
            className="flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-bold text-primary-dark transition-all hover:bg-white/60 disabled:opacity-30"
          >
            ▼
          </button>
        ))}
      </div>

      <div className="w-full max-w-lg rounded-card bg-primary p-2 shadow-card sm:p-3">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {board.map((line, row) =>
            line.map((value, col) => (
              <div
                key={`${row}-${col}`}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-full border-2 border-white/20",
                  value === 0 && "bg-white/15",
                  value === 1 && "bg-danger shadow-inner",
                  value === 2 && "bg-accent shadow-inner",
                  winningCells.has(`${row}-${col}`) && "ring-4 ring-white",
                )}
                aria-label={value === 1 ? "🔴" : value === 2 ? "🟡" : ""}
              >
                {value !== 0 && (
                  <span className="text-xs opacity-70 sm:text-base" aria-hidden="true">
                    {value === 1 ? "🔴" : "🟡"}
                  </span>
                )}
              </div>
            )),
          )}
        </div>
      </div>

      <p className="text-xs font-semibold text-ink-faint">
        👆 1 → 7 {turn === 2 && status === "playing" ? "· 🤖…" : ""}
      </p>
    </div>
  );
}
