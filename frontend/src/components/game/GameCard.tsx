// ══════════════════════════════════════════════════════════════════
//  KIDORA — Carte de jeu (§47)
//  Vignette, catégorie, âge, difficulté, meilleur score, bouton JOUER.
//  Toute la carte est lisible d'un coup d'œil par un enfant.
// ══════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { ROUTES } from "../../config";
import { useI18n } from "../../i18n";
import { cn } from "../../utils/cn";
import type { GameCardData } from "../../types";
import { FavoriteButton } from "./FavoriteButton";
import { GameThumb } from "./GameThumb";

const DIFFICULTY_STARS: Record<GameCardData["difficulty"], number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

interface GameCardProps {
  game: GameCardData;
  isFavorite?: boolean;
  onFavoriteChange?: (gameId: string, favorite: boolean) => void;
  className?: string;
}

export function GameCard({ game, isFavorite, onFavoriteChange, className }: GameCardProps) {
  const { t } = useI18n();
  const personal = game.personal;
  const favorite = isFavorite ?? personal?.isFavorite ?? false;
  const ageChip = `🎂 ${game.minAge}+`;

  return (
    <article className={cn("card card-hover relative flex flex-col overflow-hidden", className)}>
      <Link
        to={ROUTES.game(game.slug)}
        className="relative block no-select"
        aria-label={`${t("common.play")} — ${game.title}`}
      >
        <GameThumb emoji={game.emoji} color={game.color} className="h-32 sm:h-36" />
        <span className="chip absolute start-2 top-2 bg-white/90 text-xs text-ink">
          <span aria-hidden="true">{game.category.emoji}</span> {game.category.name}
        </span>
      </Link>

      <FavoriteButton
        gameId={game.id}
        initial={favorite}
        onChange={onFavoriteChange}
        className="absolute end-2 top-2"
      />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-lg leading-tight">
          <Link to={ROUTES.game(game.slug)} className="transition-colors hover:text-primary">
            {game.premium && <span aria-label={t("premium.badge")}>👑 </span>}
            {game.title}
          </Link>
        </h3>

        <p className="line-clamp-2 text-sm text-ink-soft">{game.description}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip bg-secondary-soft text-xs text-secondary-dark">{ageChip}</span>
          {game.premium && (
            <span className="chip bg-accent-soft text-xs font-bold text-ink">
              👑 {t("premium.badge")}
            </span>
          )}
          <span className="chip bg-accent-soft text-xs text-ink" title={t("games.difficulty")}>
            {"⭐".repeat(DIFFICULTY_STARS[game.difficulty])}
          </span>
          {typeof personal?.bestScore === "number" && personal.bestScore > 0 && (
            <span className="chip bg-primary-soft text-xs text-primary-dark tabular-nums">
              🏆 {personal.bestScore}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-xs font-semibold text-ink-faint">
            {t("games.timesPlayed", { count: game.playCount })}
          </span>
          <Link to={ROUTES.game(game.slug)} className="btn btn-primary btn-sm">
            {t("games.play")} <span aria-hidden="true">▶</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
