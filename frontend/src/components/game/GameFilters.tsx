// ══════════════════════════════════════════════════════════════════
//  KIDORA — Filtres du catalogue (§37)
//  Recherche + catégorie + âge + difficulté + tri.
//  Composant contrôlé : la page Games garde l'état (et l'URL).
// ══════════════════════════════════════════════════════════════════

import { AGE_TIERS, DIFFICULTIES } from "../../config";
import { useI18n } from "../../i18n";
import { cn } from "../../utils/cn";
import type { Category } from "../../types";

export interface GameFiltersValue {
  search: string;
  category: string;
  age: string;
  difficulty: string;
  sort: "popular" | "newest" | "score" | "name";
}

interface GameFiltersProps {
  value: GameFiltersValue;
  onChange: (patch: Partial<GameFiltersValue>) => void;
  categories: Category[];
  className?: string;
}

export function GameFilters({ value, onChange, categories, className }: GameFiltersProps) {
  const { t } = useI18n();

  const hasActiveFilters =
    value.search.trim() !== "" ||
    value.category !== "" ||
    value.age !== "" ||
    value.difficulty !== "";

  const reset = () =>
    onChange({ search: "", category: "", age: "", difficulty: "" });

  return (
    <div className={cn("card flex flex-col gap-3 p-3 sm:p-4", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span
            className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-lg"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            className="input ps-11"
            placeholder={t("games.searchPlaceholder")}
            value={value.search}
            onChange={(event) => onChange({ search: event.target.value })}
            aria-label={t("common.search")}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={reset}
            className="btn btn-ghost btn-icon shrink-0 text-lg"
            aria-label={t("common.cancel")}
            title={t("common.cancel")}
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="filter-category">
            {t("games.allCategories")}
          </label>
          <select
            id="filter-category"
            className="input"
            value={value.category}
            onChange={(event) => onChange({ category: event.target.value })}
          >
            <option value="">{t("games.allCategories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.emoji} {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="filter-age">
            {t("games.allAges")}
          </label>
          <select
            id="filter-age"
            className="input"
            value={value.age}
            onChange={(event) => onChange({ age: event.target.value })}
          >
            <option value="">{t("games.allAges")}</option>
            {AGE_TIERS.map((tier) => (
              <option key={tier.value} value={String(tier.min)}>
                {tier.emoji} {tier.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="filter-difficulty">
            {t("games.allDifficulties")}
          </label>
          <select
            id="filter-difficulty"
            className="input"
            value={value.difficulty}
            onChange={(event) => onChange({ difficulty: event.target.value })}
          >
            <option value="">{t("games.allDifficulties")}</option>
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty.value} value={difficulty.value.toUpperCase()}>
                {difficulty.emoji} {t(`difficulty.${difficulty.value}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="filter-sort">
            {t("games.sortBy")}
          </label>
          <select
            id="filter-sort"
            className="input"
            value={value.sort}
            onChange={(event) =>
              onChange({ sort: event.target.value as GameFiltersValue["sort"] })
            }
          >
            <option value="popular">{t("games.sortPopular")}</option>
            <option value="newest">{t("games.sortNewest")}</option>
            <option value="score">{t("games.sortScore")}</option>
            <option value="name">{t("games.sortName")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
