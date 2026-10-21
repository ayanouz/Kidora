// ══════════════════════════════════════════════════════════════════
//  KIDORA — Gamification : XP, niveaux, étoiles
//  ⚠️ Toutes ces fonctions sont la RÉFÉRENCE côté serveur.
//     Le client ne fait que les afficher (source de vérité = API).
// ══════════════════════════════════════════════════════════════════

export type DifficultyKey = "easy" | "medium" | "hard";

/** Normalise "EASY" | "easy" | "Easy" → "easy". */
export function normalizeDifficulty(d: string): DifficultyKey {
  const v = d.toLowerCase();
  return v === "medium" || v === "hard" ? (v as DifficultyKey) : "easy";
}

export function difficultyBonus(difficulty: string): number {
  switch (normalizeDifficulty(difficulty)) {
    case "hard":
      return 50;
    case "medium":
      return 25;
    default:
      return 0;
  }
}

/** Score maximal compté pour l'XP (évite les abus). */
const MAX_BASE_XP = 400;
/** XP maximal par partie, toutes primes confondues. */
export const MAX_XP_PER_SESSION = 600;

export interface SessionXpInput {
  score: number;
  isWin: boolean;
  difficulty: string;
  durationMs: number;
}

/**
 * XP gagné pour une partie validée :
 *   base      = min(score / 10, 400)
 *   victoire  = +50 (partie gagnée) ou +10 (partie perdue mais jouée)
 *   difficulté= +0 / +25 / +50
 *   rapidité  = jusqu'à +30 (victoire rapide)
 */
export function computeSessionXp(input: SessionXpInput): number {
  const base = Math.min(Math.floor(input.score / 10), MAX_BASE_XP);
  const winBonus = input.isWin ? 50 : 10;
  const diffBonus = difficultyBonus(input.difficulty);
  const timeBonus = input.isWin
    ? Math.max(0, 30 - Math.floor(input.durationMs / 5000))
    : 0;
  return Math.min(base + winBonus + diffBonus + timeBonus, MAX_XP_PER_SESSION);
}

/** Niveau à partir de l'XP total : niveau 1 à 0 XP, puis courbe √ douce. */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

/** XP requis pour atteindre un niveau donné. */
export function xpForLevel(level: number): number {
  return Math.pow(Math.max(1, level) - 1, 2) * 100;
}

export interface XpProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  percent: number;
}

/** Progression visuelle vers le niveau suivant. */
export function xpProgress(xp: number): XpProgress {
  const level = levelFromXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - currentLevelXp;
  const percent = span <= 0 ? 100 : Math.round(((xp - currentLevelXp) / span) * 100);
  return { level, xp, currentLevelXp, nextLevelXp, percent: Math.min(100, Math.max(0, percent)) };
}

/** Étoiles : ⭐ ≥ 40 % · ⭐⭐ ≥ 70 % · ⭐⭐⭐ ≥ 90 % du score max plausible. */
export function starsFromScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  const ratio = score / maxScore;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}
