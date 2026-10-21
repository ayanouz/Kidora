// ══════════════════════════════════════════════════════════════════
//  KIDORA — Toutes les catégories (§37)
// ══════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { ErrorState, GameGridSkeleton } from "../components/ui/Feedback";
import { ROUTES } from "../config";
import { useAsync, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { gamesService } from "../services/games.service";

export function Categories() {
  const { t } = useI18n();
  usePageTitle(t("nav.categories"));

  const categories = useAsync(async () => gamesService.categories(), []);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl">{t("nav.categories")}</h1>
        <p className="text-ink-soft">{t("games.subtitle")}</p>
      </header>

      {categories.loading && <GameGridSkeleton count={9} />}
      {categories.error && <ErrorState onRetry={categories.reload} />}

      {categories.data && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.data.categories.map((category) => (
            <Link
              key={category.id}
              to={ROUTES.category(category.slug)}
              className="card card-hover flex items-center gap-4 p-5 no-select"
            >
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl"
                style={{ background: `${category.color}22` }}
                aria-hidden="true"
              >
                {category.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-bold leading-tight">{category.name}</span>
                <span className="block text-sm font-semibold text-ink-faint">
                  {t("games.results", { count: category.gameCount })}
                </span>
              </span>
              <span className="ms-auto text-primary" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
