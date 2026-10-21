// ══════════════════════════════════════════════════════════════════
//  KIDORA — Aide / FAQ
//  Réponses aux questions fréquentes dans des blocs <details>
//  natifs (accessibles au clavier, zéro dépendance).
// ══════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { ROUTES } from "../config";
import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";

/** Questions fréquentes : clés i18n des titres et des réponses. */
const HELP_ITEMS = [
  { title: "legal.help1Title", text: "legal.help1Text" },
  { title: "legal.help2Title", text: "legal.help2Text" },
  { title: "legal.help3Title", text: "legal.help3Text" },
  { title: "legal.help4Title", text: "legal.help4Text" },
] as const;

export function Help() {
  const { t } = useI18n();
  usePageTitle(t("pages.helpTitle"));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <article className="card p-6 sm:p-8">
        <h1 className="mb-4 text-3xl">{t("pages.helpTitle")}</h1>
        <p className="text-ink-soft leading-relaxed">{t("legal.helpIntro")}</p>
      </article>

      {HELP_ITEMS.map((item) => (
        <details key={item.title} className="card p-4">
          <summary className="cursor-pointer font-bold">{t(item.title)}</summary>
          <p className="mt-3 text-ink-soft leading-relaxed">{t(item.text)}</p>
        </details>
      ))}

      <p className="pt-2 text-center text-sm font-semibold text-ink-soft">
        <Link to={ROUTES.contact} className="text-primary hover:underline">
          {t("footer.contact")}
        </Link>
      </p>
    </div>
  );
}
