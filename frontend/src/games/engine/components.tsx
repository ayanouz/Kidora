// ══════════════════════════════════════════════════════════════════
//  KIDORA — Composants du moteur de jeu (§33/§41/§47)
//  GameHUD · ScoreBoard · GameTimer · LevelSelector ·
//  ReadyScreen · PauseOverlay · FeedbackFloat
//  Tous les textes passent par i18n ; boutons ≥ 48px ; RTL OK.
// ══════════════════════════════════════════════════════════════════

import { DIFFICULTIES, type DifficultyKey } from "../../config";
import { useI18n } from "../../i18n";
import { cn } from "../../utils/cn";
import { Button } from "../../components/ui/Button";
import type { Game } from "../../types";
import type { SoundApi } from "./types";

// ── Utilitaires ───────────────────────────────────────────────────

/** 75000 → "1:15" (temps affiché dans le HUD). */
export function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Score maximal attendu pour une difficulté (bornes du serveur). */
export function maxScoreFor(game: Game, difficulty: DifficultyKey): number {
  return game.config.maxScore?.[difficulty] ?? game.maxScoreHint;
}

// ── ScoreBoard : score + record + combo ───────────────────────────

interface ScoreBoardProps {
  score: number;
  best?: number | null;
  combo?: number;
  className?: string;
}

export function ScoreBoard({ score, best, combo = 0, className }: ScoreBoardProps) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-center gap-2 sm:gap-3", className)}>
      <div className="flex flex-col items-center rounded-2xl bg-primary-soft px-3 py-1 sm:px-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          {t("hud.score")}
        </span>
        <span
          className="text-xl font-bold leading-none tabular-nums text-primary sm:text-2xl"
          aria-live="polite"
        >
          {score}
        </span>
      </div>

      {typeof best === "number" && best > 0 && (
        <div className="hidden flex-col items-center rounded-2xl bg-accent-soft px-3 py-1 sm:flex">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            {t("hud.best")}
          </span>
          <span className="text-lg font-bold leading-none tabular-nums text-ink">
            🏆 {best}
          </span>
        </div>
      )}

      {combo >= 2 && (
        <span
          key={combo}
          className="chip animate-pop-in bg-secondary-soft text-secondary-dark"
        >
          🔥 x{combo}
        </span>
      )}
    </div>
  );
}

// ── LivesHearts ───────────────────────────────────────────────────

interface LivesHeartsProps {
  lives: number;
  max?: number;
  className?: string;
}

export function LivesHearts({ lives, max = 3, className }: LivesHeartsProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-lg leading-none", className)}
      role="img"
      aria-label={`${lives} / ${max}`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < lives ? "" : "opacity-25 grayscale"} aria-hidden="true">
          ❤️
        </span>
      ))}
    </span>
  );
}

// ── GameTimer ─────────────────────────────────────────────────────

interface GameTimerProps {
  /** Secondes restantes. */
  timeLeft: number;
  className?: string;
}

export function GameTimer({ timeLeft, className }: GameTimerProps) {
  const { t } = useI18n();
  const danger = timeLeft <= 10;
  return (
    <div
      className={cn(
        "flex min-w-[72px] flex-col items-center rounded-2xl px-3 py-1",
        danger ? "bg-danger-soft" : "bg-secondary-soft",
        className,
      )}
      aria-label={`${t("hud.time")} : ${timeLeft}`}
    >
      <span className="flex items-center gap-1 text-lg font-bold leading-none tabular-nums">
        <span aria-hidden="true">⏱</span>
        <span
          className={cn(
            danger ? "text-danger" : "text-ink",
            danger && timeLeft <= 5 && "animate-pulse",
          )}
          aria-live="polite"
        >
          {formatMs(timeLeft * 1000)}
        </span>
      </span>
    </div>
  );
}

// ── GameHUD ───────────────────────────────────────────────────────

interface GameHUDProps {
  title: string;
  emoji: string;
  score: number;
  best?: number | null;
  combo?: number;
  lives?: number | null;
  level?: number | null;
  maxLevel?: number | null;
  timeLeft?: number | null;
  sound: SoundApi;
  onPause?: () => void;
  onExit?: () => void;
  className?: string;
}

export function GameHUD({
  title,
  emoji,
  score,
  best,
  combo,
  lives,
  level,
  maxLevel,
  timeLeft,
  sound,
  onPause,
  onExit,
  className,
}: GameHUDProps) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-card border border-primary/5 bg-white/95 p-2 shadow-soft sm:gap-3 sm:p-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="btn btn-ghost btn-icon text-xl"
            aria-label={t("common.back")}
            title={t("common.back")}
          >
            ↩
          </button>
        )}
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-2xl" aria-hidden="true">
            {emoji}
          </span>
          <span className="hidden truncate text-base font-bold sm:inline">{title}</span>
        </span>
      </div>

      <div className="order-last w-full sm:order-none sm:mx-auto sm:w-auto">
        <ScoreBoard score={score} best={best} combo={combo} className="justify-center" />
      </div>

      <div className="ms-auto flex items-center gap-2">
        {typeof level === "number" && (
          <span className="chip bg-primary-soft text-primary-dark">
            {typeof maxLevel === "number" && maxLevel > 1
              ? t("hud.levelOf", { level, max: maxLevel })
              : `${t("hud.level")} ${level}`}
          </span>
        )}
        {typeof lives === "number" && <LivesHearts lives={lives} />}
        {typeof timeLeft === "number" && <GameTimer timeLeft={timeLeft} />}

        <button
          type="button"
          onClick={sound.toggle}
          className="btn btn-ghost btn-icon text-xl"
          aria-label={sound.enabled ? t("hud.soundOn") : t("hud.soundOff")}
          title={sound.enabled ? t("hud.soundOn") : t("hud.soundOff")}
        >
          {sound.enabled ? "🔊" : "🔇"}
        </button>

        {onPause && (
          <button
            type="button"
            onClick={onPause}
            className="btn btn-outline btn-icon text-lg"
            aria-label={t("hud.pause")}
            title={t("hud.pause")}
          >
            ⏸️
          </button>
        )}
      </div>
    </div>
  );
}

// ── LevelSelector : choix de la difficulté (§20) ─────────────────

interface LevelSelectorProps {
  value: DifficultyKey;
  onChange: (value: DifficultyKey) => void;
  /** Difficulté conseillée (adaptation) — affichée si différente. */
  recommended?: DifficultyKey | null;
  disabled?: boolean;
  className?: string;
}

export function LevelSelector({
  value,
  onChange,
  recommended = null,
  disabled = false,
  className,
}: LevelSelectorProps) {
  const { t } = useI18n();
  return (
    <div
      className={cn("flex flex-wrap justify-center gap-3", className)}
      role="radiogroup"
      aria-label={t("difficulty.choose")}
    >
      {DIFFICULTIES.map((difficulty) => {
        const active = difficulty.value === value;
        return (
          <button
            key={difficulty.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(difficulty.value)}
            className={cn(
              "relative flex min-h-[56px] min-w-[112px] flex-col items-center justify-center gap-0.5",
              "rounded-2xl border-2 px-4 py-2 font-fun font-semibold transition-all",
              "active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
              active
                ? "border-primary bg-primary text-white shadow-inset"
                : "border-primary/15 bg-white text-ink hover:border-primary/50",
            )}
          >
            <span className="text-sm">{t(`difficulty.${difficulty.value}`)}</span>
            <span className="text-xs" aria-hidden="true">
              {difficulty.emoji}
            </span>
            {recommended === difficulty.value && !active && (
              <span className="absolute -top-2.5 end-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-ink shadow-soft">
                💡 {t("hud.recommended")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── ReadyScreen : écran d'accueil d'une partie ────────────────────

interface ReadyScreenProps {
  game: Game;
  best: number;
  difficulty: DifficultyKey;
  recommended?: DifficultyKey | null;
  onDifficultyChange: (value: DifficultyKey) => void;
  onStart: () => void;
  className?: string;
}

export function ReadyScreen({
  game,
  best,
  difficulty,
  recommended = null,
  onDifficultyChange,
  onStart,
  className,
}: ReadyScreenProps) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8 text-center",
        className,
      )}
    >
      <span className="animate-float text-6xl sm:text-7xl" aria-hidden="true">
        {game.emoji}
      </span>

      <div>
        <h2 className="text-2xl sm:text-3xl">{game.title}</h2>
        <p className="mt-1 text-ink-soft">
          {t("hud.ready")} {t("game.adaptiveHint")}
        </p>
      </div>

      {best > 0 && (
        <span className="chip bg-accent-soft text-ink">
          🏆 {t("game.yourBest")} : {best}
        </span>
      )}

      <LevelSelector value={difficulty} onChange={onDifficultyChange} recommended={recommended} />

      <Button size="lg" onClick={onStart} className="min-w-[220px] text-xl">
        <span aria-hidden="true">▶</span> {t("hud.start")}
      </Button>
    </div>
  );
}

// ── PauseOverlay ──────────────────────────────────────────────────

interface PauseOverlayProps {
  open: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  sound: SoundApi;
  className?: string;
}

export function PauseOverlay({
  open,
  onResume,
  onRestart,
  onQuit,
  sound,
  className,
}: PauseOverlayProps) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex items-center justify-center rounded-card bg-ink/45 p-4 backdrop-blur-[2px]",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-label={t("hud.paused")}
    >
      <div className="card w-full max-w-sm animate-pop-in p-6 text-center">
        <span className="text-5xl" aria-hidden="true">
          ⏸️
        </span>
        <h3 className="mt-2 text-2xl">{t("hud.paused")}</h3>
        <p className="mt-1 text-ink-soft">{t("hud.pausedText")}</p>

        <div className="mt-5 flex flex-col gap-3">
          <Button size="lg" onClick={onResume}>
            <span aria-hidden="true">▶</span> {t("hud.resume")}
          </Button>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={onRestart}>
              🔄 {t("hud.restart")}
            </Button>
            <Button
              variant="ghost"
              onClick={sound.toggle}
              aria-label={sound.enabled ? t("hud.soundOn") : t("hud.soundOff")}
            >
              {sound.enabled ? "🔊" : "🔇"}
            </Button>
            <Button variant="danger" onClick={onQuit}>
              🚪 {t("hud.quit")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FeedbackFloat : message bienveillant qui passe (§21) ─────────

export interface FeedbackMessage {
  id: number;
  text: string;
  kind: "good" | "bad";
  points?: number;
}

export function FeedbackFloat({ message }: { message: FeedbackMessage | null }) {
  if (!message) return null;
  return (
    <div
      key={message.id}
      className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center"
      aria-live="polite"
    >
      <span
        className={cn(
          "animate-pop-in rounded-full px-4 py-1.5 text-base font-bold text-white shadow-pop",
          message.kind === "good" ? "bg-success" : "bg-warning",
        )}
      >
        {typeof message.points === "number" && message.points > 0
          ? `+${message.points} · `
          : ""}
        {message.text}
      </span>
    </div>
  );
}
