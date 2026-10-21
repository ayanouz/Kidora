// ══════════════════════════════════════════════════════════════════
//  KIDORA — Barre de progression, étoiles, avatar
// ══════════════════════════════════════════════════════════════════

import { cn } from "../../utils/cn";

// ── ProgressBar ───────────────────────────────────────────────────

interface ProgressBarProps {
  percent: number;
  label?: string;
  color?: string;
  className?: string;
  height?: number;
}

export function ProgressBar({ percent, label, color, className, height }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex justify-between text-sm font-semibold text-ink-soft">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        style={height ? { height } : undefined}
      >
        <div
          className="progress-fill"
          style={{
            width: `${clamped}%`,
            ...(color ? { background: color } : {}),
          }}
        />
      </div>
    </div>
  );
}

// ── Stars ─────────────────────────────────────────────────────────

interface StarsProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Stars({ value, max = 3, size = "md", className }: StarsProps) {
  const sizes = { sm: "text-sm", md: "text-lg", lg: "text-3xl" } as const;
  return (
    <span
      className={cn("stars", sizes[size], className)}
      role="img"
      aria-label={`${value} étoile${value > 1 ? "s" : ""} sur ${max}`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? "" : "opacity-25 grayscale"} aria-hidden="true">
          ⭐
        </span>
      ))}
    </span>
  );
}

// ── Avatar (emoji — aucun asset binaire) ──────────────────────────

interface AvatarProps {
  emoji: string;
  size?: "sm" | "md" | "lg" | "xl";
  color?: string;
  ring?: boolean;
  className?: string;
  label?: string;
}

export function Avatar({ emoji, size = "md", color, ring, className, label }: AvatarProps) {
  const sizes = {
    sm: "h-9 w-9 text-lg",
    md: "h-12 w-12 text-2xl",
    lg: "h-16 w-16 text-3xl",
    xl: "h-24 w-24 text-5xl",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full no-select",
        sizes[size],
        ring && "ring-4 ring-white shadow-soft",
        className,
      )}
      style={{ background: color ? `${color}22` : "#EEEBFF" }}
      role="img"
      aria-label={label ?? "Avatar"}
    >
      {emoji}
    </span>
  );
}
