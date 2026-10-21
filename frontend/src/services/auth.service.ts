// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Auth
// ══════════════════════════════════════════════════════════════════

import { api } from "./api";
import type { MeResponse } from "../types";
import type { AgeTierValue } from "../config";

export interface RegisterPayload {
  displayName: string;
  email: string;
  password: string;
  ageTier?: AgeTierValue;
  acceptTerms: true;
}

export const authService = {
  login(email: string, password: string) {
    return api<MeResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipRefresh: true,
    });
  },

  register(payload: RegisterPayload) {
    return api<MeResponse>("/auth/register", {
      method: "POST",
      body: payload,
      skipRefresh: true,
    });
  },

  logout(allSessions = false) {
    return api<{ loggedOut: boolean }>("/auth/logout", {
      method: "POST",
      body: { allSessions },
      skipRefresh: true,
    });
  },

  me() {
    return api<MeResponse>("/auth/me", { skipRefresh: true });
  },

  forgotPassword(email: string) {
    return api<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
      skipRefresh: true,
    });
  },

  resetPassword(token: string, password: string) {
    return api<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: { token, password },
      skipRefresh: true,
    });
  },
};
