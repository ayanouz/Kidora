// ══════════════════════════════════════════════════════════════════
//  KIDORA — Pierre Feuille Ciseaux (moteur « rock-paper »)
//  5 manches contre une IA. Choix simultané, révélation animée.
// ══════════════════════════════════════════════════════════════════

import { useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { useAward, useCtxRef, useTimers } from "../shared/kit";

const CHOICES = [
  { key: "rock", emoji: "✊" },
  { key: "paper", emoji: "✋" },
  { key: "scissors", emoji: "✌️" },
] as const;

type Choice = (typeof CHOICES)[number]["key"];

const BEATS: Record<Choice, Choice> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

const ROUNDS = 5;

function counterOf(choice: Choice): Choice {
  return (Object.keys(BEATS) as Choice[]).find((candidate) => BEATS[candidate] === choice) ?? "rock";
}

function aiChoice(difficulty: DifficultyKey, last: Choice | null): Choice {
  if (last && difficulty === "hard" && Math.random() < 0.55) return counterOf(last);
  if (last && difficulty === "medium" && Math.random() < 0.3) return counterOf(last);
  return CHOICES[Math.floor(Math.random() * CHOICES.length)].key;
}

export function RockPaper({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const [round, setRound] = useState(1);
  const [player, setPlayer] = useState<Choice | null>(null);
  const [ai, setAi] = useState<Choice | null>(null);
  const [phase, setPhase] = useState<"choose" | "reveal" | "done">("choose");
  const [totals, setTotals] = useState({ wins: 0, losses: 0, draws: 0 });
  const roundRef = useRef(1);
  const phaseRef = useRef<"choose" | "reveal" | "done">("choose");
  const lastChoiceRef = useRef<Choice | null>(null);
  const totalsRef = useRef({ wins: 0, losses: 0, draws: 0 });
  const finishedRef = useRef(false);

  const play = (choice: Choice) => {
    const current = ctxRef.current;
    if (!current.running || phaseRef.current !== "choose" || finishedRef.current) return;
    phaseRef.current = "reveal";
    setPhase("reveal");
    current.sound.play("flip");

    const opponent = aiChoice(current.difficulty, lastChoiceRef.current);
    lastChoiceRef.current = choice;
    setPlayer(choice);
    setAi(opponent);

    let outcome: "win" | "lose" | "draw" = "draw";
    if (choice !== opponent) outcome = BEATS[choice] === opponent ? "win" : "lose";

    const nextTotals = {
      wins: totalsRef.current.wins + (outcome === "win" ? 1 : 0),
      losses: totalsRef.current.losses + (outcome === "lose" ? 1 : 0),
      draws: totalsRef.current.draws + (outcome === "draw" ? 1 : 0),
    };
    totalsRef.current = nextTotals;
    setTotals(nextTotals);

    if (outcome === "win") award(180);
    else if (outcome === "draw") award(60, true);
    else current.sound.play("wrong");

    later(() => {
      const current = ctxRef.current;
      if (finishedRef.current) return;
      // Si l'enfant a mis la partie en pause, on attend la reprise pour
      // ne pas enchaîner les manches derrière l'écran de pause.
      if (!current.running) {
        later(advanceRound, 250);
        return;
      }
      advanceRound();
    }, 1100);

    function advanceRound() {
      if (finishedRef.current) return;
      if (roundRef.current >= ROUNDS) {
        finishedRef.current = true;
        phaseRef.current = "done";
        setPhase("done");
        later(() => {
          ctxRef.current.finish({
            isWin: nextTotals.wins > nextTotals.losses,
            levelReached: 1,
            clientMeta: { game: "rock-paper", ...nextTotals },
          });
        }, 500);
        return;
      }
      roundRef.current += 1;
      setRound(roundRef.current);
      setPlayer(null);
      setAi(null);
      phaseRef.current = "choose";
      setPhase("choose");
    }
  };

  const result =
    player && ai
      ? player === ai
        ? "draw"
        : BEATS[player] === ai
          ? "win"
          : "lose"
      : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="chip bg-secondary-soft text-secondary-dark">🎯 {round}/{ROUNDS}</span>
        <span className="chip bg-success-soft text-success">🏆 {totals.wins}</span>
        <span className="chip bg-danger-soft text-danger">😅 {totals.losses}</span>
        <span className="chip bg-white text-ink-soft">🤝 {totals.draws}</span>
      </div>

      <div className="flex w-full max-w-md items-center justify-center gap-6 rounded-card bg-white/80 p-4 shadow-soft">
        <div className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-bold uppercase text-ink-faint">🙂</span>
          <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary-soft text-5xl">
            {player ? CHOICES.find((item) => item.key === player)?.emoji : "❔"}
          </span>
        </div>
        <span className="text-2xl font-black text-ink-faint">VS</span>
        <div className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-bold uppercase text-ink-faint">🤖</span>
          <span
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-2xl bg-accent-soft text-5xl",
              phase === "reveal" && "animate-pop-in",
            )}
          >
            {ai ? CHOICES.find((item) => item.key === ai)?.emoji : "❔"}
          </span>
        </div>
      </div>

      <div className="h-8 text-2xl" aria-live="polite">
        {result === "win" ? "🎉" : result === "lose" ? "🙈" : result === "draw" ? "🤝" : ""}
      </div>

      <div className="flex w-full max-w-md justify-center gap-3" role="group" aria-label="✊ ✋ ✌️">
        {CHOICES.map((choice) => (
          <button
            key={choice.key}
            type="button"
            onClick={() => play(choice.key)}
            disabled={phase !== "choose"}
            aria-label={choice.emoji}
            className="flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-primary/15 bg-white text-4xl shadow-soft transition-all hover:border-primary hover:bg-primary-soft/50 active:scale-95 disabled:opacity-50 sm:h-24 sm:w-24 sm:text-5xl"
          >
            {choice.emoji}
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold text-ink-faint">
        {phase === "choose" ? "👆" : phase === "done" ? "🎉" : "…"}
      </p>
    </div>
  );
}
