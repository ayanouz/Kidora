// ══════════════════════════════════════════════════════════════════
//  KIDORA — ANTI-CHEAT : validateur de résultat de session
//
//  PRINCIPE FONDAMENTAL : un score envoyé par le client n'est JAMAIS
//  considéré comme fiable. Chaque partie suit le cycle :
//
//    POST /api/sessions/start   → le serveur enregistre startedAt
//    POST /api/sessions/:id/finish → le serveur VALIDE puis enregistre
//
//  Ce module est PUR (aucune I/O) → unitairement testable.
// ══════════════════════════════════════════════════════════════════

import { normalizeDifficulty, type DifficultyKey } from "../../lib/xp";

/** Bornes anti-cheat définies par jeu dans `games.config` (JSON). */
export interface GameAntiCheatConfig {
  minDurationMs?: Partial<Record<DifficultyKey, number>>;
  maxScore?: Partial<Record<DifficultyKey, number>>;
  levels?: number;
}

export interface SessionFinishInput {
  score: number;
  durationMs: number;
  isWin: boolean;
  stars: number;
  difficulty: string;
  levelReached: number;
}

export interface ValidationContext {
  /** Temps réellement écoulé côté serveur depuis `start` (ms). */
  elapsedSinceStartMs: number;
  /** Nombre de sessions terminées par ce profil dans la dernière heure. */
  sessionsLastHour: number;
  /** Plafond configuré (env MAX_SESSIONS_PER_HOUR). */
  maxSessionsPerHour: number;
}

export interface ValidationResult {
  ok: boolean;
  /** Motifs techniques (journalisés dans security_logs, jamais renvoyés tels quels au client). */
  flags: string[];
}

/** Marge réseau tolérée entre durée client et temps serveur. */
const NETWORK_SLACK_MS = 15_000;
/** Durée minimale absolue, quel que soit le jeu. */
const ABSOLUTE_MIN_DURATION_MS = 2_000;

export function pickMinDuration(cfg: GameAntiCheatConfig, difficulty: string): number {
  const key = normalizeDifficulty(difficulty);
  return Math.max(cfg?.minDurationMs?.[key] ?? 0, ABSOLUTE_MIN_DURATION_MS);
}

export function pickMaxScore(cfg: GameAntiCheatConfig, difficulty: string): number {
  const key = normalizeDifficulty(difficulty);
  return cfg?.maxScore?.[key] ?? 100_000;
}

export function validateSessionResult(
  cfg: GameAntiCheatConfig,
  input: SessionFinishInput,
  ctx: ValidationContext,
): ValidationResult {
  const flags: string[] = [];

  // ── 1. Cohérence de base ────────────────────────────────────────
  if (!Number.isInteger(input.score) || input.score < 0) flags.push("invalid_score");
  if (!Number.isInteger(input.durationMs) || input.durationMs < 0) flags.push("invalid_duration");
  if (input.score > 0 && input.durationMs < ABSOLUTE_MIN_DURATION_MS) flags.push("score_without_playtime");

  // ── 2. Plafond de score plausible ───────────────────────────────
  const maxScore = pickMaxScore(cfg, input.difficulty);
  if (input.score > maxScore) flags.push("score_above_cap");

  // ── 3. Durée minimale plausible (par jeu + difficulté) ──────────
  const minDuration = pickMinDuration(cfg, input.difficulty);
  if (input.durationMs < minDuration) flags.push("too_fast");

  // ── 4. Durée déclarée vs temps serveur réel ─────────────────────
  if (input.durationMs > ctx.elapsedSinceStartMs + NETWORK_SLACK_MS) {
    flags.push("duration_mismatch");
  }

  // ── 5. Niveau atteint plausible ─────────────────────────────────
  const maxLevel = cfg?.levels ?? 10;
  if (input.levelReached < 0 || input.levelReached > maxLevel) flags.push("invalid_level");
  if (!input.isWin && input.levelReached >= maxLevel) flags.push("win_flag_inconsistent");

  // ── 6. Étoiles cohérentes ───────────────────────────────────────
  if (input.stars < 0 || input.stars > 3) flags.push("invalid_stars");

  // ── 7. Fréquence de sessions ────────────────────────────────────
  if (ctx.sessionsLastHour > ctx.maxSessionsPerHour) flags.push("session_rate_exceeded");

  return { ok: flags.length === 0, flags };
}
