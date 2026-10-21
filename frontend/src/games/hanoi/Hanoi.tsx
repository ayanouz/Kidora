// ══════════════════════════════════════════════════════════════════
//  KIDORA — Tours de Hanoï (moteur « hanoi »)
//  Déplace tous les disques sur la 3e tour, sans poser un grand
//  disque sur un plus petit.
// ══════════════════════════════════════════════════════════════════

import { useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { scoreCap, useAward, useCtxRef, useTimers } from "../shared/kit";

const DISKS: Record<DifficultyKey, number> = { easy: 4, medium: 5, hard: 6 };
const PEG_COLORS = ["#6C5CE7", "#E84393", "#00B8A9", "#FDCB6E", "#FF5A5F", "#0984E3"];

export function Hanoi({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const count = DISKS[ctx.difficulty];
  const [pegs, setPegs] = useState<number[][]>(() => [
    Array.from({ length: count }, (_, index) => count - index),
    [],
    [],
  ]);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const doneRef = useCtxRef(ctx);
  const pegsRef = useRef(pegs);
  pegsRef.current = pegs;
  const selectedRef = useRef<number | null>(null);
  const movesRef = useRef(0);
  const finishedRef = useRef(false);

  const move = (target: number) => {
    const current = ctxRef.current;
    if (!current.running || finishedRef.current) return;
    const currentPegs = pegsRef.current;
    const active = selectedRef.current;

    if (active === null) {
      if (currentPegs[target].length === 0) {
        current.sound.play("click");
        return;
      }
      selectedRef.current = target;
      setSelected(target);
      current.sound.play("click");
      return;
    }

    if (active === target) {
      selectedRef.current = null;
      setSelected(null);
      return;
    }

    const sourceTop = currentPegs[active][currentPegs[active].length - 1];
    const targetTop = currentPegs[target][currentPegs[target].length - 1];
    if (sourceTop === undefined) {
      selectedRef.current = null;
      setSelected(null);
      return;
    }
    if (targetTop !== undefined && sourceTop > targetTop) {
      current.signalWrong();
      return;
    }

    const next = currentPegs.map((peg) => [...peg]);
    next[active].pop();
    next[target].push(sourceTop);
    pegsRef.current = next;
    setPegs(next);
    selectedRef.current = null;
    setSelected(null);
    movesRef.current += 1;
    setMoves(movesRef.current);
    current.sound.play("flip");

    if (next[2].length === count) {
      finishedRef.current = true;
      setDone(true);
      award(scoreCap(ctx));
      later(() => {
        doneRef.current.finish({
          isWin: true,
          levelReached: 1,
          clientMeta: { game: "hanoi", disks: count, moves: movesRef.current },
        });
      }, 700);
    }
  };

  const minimumMoves = Math.pow(2, count) - 1;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="chip bg-primary-soft text-primary-dark">🎯 {count}</span>
        <span className="chip bg-white text-ink-soft">🔄 {moves}</span>
        <span className="chip bg-accent-soft text-ink">💡 {minimumMoves}</span>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-3 gap-2 rounded-card bg-gradient-to-b from-primary-soft/50 to-accent-soft/50 p-3 shadow-soft sm:gap-4">
        {pegs.map((peg, index) => (
          <button
            key={index}
            type="button"
            onClick={() => move(index)}
            aria-label={`${index + 1}`}
            className={cn(
              "relative flex min-h-[15rem] flex-col-reverse items-center justify-end gap-1 rounded-2xl border-2 border-transparent px-1 pb-3 pt-10 transition-all sm:min-h-[19rem]",
              selected === index && "border-primary/40 bg-white/40",
              "hover:bg-white/30",
            )}
          >
            <span
              className="absolute bottom-2 top-3 w-2 rounded-full bg-ink/20"
              aria-hidden="true"
            />
            <span
              className={cn(
                "absolute bottom-0 h-3 w-full max-w-[9rem] rounded-full bg-ink/20 transition-colors",
                selected === index && "bg-primary/40",
              )}
              aria-hidden="true"
            />
            {peg.map((disk) => (
              <span
                key={disk}
                className="relative z-10 flex h-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-soft sm:h-6 sm:text-xs"
                style={{
                  width: `${30 + (disk / count) * 62}%`,
                  backgroundColor: PEG_COLORS[(disk - 1) % PEG_COLORS.length],
                }}
                aria-hidden="true"
              >
                {disk}
              </span>
            ))}
            <span className="absolute top-2 text-xs font-bold text-ink-faint">{index + 1}</span>
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold text-ink-faint" aria-live="polite">
        {done ? "🎉" : selected === null ? "👆 1 → 2" : "👆 2 → 3"}
      </p>
    </div>
  );
}
