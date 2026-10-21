// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 01 : Memory des Animaux (moteur « memory-cards »)
//  Retourne les cartes et retrouve toutes les paires d'animaux.
//  Chaque niveau ajoute des paires (§20). Zéro asset : emojis + CSS.
//  Jeu de référence : les autres jeux suivent exactement ce contrat.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";

const ANIMALS = [
  "🐼", "🦊", "🦁", "🐯", "🐸", "🐙", "🦄", "🐲",
  "🐧", "🦉", "🐨", "🐰", "🦖", "🐳", "🦋", "🐢",
];

interface Card {
  id: number;
  emoji: string;
  matched: boolean;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck(pairCount: number): Card[] {
  const chosen = shuffle(ANIMALS).slice(0, Math.min(pairCount, ANIMALS.length));
  const cards: Card[] = [];
  chosen.forEach((emoji, index) => {
    cards.push({ id: index * 2, emoji, matched: false });
    cards.push({ id: index * 2 + 1, emoji, matched: false });
  });
  return shuffle(cards);
}

/** Paires du niveau : base + 2 par niveau (borné au stock d'emojis). */
function pairsForLevel(base: number, level: number): number {
  return Math.min(ANIMALS.length, base + (level - 1) * 2);
}

export function MemoryCards({ ctx }: GameProps) {
  const settings = ctx.game.config.settings as
    | { pairs?: Partial<Record<DifficultyKey, number>> }
    | undefined;
  const basePairs = settings?.pairs?.[ctx.difficulty] ?? 4;
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);

  // Budget de points : une partie parfaite ≈ 95 % du plafond serveur,
  // ce qui rend les 3 étoiles atteignables sans jamais dépasser la borne.
  const totalPairs = useMemo(() => {
    let sum = 0;
    for (let level = 1; level <= maxLevel; level++) sum += pairsForLevel(basePairs, level);
    return sum;
  }, [basePairs, maxLevel]);
  const maxScoreCap = ctx.game.config.maxScore?.[ctx.difficulty] ?? ctx.game.maxScoreHint;
  const pointsPerPair = Math.max(20, Math.floor((maxScoreCap * 0.95) / Math.max(1, totalPairs)));

  const [cards, setCards] = useState<Card[]>(() => buildDeck(pairsForLevel(basePairs, ctx.level)));
  const [flipped, setFlipped] = useState<number[]>([]);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;
  const lockedRef = useRef(false);
  const mistakesRef = useRef(0);
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

  // Nouveau tableau à chaque niveau (le shell remonte déjà le jeu à
  // chaque partie, ceci gère les niveaux à l'intérieur d'une partie).
  useEffect(() => {
    lockedRef.current = false;
    flippedRef.current = [];
    setFlipped([]);
    setCards(buildDeck(pairsForLevel(basePairs, ctx.level)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.level, basePairs]);

  const completeLevel = useCallback(() => {
    const current = ctxRef.current;
    if (current.level < maxLevel) {
      current.sound.play("level");
      later(() => {
        const latest = ctxRef.current;
        latest.setLevel(latest.level + 1);
      }, 650);
    } else {
      current.finish({ clientMeta: { mistakes: mistakesRef.current } });
    }
  }, [later, maxLevel]);

  const flip = useCallback(
    (id: number) => {
      const current = ctxRef.current;
      if (!current.running || lockedRef.current) return;

      const deck = cardsRef.current;
      const card = deck.find((item) => item.id === id);
      if (!card || card.matched || flippedRef.current.includes(id)) return;

      current.sound.play("flip");
      const nextFlipped = [...flippedRef.current, id];
      flippedRef.current = nextFlipped;
      setFlipped(nextFlipped);

      if (nextFlipped.length < 2) return;

      const [firstId, secondId] = nextFlipped;
      const first = deck.find((item) => item.id === firstId);
      const second = deck.find((item) => item.id === secondId);
      if (!first || !second) return;

      lockedRef.current = true;

      if (first.emoji === second.emoji) {
        later(() => {
          const updated = cardsRef.current.map((item) =>
            item.id === first.id || item.id === second.id ? { ...item, matched: true } : item,
          );
          cardsRef.current = updated;
          setCards(updated);
          flippedRef.current = [];
          setFlipped([]);
          lockedRef.current = false;

          ctxRef.current.signalCorrect(pointsPerPair);

          const remaining = updated.filter((item) => !item.matched).length;
          if (remaining === 0) completeLevel();
        }, 380);
      } else {
        mistakesRef.current += 1;
        ctxRef.current.signalWrong();
        later(() => {
          flippedRef.current = [];
          setFlipped([]);
          lockedRef.current = false;
        }, 950);
      }
    },
    [completeLevel, later, pointsPerPair],
  );

  const levelPairs = cards.length / 2;
  const matchedPairs = cards.filter((item) => item.matched).length / 2;
  const columns = cards.length <= 16 ? 4 : cards.length <= 20 ? 5 : 6;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        🃏 {matchedPairs} / {levelPairs}
      </p>

      <div
        className="grid w-full max-w-3xl gap-2 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {cards.map((card) => {
          const faceUp = card.matched || flipped.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              disabled={card.matched}
              onClick={() => flip(card.id)}
              aria-label={faceUp ? card.emoji : "?"}
              className={cn(
                "flip-scene relative aspect-square w-full no-select",
                !card.matched && "cursor-pointer",
                card.matched && "opacity-90",
              )}
            >
              <span className={cn("flip-inner absolute inset-0", faceUp && "is-flipped")}>
                <span
                  className={cn(
                    "flip-face flex items-center justify-center rounded-2xl bg-primary text-2xl text-white shadow-soft sm:text-3xl",
                    card.matched && "bg-primary-dark",
                  )}
                  aria-hidden="true"
                >
                  🐾
                </span>
                <span
                  className={cn(
                    "flip-face flip-back flex items-center justify-center rounded-2xl border-2 border-primary/15 bg-white text-3xl shadow-soft sm:text-4xl",
                    card.matched && "border-success/40 bg-success-soft",
                  )}
                  aria-hidden="true"
                >
                  {card.emoji}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {mistakesRef.current > 0 && (
        <p className="text-xs font-semibold text-ink-faint">🔄 {mistakesRef.current}</p>
      )}
    </div>
  );
}
