// ══════════════════════════════════════════════════════════════════
//  KIDORA — À propos
//  Qui nous sommes, notre mission et nos valeurs.
// ══════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { ROUTES } from "../config";
import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";

export function About() {
  const { t } = useI18n();
  usePageTitle(t("pages.aboutTitle"));

  return (
    <div className="mx-auto max-w-3xl">
      <article className="card p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-5xl animate-float" aria-hidden="true">
            🦉
          </span>
          <h1 className="text-3xl">{t("pages.aboutTitle")}</h1>
        </div>

        <div className="space-y-4 text-ink-soft leading-relaxed">
          <p>{t("legal.aboutIntro")}</p>
          <p>{t("legal.aboutMission")}</p>
          <p>{t("legal.aboutValues")}</p>
        </div>

        <div className="mt-6">
          <Link to={ROUTES.games} className="btn btn-primary btn-lg">
            🎮 {t("hero.ctaPlay")}
          </Link>
        </div>
      </article>
    </div>
  );
}
