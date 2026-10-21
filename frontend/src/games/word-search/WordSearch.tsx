// ══════════════════════════════════════════════════════════════════
//  KIDORA — Mots Mêlés (moteur « word-search »)
//  Grille générée à chaque partie ; sélection au doigt ou au clic.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { scoreCap, shuffle, useAward, useCtxRef, useTimers } from "../shared/kit";

const WORDS: Record<DifficultyKey, string[]> = {
  easy: ["CHAT", "LUNE", "ROSE", "VELO", "POMME"],
  medium: ["SOLEIL", "FLEUR", "MAISON", "BALLON", "POISSON", "ORANGE"],
  hard: ["PAPILLON", "GUITARE", "CHATEAU", "MONTAGNE", "ELEPHANT", "BANANE", "VOITURE"],
};

const SIZES: Record<DifficultyKey, number> = { easy: 8, medium: 10, hard: 12 };
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
] as const;

interface Placement {
  word: string;
  cells: { r: number; c: number }[];
}

function generate(words: string[], size: number, depth = 0): { grid: string[][]; placements: Placement[] } {
  const grid: (string | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null as string | null),
  );
  const placements: Placement[] = [];

  for (const word of shuffle(words)) {
    let placed = false;
    for (let attempt = 0; attempt < 400 && !placed; attempt++) {
      const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const maxRow = size - dr * (word.length - 1);
      const maxCol = size - dc * (word.length - 1);
      const row = Math.floor(Math.random() * maxRow);
      const col = Math.floor(Math.random() * maxCol);
      const cells = Array.from({ length: word.length }, (_, index) => ({
        r: row + dr * index,
        c: col + dc * index,
      }));
      const compatible = cells.every(({ r, c }, index) => {
        const current = grid[r][c];
        return current === null || current === word[index];
      });
      if (!compatible) continue;
      cells.forEach(({ r, c }, index) => {
        grid[r][c] = word[index];
      });
      placements.push({ word, cells });
      placed = true;
    }
  }

  // Toutes les lettres doivent être placées, sinon on régénère (rare).
  if (placements.length < words.length && depth < 20) return generate(words, size, depth + 1);

  const filled = grid.map((row) => row.map((letter) => letter ?? LETTERS[Math.floor(Math.random() * 26)]));
  return { grid: filled, placements };
}

export function WordSearch({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const words = WORDS[ctx.difficulty];
  const size = SIZES[ctx.difficulty];
  const { grid, placements } = useMemo(() => generate(words, size), [words, size]);

  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const finishedRef = useCtxRef(ctx);
  const selectedRef = useRef<{ r: number; c: number } | null>(null);
  const foundWordsRef = useRef<Set<string>>(new Set());
  const foundCellsRef = useRef<Set<string>>(new Set());
  const finishedLockRef = useRef(false);

  const pointsPerWord = Math.max(20, Math.floor(scoreCap(ctx) / Math.max(1, words.length)));

  const select = useCallback((cell: { r: number; c: number } | null) => {
    selectedRef.current = cell;
    setSelected(cell);
  }, []);

  const finishIfDone = useCallback(
    (foundCount: number) => {
      if (foundCount < words.length || finishedLockRef.current) return;
      finishedLockRef.current = true;
      later(() => {
        finishedRef.current.finish({
          isWin: true,
          levelReached: 1,
          clientMeta: { game: "word-search", found: foundCount, mistakes },
        });
      }, 500);
    },
    [finishedRef, later, mistakes, words.length],
  );

  const onCell = useCallback(
    (row: number, col: number) => {
      const current = ctxRef.current;
      if (!current.running || finishedLockRef.current) return;
      const active = selectedRef.current;
      if (!active) {
        select({ r: row, c: col });
        current.sound.play("click");
        return;
      }
      if (active.r === row && active.c === col) {
        select(null);
        return;
      }
      const dr = Math.sign(row - active.r);
      const dc = Math.sign(col - active.c);
      const length = Math.max(Math.abs(row - active.r), Math.abs(col - active.c)) + 1;
      const aligned =
        (dr === 0 && dc !== 0) || (dc === 0 && dr !== 0) || (Math.abs(row - active.r) === Math.abs(col - active.c));
      if (!aligned) {
        select({ r: row, c: col });
        setMistakes((value) => value + 1);
        current.signalWrong();
        return;
      }

      const cells = Array.from({ length }, (_, index) => ({
        r: active.r + dr * index,
        c: active.c + dc * index,
      }));
      if (cells.some(({ r, c }) => r < 0 || c < 0 || r >= size || c >= size)) {
        select({ r: row, c: col });
        current.signalWrong();
        return;
      }

      const line = cells.map(({ r, c }) => grid[r][c]).join("");
      const reversed = [...line].reverse().join("");
      const matched = placements.find(
        (placement) =>
          !foundWordsRef.current.has(placement.word) &&
          (placement.word === line || placement.word === reversed),
      );

      if (!matched) {
        setMistakes((value) => value + 1);
        current.signalWrong();
        select(null);
        return;
      }

      // Verrou synchrone : un double-clic très rapide ne peut pas créditer
      // deux fois le même mot avant le re-rendu React.
      foundWordsRef.current.add(matched.word);
      matched.cells.forEach(({ r, c }) => foundCellsRef.current.add(`${r}-${c}`));
      const nextFound = words.filter((word) => foundWordsRef.current.has(word));
      setFound(nextFound);
      setFoundCells(new Set(foundCellsRef.current));
      select(null);
      award(pointsPerWord);
      finishIfDone(nextFound.length);
    },
    [award, ctxRef, finishIfDone, grid, placements, pointsPerWord, select, size, words],
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
      <div className="flex flex-wrap items-center justify-center gap-1.5" aria-live="polite">
        {words.map((word) => (
          <span
            key={word}
            className={cn(
              "chip text-xs sm:text-sm",
              found.includes(word)
                ? "bg-success-soft text-success line-through"
                : "bg-white text-ink-soft",
            )}
          >
            {word}
          </span>
        ))}
      </div>

      <div
        className="grid w-full max-w-xl gap-1 rounded-card bg-white/80 p-2 shadow-soft sm:gap-1.5 sm:p-3"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="🔎"
      >
        {grid.map((row, rowIndex) =>
          row.map((letter, colIndex) => {
            const key = `${rowIndex}-${colIndex}`;
            const isFound = foundCells.has(key);
            const isSelected = selected?.r === rowIndex && selected?.c === colIndex;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCell(rowIndex, colIndex)}
                aria-label={letter}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg border-2 text-sm font-bold transition-all sm:text-base",
                  isFound
                    ? "border-success/40 bg-success text-white"
                    : isSelected
                      ? "border-primary bg-primary-soft text-primary-dark ring-2 ring-primary/40"
                      : "border-transparent bg-primary-soft/40 text-ink hover:border-primary/40 hover:bg-primary-soft",
                )}
              >
                {letter}
              </button>
            );
          }),
        )}
      </div>

      <p className="text-xs font-semibold text-ink-faint" aria-live="polite">
        {found.length}/{words.length} {mistakes > 0 ? `· 🔄 ${mistakes}` : ""}
      </p>
    </div>
  );
}
