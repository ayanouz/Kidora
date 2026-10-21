// ══════════════════════════════════════════════════════════════════
//  KIDORA — Morpion (moteur « tic-tac-toe »)
//  3 manches contre une IA adaptative. Le joueur commence une
//  manche sur deux.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { useAward, useCtxRef, useTimers } from "../shared/kit";

type Mark = 0 | 1 | 2;
type Board = Mark[];

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

const ROUNDS = 3;

function winnerOf(board: Board): 0 | 1 | 2 | 3 {
  for (const [a, b, c] of LINES) {
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  return board.includes(0) ? 0 : 3;
}

function minimax(board: Board, turn: 1 | 2, depth: number): { score: number; move: number } {
  const result = winnerOf(board);
  if (result === 2) return { score: 10 - depth, move: -1 };
  if (result === 1) return { score: depth - 10, move: -1 };
  if (result === 3) return { score: 0, move: -1 };

  let bestScore = turn === 2 ? -Infinity : Infinity;
  let bestMove = -1;
  board.forEach((value, index) => {
    if (value !== 0) return;
    const next = [...board] as Board;
    next[index] = turn;
    const { score } = minimax(next, turn === 1 ? 2 : 1, depth + 1);
    if (turn === 2 ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = index;
    }
  });
  return { score: bestScore, move: bestMove };
}

function chooseAi(board: Board, difficulty: DifficultyKey): number {
  const empties = board.map((value, index) => (value === 0 ? index : -1)).filter((index) => index >= 0);
  if (empties.length === 0) return -1;
  const random = empties[Math.floor(Math.random() * empties.length)];
  if (difficulty === "easy") return random;
  if (difficulty === "medium" && Math.random() < 0.35) return random;
  return minimax(board, 2, 0).move;
}

export function TicTacToe({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const [board, setBoard] = useState<Board>(() => Array(9).fill(0) as Board);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [round, setRound] = useState(1);
  const [status, setStatus] = useState<"playing" | "over">("playing");
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [totals, setTotals] = useState({ wins: 0, losses: 0, draws: 0 });
  const totalsRef = useRef(totals);
  totalsRef.current = totals;
  const overRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    ctxRef.current.setLives(null);
    ctxRef.current.setTimeLeft(null);
    ctxRef.current.setRoundsTotal(ROUNDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextRound = useCallback((next: number) => {
    if (next > ROUNDS) {
      const final = totalsRef.current;
      overRef.current = true;
      ctxRef.current.finish({
        isWin: final.wins > final.losses || (final.wins === 0 && final.losses === 0 && final.draws > 0),
        levelReached: 1,
        clientMeta: { game: "tic-tac-toe", ...final },
      });
      return;
    }
    setRound(next);
    setBoard(Array(9).fill(0) as Board);
    setTurn(next % 2 === 0 ? 2 : 1);
    setStatus("playing");
    setResult(null);
    busyRef.current = false;
  }, []);

  const endRound = useCallback(
    (outcome: 0 | 1 | 2 | 3) => {
      setStatus("over");
      setResult(outcome === 1 ? "win" : outcome === 2 ? "lose" : "draw");
      if (outcome === 1) {
        award(300);
        setTotals((value) => ({ ...value, wins: value.wins + 1 }));
      } else if (outcome === 2) {
        ctxRef.current.sound.play("wrong");
        setTotals((value) => ({ ...value, losses: value.losses + 1 }));
      } else {
        award(80, true);
        setTotals((value) => ({ ...value, draws: value.draws + 1 }));
      }
      const next = round + 1;
      later(() => nextRound(next), 1000);
    },
    [award, later, nextRound, round],
  );

  const play = useCallback(
    (index: number) => {
      const current = ctxRef.current;
      if (!current.running || status !== "playing" || turn !== 1 || board[index] !== 0 || busyRef.current) {
        return;
      }
      busyRef.current = true;
      const next = [...board] as Board;
      next[index] = 1;
      setBoard(next);
      current.sound.play("click");
      const resultNow = winnerOf(next);
      if (resultNow !== 0) {
        endRound(resultNow);
        return;
      }
      setTurn(2);
    },
    [board, endRound, status, turn],
  );

  useEffect(() => {
    if (status !== "playing" || turn !== 2) return;
    const id = window.setTimeout(() => {
      const current = ctxRef.current;
      if (!current.running) return;
      const move = chooseAi(board, current.difficulty);
      if (move < 0) return;
      const next = [...board] as Board;
      next[move] = 2;
      setBoard(next);
      current.sound.play("flip");
      const resultNow = winnerOf(next);
      if (resultNow !== 0) {
        endRound(resultNow);
        return;
      }
      setTurn(1);
      busyRef.current = false;
    }, 500);
    return () => window.clearTimeout(id);
  }, [board, endRound, status, turn, ctx.running]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="chip bg-secondary-soft text-secondary-dark">🎯 {round}/{ROUNDS}</span>
        <span className="chip bg-success-soft text-success">❌ {totals.wins}</span>
        <span className="chip bg-danger-soft text-danger">⭕ {totals.losses}</span>
        <span className="chip bg-white text-ink-soft">🤝 {totals.draws}</span>
      </div>

      <div className="grid w-full max-w-[19rem] grid-cols-3 gap-2 rounded-card bg-primary-soft/50 p-3 shadow-soft">
        {board.map((value, index) => (
          <button
            key={index}
            type="button"
            onClick={() => play(index)}
            disabled={value !== 0 || turn !== 1 || status !== "playing"}
            aria-label={value === 1 ? "❌" : value === 2 ? "⭕" : `${index + 1}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-2xl border-2 bg-white text-4xl shadow-sm transition-all sm:text-5xl",
              value === 0 && "border-primary/15 hover:border-primary/50 hover:bg-primary-soft/60 active:scale-95",
              value === 1 && "border-success/30",
              value === 2 && "border-danger/30",
              status === "over" && result === "win" && "bg-success-soft",
            )}
          >
            {value === 1 ? "❌" : value === 2 ? "⭕" : ""}
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold text-ink-faint" aria-live="polite">
        {status === "over"
          ? result === "win"
            ? "🎉"
            : result === "draw"
              ? "🤝"
              : "😊"
          : turn === 1
            ? "❌"
            : "⭕…"}
      </p>
    </div>
  );
}
