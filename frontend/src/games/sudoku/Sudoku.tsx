// ══════════════════════════════════════════════════════════════════
//  KIDORA — Sudoku des Animaux (moteur « sudoku »)
//  Grille 4×4 avec 4 animaux ; chaque ligne, colonne et carré
//  contient les 4 animaux exactement une fois.
// ══════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { scoreCap, shuffle, useAward, useCtxRef, useTimers } from "../shared/kit";

const ANIMALS = ["🐼", "🦊", "🐸", "🦉"];
const BLANKS: Record<DifficultyKey, number> = { easy: 5, medium: 7, hard: 9 };

interface Cell {
  r: number;
  c: number;
}

function buildPuzzle(difficulty: DifficultyKey): { solution: number[][]; puzzle: (number | null)[][] } {
  const majors = shuffle([0, 1, 2, 3]);
  const solution = Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => majors[(row * 2 + Math.floor(row / 2) + col) % 4]),
  );
  const puzzle: (number | null)[][] = solution.map((row) => [...row]);
  const cells = shuffle(
    Array.from({ length: 16 }, (_, index) => ({ r: Math.floor(index / 4), c: index % 4 })),
  ).slice(0, BLANKS[difficulty]);
  cells.forEach(({ r, c }) => {
    puzzle[r][c] = null;
  });
  return { solution, puzzle };
}

export function Sudoku({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const { solution, puzzle: initial } = useMemo(() => buildPuzzle(ctx.difficulty), [ctx.difficulty]);
  const [puzzle, setPuzzle] = useState<(number | null)[][]>(() => initial.map((row) => [...row]));
  const [selected, setSelected] = useState<Cell | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const doneRef = useCtxRef(ctx);
  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;
  const mistakesRef = useRef(0);
  const finishedRef = useRef(false);

  const blanks = useMemo(() => initial.flat().filter((value) => value === null).length, [initial]);
  const pointsPerBlank = Math.max(20, Math.floor(scoreCap(ctx) / Math.max(1, blanks)));

  const choose = (value: number) => {
    const current = ctxRef.current;
    if (!current.running || !selected || finishedRef.current) return;
    const { r, c } = selected;
    const currentPuzzle = puzzleRef.current;
    if (currentPuzzle[r][c] !== null) return;

    if (value !== solution[r][c]) {
      mistakesRef.current += 1;
      setMistakes(mistakesRef.current);
      current.signalWrong();
      return;
    }

    const updated = currentPuzzle.map((row, rowIndex) =>
      row.map((cell, colIndex) => (rowIndex === r && colIndex === c ? value : cell)),
    );
    puzzleRef.current = updated;
    setPuzzle(updated);
    setSelected(null);
    award(pointsPerBlank);
    const complete = updated.every((row) => row.every((cell) => cell !== null));
    if (complete) {
      finishedRef.current = true;
      later(() => {
        doneRef.current.finish({
          isWin: true,
          levelReached: 1,
          clientMeta: { game: "sudoku", mistakes: mistakesRef.current },
        });
      }, 600);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
      <div className="flex items-center gap-2">
        <span className="chip bg-primary-soft text-primary-dark">🧩 4×4</span>
        {mistakes > 0 && (
          <span className="chip bg-warning-soft text-ink" aria-live="polite">
            🔄 {mistakes}
          </span>
        )}
      </div>

      <div className="grid w-full max-w-[19rem] grid-cols-4 gap-1.5 rounded-card bg-primary-soft/50 p-2.5 shadow-soft">
        {puzzle.map((row, rowIndex) =>
          row.map((value, colIndex) => {
            const isGiven = initial[rowIndex][colIndex] !== null;
            const isSelected = selected?.r === rowIndex && selected?.c === colIndex;
            const sameRowOrCol = selected && (selected.r === rowIndex || selected.c === colIndex);
            const sameBox =
              selected &&
              Math.floor(selected.r / 2) === Math.floor(rowIndex / 2) &&
              Math.floor(selected.c / 2) === Math.floor(colIndex / 2);
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                onClick={() => {
                  if (isGiven) return;
                  setSelected({ r: rowIndex, c: colIndex });
                  ctxRef.current.sound.play("click");
                }}
                aria-label={value === null ? "" : ANIMALS[value]}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-xl border-2 text-3xl transition-all sm:text-4xl",
                  isGiven
                    ? "border-primary/20 bg-white font-bold"
                    : "border-primary/25 bg-white/90 hover:border-primary",
                  isSelected && "border-primary ring-4 ring-primary/25",
                  !isSelected && sameRowOrCol && "bg-primary-soft/60",
                  !isSelected && sameBox && "bg-accent-soft/60",
                  value !== null && !isGiven && "bg-success-soft border-success/40",
                )}
              >
                {value === null ? "" : ANIMALS[value]}
              </button>
            );
          }),
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="🐼">
        {ANIMALS.map((animal, index) => (
          <button
            key={animal}
            type="button"
            onClick={() => choose(index)}
            disabled={!selected}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-primary/20 bg-white text-3xl shadow-soft transition-all hover:border-primary active:scale-95 disabled:opacity-40 sm:h-16 sm:w-16"
            aria-label={animal}
          >
            {animal}
          </button>
        ))}
      </div>
    </div>
  );
}
