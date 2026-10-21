// ══════════════════════════════════════════════════════════════════
//  KIDORA — Conditions d'utilisation
//  Règles simples et bienveillantes, pensées pour les familles.
// ══════════════════════════════════════════════════════════════════

import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";

export function Terms() {
  const { t } = useI18n();
  usePageTitle(t("pages.termsTitle"));

  return (
    <div className="mx-auto max-w-3xl">
      <article className="card p-6 sm:p-8">
        <h1 className="mb-4 text-3xl">{t("pages.termsTitle")}</h1>

        <div className="space-y-4 text-ink-soft leading-relaxed">
          <p>{t("legal.termsIntro")}</p>
          <p>{t("legal.termsUse")}</p>
          <p>{t("legal.termsAccounts")}</p>
          <p>{t("legal.termsContent")}</p>
          <p>{t("legal.termsWarranty")}</p>
        </div>
      </article>
    </div>
  );
}
