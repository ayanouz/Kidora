// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeux d'une catégorie (§37)
// ══════════════════════════════════════════════════════════════════

import { Link, useParams } from "react-router-dom";
import { GameGrid } from "../components/game/GameGrid";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";
import { ROUTES } from "../config";
import { useAsync, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { gamesService } from "../services/games.service";

export function Category() {
  const { slug = "" } = useParams();
  const { t } = useI18n();

  const data = useAsync(async (signal) => {
    const [category, games] = await Promise.all([
      gamesService.category(slug, signal),
      gamesService.list({ category: slug, limit: 24, sort: "popular" }, signal),
    ]);
    return { category: category.category, games: games.games };
  }, [slug]);

  usePageTitle(data.data?.category.name ?? t("nav.categories"));

  if (data.loading) return <Spinner className="py-24" label={t("common.loading")} />;
  if (data.error || !data.data) return <ErrorState onRetry={data.reload} />;

  const { category, games } = data.data;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-4">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-4xl"
          style={{ background: `${category.color}22` }}
          aria-hidden="true"
        >
          {category.emoji}
        </span>
        <div>
          <h1 className="text-3xl">{category.name}</h1>
          <p className="text-ink-soft">{t("games.results", { count: category.gameCount })}</p>
        </div>
      </header>

      {games.length === 0 ? (
        <EmptyState
          icon="🎮"
          title={t("games.noResults")}
          actionLabel={t("pages.backToGames")}
          actionTo={ROUTES.games}
        />
      ) : (
        <GameGrid games={games} />
      )}

      <p>
        <Link to={ROUTES.categories} className="btn btn-outline">
          ← {t("common.back")}
        </Link>
      </p>
    </div>
  );
}
