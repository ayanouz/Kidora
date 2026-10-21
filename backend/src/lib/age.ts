// ══════════════════════════════════════════════════════════════════
//  KIDORA — Tranches d'âge (§4)
//  On ne stocke JAMAIS la date de naissance complète d'un enfant :
//  seulement l'année (facultative) ou la tranche d'âge choisie.
// ══════════════════════════════════════════════════════════════════

import type { AgeTier } from "@prisma/client";

export const AGE_TIERS: AgeTier[] = ["AGE_3_5", "AGE_6_8", "AGE_9_12", "AGE_13_PLUS"];

export function ageTierFromBirthYear(birthYear: number): AgeTier {
  const age = new Date().getFullYear() - birthYear;
  if (age <= 5) return "AGE_3_5";
  if (age <= 8) return "AGE_6_8";
  if (age <= 12) return "AGE_9_12";
  return "AGE_13_PLUS";
}

export function ageFromTier(tier: AgeTier): { min: number; max: number } {
  switch (tier) {
    case "AGE_3_5":
      return { min: 3, max: 5 };
    case "AGE_6_8":
      return { min: 6, max: 8 };
    case "AGE_9_12":
      return { min: 9, max: 12 };
    case "AGE_13_PLUS":
      return { min: 13, max: 120 };
  }
}

export function tierLabel(tier: AgeTier): string {
  const { min, max } = ageFromTier(tier);
  return max >= 120 ? `${min}+ ans` : `${min}–${max} ans`;
}

/** Un jeu convient-il à cette tranche d'âge ? */
export function gameFitsTier(minAge: number, maxAge: number | null, tier: AgeTier): boolean {
  const range = ageFromTier(tier);
  return minAge <= range.max && (maxAge === null || maxAge >= range.min);
}
