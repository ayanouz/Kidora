// ══════════════════════════════════════════════════════════════════
//  KIDORA — Contact
//  Un seul canal, simple et direct : l'email de contact.
// ══════════════════════════════════════════════════════════════════

import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";

export function Contact() {
  const { t } = useI18n();
  usePageTitle(t("pages.contactTitle"));

  return (
    <div className="mx-auto max-w-3xl">
      <article className="card p-6 sm:p-8">
        <h1 className="mb-4 text-3xl">{t("pages.contactTitle")}</h1>

        <div className="space-y-4 text-ink-soft leading-relaxed">
          <p>{t("pages.contactText")}</p>
        </div>

        <div className="mt-6">
          <a href="mailto:hello@kidora.example" className="btn btn-primary btn-lg">
            ✉️ {t("pages.contactEmail")}
          </a>
        </div>

        <p className="mt-4 text-sm text-ink-soft">{t("legal.contactNote")}</p>
      </article>
    </div>
  );
}
