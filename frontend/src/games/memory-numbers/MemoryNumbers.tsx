// ══════════════════════════════════════════════════════════════════
//  KIDORA — Memory des Nombres (moteur « memory-numbers »)
//  Associe chaque chiffre à la carte de points correspondante.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { scoreCap, shuffle, useAward, useCtxRef, useTimers } from "../shared/kit";

const PAIRS: Record<DifficultyKey, number> = { easy: 4, medium: 6, hard: 8 };
const CARD_COLORS = ["#6C5CE7", "#E84393", "#00B8A9", "#FDCB6E", "#FF5A5F", "#0984E3", "#8E44AD", "#E67E22"];

interface Card {
  id: number;
  value: number;
  kind: "number" | "dots";
  matched: boolean;
}

function buildDeck(pairs: number): Card[] {
  const cards: Card[] = [];
  for (let value = 1; value <= pairs; value++) {
    cards.push({ id: value * 2 - 2, value, kind: "number", matched: false });
    cards.push({ id: value * 2 - 1, value, kind: "dots", matched: false });
  }
  return shuffle(cards);
}

function Dots({ value }: { value: number }) {
  return (
    <span className="grid max-w-[80%] grid-cols-3 place-items-center gap-1" aria-hidden="true">
      {Array.from({ length: value }, (_, index) => (
        <span key={index} className="h-2.5 w-2.5 rounded-full bg-current sm:h-3 sm:w-3" />
      ))}
    </span>
  );
}

export function MemoryNumbers({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const pairs = PAIRS[ctx.difficulty];
  const pointsPerPair = Math.max(20, Math.floor(scoreCap(ctx) / pairs));

  const [cards, setCards] = useState<Card[]>(() => buildDeck(pairs));
  const [flipped, setFlipped] = useState<number[]>([]);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;
  const lockedRef = useRef(false);
  const overRef = useRef(false);

  useEffect(
    () => () => {
      overRef.current = true;
    },
    [],
  );

  const flip = useCallback(
    (id: number) => {
      const current = ctxRef.current;
      if (!current.running || lockedRef.current || overRef.current) return;
      if (flippedRef.current.includes(id)) return;
      const card = cardsRef.current.find((item) => item.id === id);
      if (!card || card.matched) return;

      current.sound.play("flip");
      const next = [...flippedRef.current, id];
      flippedRef.current = next;
      setFlipped(next);
      if (next.length < 2) return;

      lockedRef.current = true;
      const [firstId, secondId] = next;
      const first = cardsRef.current.find((item) => item.id === firstId);
      const second = cardsRef.current.find((item) => item.id === secondId);
      if (!first || !second) return;

      if (first.value === second.value && first.kind !== second.kind) {
        later(() => {
          const updated = cardsRef.current.map((item) =>
            item.id === first.id || item.id === second.id ? { ...item, matched: true } : item,
          );
          cardsRef.current = updated;
          setCards(updated);
          flippedRef.current = [];
          setFlipped([]);
          lockedRef.current = false;
          award(pointsPerPair);

          if (updated.every((item) => item.matched)) {
            overRef.current = true;
            later(() => {
              ctxRef.current.finish({
                isWin: true,
                levelReached: 1,
                clientMeta: { game: "memory-numbers", pairs },
              });
            }, 500);
          }
        }, 350);
      } else {
        current.signalWrong();
        later(() => {
          flippedRef.current = [];
          setFlipped([]);
          lockedRef.current = false;
        }, 900);
      }
    },
    [award, ctxRef, later, pairs, pointsPerPair],
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
      <span className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        🃏 {cards.filter((card) => card.matched).length / 2} / {pairs}
      </span>

      <div className="grid w-full max-w-2xl grid-cols-4 gap-2 sm:gap-3">
        {cards.map((card) => {
          const faceUp = card.matched || flipped.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(card.id)}
              disabled={card.matched}
              aria-label={faceUp ? `${card.value}` : "?"}
              className={cn(
                "flip-scene relative aspect-square w-full no-select",
                !card.matched && "cursor-pointer",
                card.matched && "opacity-90",
              )}
            >
              <span className={cn("flip-inner absolute inset-0", faceUp && "is-flipped")}>
                <span className="flip-face flex items-center justify-center rounded-2xl bg-primary text-2xl text-white shadow-soft">
                  🔢
                </span>
                <span
                  className={cn(
                    "flip-face flip-back flex items-center justify-center rounded-2xl border-2 border-primary/15 bg-white text-3xl font-bold shadow-soft",
                    card.matched && "border-success/40 bg-success-soft",
                  )}
                  style={faceUp ? { color: CARD_COLORS[(card.value - 1) % CARD_COLORS.length] } : undefined}
                >
                  {faceUp ? (card.kind === "number" ? card.value : <Dots value={card.value} />) : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
