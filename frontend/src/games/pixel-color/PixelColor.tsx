// ══════════════════════════════════════════════════════════════════
//  KIDORA — Coloriage Magique (moteur « pixel-color »)
//  Choisis une couleur, colorie les cases numérotées, découvre l'image.
// ══════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { scoreCap, useAward, useCtxRef, useTimers } from "../shared/kit";

const COLORS: Record<number, string> = {
  1: "#FF5A5F",
  2: "#FDCB6E",
  3: "#00B8A9",
};

const PATTERNS: Record<DifficultyKey, { rows: string[]; emoji: string }> = {
  easy: {
    emoji: "❤️",
    rows: [
      "0110110",
      "1122211",
      "1222221",
      "1222221",
      "0122210",
      "0012100",
      "0001000",
    ],
  },
  medium: {
    emoji: "⭐",
    rows: [
      "0002000",
      "0022200",
      "2222222",
      "0222220",
      "0022200",
      "0220220",
      "2200022",
    ],
  },
  hard: {
    emoji: "🌸",
    rows: [
      "0011100",
      "0122210",
      "1222221",
      "1222221",
      "0122210",
      "0033300",
      "0003000",
    ],
  },
};

export function PixelColor({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const pattern = PATTERNS[ctx.difficulty];
  const size = pattern.rows.length;
  const target = useMemo(
    () => pattern.rows.map((row) => row.split("").map((value) => Number(value))),
    [pattern],
  );
  const totalCells = useMemo(
    () => target.flat().filter((value) => value > 0).length,
    [target],
  );
  const pointsPerCell = Math.max(10, Math.floor(scoreCap(ctx) / Math.max(1, totalCells)));

  const [color, setColor] = useState(1);
  const [filled, setFilled] = useState<number[][]>(() =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => 0)),
  );
  const [mistakes, setMistakes] = useState(0);
  const doneRef = useCtxRef(ctx);
  const filledRef = useRef<number[][]>(filled);
  const mistakesRef = useRef(0);
  const finishedLockRef = useRef(false);

  const onCell = (row: number, col: number) => {
    const current = ctxRef.current;
    if (!current.running || finishedLockRef.current) return;
    const value = target[row][col];
    if (value === 0 || filledRef.current[row][col] !== 0) return;
    if (value !== color) {
      mistakesRef.current += 1;
      setMistakes(mistakesRef.current);
      current.signalWrong();
      return;
    }
    const updated = filledRef.current.map((line, rowIndex) =>
      line.map((cell, colIndex) => (rowIndex === row && colIndex === col ? value : cell)),
    );
    filledRef.current = updated;
    setFilled(updated);
    award(pointsPerCell);
    const done = updated.every((line, rowIndex) =>
      line.every((cell, colIndex) => target[rowIndex][colIndex] === 0 || cell === target[rowIndex][colIndex]),
    );
    if (done) {
      finishedLockRef.current = true;
      later(() => {
        doneRef.current.finish({
          isWin: true,
          levelReached: 1,
          clientMeta: { game: "pixel-color", mistakes: mistakesRef.current },
        });
      }, 600);
    }
  };

  const filledCount = filled.flat().filter((value) => value > 0).length;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[1, 2, 3].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setColor(value);
              ctxRef.current.sound.play("click");
            }}
            aria-pressed={color === value}
            aria-label={`${value}`}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border-4 text-lg font-bold text-white shadow-soft transition-all",
              color === value ? "scale-110 border-ink" : "border-white/70 opacity-80",
            )}
            style={{ backgroundColor: COLORS[value] }}
          >
            {value}
          </button>
        ))}
        <span className="chip bg-white text-ink-soft" aria-live="polite">
          🎨 {filledCount}/{totalCells}
        </span>
      </div>

      <div
        className="grid w-full max-w-md gap-1 rounded-card bg-white/85 p-2 shadow-soft"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="🎨"
      >
        {target.map((row, rowIndex) =>
          row.map((value, colIndex) => {
            const isFilled = filled[rowIndex][colIndex] > 0;
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                onClick={() => onCell(rowIndex, colIndex)}
                disabled={value === 0 || isFilled}
                aria-label={value === 0 ? "" : `${value}`}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border text-sm font-bold transition-all sm:text-base",
                  value === 0
                    ? "cursor-default border-transparent bg-transparent"
                    : isFilled
                      ? "border-white/50 text-white/90"
                      : "border-ink/10 bg-white text-ink-soft hover:border-primary/50 hover:bg-primary-soft",
                )}
                style={isFilled ? { backgroundColor: COLORS[filled[rowIndex][colIndex]] } : undefined}
              >
                {value === 0 ? "" : isFilled ? value : value}
              </button>
            );
          }),
        )}
      </div>

      <p className="text-xs font-semibold text-ink-faint" aria-live="polite">
        {filledCount === totalCells ? `🌟 ${pattern.emoji}` : "🖌️"} {mistakes > 0 ? `· 🔄 ${mistakes}` : ""}
      </p>
    </div>
  );
}
