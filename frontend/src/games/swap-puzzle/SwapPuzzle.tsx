// ══════════════════════════════════════════════════════════════════
//  KIDORA — Puzzle Échange (moteur « swap-puzzle »)
//  Échange deux pièces pour remettre les nombres dans l'ordre.
//  (Différent du Puzzle Magique, qui est un taquin coulissant.)
// ══════════════════════════════════════════════════════════════════

import { useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { scoreCap, shuffle, useAward, useCtxRef, useTimers } from "../shared/kit";

const SIZES: Record<DifficultyKey, number> = { easy: 3, medium: 4, hard: 4 };

function makeTiles(size: number): number[] {
  const total = size * size;
  const tiles = shuffle(Array.from({ length: total }, (_, index) => index + 1));
  const solved = tiles.every((value, index) => value === index + 1);
  if (solved) [tiles[0], tiles[1]] = [tiles[1], tiles[0]];
  return tiles;
}

export function SwapPuzzle({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const size = SIZES[ctx.difficulty];
  const total = size * size;
  const [tiles, setTiles] = useState<number[]>(() => makeTiles(size));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const doneRef = useCtxRef(ctx);
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  const selectedRef = useRef<number | null>(null);
  const movesRef = useRef(0);
  const finishedRef = useRef(false);

  const solvedCount = tiles.filter((value, index) => value === index + 1).length;

  const onTile = (index: number) => {
    const current = ctxRef.current;
    if (!current.running || finishedRef.current) return;
    const active = selectedRef.current;
    if (active === null) {
      selectedRef.current = index;
      setSelected(index);
      current.sound.play("click");
      return;
    }
    if (active === index) {
      selectedRef.current = null;
      setSelected(null);
      return;
    }
    const updated = [...tilesRef.current];
    [updated[active], updated[index]] = [updated[index], updated[active]];
    tilesRef.current = updated;
    setTiles(updated);
    selectedRef.current = null;
    setSelected(null);
    movesRef.current += 1;
    setMoves(movesRef.current);
    current.sound.play("flip");

    const solved = updated.every((value, position) => value === position + 1);
    if (solved) {
      finishedRef.current = true;
      award(scoreCap(ctx));
      later(() => {
        doneRef.current.finish({
          isWin: true,
          levelReached: 1,
          clientMeta: { game: "swap-puzzle", moves: movesRef.current },
        });
      }, 600);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
      <div className="flex items-center gap-2">
        <span className="chip bg-primary-soft text-primary-dark" aria-live="polite">
          🎯 {solvedCount}/{total}
        </span>
        <span className="chip bg-white text-ink-soft">🔄 {moves}</span>
      </div>

      <div
        className="grid w-full max-w-md gap-2 rounded-card bg-white/80 p-3 shadow-soft"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="🧩"
      >
        {tiles.map((value, index) => {
          const isPlaced = value === index + 1;
          const isSelected = selected === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onTile(index)}
              aria-label={`${value}`}
              aria-pressed={isSelected}
              className={cn(
                "flex aspect-square items-center justify-center rounded-2xl border-2 text-2xl font-bold text-white shadow-soft transition-all sm:text-3xl",
                isSelected
                  ? "scale-105 border-ink ring-4 ring-primary/40"
                  : isPlaced
                    ? "border-success/60"
                    : "border-white/60 hover:scale-[1.03]",
              )}
              style={{
                background: `linear-gradient(135deg, hsl(${(value * 43) % 360} 75% 62%), hsl(${(value * 43 + 40) % 360} 70% 48%))`,
              }}
            >
              {value}
            </button>
          );
        })}
      </div>

      <p className="text-xs font-semibold text-ink-faint">
        👆 {selected === null ? "1" : "2"}
      </p>
    </div>
  );
}
