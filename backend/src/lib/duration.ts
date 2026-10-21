// ══════════════════════════════════════════════════════════════════
//  KIDORA — Utilitaires de durée ("15m", "7d", "30s")
// ══════════════════════════════════════════════════════════════════

const UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** "15m" → 900000 ms. Défaut : 15 minutes si format inconnu. */
export function parseDuration(input: string, fallbackMs = 15 * 60 * 1000): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(input.trim());
  if (!match) return fallbackMs;
  return Number(match[1]) * UNITS[match[2]];
}

export function daysToMs(days: number): number {
  return days * UNITS.d;
}

export function minutesToMs(minutes: number): number {
  return minutes * UNITS.m;
}
