// ══════════════════════════════════════════════════════════════════
//  KIDORA — Pixel Puzzle (moteur « nonogram »)
//  Remplis les cases selon les indices des lignes et colonnes.
// ══════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import type { GameProps } from "../registry";
import { scoreCap, useAward, useCtxRef, useTimers } from "../shared/kit";

const PATTERNS: Record<DifficultyKey, string[]> = {
  easy: ["01110", "11111", "11111", "01110", "00100"],
  medium: ["00100", "01110", "11111", "01110", "11011"],
  hard: ["00100", "01110", "11111", "10101", "11111"],
};

function runs(line: boolean[]): number[] {
  const result: number[] = [];
  let count = 0;
  line.forEach((value) => {
    if (value) count += 1;
    else if (count > 0) {
      result.push(count);
      count = 0;
    }
  });
  if (count > 0) result.push(count);
  return result.length > 0 ? result : [0];
}

export function Nonogram({ ctx }: GameProps) {
  const ctxRef = useCtxRef(ctx);
  const award = useAward(ctx);
  const { later } = useTimers();
  const pattern = PATTERNS[ctx.difficulty];
  const solution = useMemo(
    () => pattern.map((row) => row.split("").map((value) => value === "1")),
    [pattern],
  );
  const size = solution.length;
  const rowClues = useMemo(() => solution.map((row) => runs(row)), [solution]);
  const colClues = useMemo(
    () => Array.from({ length: size }, (_, col) => runs(solution.map((row) => row[col]))),
    [solution, size],
  );

  const [grid, setGrid] = useState<boolean[][]>(() =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => false)),
  );
  const [awardedRows, setAwardedRows] = useState<Set<number>>(() => new Set());
  const [awardedCols, setAwardedCols] = useState<Set<number>>(() => new Set());
  const doneRef = useCtxRef(ctx);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const rowsRef = useRef<Set<number>>(new Set());
  const colsRef = useRef<Set<number>>(new Set());
  const finishedRef = useRef(false);
  const pointsPerLine = Math.max(15, Math.floor(scoreCap(ctx) / (size * 2)));

  const toggle = (row: number, col: number) => {
    const current = ctxRef.current;
    if (!current.running || finishedRef.current) return;
    const next = gridRef.current.map((line, rowIndex) =>
      line.map((value, colIndex) => (rowIndex === row && colIndex === col ? !value : value)),
    );
    gridRef.current = next;
    setGrid(next);
    current.sound.play("click");

    const newRows = new Set(rowsRef.current);
    const newCols = new Set(colsRef.current);
    for (let index = 0; index < size; index++) {
      if (!newRows.has(index) && next[index].every((value, position) => value === solution[index][position])) {
        newRows.add(index);
        award(pointsPerLine);
      }
      if (
        !newCols.has(index) &&
        next.every((line, lineIndex) => line[index] === solution[lineIndex][index])
      ) {
        newCols.add(index);
        award(pointsPerLine);
      }
    }
    rowsRef.current = newRows;
    colsRef.current = newCols;
    setAwardedRows(newRows);
    setAwardedCols(newCols);

    const complete = next.every((line, rowIndex) =>
      line.every((value, colIndex) => value === solution[rowIndex][colIndex]),
    );
    if (complete) {
      finishedRef.current = true;
      later(() => {
        doneRef.current.finish({
          isWin: true,
          levelReached: 1,
          clientMeta: { game: "nonogram", size },
        });
      }, 600);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="chip bg-primary-soft text-primary-dark">
          🖼️ {grid.flat().filter(Boolean).length}/{solution.flat().filter(Boolean).length}
        </span>
        <span className="chip bg-white text-ink-soft">🟪 {awardedRows.size + awardedCols.size}/{size * 2}</span>
      </div>

      <div
        className="grid gap-1 rounded-card bg-white/90 p-2 shadow-soft"
        style={{
          gridTemplateColumns: `minmax(2.2rem, auto) repeat(${size}, minmax(2.2rem, 3rem))`,
        }}
        role="grid"
        aria-label="🖼️"
      >
        <span aria-hidden="true" />
        {colClues.map((clue, col) => (
          <div key={`cc-${col}`} className="flex flex-col items-center justify-end gap-0.5 pb-1">
            {clue.map((count, index) => (
              <span
                key={index}
                className={cn(
                  "text-xs font-bold tabular-nums",
                  awardedCols.has(col) ? "text-success" : "text-ink-soft",
                )}
              >
                {count}
              </span>
            ))}
          </div>
        ))}

        {grid.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="contents">
            <div className="flex items-center justify-end gap-1 pe-2">
              {rowClues[rowIndex].map((count, index) => (
                <span
                  key={index}
                  className={cn(
                    "text-xs font-bold tabular-nums",
                    awardedRows.has(rowIndex) ? "text-success" : "text-ink-soft",
                  )}
                >
                  {count}
                </span>
              ))}
            </div>
            {row.map((value, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                onClick={() => toggle(rowIndex, colIndex)}
                aria-label={value ? "🟪" : ""}
                aria-pressed={value}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border text-sm transition-all",
                  value
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-primary/15 bg-primary-soft/30 hover:border-primary/40 hover:bg-primary-soft/70",
                )}
              >
                {value ? "🟪" : ""}
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="text-xs font-semibold text-ink-faint">👆 {pattern.length}×{pattern.length}</p>
    </div>
  );
}
