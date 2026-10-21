// ══════════════════════════════════════════════════════════════════
//  KIDORA — Store d'authentification (Zustand)
//  Contient l'utilisateur connecté + ses profils joueurs.
//  La session réelle vit dans des cookies HttpOnly côté serveur.
// ══════════════════════════════════════════════════════════════════

import { create } from "zustand";
import { authService, type RegisterPayload } from "../services/auth.service";
import { profileService } from "../services/profile.service";
import { onSessionExpired } from "../services/api";
import type { MeResponse, Profile, User } from "../types";

export type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthState {
  status: AuthStatus;
  user: User | null;
  profiles: Profile[];
  /** Profil joueur actif (enfant sélectionné ou compte autonome). */
  activeProfile: Profile | null;

  fetchMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  selectProfile: (profileId: string) => Promise<void>;
  /** Mise à jour locale après une partie (XP, niveau, points). */
  applyProfileUpdate: (update: { level: number; xp: number; points: number }) => void;
  setActiveProfileLocal: (profile: Profile) => void;
  setProfilesLocal: (profiles: Profile[]) => void;
  clear: () => void;
}

function deriveActiveProfile(user: User | null, profiles: Profile[]): Profile | null {
  if (!user) return null;
  if (user.activeProfileId) {
    const active = profiles.find((p) => p.id === user.activeProfileId);
    if (active) return active;
  }
  return profiles[0] ?? null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  profiles: [],
  activeProfile: null,

  fetchMe: async () => {
    try {
      const me = await authService.me();
      set({
        status: "authenticated",
        user: me.user,
        profiles: me.profiles,
        activeProfile: deriveActiveProfile(me.user, me.profiles),
      });
    } catch {
      set({ status: "guest", user: null, profiles: [], activeProfile: null });
    }
  },

  login: async (email, password) => {
    const me = await authService.login(email, password);
    set({
      status: "authenticated",
      user: me.user,
      profiles: me.profiles,
      activeProfile: deriveActiveProfile(me.user, me.profiles),
    });
  },

  register: async (payload) => {
    const me = await authService.register(payload);
    set({
      status: "authenticated",
      user: me.user,
      profiles: me.profiles,
      activeProfile: deriveActiveProfile(me.user, me.profiles),
    });
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      get().clear();
    }
  },

  selectProfile: async (profileId) => {
    const { profile } = await profileService.select(profileId);
    set((state) => ({
      activeProfile: profile,
      user: state.user ? { ...state.user, activeProfileId: profile.id } : null,
    }));
  },

  applyProfileUpdate: (update) => {
    set((state) => {
      if (!state.activeProfile) return state;
      const updated: Profile = {
        ...state.activeProfile,
        level: update.level,
        xp: update.xp,
        points: update.points,
      };
      return {
        activeProfile: updated,
        profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
      };
    });
  },

  setActiveProfileLocal: (profile) => {
    set((state) => ({
      activeProfile: profile,
      profiles: state.profiles.map((p) => (p.id === profile.id ? profile : p)),
    }));
  },

  setProfilesLocal: (profiles) => {
    set((state) => ({
      profiles,
      activeProfile: deriveActiveProfile(state.user, profiles),
    }));
  },

  clear: () => set({ status: "guest", user: null, profiles: [], activeProfile: null }),
}));

// Expiration de session détectée par le client API → retour à l'état invité.
onSessionExpired(() => {
  useAuthStore.getState().clear();
});

/** Raccourcis pratiques pour les composants. */
export const useIsPremium = () => useAuthStore((s) => s.user?.role === "ADMIN");
