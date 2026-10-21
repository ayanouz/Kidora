// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 05 : Défi Maths (moteur « math-challenge »)
//  60 secondes par niveau : réussis un maximum de calculs !
//  3 vies, 3 niveaux ; budget de points plafonné (§44).
//  Zéro asset : CSS + emojis uniquement.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import { useCountdown } from "../engine/hooks";
import type { GameProps } from "../registry";

// ── Réglages (seed.ts : durationSec 60, lives 3) ─────────────────

const DEFAULT_DURATION_SEC = 60;
const DEFAULT_LIVES = 3;
const FEEDBACK_MS = 700; // temps de lecture bonne/mauvaise réponse
const RELOCK_MS = 180; // anti double-clic après une bonne réponse

/** Bonnes réponses attendues par minute (budget de points, §44). */
const EXPECTED_CORRECT: Record<DifficultyKey, number> = { easy: 20, medium: 24, hard: 28 };
/** Bonnes réponses par niveau pour débloquer le suivant. */
const MIN_CORRECT: Record<DifficultyKey, number> = { easy: 10, medium: 12, hard: 14 };

// ── Génération des calculs ───────────────────────────────────────

interface Question {
  /** Énoncé affiché, ex. « 7 + 5 = ? ». */
  text: string;
  answer: number;
  choices: number[];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** 4 propositions : la bonne réponse + 3 leurres plausibles (jamais négatifs). */
function buildChoices(answer: number): number[] {
  const values = new Set<number>([answer]);
  let guard = 0;
  while (values.size < 4 && guard < 80) {
    guard += 1;
    const delta = rand(1, 3) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = answer + delta;
    if (candidate >= 0) values.add(candidate);
  }
  // Filet de sécurité (très petits calculs) : compléter au-dessus.
  let extra = answer + 4;
  while (values.size < 4) {
    values.add(extra);
    extra += 1;
  }
  return shuffle([...values]);
}

/** Calcul adapté à la difficulté : ≤ 20, ≤ 50, puis tables (≤ 12 × 12). */
function makeQuestion(difficulty: DifficultyKey): Question {
  let a: number;
  let b: number;
  let operator: "+" | "−" | "×";

  if (difficulty === "easy") {
    operator = "+";
    a = rand(1, 10);
    b = rand(1, 20 - a);
  } else if (difficulty === "medium") {
    if (Math.random() < 0.5) {
      operator = "+";
      a = rand(6, 30);
      b = rand(2, Math.min(20, 50 - a));
    } else {
      operator = "−";
      a = rand(11, 50);
      b = rand(1, Math.min(20, a - 1));
    }
  } else if (Math.random() < 0.5) {
    operator = "×";
    a = rand(2, 12);
    b = rand(2, 12);
  } else if (Math.random() < 0.5) {
    operator = "+";
    a = rand(2, 12);
    b = rand(2, 12);
  } else {
    operator = "−";
    a = rand(4, 24);
    b = rand(1, a - 1);
  }

  const answer = operator === "+" ? a + b : operator === "−" ? a - b : a * b;
  return { text: `${a} ${operator} ${b} = ?`, answer, choices: buildChoices(answer) };
}

// ── Composant ────────────────────────────────────────────────────

export function MathChallenge({ ctx }: GameProps) {
  const settings = ctx.game.config.settings as
    | { durationSec?: number; lives?: number }
    | undefined;
  const durationSec = settings?.durationSec ?? DEFAULT_DURATION_SEC;
  const livesTotal = settings?.lives ?? DEFAULT_LIVES;
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);

  // Plafond anti-triche : 95 % du maximum serveur (§44).
  const cap = Math.floor(
    (ctx.game.config.maxScore?.[ctx.difficulty] ?? ctx.game.maxScoreHint) * 0.95,
  );
  const pointsPerAnswer = Math.floor(cap / (EXPECTED_CORRECT[ctx.difficulty] * maxLevel));
  const minCorrect = MIN_CORRECT[ctx.difficulty];

  // Le canal onEnd passe par une ref : toujours la dernière version.
  const endHandlerRef = useRef<() => void>(() => undefined);
  const countdown = useCountdown(durationSec, { onEnd: () => endHandlerRef.current() });
  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;

  const [question, setQuestion] = useState<Question>(() => makeQuestion(ctx.difficulty));
  const [flash, setFlash] = useState<{ chosen: number } | null>(null);
  const [locked, setLocked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const questionRef = useRef(question);
  questionRef.current = question;
  const lockedRef = useRef(false);
  const finishedRef = useRef(false);
  const livesRef = useRef(livesTotal);
  const creditedRef = useRef(0);
  const levelCorrectRef = useRef(0);
  const totalCorrectRef = useRef(0);
  const wrongRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  // Aucun minuteur ne survit au démontage.
  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  // Montage = début de partie : vies + chrono du premier niveau.
  useEffect(() => {
    const current = ctxRef.current;
    current.setLives(livesTotal);
    countdownRef.current.start(durationSec);
    return () => {
      countdownRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le HUD affiche le temps restant du chronomètre interne.
  useEffect(() => {
    ctxRef.current.setTimeLeft(countdown.timeLeft);
  }, [countdown.timeLeft]);

  // Pause du shell → chrono en pause ; reprise → il repart.
  useEffect(() => {
    if (ctx.running) countdown.resume();
    else countdown.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.running]);

  // Fin de partie : une seule fois, chrono arrêté d'abord.
  const finishRun = useCallback((isWin: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    countdownRef.current.stop();
    const current = ctxRef.current;
    current.finish({
      isWin,
      levelReached: current.level,
      clientMeta: { correct: totalCorrectRef.current, wrong: wrongRef.current },
    });
  }, []);

  // Fin du temps d'un niveau.
  const handleTimeEnd = useCallback(() => {
    const current = ctxRef.current;
    if (finishedRef.current) return;

    if (current.level < maxLevel && levelCorrectRef.current >= minCorrect) {
      // Objectif du niveau atteint : petite pause puis niveau suivant.
      current.sound.play("level");
      lockedRef.current = true;
      setLocked(true);
      later(() => {
        const latest = ctxRef.current;
        latest.setLevel(Math.min(maxLevel, latest.level + 1));
        levelCorrectRef.current = 0;
        lockedRef.current = false;
        setLocked(false);
        setFlash(null);
        setQuestion(makeQuestion(latest.difficulty));
        countdownRef.current.start(durationSec);
        if (!ctxRef.current.running) countdownRef.current.pause();
      }, 600);
      return;
    }

    if (current.level < maxLevel) {
      // Objectif du niveau non atteint : la partie s'arrête là, sans gronder.
      finishRun(false);
      return;
    }

    // Dernier niveau terminé : victoire si l'enfant a tenu jusqu'au bout.
    finishRun(livesRef.current > 0);
  }, [durationSec, finishRun, later, maxLevel, minCorrect]);
  endHandlerRef.current = handleTimeEnd;

  const pick = useCallback(
    (value: number) => {
      const current = ctxRef.current;
      if (!current.running || lockedRef.current || finishedRef.current) return;
      const activeQuestion = questionRef.current;
      if (!activeQuestion.choices.includes(value)) return;

      if (value === activeQuestion.answer) {
        totalCorrectRef.current += 1;
        levelCorrectRef.current += 1;
        setCorrect(totalCorrectRef.current);

        // Budget de points : jamais au-delà de 95 % du plafond serveur.
        const gain = Math.max(0, Math.min(pointsPerAnswer, cap - creditedRef.current));
        if (gain > 0) {
          creditedRef.current += gain;
          current.signalCorrect(gain);
        } else {
          current.sound.play("correct");
        }

        // Court verrou anti double-clic, puis calcul suivant.
        lockedRef.current = true;
        setLocked(true);
        setFlash(null);
        setQuestion(makeQuestion(current.difficulty));
        later(() => {
          lockedRef.current = false;
          setLocked(false);
        }, RELOCK_MS);
        return;
      }

      // Mauvaise réponse : on montre la bonne, on retire une vie.
      wrongRef.current += 1;
      setWrong(wrongRef.current);
      current.sound.play("wrong");
      lockedRef.current = true;
      setLocked(true);
      setFlash({ chosen: value });

      const nextLives = livesRef.current - 1;
      livesRef.current = nextLives;
      current.setLives(nextLives);

      if (nextLives <= 0) {
        countdownRef.current.stop();
        later(() => finishRun(false), FEEDBACK_MS + 60);
        return;
      }
      later(() => {
        lockedRef.current = false;
        setLocked(false);
        setFlash(null);
        // Nouveau calcul : impossible de revalider la réponse révélée.
        setQuestion(makeQuestion(ctxRef.current.difficulty));
      }, FEEDBACK_MS);
    },
    [cap, finishRun, later, pointsPerAnswer],
  );

  // Clavier : touches 1-4 pour répondre (contrat §31).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = ["1", "2", "3", "4"].indexOf(event.key);
      if (index < 0) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (!ctxRef.current.running || lockedRef.current || finishedRef.current) return;
      const choice = questionRef.current.choices[index];
      if (typeof choice !== "number") return;
      event.preventDefault();
      pick(choice);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pick]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-4">
      <p className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        ✅ {correct} · ❌ {wrong}
      </p>

      <div
        key={`${ctx.level}-${correct + wrong}`}
        className="animate-pop-in rounded-card bg-secondary-soft px-6 py-4 text-center"
      >
        <p className="text-4xl font-bold tabular-nums text-ink sm:text-5xl">{question.text}</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {question.choices.map((choice, index) => {
          const showCorrect = flash !== null && choice === question.answer;
          const showWrong = flash !== null && choice === flash.chosen;
          return (
            <button
              key={`${choice}-${index}`}
              type="button"
              disabled={locked}
              onClick={() => pick(choice)}
              aria-label={`${choice}`}
              className={cn(
                "flex min-h-[56px] w-full items-center justify-center rounded-2xl border-2 border-b-4",
                "font-fun text-2xl font-bold tabular-nums no-select transition-all",
                "active:scale-[0.97] disabled:active:scale-100",
                showCorrect && "border-success bg-success text-white",
                showWrong && "border-danger bg-danger text-white",
                !showCorrect &&
                  !showWrong &&
                  "border-primary/15 bg-white text-ink hover:border-primary/50",
              )}
            >
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
}
