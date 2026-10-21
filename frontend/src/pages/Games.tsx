// ══════════════════════════════════════════════════════════════════
//  KIDORA — Catalogue des jeux (§37)
//  Recherche, filtres, tri, pagination — URL partageable.
// ══════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GameFilters, type GameFiltersValue } from "../components/game/GameFilters";
import { GameGrid } from "../components/game/GameGrid";
import { Button } from "../components/ui/Button";
import { EmptyState, ErrorState, GameGridSkeleton } from "../components/ui/Feedback";
import { useAsync, useDebouncedValue, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { gamesService } from "../services/games.service";

const PAGE_SIZE = 12;

function readSort(raw: string | null): GameFiltersValue["sort"] {
  return raw === "newest" || raw === "score" || raw === "name" ? raw : "popular";
}

export function Games() {
  const { t } = useI18n();
  usePageTitle(t("games.title"));
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<GameFiltersValue>(() => ({
    search: searchParams.get("search") ?? "",
    category: searchParams.get("category") ?? "",
    age: searchParams.get("age") ?? "",
    difficulty: searchParams.get("difficulty") ?? "",
    sort: readSort(searchParams.get("sort")),
  }));
  const [searchInput, setSearchInput] = useState(filters.search);
  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  });
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({});

  const debouncedSearch = useDebouncedValue(searchInput, 350);

  // La recherche passe par le debounce ; les autres filtres sont immédiats.
  useEffect(() => {
    setFilters((current) =>
      current.search === debouncedSearch ? current : { ...current, search: debouncedSearch },
    );
    setPage(1);
  }, [debouncedSearch]);

  // URL partageable (sans polluer l'historique du navigateur)
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.age) params.age = filters.age;
    if (filters.difficulty) params.difficulty = filters.difficulty;
    if (filters.sort !== "popular") params.sort = filters.sort;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [filters, page, setSearchParams]);

  const categories = useAsync(async () => gamesService.categories(), []);

  const listKey = `${filters.search}|${filters.category}|${filters.age}|${filters.difficulty}|${filters.sort}|${page}`;
  const list = useAsync(
    async (signal) =>
      gamesService.list(
        {
          search: filters.search || undefined,
          category: filters.category || undefined,
          age: filters.age ? Number(filters.age) : undefined,
          difficulty: filters.difficulty || undefined,
          sort: filters.sort,
          page,
          limit: PAGE_SIZE,
        },
        signal,
      ),
    [listKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const patch = (next: Partial<GameFiltersValue>) => {
    if (next.search !== undefined) {
      setSearchInput(next.search);
      return; // le debounce met à jour filters.search
    }
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  };

  const result = list.data;
  const pages = result?.pages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl">{t("games.title")}</h1>
        <p className="text-ink-soft">{t("games.subtitle")}</p>
      </header>

      <GameFilters
        value={{ ...filters, search: searchInput }}
        onChange={patch}
        categories={categories.data?.categories ?? []}
      />

      {result && (
        <p className="text-sm font-semibold text-ink-soft" aria-live="polite">
          {t("games.results", { count: result.total })}
        </p>
      )}

      {list.loading && <GameGridSkeleton count={8} />}
      {list.error && <ErrorState onRetry={list.reload} />}

      {result && !list.loading && result.games.length === 0 && (
        <EmptyState
          icon="🔍"
          title={t("games.noResults")}
          text={t("games.noResultsHint")}
          actionLabel={t("common.retry")}
          onAction={() => {
            setSearchInput("");
            setFilters({ search: "", category: "", age: "", difficulty: "", sort: "popular" });
            setPage(1);
          }}
        />
      )}

      {result && !list.loading && result.games.length > 0 && (
        <>
          <GameGrid
            games={result.games}
            favorites={favOverrides}
            onFavoriteChange={(gameId, favorite) =>
              setFavOverrides((current) => ({ ...current, [gameId]: favorite }))
            }
          />

          {pages > 1 && (
            <nav
              className="flex items-center justify-center gap-4 pt-2"
              aria-label={t("games.title")}
            >
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← {t("common.back")}
              </Button>
              <span className="text-sm font-bold text-ink-soft tabular-nums">
                {page} {t("common.of")} {pages}
              </span>
              <Button
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                {t("common.next")} →
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
