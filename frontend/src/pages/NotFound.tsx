// ══════════════════════════════════════════════════════════════════
//  KIDORA — Page introuvable (404)
//  Jamais d'écran mort : gros emoji, message doux et raccourcis
//  pour repartir jouer en un clin d'œil.
// ══════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { ROUTES } from "../config";
import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";

export function NotFound() {
  const { t } = useI18n();
  usePageTitle(t("pages.notFoundTitle"));

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="text-7xl animate-bounce-soft" aria-hidden="true">
        🧩
      </div>
      <h1 className="text-3xl">{t("pages.notFoundTitle")}</h1>
      <p className="text-ink-soft">{t("pages.notFoundText")}</p>

      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link to={ROUTES.home} className="btn btn-primary btn-lg">
          {t("pages.backHome")}
        </Link>
        <Link to={ROUTES.games} className="btn btn-outline btn-lg">
          {t("pages.backToGames")}
        </Link>
      </div>
    </div>
  );
}
