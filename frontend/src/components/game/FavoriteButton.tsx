// ══════════════════════════════════════════════════════════════════
//  KIDORA — Bouton favori ❤️ (§39)
//  Mise à jour optimiste + retour arrière si erreur réseau.
//  Invité → redirigé vers la connexion (jamais de bug silencieux).
// ══════════════════════════════════════════════════════════════════

import { useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../config";
import { useI18n } from "../../i18n";
import { favoritesService } from "../../services/gameplay.service";
import { useAuthStore } from "../../store/auth.store";
import { cn } from "../../utils/cn";

interface FavoriteButtonProps {
  gameId: string;
  initial: boolean;
  onChange?: (gameId: string, favorite: boolean) => void;
  className?: string;
}

export function FavoriteButton({ gameId, initial, onChange, className }: FavoriteButtonProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const [favorite, setFavorite] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setFavorite(initial), [initial]);

  const toggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (status !== "authenticated") {
      navigate(ROUTES.login);
      return;
    }
    if (busy) return;

    const next = !favorite;
    setFavorite(next); // optimiste
    setBusy(true);
    try {
      if (next) {
        await favoritesService.add(gameId);
      } else {
        await favoritesService.remove(gameId);
      }
      onChange?.(gameId, next);
    } catch {
      setFavorite(!next); // retour arrière
    } finally {
      setBusy(false);
    }
  };

  const label = favorite ? t("games.unfavorite") : t("games.favorite");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={favorite}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl shadow-soft backdrop-blur",
        "transition-transform active:scale-90",
        className,
      )}
    >
      <span aria-hidden="true">{favorite ? "❤️" : "🤍"}</span>
    </button>
  );
}
