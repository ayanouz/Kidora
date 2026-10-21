// ══════════════════════════════════════════════════════════════════
//  KIDORA — Politique cookies
//  Uniquement des cookies essentiels et des préférences locales :
//  aucune publicité, aucun traqueur analytique tiers.
// ══════════════════════════════════════════════════════════════════

import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";

export function Cookies() {
  const { t } = useI18n();
  usePageTitle(t("pages.cookiesTitle"));

  return (
    <div className="mx-auto max-w-3xl">
      <article className="card p-6 sm:p-8">
        <h1 className="mb-4 text-3xl">{t("pages.cookiesTitle")}</h1>

        <div className="space-y-4 text-ink-soft leading-relaxed">
          <p>{t("legal.cookiesIntro")}</p>
          <p>{t("legal.cookiesEssential")}</p>
          <p>{t("legal.cookiesPreferences")}</p>
          <p>{t("legal.cookiesNoAds")}</p>
        </div>
      </article>
    </div>
  );
}
