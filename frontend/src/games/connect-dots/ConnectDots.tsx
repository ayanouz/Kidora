// ══════════════════════════════════════════════════════════════════
//  KIDORA — Relie les Points (moteur « connect-dots »)
//  3 dessins, 3 niveaux : suis les numéros dans l'ordre.
// ══════════════════════════════════════════════════════════════════

import { useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { useAward, useCtxRef, useTimers } from "../shared/kit";

interface Pattern {
  points: [number, number][];
  color: string;
  emoji: string;
}

const PATTERNS: Record<DifficultyKey, Pattern> = {
  easy: {
    points: [
      [24, 82],
      [24, 42],
      [50, 16],
      [76, 42],
      [76, 82],
    ],
    color: "#FF5A5F",
    emoji: "🏠",
  },
  medium: {
    points: [
      [50, 8],
      [62, 36],
      [92, 38],
      [68, 56],
      [79, 88],
      [50, 69],
      [21, 88],
      [32, 56],
      [8, 38],
      [38, 36],
    ],
    color: "#FDCB6E",
    emoji: "⭐",
  },
  hard: {
    points: [
      [50, 88],
      [24, 64],
      [12, 42],
      [20, 22],
      [38, 12],
      [50, 26],
      [62, 12],
      [80, 22],
      [88, 42],
      [76, 64],
    ],
    color: "#E84393",
    emoji: "💖",
  },
};

export function ConnectDots({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const pattern = PATTERNS[ctx.difficulty];
  const points = pattern.points;
  const [next, setNext] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const doneRef = useCtxRef(ctx);
  const nextRef = useRef(0);
  const mistakesRef = useRef(0);
  const finishedLockRef = useRef(false);

  const completed = next >= points.length;
  const pointsPerDot = Math.max(15, Math.floor((ctx.game.config.maxScore?.[ctx.difficulty] ?? ctx.game.maxScoreHint) * 0.9 / points.length));

  const onDot = (index: number) => {
    const current = ctxRef.current;
    if (!current.running || finishedLockRef.current) return;
    if (index !== nextRef.current) {
      mistakesRef.current += 1;
      setMistakes(mistakesRef.current);
      current.signalWrong();
      return;
    }
    award(pointsPerDot, true);
    current.sound.play("pop");
    const updated = nextRef.current + 1;
    nextRef.current = updated;
    setNext(updated);
    if (updated >= points.length) {
      finishedLockRef.current = true;
      later(() => {
        doneRef.current.finish({
          isWin: true,
          levelReached: 1,
          clientMeta: { game: "connect-dots", mistakes: mistakesRef.current },
        });
      }, 700);
    }
  };

  const polyline = points.slice(0, Math.max(1, next + 1)).map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
      <span className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        {next} / {points.length} {mistakes > 0 ? `· 🔄 ${mistakes}` : ""}
      </span>

      <div className="relative mx-auto aspect-square w-full max-w-lg rounded-card border-4 border-white bg-gradient-to-br from-primary-soft to-accent-soft shadow-soft">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {next > 0 && (
            <polyline
              points={polyline}
              fill={completed ? pattern.color : "none"}
              fillOpacity={0.18}
              stroke={pattern.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {completed && (
            <polygon
              points={points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill={pattern.color}
              fillOpacity={0.85}
              stroke={pattern.color}
              strokeWidth={2}
            />
          )}
        </svg>

        {completed && (
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl animate-pop-in"
            aria-hidden="true"
          >
            {pattern.emoji}
          </span>
        )}

        {points.map(([x, y], index) => {
          const isDone = index < next;
          const isNext = index === next;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onDot(index)}
              aria-label={`${index + 1}`}
              className={cn(
                "absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-bold shadow-soft transition-all sm:h-12 sm:w-12",
                isDone
                  ? "border-white/80 bg-success text-white"
                  : isNext
                    ? "animate-pulse border-primary bg-white text-primary ring-4 ring-primary/30"
                    : "border-primary/30 bg-white/90 text-ink-soft hover:border-primary",
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <p className="text-xs font-semibold text-ink-faint">
        {completed ? "🌟" : "👆 1 → 2 → 3…"}
      </p>
    </div>
  );
}
