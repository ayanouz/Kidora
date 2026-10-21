// ══════════════════════════════════════════════════════════════════
//  KIDORA — États de l'interface
//  Skeleton (§49), EmptyState (§50), ErrorState (§48), Spinner.
//  Jamais d'écran blanc : toujours un état clair et rassurant.
// ══════════════════════════════════════════════════════════════════

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { Button } from "./Button";
import { cn } from "../../utils/cn";

// ── Skeleton ──────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function GameGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Chargement des jeux"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card overflow-hidden p-0">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-10", className)} role="status">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      {label && <span className="text-sm font-semibold text-ink-soft">{label}</span>}
    </div>
  );
}

// ── EmptyState (§50) ──────────────────────────────────────────────

interface EmptyStateProps {
  icon: string;
  title: string;
  text?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  actionTo,
  onAction,
  children,
}: EmptyStateProps) {
  return (
    <div className="card mx-auto max-w-md px-6 py-10 text-center animate-fade-up">
      <div className="mb-3 text-6xl animate-bounce-soft" aria-hidden="true">
        {icon}
      </div>
      <h2 className="mb-2 text-xl">{title}</h2>
      {text && <p className="mb-5 text-ink-soft">{text}</p>}
      {children}
      {actionLabel &&
        (actionTo ? (
          <Link to={actionTo} className="btn btn-primary btn-lg">
            {actionLabel}
          </Link>
        ) : (
          <Button onClick={onAction} size="lg">
            {actionLabel}
          </Button>
        ))}
    </div>
  );
}

// ── ErrorState (§48) ──────────────────────────────────────────────

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useI18n();
  return (
    <div className="card mx-auto max-w-md px-6 py-10 text-center" role="alert">
      <div className="mb-3 text-6xl" aria-hidden="true">
        🙈
      </div>
      <h2 className="mb-2 text-xl">{t("common.error")}</h2>
      <p className="mb-5 text-ink-soft">{message ?? t("errors.network")}</p>
      {onRetry && (
        <Button onClick={onRetry} size="lg" icon="🔄">
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
