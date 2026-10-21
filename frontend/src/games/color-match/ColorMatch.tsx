// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 04 : Attrape les Couleurs (moteur « color-match »)
//  Trouve la case dont la couleur est identique à la cible.
//  Toutes les 4 manches, un « piège » : c'est la couleur du fruit
//  qu'il faut retrouver parmi les carrés de couleur.
//  Aucun texte visible : emojis + chiffres + formes (§5 du contrat).
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import { maxScoreFor } from "../engine/components";
import type { GameProps } from "../registry";

/** Palette fixe de 8 couleurs très distinctes (humeurs différentes). */
const PALETTE = [
  "#FF5A5F", // rouge corail
  "#FF8A3D", // orange
  "#FFC93C", // jaune banane
  "#22B573", // vert pomme
  "#00B8A9", // turquoise
  "#0984E3", // bleu
  "#6C5CE7", // violet
  "#E84393", // rose
] as const;

/** Les fruits du « piège » : chaque fruit a UNE couleur de la palette. */
const FRUITS: { emoji: string; color: string }[] = [
  { emoji: "🍎", color: "#FF5A5F" },
  { emoji: "🍊", color: "#FF8A3D" },
  { emoji: "🍌", color: "#FFC93C" },
  { emoji: "🍐", color: "#22B573" },
  { emoji: "🥝", color: "#00B8A9" },
  { emoji: "🫐", color: "#0984E3" },
  { emoji: "🍇", color: "#6C5CE7" },
  { emoji: "🍓", color: "#E84393" },
];

interface Round {
  /** "color" : reproduire la couleur ; "fruit" : couleur du fruit. */
  kind: "color" | "fruit";
  targetColor: string;
  targetEmoji: string | null;
  choices: string[];
  correctIndex: number;
}

function sample<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Éclaircit / assombrit une couleur hexadécimale (nuances « difficiles »). */
function shade(hex: string, factor: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number): number => {
    const part = (value >> shift) & 0xff;
    return Math.max(0, Math.min(255, Math.round(part * factor)));
  };
  const toHex = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${toHex(channel(16))}${toHex(channel(8))}${toHex(channel(0))}`;
}

/** Une manche : cible + choix mélangés + index correct. */
function buildRound(index: number, choiceCount: number, withNearShades: boolean): Round {
  const isFruitRound = (index + 1) % 4 === 0;
  let targetColor: string;
  let targetEmoji: string | null = null;
  if (isFruitRound) {
    const fruit = sample(FRUITS);
    targetColor = fruit.color;
    targetEmoji = fruit.emoji;
  } else {
    targetColor = sample(PALETTE);
  }

  // Distracteurs : couleurs franches, + nuances proches en « difficile ».
  const pool = new Set<string>();
  for (const color of PALETTE) {
    if (color !== targetColor) pool.add(color);
  }
  if (withNearShades && !isFruitRound) {
    pool.add(shade(targetColor, 0.78));
    pool.add(shade(targetColor, 1.18));
  }
  const distractors = shuffle([...pool].filter((color) => color !== targetColor)).slice(
    0,
    choiceCount - 1,
  );
  const choices = shuffle([targetColor, ...distractors]);
  return {
    kind: isFruitRound ? "fruit" : "color",
    targetColor,
    targetEmoji,
    choices,
    correctIndex: choices.indexOf(targetColor),
  };
}

// ── Le jeu ────────────────────────────────────────────────────────

export function ColorMatch({ ctx }: GameProps) {
  const settings = ctx.game.config.settings as
    | { rounds?: number; choices?: Partial<Record<DifficultyKey, number>> }
    | undefined;
  const rounds = Math.max(1, settings?.rounds ?? 12);
  const choiceCount = Math.max(2, settings?.choices?.[ctx.difficulty] ?? 4);
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);
  const level = Math.min(Math.max(1, ctx.level), maxLevel);
  const isHard = ctx.difficulty === "hard";

  // Budget : une partie parfaite ≈ 95 % du plafond serveur (§3).
  const cap = maxScoreFor(ctx.game, ctx.difficulty);
  const pointsPerRound = Math.max(1, Math.floor((cap * 0.95) / (rounds * maxLevel)));
  const maxAwarded = Math.floor(cap * 0.95);

  const [round, setRound] = useState<Round>(() => buildRound(0, choiceCount, isHard));
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
    const next = buildRound(0, choiceCount, isHard);
    roundRef.current = next;
    setRound(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, choiceCount, isHard]);

  const choose = useCallback(
    (index: number) => {
      const current = ctxRef.current;
      const active = roundRef.current;
      if (!current.running || lockedRef.current || finishedRef.current) return;

      if (index !== active.correctIndex) {
        current.signalWrong();
        setShaking(true);
        return; // mauvaise couleur : on ne change pas de manche
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
          current.finish({ clientMeta: { rounds } });
        } else {
          later(() => {
            const latest = ctxRef.current;
            latest.setLevel(Math.min(maxLevel, latest.level + 1));
          }, 600);
        }
        return;
      }

      const next = buildRound(nextAnswered, choiceCount, isHard);
      roundRef.current = next;
      setRound(next);
    },
    [choiceCount, isHard, later, level, maxAwarded, maxLevel, pointsPerRound, rounds],
  );

  const columns = choiceCount <= 3 ? choiceCount : choiceCount <= 4 ? 2 : 3;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <p className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        🎯 {Math.min(answered + 1, rounds)}/{rounds}
      </p>

      {/* Cible : couleur à retrouver, ou fruit du « piège » (manche 4/8/12…). */}
      <div
        key={answered}
        className={cn(
          "flex h-32 w-32 animate-pop-in items-center justify-center rounded-3xl shadow-pop sm:h-40 sm:w-40",
          round.kind === "fruit" && "border-2 border-primary/10 bg-white",
        )}
        style={round.kind === "color" ? { backgroundColor: round.targetColor } : undefined}
        role="img"
        aria-label={round.targetEmoji ?? "⭐"}
      >
        {round.targetEmoji ? (
          <span className="text-7xl" aria-hidden="true">
            {round.targetEmoji}
          </span>
        ) : (
          <span
            className="text-7xl text-white"
            aria-hidden="true"
            style={{ textShadow: "0 3px 6px rgba(45, 42, 69, 0.35)" }}
          >
            ⭐
          </span>
        )}
      </div>

      {/* Choix : carrés de couleur ≥ 64 px. */}
      <div
        className={cn("grid w-full max-w-md gap-3 sm:gap-4", shaking && "animate-shake")}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        onAnimationEnd={() => setShaking(false)}
      >
        {round.choices.map((color, index) => (
          <button
            key={index}
            type="button"
            onClick={() => choose(index)}
            aria-label={`${index + 1}`}
            className="aspect-square w-full min-h-[64px] rounded-2xl border-2 border-primary/5 shadow-inset no-select transition-transform duration-150 active:scale-95"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
