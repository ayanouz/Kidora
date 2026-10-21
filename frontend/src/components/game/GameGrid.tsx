// ══════════════════════════════════════════════════════════════════
//  KIDORA — Grille de jeux responsive (§31)
// ══════════════════════════════════════════════════════════════════

import { cn } from "../../utils/cn";
import type { GameCardData } from "../../types";
import { GameCard } from "./GameCard";

interface GameGridProps {
  games: GameCardData[];
  /** États favoris optimistes (id → favori), en plus de game.personal. */
  favorites?: Record<string, boolean>;
  onFavoriteChange?: (gameId: string, favorite: boolean) => void;
  className?: string;
}

export function GameGrid({ games, favorites, onFavoriteChange, className }: GameGridProps) {
  return (
    <div
      className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}
      aria-label="Liste des jeux"
    >
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          isFavorite={favorites?.[game.id]}
          onFavoriteChange={onFavoriteChange}
        />
      ))}
    </div>
  );
}
