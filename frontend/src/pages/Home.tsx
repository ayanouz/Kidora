// ══════════════════════════════════════════════════════════════════
//  KIDORA — Page d'accueil (§37)
//  Héros, reprise de partie, jeux populaires, catégories, nouveautés.
//  Aucune distraction : que du jeu et de la bonne humeur.
// ══════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { GameGrid } from "../components/game/GameGrid";
import { ErrorState, GameGridSkeleton } from "../components/ui/Feedback";
import { ROUTES, SITE_TAGLINE } from "../config";
import { usePageTitle, useAsync } from "../hooks/utils";
import { useI18n } from "../i18n";
import { gamesService } from "../services/games.service";
import { progressService } from "../services/gameplay.service";
import { useAuthStore } from "../store/auth.store";
import type { ProgressOverview } from "../types";

export function Home() {
  const { t } = useI18n();
  usePageTitle(SITE_TAGLINE);

  const status = useAuthStore((s) => s.status);
  const activeProfile = useAuthStore((s) => s.activeProfile);

  const catalog = useAsync(async () => {
    const [popular, newest, categories] = await Promise.all([
      gamesService.list({ sort: "popular", limit: 4 }),
      gamesService.list({ sort: "newest", limit: 4 }),
      gamesService.categories(),
    ]);
    return { popular, newest, categories: categories.categories };
  }, []);

  const progress = useAsync<ProgressOverview | null>(async () => {
    if (status !== "authenticated") return null;
    try {
      return await progressService.overview();
    } catch {
      return null; // section optionnelle : jamais d'erreur bloquante
    }
  }, [status]);

  const welcome =
    status === "authenticated" && activeProfile
      ? t("home.welcome", { name: activeProfile.displayName })
      : t("home.welcomeGuest");

  const recentGames = progress.data?.recentGames.slice(0, 4) ?? [];

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {/* ── Héros ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-blob bg-gradient-to-br from-primary via-primary-light to-secondary px-5 py-10 text-white shadow-pop sm:px-10 sm:py-14">
        <span className="pointer-events-none absolute -end-6 -top-8 text-8xl opacity-20 animate-float" aria-hidden="true">
          🎈
        </span>
        <span
          className="pointer-events-none absolute -bottom-10 start-4 text-8xl opacity-20 animate-float"
          style={{ animationDelay: "1.2s" }}
          aria-hidden="true"
        >
          ⭐
        </span>

        <div className="relative max-w-2xl">
          <p className="mb-1 font-semibold text-white/90">{welcome}</p>
          <h1 className="text-balance text-3xl leading-tight text-white sm:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="mt-3 text-lg text-white/90">{t("hero.subtitle")}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={ROUTES.games} className="btn btn-accent btn-lg text-lg">
              🎮 {t("hero.ctaPlay")}
            </Link>
            <Link
              to={ROUTES.categories}
              className="btn btn-lg border-2 border-white/60 bg-white/10 text-white hover:bg-white/20"
            >
              🗂️ {t("hero.ctaExplore")}
            </Link>
          </div>

          {catalog.data && (
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  {t("home.statsGames")}
                </dt>
                <dd className="text-2xl font-bold">{catalog.data.popular.total}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  {t("home.statsCategories")}
                </dt>
                <dd className="text-2xl font-bold">{catalog.data.categories.length}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  {t("home.statsAchievements")}
                </dt>
                <dd className="text-2xl font-bold">🏅</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {/* ── Reprendre où tu t'es arrêté (§24) ─────────────────── */}
      {recentGames.length > 0 && (
        <section aria-labelledby="home-recent">
          <h2 id="home-recent" className="mb-4 text-2xl">
            {t("home.recentlyPlayed")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentGames.map((entry) => (
              <Link
                key={entry.gameId}
                to={ROUTES.game(entry.game.slug)}
                className="card card-hover flex items-center gap-3 p-3"
              >
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
                  style={{ background: `${entry.game.color}22` }}
                  aria-hidden="true"
                >
                  {entry.game.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{entry.game.title}</span>
                  <span className="block text-sm text-ink-soft">
                    {t("profile.level", { level: entry.level })} · 🏆 {entry.bestScore}
                  </span>
                </span>
                <span className="text-primary" aria-hidden="true">
                  ▶
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Jeux populaires ───────────────────────────────────── */}
      <section aria-labelledby="home-popular">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="home-popular" className="text-2xl">
            {t("home.popular")}
          </h2>
          <Link to={ROUTES.games} className="btn btn-ghost btn-sm">
            {t("common.seeMore")} →
          </Link>
        </div>
        {catalog.loading && <GameGridSkeleton count={4} />}
        {catalog.error && <ErrorState onRetry={catalog.reload} />}
        {catalog.data && <GameGrid games={catalog.data.popular.games} />}
      </section>

      {/* ── Catégories ────────────────────────────────────────── */}
      {catalog.data && catalog.data.categories.length > 0 && (
        <section aria-labelledby="home-categories">
          <h2 id="home-categories" className="mb-4 text-2xl">
            {t("home.allCategories")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {catalog.data.categories.map((category) => (
              <Link
                key={category.id}
                to={ROUTES.category(category.slug)}
                className="card card-hover flex items-center gap-2 px-4 py-3 no-select"
                style={{ borderColor: `${category.color}33` }}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                  style={{ background: `${category.color}22` }}
                  aria-hidden="true"
                >
                  {category.emoji}
                </span>
                <span>
                  <span className="block font-bold leading-tight">{category.name}</span>
                  <span className="block text-xs font-semibold text-ink-faint">
                    {t("games.results", { count: category.gameCount })}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Comment ça marche (§50) ───────────────────────────── */}
      <section aria-labelledby="home-how" className="rounded-card bg-white p-5 shadow-soft sm:p-8">
        <h2 id="home-how" className="mb-6 text-center text-2xl">
          {t("home.howItWorks")}
        </h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {(
            [
              ["🎮", "home.step1Title", "home.step1Text"],
              ["⭐", "home.step2Title", "home.step2Text"],
              ["🏆", "home.step3Title", "home.step3Text"],
            ] as const
          ).map(([emoji, titleKey, textKey]) => (
            <li key={titleKey} className="flex flex-col items-center gap-2 text-center">
              <span className="text-5xl animate-bounce-soft" aria-hidden="true">
                {emoji}
              </span>
              <h3 className="text-lg">{t(titleKey)}</h3>
              <p className="text-ink-soft">{t(textKey)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Nouveaux jeux ─────────────────────────────────────── */}
      {catalog.data && catalog.data.newest.games.length > 0 && (
        <section aria-labelledby="home-newest">
          <h2 id="home-newest" className="mb-4 text-2xl">
            {t("home.newGames")}
          </h2>
          <GameGrid games={catalog.data.newest.games} />
        </section>
      )}
    </div>
  );
}
