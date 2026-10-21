// ══════════════════════════════════════════════════════════════════
//  KIDORA — Moteur « quiz » (23 jeux de réflexion)
//  Chaque jeu fournit une fabrique de questions (generators.ts).
//  Ici : rendu premium (horloge, pizza, pièces, balance, formes),
//  clavier 1…9, pause, feedback immédiat, budget de points §44.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { useI18n } from "../../i18n";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import type { QuizQuestion, QuizVisual } from "./generators";
import { QUIZ_GENERATORS } from "./generators";
import { answerClass, scoreCap, useCtxRef, useKeypad, useTimers, useAward } from "../shared/kit";

const ROUNDS: Record<DifficultyKey, number> = { easy: 10, medium: 12, hard: 14 };
const FEEDBACK_MS = 900;

const FALLBACK: QuizQuestion = {
  prompt: "1 + 1 = ?",
  options: ["2", "3", "1", "4"],
  answer: "2",
};

// ── Visuels ──────────────────────────────────────────────────────

function ClockFace({ hour, minute }: { hour: number; minute: number }) {
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const minuteAngle = minute * 6;
  const hand = (angle: number, length: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: 100 + Math.cos(rad) * length, y: 100 + Math.sin(rad) * length };
  };
  const hourTip = hand(hourAngle, 48);
  const minuteTip = hand(minuteAngle, 72);

  return (
    <svg
      viewBox="0 0 200 200"
      className="mx-auto h-44 w-44 drop-shadow-soft sm:h-56 sm:w-56"
      role="img"
      aria-label={`${hour}:${String(minute).padStart(2, "0")}`}
    >
      <circle cx="100" cy="100" r="94" fill="#FFF9F0" stroke="#6C5CE7" strokeWidth="8" />
      <circle cx="100" cy="100" r="86" fill="#FFFFFF" />
      {Array.from({ length: 12 }, (_, index) => {
        const angle = ((index + 1) * 30 - 90) * (Math.PI / 180);
        const x1 = 100 + Math.cos(angle) * 76;
        const y1 = 100 + Math.sin(angle) * 76;
        const x2 = 100 + Math.cos(angle) * 84;
        const y2 = 100 + Math.sin(angle) * 84;
        return (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#A29BFE"
            strokeWidth={index % 3 === 0 ? 5 : 2}
            strokeLinecap="round"
          />
        );
      })}
      {[12, 3, 6, 9].map((number, index) => {
        const angle = (index * 90 - 90) * (Math.PI / 180);
        return (
          <text
            key={number}
            x={100 + Math.cos(angle) * 65}
            y={100 + Math.sin(angle) * 65 + 6}
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill="#4B4B6B"
          >
            {number}
          </text>
        );
      })}
      <line
        x1="100"
        y1="100"
        x2={hourTip.x}
        y2={hourTip.y}
        stroke="#2D3436"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <line
        x1="100"
        y1="100"
        x2={minuteTip.x}
        y2={minuteTip.y}
        stroke="#FF5A5F"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="100" cy="100" r="8" fill="#6C5CE7" />
    </svg>
  );
}

function PizzaFraction({ filled, total }: { filled: number; total: number }) {
  const point = (angle: number, radius: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: 100 + Math.cos(rad) * radius, y: 100 + Math.sin(rad) * radius };
  };
  return (
    <svg
      viewBox="0 0 200 200"
      className="mx-auto h-44 w-44 sm:h-56 sm:w-56"
      role="img"
      aria-label={`${filled}/${total}`}
    >
      <circle cx="100" cy="100" r="94" fill="#E17055" />
      <circle cx="100" cy="100" r="86" fill="#FDCB6E" />
      {Array.from({ length: total }, (_, index) => {
        const start = (index * 360) / total;
        const end = ((index + 1) * 360) / total;
        const p1 = point(start, 86);
        const p2 = point(end, 86);
        const mid = point((start + end) / 2, 52);
        const isFilled = index < filled;
        return (
          <g key={index}>
            {!isFilled && (
              <path
                d={`M100,100 L${p1.x},${p1.y} A86,86 0 0,1 ${p2.x},${p2.y} Z`}
                fill="#FFF3E0"
                stroke="#E17055"
                strokeWidth="3"
              />
            )}
            <line
              x1="100"
              y1="100"
              x2={p2.x}
              y2={p2.y}
              stroke="#E17055"
              strokeWidth="3"
            />
            {isFilled && (
              <circle cx={mid.x} cy={mid.y} r="6" fill="#D63031" opacity="0.9" />
            )}
          </g>
        );
      })}
      <circle cx="100" cy="100" r="10" fill="#E17055" />
    </svg>
  );
}

function Coin({ cents }: { cents: number }) {
  const label = cents >= 100 ? `${cents / 100}€` : `${cents}c`;
  const size = cents >= 100 ? "h-16 w-16 text-lg" : "h-14 w-14 text-sm";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border-4 border-yellow-500 bg-yellow-300 font-bold text-yellow-900 shadow-soft",
        size,
      )}
      aria-label={`${cents} centimes`}
    >
      {label}
    </span>
  );
}

function BalanceVisual({ known, total }: { known: number; total: number }) {
  return (
    <svg
      viewBox="0 0 260 150"
      className="mx-auto h-36 w-full max-w-xs sm:h-44"
      role="img"
      aria-label={`${known} + ? = ${total}`}
    >
      <rect x="120" y="40" width="20" height="80" rx="8" fill="#6C5CE7" />
      <rect x="70" y="118" width="120" height="14" rx="7" fill="#6C5CE7" />
      <rect x="40" y="36" width="180" height="10" rx="5" fill="#A29BFE" />
      <circle cx="130" cy="36" r="9" fill="#E84393" />
      <line x1="55" y1="46" x2="55" y2="78" stroke="#8E44AD" strokeWidth="3" />
      <line x1="205" y1="46" x2="205" y2="78" stroke="#8E44AD" strokeWidth="3" />
      <rect x="22" y="78" width="66" height="42" rx="10" fill="#FFF3E0" stroke="#E17055" strokeWidth="2" />
      <rect x="172" y="78" width="66" height="42" rx="10" fill="#E8F8F5" stroke="#00B8A9" strokeWidth="2" />
      <text x="55" y="104" textAnchor="middle" fontSize="16" fontWeight="700" fill="#2D3436">
        {known} + ❓
      </text>
      <text x="205" y="104" textAnchor="middle" fontSize="16" fontWeight="700" fill="#2D3436">
        {total}
      </text>
    </svg>
  );
}

function ShapeVisual({ sides }: { sides: number }) {
  const points = Array.from({ length: sides }, (_, index) => {
    const angle = ((index * 360) / sides - 90) * (Math.PI / 180);
    return `${100 + Math.cos(angle) * 72},${100 + Math.sin(angle) * 72}`;
  }).join(" ");
  return (
    <svg
      viewBox="0 0 200 200"
      className="mx-auto h-40 w-40 sm:h-48 sm:w-48"
      role="img"
      aria-label={`${sides}`}
    >
      <polygon points={points} fill="#A29BFE" stroke="#6C5CE7" strokeWidth="7" strokeLinejoin="round" />
    </svg>
  );
}

function Visual({ visual }: { visual: QuizVisual }) {
  switch (visual.kind) {
    case "clock":
      return <ClockFace hour={visual.hour} minute={visual.minute} />;
    case "fraction":
      return <PizzaFraction filled={visual.filled} total={visual.total} />;
    case "coins":
      return (
        <div className="flex max-w-md flex-wrap items-center justify-center gap-2 py-2" aria-hidden="true">
          {visual.cents.map((cents, index) => (
            <Coin key={index} cents={cents} />
          ))}
        </div>
      );
    case "balance":
      return <BalanceVisual known={visual.known} total={visual.total} />;
    case "shape":
      return <ShapeVisual sides={visual.sides} />;
    default:
      return null;
  }
}

// ── Jeu ──────────────────────────────────────────────────────────

export function QuizGame({ ctx }: GameProps) {
  const { t } = useI18n();
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();

  const settings = ctx.game.config.settings as
    | { rounds?: Partial<Record<DifficultyKey, number>> }
    | undefined;
  const rounds = Math.max(4, settings?.rounds?.[ctx.difficulty] ?? ROUNDS[ctx.difficulty]);
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);
  const overRef = useRef(false);
  const indexRef = useRef(0);
  const correctRef = useRef(0);
  const pickedRef = useRef<string | null>(null);

  const generator = QUIZ_GENERATORS[ctx.game.slug] ?? (() => FALLBACK);
  const [question, setQuestion] = useState<QuizQuestion>(() => generator(ctx.difficulty));
  const [picked, setPicked] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);

  const pointsPerQuestion = Math.max(
    10,
    Math.floor(scoreCap(ctx) / Math.max(1, rounds * maxLevel)),
  );

  useEffect(() => {
    ctxRef.current.setRoundsTotal(rounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds]);

  const onPick = useCallback(
    (option: string) => {
      const current = ctxRef.current;
      if (!current.running || pickedRef.current !== null || overRef.current) return;
      if (!question.options.includes(option)) return;

      pickedRef.current = option;
      setPicked(option);
      const isCorrect = option === question.answer;
      if (isCorrect) {
        correctRef.current += 1;
        setCorrect(correctRef.current);
        award(pointsPerQuestion);
      } else {
        current.signalWrong();
      }

      later(() => {
        const latest = ctxRef.current;
        if (overRef.current) return;
        if (indexRef.current + 1 >= rounds * maxLevel) {
          overRef.current = true;
          const totalCorrect = correctRef.current;
          const totalRounds = rounds * maxLevel;
          latest.finish({
            isWin: totalCorrect / totalRounds >= 0.6,
            levelReached: maxLevel,
            clientMeta: { game: latest.game.slug, correct: totalCorrect, rounds: totalRounds },
          });
          return;
        }
        indexRef.current += 1;
        setIndex(indexRef.current);
        pickedRef.current = null;
        setPicked(null);
        setQuestion((QUIZ_GENERATORS[latest.game.slug] ?? (() => FALLBACK))(latest.difficulty));
      }, FEEDBACK_MS);
    },
    [award, later, maxLevel, pointsPerQuestion, question.answer, question.options, rounds],
  );

  useKeypad(question.options.length, (position) => onPick(question.options[position]));

  const isLong = question.prompt.length > 24;
  const optionsAreShort = question.options.every((option) => option.length <= 4);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
      <div
        className="h-2 w-full max-w-xl overflow-hidden rounded-full bg-primary-soft"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={rounds * maxLevel}
        aria-valuenow={Math.min(index + 1, rounds * maxLevel)}
        aria-label={t("hud.level")}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${((index + (picked ? 1 : 0.35)) / (rounds * maxLevel)) * 100}%` }}
        />
      </div>

      <div className="flex min-h-[9rem] w-full max-w-xl flex-col items-center justify-center rounded-card bg-white/70 px-4 py-3 text-center shadow-soft sm:min-h-[11rem]">
        {question.visual ? (
          <Visual visual={question.visual} />
        ) : (
          <div
            className={cn(
              "font-bold leading-tight text-ink",
              isLong ? "text-lg sm:text-2xl" : "text-3xl sm:text-5xl",
              question.prompt.length > 40 && "break-words",
            )}
            aria-live="polite"
          >
            {question.prompt}
          </div>
        )}
        {question.visual && question.prompt !== "🔍" && question.prompt !== "🕐" && question.prompt !== "🍕" && (
          <div className="mt-1 text-3xl" aria-hidden="true">
            {question.prompt}
          </div>
        )}
      </div>

      <div
        className={cn(
          "grid w-full max-w-xl gap-2 sm:gap-3",
          optionsAreShort ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
        )}
        role="group"
        aria-label={t("feedback.correct")}
      >
        {question.options.map((option, optionIndex) => {
          const isAnswer = option === question.answer;
          const isPicked = option === picked;
          const state = !picked
            ? "idle"
            : isAnswer
              ? "good"
              : isPicked
                ? "bad"
                : "muted";
          return (
            <button
              key={`${option}-${optionIndex}`}
              type="button"
              disabled={picked !== null}
              onClick={() => onPick(option)}
              className={cn(
                "relative flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-xl font-bold shadow-sm transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-primary/40 sm:min-h-[64px] sm:text-2xl",
                answerClass(state),
              )}
            >
              <span className="pointer-events-none absolute start-2 top-1 text-[10px] font-semibold text-ink-faint">
                {optionIndex + 1}
              </span>
              <span className={cn("break-words", option.length > 16 && "text-base sm:text-lg")}>
                {option}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs font-semibold text-ink-faint" aria-live="polite">
        {"⭐".repeat(Math.min(5, Math.max(1, Math.round((correct / Math.max(1, index + 1)) * 5))))}
      </p>
    </div>
  );
}
