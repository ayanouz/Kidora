// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Jeux & Catégories
// ══════════════════════════════════════════════════════════════════

import { api, toQuery } from "./api";
import type { Category, GameDetailResponse, GamesListResponse } from "../types";

export interface ListGamesParams {
  search?: string;
  category?: string;
  age?: number;
  difficulty?: string;
  sort?: "popular" | "newest" | "score" | "name";
  page?: number;
  limit?: number;
  favorites?: boolean;
}

export const gamesService = {
  list(params: ListGamesParams = {}, signal?: AbortSignal) {
    const query = toQuery({
      search: params.search,
      category: params.category,
      age: params.age,
      difficulty: params.difficulty,
      sort: params.sort,
      page: params.page,
      limit: params.limit,
      favorites: params.favorites ? "1" : undefined,
    });
    return api<GamesListResponse>(`/games${query}`, { signal });
  },

  get(slug: string, signal?: AbortSignal) {
    return api<GameDetailResponse>(`/games/${encodeURIComponent(slug)}`, { signal });
  },

  categories(signal?: AbortSignal) {
    return api<{ categories: Category[] }>("/categories", { signal });
  },

  category(slug: string, signal?: AbortSignal) {
    return api<{ category: Category }>(`/categories/${encodeURIComponent(slug)}`, { signal });
  },
};
