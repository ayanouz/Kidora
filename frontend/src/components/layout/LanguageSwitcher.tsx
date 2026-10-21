// ══════════════════════════════════════════════════════════════════
//  KIDORA — Sélecteur de langue FR / EN / AR (§46)
//  Applique dir="rtl" automatiquement via le provider i18n.
// ══════════════════════════════════════════════════════════════════

import { LOCALES, type LocaleCode } from "../../config";
import { useI18n } from "../../i18n";
import { cn } from "../../utils/cn";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <select
      value={lang}
      onChange={(event) => setLang(event.target.value as LocaleCode)}
      aria-label={t("settings.language")}
      title={t("settings.language")}
      className={cn(
        "input h-11 w-auto cursor-pointer py-1.5 pe-8 text-sm font-semibold",
        className,
      )}
    >
      {LOCALES.map((locale) => (
        <option key={locale.code} value={locale.code}>
          {locale.flag} {locale.label}
        </option>
      ))}
    </select>
  );
}
