// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 10 : Séquence Mémoire (moteur « memory-sequence »)
//  Observe la séquence de couleurs, puis reproduis-la de mémoire !
//  3 vies, 3 niveaux, 12 manches ; budget de points plafonné (§44).
//  Zéro asset : CSS + emojis uniquement.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";

// ── Réglages (seed.ts : startLength 3/4/5, maxRounds 12) ─────────

const DEFAULT_START_LENGTH = 3;
const DEFAULT_MAX_ROUNDS = 12;
const LIVES = 3;
const HIGHLIGHT_MS = 550; // durée d'éclat d'une pastille
const STEP_MS = 700; // éclat + respiration entre deux pastilles
const REPLAY_DELAY = 900; // avant de rejouer la même séquence
const ROUND_GAP = 700; // avant la manche suivante
const LEVEL_DELAY = 600; // avant le niveau suivant

/** Les 4 pastilles (≥ 96 px) : couleurs façon projet + emoji. */
const PAD_COLORS = ["#22B573", "#FF5A5F", "#FFB020", "#0984E3"] as const;
const PAD_ICONS = ["🍀", "❤️", "⭐", "💧"] as const;
/** Tonalité de chaque pastille pendant l'écoute. */
const PAD_SOUNDS = ["tick", "flip", "click", "pop"] as const;

type PadPhase = "playback" | "input" | "wait";

function randPad(): number {
  return Math.floor(Math.random() * PAD_COLORS.length);
}

function makeSequence(length: number): number[] {
  return Array.from({ length }, randPad);
}

// ── Composant ────────────────────────────────────────────────────

export function MemorySequence({ ctx }: GameProps) {
  const settings = ctx.game.config.settings as
    | { startLength?: Partial<Record<DifficultyKey, number>>; maxRounds?: number }
    | undefined;
  const startLength = settings?.startLength?.[ctx.difficulty] ?? DEFAULT_START_LENGTH;
  const maxRounds = Math.max(1, settings?.maxRounds ?? DEFAULT_MAX_ROUNDS);
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);

  // Plafond anti-triche : 95 % du maximum serveur (§44).
  const cap = Math.floor(
    (ctx.game.config.maxScore?.[ctx.difficulty] ?? ctx.game.maxScoreHint) * 0.95,
  );
  const pointsPerRound = Math.floor(cap / (maxRounds * maxLevel));

  /** Longueur de base d'un niveau : +1 pastille par niveau. */
  const baseLengthFor = useCallback((level: number) => startLength + (level - 1), [startLength]);

  const [sequence, setSequence] = useState<number[]>(() => makeSequence(baseLengthFor(ctx.level)));
  const [round, setRound] = useState(0);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [phase, setPhase] = useState<PadPhase>("playback");

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const sequenceRef = useRef(sequence);
  sequenceRef.current = sequence;
  const phaseRef = useRef<PadPhase>("playback");
  const inputIndexRef = useRef(0);
  const roundRef = useRef(0);
  const livesRef = useRef(LIVES);
  const clearedRef = useRef(0);
  const mistakesRef = useRef(0);
  const creditedRef = useRef(0);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  // Lecture de la séquence : éclats + tonalités, puis main à l'enfant.
  // Chaque étape attend la reprise si le jeu est en pause (§2).
  const playSequence = useCallback(
    (seq: number[]) => {
      clearTimers();
      phaseRef.current = "playback";
      setPhase("playback");
      setActivePad(null);
      const whenRunning = (fn: () => void): void => {
        const run = (): void => {
          if (finishedRef.current) return;
          if (!ctxRef.current.running) {
            schedule(run, 220);
            return;
          }
          fn();
        };
        run();
      };
      seq.forEach((pad, index) => {
        schedule(() => {
          whenRunning(() => {
            setActivePad(pad);
            ctxRef.current.sound.play(PAD_SOUNDS[pad]);
          });
        }, index * STEP_MS);
        schedule(() => {
          whenRunning(() => setActivePad(null));
        }, index * STEP_MS + HIGHLIGHT_MS);
      });
      schedule(() => {
        whenRunning(() => {
          phaseRef.current = "input";
          setPhase("input");
          inputIndexRef.current = 0;
        });
      }, seq.length * STEP_MS);
    },
    [clearTimers, schedule],
  );

  // Montage = début de partie : 3 vies + première écoute.
  useEffect(() => {
    ctxRef.current.setLives(LIVES);
    playSequence(sequenceRef.current);
    return () => clearTimers();
  }, [clearTimers, playSequence]);

  // Fin de partie : une seule fois.
  const finishRun = useCallback(
    (isWin: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTimers();
      const current = ctxRef.current;
      current.finish({
        isWin,
        levelReached: current.level,
        clientMeta: { roundsCleared: clearedRef.current, mistakes: mistakesRef.current },
      });
    },
    [clearTimers],
  );

  const completeLevel = useCallback(() => {
    const current = ctxRef.current;
    if (current.level >= maxLevel) {
      finishRun(true);
      return;
    }
    current.sound.play("level");
    schedule(() => {
      const latest = ctxRef.current;
      latest.setLevel(Math.min(maxLevel, latest.level + 1));
      roundRef.current = 0;
      setRound(0);
      const nextSequence = makeSequence(baseLengthFor(latest.level));
      sequenceRef.current = nextSequence;
      setSequence(nextSequence);
      playSequence(nextSequence);
    }, LEVEL_DELAY);
  }, [baseLengthFor, finishRun, maxLevel, playSequence, schedule]);

  const tapPad = useCallback(
    (pad: number) => {
      const current = ctxRef.current;
      if (!current.running || finishedRef.current) return;
      if (phaseRef.current !== "input") return;

      current.sound.play(PAD_SOUNDS[pad]);

      const seq = sequenceRef.current;
      if (pad !== seq[inputIndexRef.current]) {
        // Erreur : combo remis à zéro, une vie en moins.
        mistakesRef.current += 1;
        current.sound.play("wrong");
        current.signalWrong();
        phaseRef.current = "wait";
        setPhase("wait");

        const nextLives = livesRef.current - 1;
        livesRef.current = nextLives;
        current.setLives(nextLives);

        if (nextLives <= 0) {
          schedule(() => finishRun(false), REPLAY_DELAY);
          return;
        }
        // On rejoue la même séquence : aucune punition supplémentaire.
        const replay = [...seq];
        schedule(() => playSequence(replay), REPLAY_DELAY);
        return;
      }

      inputIndexRef.current += 1;
      if (inputIndexRef.current < seq.length) return;

      // Séquence reproduite : points + manche suivante (plus longue).
      const gain = Math.max(0, Math.min(pointsPerRound, cap - creditedRef.current));
      if (gain > 0) {
        creditedRef.current += gain;
        current.signalCorrect(gain);
      } else {
        current.sound.play("correct");
      }
      clearedRef.current += 1;
      phaseRef.current = "wait";
      setPhase("wait");

      const nextRound = roundRef.current + 1;
      if (nextRound >= maxRounds) {
        completeLevel();
        return;
      }
      const nextSequence = makeSequence(baseLengthFor(current.level) + nextRound);
      schedule(() => {
        roundRef.current = nextRound;
        setRound(nextRound);
        sequenceRef.current = nextSequence;
        setSequence(nextSequence);
        playSequence(nextSequence);
      }, ROUND_GAP);
    },
    [baseLengthFor, cap, completeLevel, finishRun, maxRounds, playSequence, pointsPerRound, schedule],
  );

  // Clavier : touches 1-4 (contrat §31) ; Tab/Entrée marchent nativement.
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
      event.preventDefault();
      tapPad(index);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tapPad]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-4">
      <p className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        🎵 {round + 1}/{maxRounds}
      </p>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        {PAD_COLORS.map((color, pad) => {
          const active = activePad === pad;
          return (
            <button
              key={pad}
              type="button"
              disabled={phase !== "input"}
              onClick={() => tapPad(pad)}
              aria-label={`${pad + 1} ${PAD_ICONS[pad]}`}
              style={{ backgroundColor: color }}
              className={cn(
                "flex aspect-square min-h-[96px] w-full items-center justify-center rounded-3xl",
                "text-4xl shadow-soft no-select transition-all duration-150",
                active ? "scale-95 brightness-125 ring-4 ring-white" : "active:scale-95",
              )}
            >
              <span
                aria-hidden="true"
                className={cn("transition-opacity", active ? "opacity-100" : "opacity-60")}
              >
                {PAD_ICONS[pad]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
