// ══════════════════════════════════════════════════════════════════
//  KIDORA — Page Mes favoris (§39)
//  Grille des jeux favoris du profil actif ; retirer un favori
//  retire la carte immédiatement (la route est déjà protégée).
// ══════════════════════════════════════════════════════════════════

import { useState } from "react";
import { GameGrid } from "../components/game/GameGrid";
import { EmptyState, ErrorState, GameGridSkeleton } from "../components/ui/Feedback";
import { ROUTES } from "../config";
import { useAsync, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { favoritesService } from "../services/gameplay.service";
import type { FavoriteEntry } from "../types";

export function Favorites() {
  const { t } = useI18n();
  usePageTitle(t("favorites.title"));

  const { data, loading, error, reload } = useAsync(async () => favoritesService.list(), []);

  // Copie locale de la liste : permet de retirer une carte sans rechargement.
  const [entries, setEntries] = useState<FavoriteEntry[]>([]);
  const [syncedSource, setSyncedSource] = useState<{ favorites: FavoriteEntry[] } | null>(null);

  // Ré-synchronise la copie locale à chaque nouvelle réponse serveur
  // (état ajusté pendant le rendu : aucun flash « vide » entre deux rendus).
  if (data && data !== syncedSource) {
    setSyncedSource(data);
    setEntries(data.favorites);
  }

  // Toutes les cartes affichées sont favorites par définition.
  const favorites: Record<string, boolean> = {};
  for (const entry of entries) {
    favorites[entry.game.id] = true;
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-3xl">{t("favorites.title")}</h1>
      </header>

      {loading ? (
        <GameGridSkeleton count={4} />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="❤️"
          title={t("favorites.empty")}
          text={t("favorites.emptyHint")}
          actionLabel={t("favorites.explore")}
          actionTo={ROUTES.games}
        />
      ) : (
        <GameGrid
          games={entries.map((entry) => entry.game)}
          favorites={favorites}
          onFavoriteChange={(gameId, favorite) => {
            if (!favorite) {
              setEntries((list) => list.filter((entry) => entry.game.id !== gameId));
            }
          }}
        />
      )}
    </div>
  );
}
