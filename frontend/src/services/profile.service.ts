// ══════════════════════════════════════════════════════════════════
//  KIDORA — Services Profils & Compte
// ══════════════════════════════════════════════════════════════════

import { api, apiDownload } from "./api";
import type { Profile, User } from "../types";
import type { AgeTierValue } from "../config";

export interface ProfileInput {
  displayName?: string;
  avatar?: string;
  ageTier?: AgeTierValue;
  leaderboardOptIn?: boolean;
  pin?: string | null;
}

export const profileService = {
  list() {
    return api<{ profiles: Profile[] }>("/profiles");
  },

  active() {
    return api<{ profile: Profile }>("/profile");
  },

  updateActive(input: ProfileInput) {
    return api<{ profile: Profile }>("/profile", { method: "PUT", body: input });
  },

  create(input: Required<Pick<ProfileInput, "displayName" | "avatar" | "ageTier">> & { pin?: string }) {
    return api<{ profile: Profile }>("/profiles", { method: "POST", body: input });
  },

  update(id: string, input: ProfileInput) {
    return api<{ profile: Profile }>(`/profiles/${id}`, { method: "PUT", body: input });
  },

  remove(id: string) {
    return api<{ deleted: boolean }>(`/profiles/${id}`, { method: "DELETE" });
  },

  select(id: string) {
    return api<{ profile: Profile }>(`/profiles/${id}/select`, { method: "POST", body: {} });
  },
};

export const accountService = {
  update(input: { displayName?: string; avatar?: string; leaderboardOptIn?: boolean }) {
    return api<{ user: User }>("/users/me", { method: "PUT", body: input });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return api<{ updated: boolean }>("/users/me/password", {
      method: "PUT",
      body: { currentPassword, newPassword },
    });
  },

  exportData() {
    return apiDownload("/users/me/export", `kidora-export-${Date.now()}.json`);
  },

  deleteAccount(password: string, confirm: string) {
    return api<{ deleted: boolean }>("/users/me", {
      method: "DELETE",
      body: { password, confirm },
      skipRefresh: true,
    });
  },
};
