// ══════════════════════════════════════════════════════════════════
//  KIDORA — Registre des jeux
//  Le champ `games.engine` (base de données) est relié au composant
//  React correspondant. Pour ajouter un jeu : créer le composant,
//  puis ajouter une ligne ici.
//
//  CONTRAT D'UN JEU (voir docs/GAMES-CONTRACT.md) :
//  • `{ ctx }` : le GameShell fournit tout (score, niveau, sons, fin).
//  • Montage = début de partie (le shell remonte le jeu à chaque run).
//  • `ctx.running === false` → mettre les boucles/entrées en pause.
//  • Fin de partie : `ctx.finish({ isWin, levelReached, clientMeta })`.
//  • Le score s'affiche via `ctx.addScore` / `ctx.signalCorrect`.
//  • Le client n'écrit JAMAIS un score : le serveur valide (§44).
//  • Aucun asset binaire, aucune dépendance en plus, textes i18n.
// ══════════════════════════════════════════════════════════════════

import type { ComponentType } from "react";
import type { GameContext } from "./engine/types";

import { MemoryCards } from "./memory/MemoryCards";
import { MagicPuzzle } from "./puzzle/MagicPuzzle";
import { LostMaze } from "./maze/LostMaze";
import { ColorMatch } from "./color-match/ColorMatch";
import { MathChallenge } from "./math/MathChallenge";
import { OddOneOut } from "./odd-one-out/OddOneOut";
import { LogicPattern } from "./pattern/LogicPattern";
import { BubblePop } from "./bubble-pop/BubblePop";
import { CatchTheStars } from "./catch-stars/CatchTheStars";
import { MemorySequence } from "./memory-sequence/MemorySequence";
import { Arkadas } from "./arkadas/Arkadas";

// ── Nouveaux moteurs (extension 2026) ───────────────────────────
import { QuizGame } from "./quiz/QuizGame";
import { ArcadeGame } from "./arcade/ArcadeGame";
import { WordSearch } from "./word-search/WordSearch";
import { ConnectDots } from "./connect-dots/ConnectDots";
import { PixelColor } from "./pixel-color/PixelColor";
import { SwapPuzzle } from "./swap-puzzle/SwapPuzzle";
import { Sudoku } from "./sudoku/Sudoku";
import { Nonogram } from "./nonogram/Nonogram";
import { TicTacToe } from "./tic-tac-toe/TicTacToe";
import { ConnectFour } from "./connect-four/ConnectFour";
import { Minesweeper } from "./minesweeper/Minesweeper";
import { Hanoi } from "./hanoi/Hanoi";
import { MemoryNumbers } from "./memory-numbers/MemoryNumbers";
import { FlashCount } from "./flash-count/FlashCount";
import { Disappearing } from "./disappearing/Disappearing";
import { NumberHunt } from "./number-hunt/NumberHunt";
import { RockPaper } from "./rock-paper/RockPaper";

/** Props communes à tous les jeux. */
export interface GameProps {
  ctx: GameContext;
}

export type GameComponent = ComponentType<GameProps>;

const REGISTRY: Record<string, GameComponent> = {
  "memory-cards": MemoryCards,
  puzzle: MagicPuzzle,
  maze: LostMaze,
  "color-match": ColorMatch,
  "math-challenge": MathChallenge,
  "odd-one-out": OddOneOut,
  pattern: LogicPattern,
  "bubble-pop": BubblePop,
  "catch-the-stars": CatchTheStars,
  "memory-sequence": MemorySequence,
  arkadas: Arkadas,
  // Extension : 51 jeux supplémentaires, 17 moteurs partagés.
  quiz: QuizGame,
  arcade: ArcadeGame,
  "word-search": WordSearch,
  "connect-dots": ConnectDots,
  "pixel-color": PixelColor,
  "swap-puzzle": SwapPuzzle,
  sudoku: Sudoku,
  nonogram: Nonogram,
  "tic-tac-toe": TicTacToe,
  "connect-four": ConnectFour,
  minesweeper: Minesweeper,
  hanoi: Hanoi,
  "memory-numbers": MemoryNumbers,
  "flash-count": FlashCount,
  disappearing: Disappearing,
  "number-hunt": NumberHunt,
  "rock-paper": RockPaper,
};

/** Composant du jeu correspondant au moteur, ou null si inconnu. */
export function getGameComponent(engine: string): GameComponent | null {
  return REGISTRY[engine] ?? null;
}

/** Liste des moteurs disponibles (diagnostic / admin). */
export function availableEngines(): string[] {
  return Object.keys(REGISTRY);
}

/** Nombre de niveaux déclarés dans la config du jeu (≥ 1). */
export function maxLevelOf(game: { config: { levels?: number } }): number {
  return Math.max(1, game.config.levels ?? 1);
}
