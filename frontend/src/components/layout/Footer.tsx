// ══════════════════════════════════════════════════════════════════
//  KIDORA — Pied de page
//  Liens utiles, rappel « zéro pub », mention enfants.
// ══════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { ROUTES, SITE_NAME, SITE_TAGLINE } from "../../config";
import { useI18n } from "../../i18n";

export function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-primary/10 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-xl text-white shadow-soft"
              aria-hidden="true"
            >
              🦉
            </span>
            <span className="text-xl font-bold text-primary">{SITE_NAME}</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-ink-soft">{SITE_TAGLINE}</p>
          <p className="mt-2 text-sm text-ink-soft">{t("footer.madeWith")}</p>
          <p className="mt-2 text-xs text-ink-faint">🚫📢 {t("legal.cookiesIntro")}</p>
        </div>

        <nav aria-label={t("nav.games")}>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t("nav.games")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm font-semibold">
            <li>
              <Link to={ROUTES.games} className="text-ink-soft hover:text-primary">
                {t("games.title")}
              </Link>
            </li>
            <li>
              <Link to={ROUTES.categories} className="text-ink-soft hover:text-primary">
                {t("nav.categories")}
              </Link>
            </li>
            <li>
              <Link to={ROUTES.leaderboard} className="text-ink-soft hover:text-primary">
                {t("leaderboard.title")}
              </Link>
            </li>
            <li>
              <Link to={ROUTES.achievements} className="text-ink-soft hover:text-primary">
                {t("achievements.title")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("footer.help")}>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t("footer.help")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm font-semibold">
            <li>
              <Link to={ROUTES.about} className="text-ink-soft hover:text-primary">
                {t("footer.about")}
              </Link>
            </li>
            <li>
              <Link to={ROUTES.contact} className="text-ink-soft hover:text-primary">
                {t("footer.contact")}
              </Link>
            </li>
            <li>
              <Link to={ROUTES.help} className="text-ink-soft hover:text-primary">
                {t("footer.help")}
              </Link>
            </li>
            <li>
              <Link to={ROUTES.parent} className="text-ink-soft hover:text-primary">
                {t("footer.parents")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("footer.privacy")}>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t("footer.privacy")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm font-semibold">
            <li>
              <Link to={ROUTES.privacy} className="text-ink-soft hover:text-primary">
                {t("footer.privacy")}
              </Link>
            </li>
            <li>
              <Link to={ROUTES.terms} className="text-ink-soft hover:text-primary">
                {t("footer.terms")}
              </Link>
            </li>
            <li>
              <Link to={ROUTES.cookies} className="text-ink-soft hover:text-primary">
                {t("footer.cookies")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-primary/10 py-4 text-center text-xs text-ink-faint">
        © {year} {SITE_NAME} — {t("footer.rights")}
      </div>
    </footer>
  );
}
