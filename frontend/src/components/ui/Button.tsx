// ══════════════════════════════════════════════════════════════════
//  KIDORA — Bouton (design system §47)
//  Variantes : primary / secondary / success / danger / accent /
//              ghost / outline — tailles sm / md / lg
//  Toujours ≥ 48px de haut (tactile enfant), état loading intégré.
// ══════════════════════════════════════════════════════════════════

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "accent"
  | "ghost"
  | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "btn",
        `btn-${variant}`,
        size === "lg" && "btn-lg",
        size === "sm" && "btn-sm",
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <span
          className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white"
          aria-hidden="true"
        />
      ) : (
        icon && <span aria-hidden="true">{icon}</span>
      )}
      {children}
    </button>
  );
}
