// ══════════════════════════════════════════════════════════════════
//  KIDORA — Qu'est-ce qui a disparu ? (moteur « disappearing »)
//  Observe la grille, puis retrouve l'élément qui s'est volatilisé.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { pickMany, pickOne, randInt, scoreCap, shuffle, useAward, useCtxRef, useTimers } from "../shared/kit";

const ROUNDS: Record<DifficultyKey, number> = { easy: 5, medium: 6, hard: 8 };
const SHOW_MS: Record<DifficultyKey, number> = { easy: 2500, medium: 2100, hard: 1800 };
const CELLS: Record<DifficultyKey, number> = { easy: 9, medium: 12, hard: 16 };

const POOL = [
  "🐼", "🦊", "🐸", "🦉", "🦁", "🐯", "🐙", "🐧", "🦄", "🐨",
  "🍎", "🍌", "🍇", "🍓", "🍉", "🍕", "🍩", "🍪", "🌻", "🌵",
  "🚗", "🚀", "⚽", "🎈", "🎸", "🧸", "🪁", "🛸", "🌈", "⭐",
];

export function Disappearing({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const rounds = ROUNDS[ctx.difficulty];
  const cellCount = CELLS[ctx.difficulty];
  const points = Math.max(20, Math.floor(scoreCap(ctx) / rounds));

  const [round, setRound] = useState(0);
  const [items, setItems] = useState<string[]>(() => pickMany(POOL, cellCount));
  const [missing, setMissing] = useState(() => randInt(0, cellCount - 1));
  const [options, setOptions] = useState<string[]>(() => []);
  const [phase, setPhase] = useState<"show" | "answer">("show");
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const correctRef = useRef(0);
  const showMsRef = useRef(SHOW_MS[ctx.difficulty]);
  const finishedRef = useRef(false);
  const currentItemsRef = useRef(items);
  currentItemsRef.current = items;
  const pickedRef = useRef(false);

  const startRound = useCallback(() => {
    const nextItems = pickMany(POOL, cellCount);
    const nextMissing = randInt(0, cellCount - 1);
    const missingEmoji = nextItems[nextMissing];
    const decoys = pickMany(
      POOL.filter((emoji) => !nextItems.includes(emoji)),
      3,
    );
    setItems(nextItems);
    setMissing(nextMissing);
    setOptions(shuffle([missingEmoji, ...decoys]));
    setPhase("show");
    setPicked(null);
    pickedRef.current = false;
    showMsRef.current = SHOW_MS[ctx.difficulty];
  }, [cellCount, ctx.difficulty]);

  useEffect(() => {
    // Le premier tour doit aussi proposer 4 réponses.
    const missingEmoji = currentItemsRef.current[missing];
    setOptions(
      shuffle([
        missingEmoji,
        ...pickMany(
          POOL.filter((emoji) => !currentItemsRef.current.includes(emoji)),
          3,
        ),
      ]),
    );
    ctxRef.current.setRoundsTotal(rounds);
    ctxRef.current.setLives(null);
    ctxRef.current.setTimeLeft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "show") return;
    const id = window.setInterval(() => {
      if (!ctxRef.current.running) return;
      showMsRef.current -= 100;
      if (showMsRef.current <= 0) {
        window.clearInterval(id);
        setPhase("answer");
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, round]);

  const pick = (option: string) => {
    const current = ctxRef.current;
    if (phase !== "answer" || pickedRef.current || !current.running || finishedRef.current) return;
    pickedRef.current = true;
    setPicked(option);
    if (option === items[missing]) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
      award(points);
    } else {
      current.signalWrong();
    }
    later(() => {
      if (finishedRef.current) return;
      if (round + 1 >= rounds) {
        finishedRef.current = true;
        ctxRef.current.finish({
          isWin: correctRef.current / rounds >= 0.6,
          levelReached: 1,
          clientMeta: { game: "disappearing", correct: correctRef.current, rounds },
        });
        return;
      }
      setRound((value) => value + 1);
      startRound();
    }, 850);
  };

  const columns = cellCount === 9 ? 3 : 4;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
      <div className="flex w-full max-w-md items-center gap-1" aria-live="polite">
        {Array.from({ length: rounds }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-2 flex-1 rounded-full",
              index < round ? "bg-success" : index === round ? "bg-primary" : "bg-primary-soft",
            )}
          />
        ))}
      </div>

      <div
        className="grid w-full max-w-sm gap-2 rounded-card bg-white/80 p-3 shadow-soft"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="🕵️"
      >
        {items.map((emoji, index) => {
          const isMissing = phase === "answer" && index === missing;
          return (
            <div
              key={index}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl border-2 text-3xl transition-all sm:text-4xl",
                isMissing
                  ? "border-dashed border-primary/40 bg-primary-soft/50 text-2xl text-primary"
                  : "border-primary/10 bg-primary-soft/25",
                phase === "answer" && !isMissing && "opacity-40",
              )}
              aria-hidden="true"
            >
              {isMissing ? "❓" : emoji}
            </div>
          );
        })}
      </div>

      {phase === "show" ? (
        <p className="text-sm font-semibold text-ink-faint">👀 ⏳</p>
      ) : (
        <div className="grid w-full max-w-sm grid-cols-4 gap-2" role="group" aria-label="🕵️">
          {options.map((option) => {
            const isPicked = picked === option;
            const isGood = picked !== null && option === items[missing];
            return (
              <button
                key={option}
                type="button"
                onClick={() => pick(option)}
                disabled={picked !== null}
                aria-label={option}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-2xl border-2 text-3xl shadow-sm transition-all sm:text-4xl",
                  isGood
                    ? "border-success bg-success-soft"
                    : isPicked
                      ? "border-danger bg-danger-soft animate-shake"
                      : "border-primary/15 bg-white hover:border-primary",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs font-semibold text-ink-faint">
        ⭐ {correct}/{rounds}
      </p>
    </div>
  );
}
