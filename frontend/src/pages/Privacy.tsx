// ══════════════════════════════════════════════════════════════════
//  KIDORA — Politique de confidentialité
//  La vie privée des enfants est la priorité : données minimales,
//  zéro publicité, zéro traqueur tiers.
// ══════════════════════════════════════════════════════════════════

import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";

export function Privacy() {
  const { t } = useI18n();
  usePageTitle(t("pages.privacyTitle"));

  return (
    <div className="mx-auto max-w-3xl">
      <article className="card p-6 sm:p-8">
        <h1 className="mb-4 text-3xl">{t("pages.privacyTitle")}</h1>

        <div className="space-y-4 text-ink-soft leading-relaxed">
          <p>{t("legal.privacyIntro")}</p>
          <p>{t("legal.privacyData")}</p>
          <p>{t("legal.privacyChildren")}</p>
          <p>{t("legal.privacyRights")}</p>
          <p>{t("legal.privacyContact")}</p>
        </div>
      </article>
    </div>
  );
}
