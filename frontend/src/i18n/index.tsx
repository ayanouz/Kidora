// ══════════════════════════════════════════════════════════════════
//  KIDORA — Système i18n (FR / EN / AR + RTL)
//  • Aucun texte en dur dans les composants (§46)
//  • t("games.play") → chaîne traduite, avec interpolation {var}
//  • La langue est persistée dans localStorage et applique dir=rtl
// ══════════════════════════════════════════════════════════════════

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LOCALES, type LocaleCode } from "../config";
import { fr, type Dictionary } from "./fr";
import { en } from "./en";
import { ar } from "./ar";

const DICTIONARIES: Record<LocaleCode, Dictionary> = { fr, en, ar };
const STORAGE_KEY = "kidora_lang";

/** Parcourt un objet imbriqué avec un chemin "games.play". */
function resolvePath(dict: Dictionary, path: string): string | undefined {
  const parts = path.split(".");
  let node: unknown = dict;
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : match,
  );
}

function detectInitialLocale(): LocaleCode {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && LOCALES.some((l) => l.code === stored)) return stored as LocaleCode;
  const navigatorLang = window.navigator.language.slice(0, 2).toLowerCase();
  const match = LOCALES.find((l) => l.code === navigatorLang);
  return match ? match.code : "fr";
}

export interface I18nContextValue {
  lang: LocaleCode;
  dir: "ltr" | "rtl";
  setLang: (lang: LocaleCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LocaleCode>(detectInitialLocale);

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, dir]);

  const setLang = useCallback((next: LocaleCode) => setLangState(next), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = DICTIONARIES[lang];
      const value = resolvePath(dict, key) ?? resolvePath(fr, key) ?? key;
      return interpolate(value, vars);
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, dir, setLang, t }),
    [lang, dir, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n doit être utilisé dans <I18nProvider>");
  return ctx;
}
