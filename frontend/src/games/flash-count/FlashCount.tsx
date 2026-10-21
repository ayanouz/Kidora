// ══════════════════════════════════════════════════════════════════
//  KIDORA — Compte Éclair (moteur « flash-count »)
//  Observe les objets pendant quelques secondes, puis compte-les !
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { pickOne, randInt, scoreCap, shuffle, useAward, useCtxRef, useTimers } from "../shared/kit";

const ROUNDS: Record<DifficultyKey, number> = { easy: 6, medium: 8, hard: 10 };
const SHOW_MS: Record<DifficultyKey, number> = { easy: 2400, medium: 2000, hard: 1700 };
const MAX_COUNT: Record<DifficultyKey, number> = { easy: 9, medium: 12, hard: 16 };
const EMOJIS = ["🍎", "⭐", "🎈", "🐟", "🍓", "🌸", "🍪", "🐞", "🧁", "🚗", "🦋", "🍊"];

function buildOptions(count: number): string[] {
  const values = new Set<number>([count]);
  while (values.size < 4) {
    const candidate = count + (randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1));
    if (candidate > 0) values.add(candidate);
  }
  return shuffle([...values]).map(String);
}

export function FlashCount({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const rounds = ROUNDS[ctx.difficulty];
  const points = Math.max(20, Math.floor(scoreCap(ctx) / rounds));

  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"show" | "answer" | "done">("show");
  const [count, setCount] = useState(() => randInt(3, MAX_COUNT[ctx.difficulty]));
  const [emoji, setEmoji] = useState(() => pickOne(EMOJIS));
  const [options, setOptions] = useState<string[]>(() => buildOptions(count));
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const correctRef = useRef(0);
  const showMsRef = useRef(SHOW_MS[ctx.difficulty]);
  const finishedRef = useRef(false);
  const pickedRef = useRef(false);

  const startRound = useCallback(() => {
    const nextCount = randInt(3, MAX_COUNT[ctx.difficulty]);
    setCount(nextCount);
    setEmoji(pickOne(EMOJIS));
    setOptions(buildOptions(nextCount));
    setPicked(null);
    pickedRef.current = false;
    setPhase("show");
    showMsRef.current = SHOW_MS[ctx.difficulty];
  }, [ctx.difficulty]);

  useEffect(() => {
    ctxRef.current.setRoundsTotal(rounds);
    ctxRef.current.setLives(null);
    ctxRef.current.setTimeLeft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds]);

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
    if (option === String(count)) {
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
          clientMeta: { game: "flash-count", correct: correctRef.current, rounds },
        });
        return;
      }
      setRound((value) => value + 1);
      startRound();
    }, 850);
  };

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

      <div className="flex min-h-[13rem] w-full max-w-md flex-col items-center justify-center rounded-card bg-white/80 p-4 shadow-soft">
        {phase === "show" ? (
          <>
            <div className="flex min-h-[9rem] flex-wrap content-center items-center justify-center gap-1.5 text-2xl sm:text-3xl">
              {Array.from({ length: count }, (_, index) => (
                <span key={index} aria-hidden="true">
                  {emoji}
                </span>
              ))}
            </div>
            <span className="chip mt-3 bg-accent-soft text-ink">👀</span>
          </>
        ) : (
          <span className="text-6xl" aria-hidden="true">
            ❓
          </span>
        )}
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {phase === "answer" &&
          options.map((option, index) => {
            const isPicked = option === picked;
            const isGood = picked !== null && option === String(count);
            const isBad = isPicked && option !== String(count);
            return (
              <button
                key={option}
                type="button"
                onClick={() => pick(option)}
                disabled={picked !== null}
                aria-label={option}
                className={cn(
                  "relative flex min-h-[64px] items-center justify-center rounded-2xl border-2 text-2xl font-bold shadow-sm transition-all sm:text-3xl",
                  isGood
                    ? "border-success bg-success-soft"
                    : isBad
                      ? "border-danger bg-danger-soft animate-shake"
                      : "border-primary/15 bg-white hover:border-primary",
                )}
              >
                <span className="absolute start-2 top-1 text-[10px] text-ink-faint">{index + 1}</span>
                {option}
              </button>
            );
          })}
        {phase === "show" && (
          <div className="col-span-2 text-center text-sm font-semibold text-ink-faint">⏳ 👀</div>
        )}
      </div>

      <p className="text-xs font-semibold text-ink-faint">
        ⭐ {correct}/{rounds}
      </p>
    </div>
  );
}
