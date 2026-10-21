// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Administration (§26)
// ══════════════════════════════════════════════════════════════════

import { api, toQuery } from "./api";
import type {
  AdminCategory,
  AdminGame,
  AdminStats,
  AdminUser,
  SecurityLogEntry,
} from "../types";

export interface AdminGameInput {
  slug: string;
  title: string;
  description?: string;
  engine: string;
  categoryId: string;
  minAge: number;
  maxAge?: number | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  emoji: string;
  color: string;
  config?: Record<string, unknown>;
  maxScoreHint?: number;
  isPublished?: boolean;
}

export interface AdminCategoryInput {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const adminService = {
  stats() {
    return api<AdminStats>("/admin/stats");
  },

  users(params: { search?: string; role?: string; page?: number; limit?: number } = {}) {
    return api<{ users: AdminUser[]; total: number; page: number; pages: number }>(
      `/admin/users${toQuery(params)}`,
    );
  },

  setUserActive(userId: string, isActive: boolean) {
    return api<{ updated: boolean }>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: { isActive },
    });
  },

  deleteUser(userId: string) {
    return api<{ deleted: boolean }>(`/admin/users/${userId}`, { method: "DELETE" });
  },

  games(params: { search?: string; page?: number; limit?: number } = {}) {
    return api<{ games: AdminGame[]; total: number; page: number; pages: number }>(
      `/admin/games${toQuery(params)}`,
    );
  },

  createGame(input: AdminGameInput) {
    return api<{ game: AdminGame }>("/admin/games", { method: "POST", body: input });
  },

  updateGame(id: string, input: Partial<AdminGameInput>) {
    return api<{ game: AdminGame }>(`/admin/games/${id}`, { method: "PUT", body: input });
  },

  deleteGame(id: string) {
    return api<{ deleted: boolean }>(`/admin/games/${id}`, { method: "DELETE" });
  },

  categories() {
    return api<{ categories: AdminCategory[] }>("/admin/categories");
  },

  createCategory(input: AdminCategoryInput) {
    return api<{ category: AdminCategory }>("/admin/categories", { method: "POST", body: input });
  },

  updateCategory(id: string, input: Partial<AdminCategoryInput>) {
    return api<{ category: AdminCategory }>(`/admin/categories/${id}`, {
      method: "PUT",
      body: input,
    });
  },

  deleteCategory(id: string) {
    return api<{ deleted: boolean }>(`/admin/categories/${id}`, { method: "DELETE" });
  },

  securityLogs(limit = 50) {
    return api<{ logs: SecurityLogEntry[] }>(`/admin/security-logs${toQuery({ limit })}`);
  },
};
