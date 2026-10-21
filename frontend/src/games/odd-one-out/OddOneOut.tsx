// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 06 : Cherche l'Intrus (moteur « odd-one-out »)
//  Une seule case est différente : trouve-la ! La différence est un
//  détail (image en miroir, rotation, ou emoji jumeau). La grille
//  grandit tous les 3 bons tours. Boutons accessibles (Tab + Entrée).
//  Aucun texte visible : emojis + chiffres (§5 du contrat).
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import { maxScoreFor } from "../engine/components";
import type { GameProps } from "../registry";

/** Nombre maximal de cases dans la grille. */
const MAX_CHOICES = 12;

interface Variant {
  /** Emoji des cases normales. */
  base: string;
  /** Emoji de la case intruse (souvent le même, transformé). */
  odd: string;
  /** Transformation CSS appliquée uniquement à l'intrus. */
  transform: string | null;
  /** Différence discrète (sélection en mode « difficile »). */
  subtle: boolean;
}

const VARIANTS: Variant[] = [
  // Emojis jumeaux : même thème, dessin légèrement différent.
  { base: "🙂", odd: "🙃", transform: null, subtle: false },
  { base: "🐶", odd: "🐕", transform: null, subtle: false },
  { base: "🍐", odd: "🍏", transform: null, subtle: false },
  { base: "👀", odd: "👁️", transform: null, subtle: false },
  { base: "☹️", odd: "😞", transform: null, subtle: true },
  // Miroir / rotation du même emoji (formes asymétriques).
  { base: "🚗", odd: "🚗", transform: "scaleX(-1)", subtle: true },
  { base: "🎈", odd: "🎈", transform: "scaleX(-1)", subtle: true },
  { base: "🐰", odd: "🐰", transform: "scaleX(-1)", subtle: true },
  { base: "🐱", odd: "🐱", transform: "rotate(180deg)", subtle: true },
  { base: "🐸", odd: "🐸", transform: "rotate(180deg)", subtle: true },
  { base: "🐼", odd: "🐼", transform: "rotate(180deg)", subtle: true },
  { base: "⭐️", odd: "⭐️", transform: "rotate(180deg)", subtle: true },
];

interface OddRound {
  count: number;
  oddIndex: number;
  base: string;
  odd: string;
  transform: string | null;
}

/** Une manche : n cases identiques + exactement une case intruse. */
function buildRound(
  answered: number,
  level: number,
  startChoices: number,
  subtleOnly: boolean,
): OddRound {
  const pool = subtleOnly ? VARIANTS.filter((variant) => variant.subtle) : VARIANTS;
  const variant = pool[Math.floor(Math.random() * pool.length)];
  const count = Math.min(MAX_CHOICES, startChoices + (level - 1) + Math.floor(answered / 3));
  const oddIndex = Math.floor(Math.random() * count);
  return {
    count,
    oddIndex,
    base: variant.base,
    odd: variant.odd,
    transform: variant.transform,
  };
}

// ── Le jeu ────────────────────────────────────────────────────────

export function OddOneOut({ ctx }: GameProps) {
  const settings = ctx.game.config.settings as
    | { rounds?: number; startChoices?: number }
    | undefined;
  const rounds = Math.max(1, settings?.rounds ?? 15);
  const startChoices = Math.max(2, settings?.startChoices ?? 4);
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);
  const level = Math.min(Math.max(1, ctx.level), maxLevel);
  const isHard = ctx.difficulty === "hard";

  // Budget : une partie parfaite ≈ 95 % du plafond serveur (§3).
  const cap = maxScoreFor(ctx.game, ctx.difficulty);
  const pointsPerRound = Math.max(1, Math.floor((cap * 0.95) / (rounds * maxLevel)));
  const maxAwarded = Math.floor(cap * 0.95);

  const [round, setRound] = useState<OddRound>(() =>
    buildRound(0, level, startChoices, isHard),
  );
  const [answered, setAnswered] = useState(0);
  const [shaking, setShaking] = useState(false);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const roundRef = useRef(round);
  roundRef.current = round;
  const answeredRef = useRef(0);
  const awardedRef = useRef(0);
  const lockedRef = useRef(false);
  const finishedRef = useRef(false);
  const builtLevelRef = useRef(level);
  const timersRef = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  // Nouvelle série de manches à chaque niveau (le montage garde son tirage).
  useEffect(() => {
    if (builtLevelRef.current === level) return;
    builtLevelRef.current = level;
    answeredRef.current = 0;
    setAnswered(0);
    lockedRef.current = false;
    const next = buildRound(0, level, startChoices, isHard);
    roundRef.current = next;
    setRound(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, startChoices, isHard]);

  const choose = useCallback(
    (index: number) => {
      const current = ctxRef.current;
      const active = roundRef.current;
      if (!current.running || lockedRef.current || finishedRef.current) return;

      if (index !== active.oddIndex) {
        current.signalWrong();
        setShaking(true);
        return; // pas grave : la grille reste, on réessaie
      }

      // Garde-fou : le cumul ne dépasse jamais 95 % du plafond (§3).
      const remaining = maxAwarded - awardedRef.current;
      const award = Math.max(0, Math.min(pointsPerRound, remaining));
      awardedRef.current += award;
      current.signalCorrect(award);

      const nextAnswered = answeredRef.current + 1;
      answeredRef.current = nextAnswered;
      setAnswered(nextAnswered);

      if (nextAnswered >= rounds) {
        lockedRef.current = true;
        current.sound.play("level");
        if (level >= maxLevel) {
          finishedRef.current = true;
          current.finish({ isWin: true, clientMeta: { rounds } });
        } else {
          later(() => {
            const latest = ctxRef.current;
            latest.setLevel(Math.min(maxLevel, latest.level + 1));
          }, 600);
        }
        return;
      }

      const next = buildRound(nextAnswered, level, startChoices, isHard);
      roundRef.current = next;
      setRound(next);
    },
    [isHard, later, level, maxAwarded, maxLevel, pointsPerRound, rounds, startChoices],
  );

  const columns = round.count <= 4 ? 2 : round.count <= 9 ? 3 : 4;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <p className="chip bg-secondary-soft text-ink" aria-live="polite">
        🔍 {Math.min(answered + 1, rounds)}/{rounds}
      </p>

      <div
        className={cn("grid w-full max-w-lg gap-2 sm:gap-3", shaking && "animate-shake")}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        onAnimationEnd={() => setShaking(false)}
      >
        {Array.from({ length: round.count }, (_, index) => {
          const isOdd = index === round.oddIndex;
          return (
            <button
              key={index}
              type="button"
              onClick={() => choose(index)}
              aria-label={`${index + 1}`}
              className="flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-primary/5 bg-white text-4xl shadow-soft no-select transition-transform duration-150 active:scale-95 sm:text-5xl"
            >
              <span
                aria-hidden="true"
                className="leading-none"
                style={
                  isOdd && round.transform
                    ? { display: "inline-block", transform: round.transform }
                    : undefined
                }
              >
                {isOdd ? round.odd : round.base}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
