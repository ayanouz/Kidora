// ══════════════════════════════════════════════════════════════════
//  KIDORA — Préférences locales (Zustand + persist)
//  Sons, animations. La langue vit dans le module i18n.
// ══════════════════════════════════════════════════════════════════

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrefsState {
  /** Sons du site (§33) — jamais de musique automatique. */
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set, get) => ({
      soundEnabled: true,
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      toggleSound: () => set({ soundEnabled: !get().soundEnabled }),
    }),
    { name: "kidora_prefs" },
  ),
);
