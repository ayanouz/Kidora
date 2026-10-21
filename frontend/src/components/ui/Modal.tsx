// ══════════════════════════════════════════════════════════════════
//  KIDORA — Modal accessible
//  • Fermeture : Échap, clic sur le fond (option), bouton ✕
//  • aria-modal, focus géré, scroll de page bloqué
//  • Jamais de popup agressive : contenu clair, gros boutons
// ══════════════════════════════════════════════════════════════════

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Largeur maximale du panneau. */
  size?: "sm" | "md" | "lg";
  /** Empêche la fermeture au clic sur le fond (ex: Game Over). */
  preventBackdropClose?: boolean;
  footer?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  preventBackdropClose = false,
  footer,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus initial sur le panneau (accessibilité clavier)
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-pop-in"
        onClick={preventBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "card relative w-full p-5 sm:p-6 animate-pop-in max-h-[92dvh] overflow-y-auto outline-none",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-2xl",
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          {title && <h2 className="text-xl sm:text-2xl">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon text-xl shrink-0"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-center gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
