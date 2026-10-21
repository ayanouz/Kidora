// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 07 : La Suite Logique (moteur « pattern »)
//  15 manches par niveau : trouve le symbole qui continue la suite.
//  3 niveaux ; budget de points plafonné (§44).
//  Zéro asset : emojis + CSS uniquement.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";

// ── Réglages (seed.ts : rounds 15, sequenceStartLength 3) ────────

const DEFAULT_ROUNDS = 15;
const DEFAULT_START_LENGTH = 3;
const MAX_SEQUENCE = 6;
const SHAKE_MS = 420;
const RELOCK_MS = 140;

/** Symboles des suites (formes et couleurs bien contrastées). */
const SYMBOLS = ["🔴", "🟡", "🔵", "🟩", "⭐️", "🌸", "⬛️", "💜"];

/** Modèles de suites : ABAB, ABCABC, AABB, ABBABB, ABCD. */
const TEMPLATES: number[][] = [
  [0, 1],
  [0, 1, 2],
  [0, 0, 1, 1],
  [0, 1, 1],
  [0, 1, 2, 3],
];

/** Nombre de propositions : 3 (facile) ou 4 (moyen/difficile). */
const CHOICES_BY_DIFFICULTY: Record<DifficultyKey, number> = { easy: 3, medium: 4, hard: 4 };

interface Pattern {
  /** Suite complète ; la dernière case est cachée à l'écran. */
  symbols: string[];
  answer: string;
  choices: string[];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Longueur de la suite : longueur de départ + 1 toutes les 3 manches (max 6). */
function lengthForRound(startLength: number, round: number): number {
  return Math.min(MAX_SEQUENCE, startLength + Math.floor(round / 3));
}

/** Suite déterministe : une seule proposition continue le motif. */
function buildPattern(length: number, choiceCount: number): Pattern {
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const distinct = Math.max(...template) + 1;
  const palette = shuffle(SYMBOLS).slice(0, distinct);

  const symbols: string[] = [];
  for (let i = 0; i < length; i++) {
    symbols.push(palette[template[i % template.length]]);
  }

  const answer = symbols[symbols.length - 1];
  // Leurres : symboles déjà présents d'abord (plus plausibles), puis le reste.
  const inSequence = [...new Set(symbols)].filter((symbol) => symbol !== answer);
  const others = SYMBOLS.filter((symbol) => symbol !== answer && !inSequence.includes(symbol));
  const distractors = [...shuffle(inSequence), ...shuffle(others)].slice(0, choiceCount - 1);
  return { symbols, answer, choices: shuffle([answer, ...distractors]) };
}

// ── Composant ────────────────────────────────────────────────────

export function LogicPattern({ ctx }: GameProps) {
  const settings = ctx.game.config.settings as
    | { rounds?: number; sequenceStartLength?: number }
    | undefined;
  const rounds = Math.max(1, settings?.rounds ?? DEFAULT_ROUNDS);
  const startLength = settings?.sequenceStartLength ?? DEFAULT_START_LENGTH;
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);
  const choiceCount = CHOICES_BY_DIFFICULTY[ctx.difficulty];

  // Plafond anti-triche : 95 % du maximum serveur (§44).
  const cap = Math.floor(
    (ctx.game.config.maxScore?.[ctx.difficulty] ?? ctx.game.maxScoreHint) * 0.95,
  );
  const pointsPerRound = Math.floor(cap / (rounds * maxLevel));

  const [pattern, setPattern] = useState<Pattern>(() =>
    buildPattern(lengthForRound(startLength, 0), choiceCount),
  );
  const [round, setRound] = useState(0);
  const [locked, setLocked] = useState(false);
  const [shaking, setShaking] = useState(false);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const patternRef = useRef(pattern);
  patternRef.current = pattern;
  const roundRef = useRef(0);
  const lockedRef = useRef(false);
  const finishedRef = useRef(false);
  const creditedRef = useRef(0);
  const clearedRef = useRef(0);
  const mistakesRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const lock = useCallback((value: boolean) => {
    lockedRef.current = value;
    setLocked(value);
  }, []);

  // Aucun minuteur ne survit au démontage.
  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  // Fin de partie : une seule fois.
  const finishRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const current = ctxRef.current;
    current.finish({
      isWin: true,
      levelReached: current.level,
      clientMeta: { rounds: clearedRef.current, mistakes: mistakesRef.current },
    });
  }, []);

  const startRound = useCallback(
    (nextRound: number) => {
      const nextPattern = buildPattern(lengthForRound(startLength, nextRound), choiceCount);
      patternRef.current = nextPattern;
      roundRef.current = nextRound;
      setPattern(nextPattern);
      setRound(nextRound);
      setShaking(false);
      lock(false);
    },
    [choiceCount, lock, startLength],
  );

  const completeLevel = useCallback(() => {
    const current = ctxRef.current;
    if (current.level >= maxLevel) {
      finishRun();
      return;
    }
    current.sound.play("level");
    later(() => {
      const latest = ctxRef.current;
      latest.setLevel(Math.min(maxLevel, latest.level + 1));
      startRound(0);
    }, 600);
  }, [finishRun, later, maxLevel, startRound]);

  const choose = useCallback(
    (choice: string) => {
      const current = ctxRef.current;
      if (!current.running || lockedRef.current || finishedRef.current) return;
      const active = patternRef.current;

      if (choice !== active.answer) {
        // Erreur : combo remis à zéro, on peut réessayer tout de suite.
        mistakesRef.current += 1;
        current.sound.play("wrong");
        current.signalWrong();
        lock(true);
        setShaking(true);
        later(() => {
          setShaking(false);
          lock(false);
        }, SHAKE_MS);
        return;
      }

      clearedRef.current += 1;
      const gain = Math.max(0, Math.min(pointsPerRound, cap - creditedRef.current));
      if (gain > 0) {
        creditedRef.current += gain;
        current.signalCorrect(gain);
      } else {
        current.sound.play("correct");
      }

      const nextRound = roundRef.current + 1;
      lock(true);
      if (nextRound >= rounds) {
        completeLevel();
        return;
      }
      // Petite pause anti double-tap, puis manche suivante animée.
      later(() => startRound(nextRound), RELOCK_MS);
    },
    [cap, completeLevel, later, lock, pointsPerRound, rounds, startRound],
  );

  const visible = pattern.symbols.slice(0, -1);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-4">
      <p className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        🧠 {round + 1}/{rounds}
      </p>

      <div
        key={`sequence-${ctx.level}-${round}`}
        className="animate-pop-in flex flex-wrap items-center justify-center gap-2 sm:gap-3"
      >
        {visible.map((symbol, index) => (
          <span
            key={`${index}-${symbol}`}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-2xl shadow-soft sm:h-16 sm:w-16 sm:text-3xl"
            aria-hidden="true"
          >
            {symbol}
          </span>
        ))}
        <span
          className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft text-2xl font-bold text-ink shadow-soft sm:h-16 sm:w-16 sm:text-3xl"
          aria-hidden="true"
        >
          ?
        </span>
      </div>

      <div key={`choices-${ctx.level}-${round}`} className="animate-pop-in">
        <div className={cn("flex flex-wrap justify-center gap-3", shaking && "animate-shake")}>
          {pattern.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={locked}
              onClick={() => choose(choice)}
              aria-label={choice}
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-b-4",
                "border-primary/15 bg-white text-3xl shadow-soft no-select transition-all",
                "hover:border-primary/50 active:scale-[0.97] sm:h-[72px] sm:w-[72px] sm:text-4xl",
              )}
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
