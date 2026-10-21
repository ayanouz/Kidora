// ══════════════════════════════════════════════════════════════════
//  KIDORA — Chasse aux Nombres (moteur « number-hunt »)
//  Tableau de Schulte : touche les nombres dans l'ordre, le plus vite
//  possible. Un classique d'attention visuelle et de rapidité.
// ══════════════════════════════════════════════════════════════════

import { useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { scoreCap, shuffle, useAward, useCtxRef, useTimers } from "../shared/kit";

const SIZES: Record<DifficultyKey, number> = { easy: 4, medium: 5, hard: 6 };

export function NumberHunt({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const size = SIZES[ctx.difficulty];
  const total = size * size;
  const pointsPerNumber = Math.max(10, Math.floor(scoreCap(ctx) / total));

  const [numbers] = useState<number[]>(() =>
    shuffle(Array.from({ length: total }, (_, index) => index + 1)),
  );
  const [next, setNext] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);
  const doneRef = useCtxRef(ctx);
  const nextRef = useRef(1);
  const mistakesRef = useRef(0);
  const finishedRef = useRef(false);

  const onNumber = (value: number) => {
    const current = ctxRef.current;
    if (!current.running || finishedRef.current) return;
    if (value !== nextRef.current) {
      mistakesRef.current += 1;
      setMistakes(mistakesRef.current);
      current.signalWrong();
      return;
    }
    award(pointsPerNumber);
    const updated = nextRef.current + 1;
    nextRef.current = updated;
    setNext(updated);
    if (value >= total) {
      finishedRef.current = true;
      setDone(true);
      later(() => {
        doneRef.current.finish({
          isWin: true,
          levelReached: 1,
          clientMeta: { game: "number-hunt", size, mistakes: mistakesRef.current },
        });
      }, 600);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="chip bg-primary text-white" aria-live="polite">
          👉 {Math.min(next, total)}
        </span>
        <span className="chip bg-white text-ink-soft">✅ {next - 1}/{total}</span>
        {mistakes > 0 && (
          <span className="chip bg-warning-soft text-ink">🔄 {mistakes}</span>
        )}
      </div>

      <div
        className="grid w-full max-w-xl gap-1.5 rounded-card bg-white/80 p-2 shadow-soft sm:gap-2 sm:p-3"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="🔢"
      >
        {numbers.map((value) => {
          const found = value < next;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onNumber(value)}
              disabled={found || done}
              aria-label={`${value}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl border-2 text-lg font-bold shadow-sm transition-all sm:text-2xl",
                found
                  ? "border-success/20 bg-success-soft text-success/60"
                  : "border-primary/10 bg-white text-ink hover:border-primary/40 hover:bg-primary-soft/50 active:scale-95",
              )}
            >
              {value}
            </button>
          );
        })}
      </div>

      <p className="text-xs font-semibold text-ink-faint">
        {done ? "🎉" : "👆 1 → 2 → 3…"}
      </p>
    </div>
  );
}
