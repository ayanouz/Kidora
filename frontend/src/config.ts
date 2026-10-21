// ══════════════════════════════════════════════════════════════════
//  KIDORA — Constantes de l'application
//  Le nom du site est modifiable ICI uniquement (nom provisoire).
// ══════════════════════════════════════════════════════════════════

export const SITE_NAME = "Kidora";
export const SITE_TAGLINE = "Joue. Réfléchis. Apprends. Amuse-toi !";
export const SITE_DESCRIPTION =
  "Découvre des jeux amusants qui font travailler ton cerveau.";

export const API_BASE = "/api";

/** Routes utilisées pour la navigation programmatique. */
export const ROUTES = {
  home: "/",
  games: "/games",
  game: (slug: string) => `/games/${slug}`,
  categories: "/categories",
  category: (slug: string) => `/category/${slug}`,
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  profile: "/profile",
  favorites: "/favorites",
  leaderboard: "/leaderboard",
  achievements: "/achievements",
  parent: "/parent",
  parentDashboard: (profileId: string) => `/parent/dashboard/${profileId}`,
  premium: "/premium",
  settings: "/settings",
  about: "/about",
  contact: "/contact",
  help: "/help",
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
  admin: "/admin",
} as const;

/** Avatars proposés aux enfants (emojis — aucun asset binaire). */
export const AVATARS = [
  "🐼", "🦊", "🦁", "🐯", "🐸", "🐙", "🦄", "🐲", "🐧", "🦉",
  "🐨", "🐰", "🦖", "🐳", "🦋", "🌟", "🚀", "⚽",
] as const;

/** Tranches d'âge proposées (§4). */
export const AGE_TIERS = [
  { value: "AGE_3_5", label: "3–5 ans", min: 3, max: 5, emoji: "🧸" },
  { value: "AGE_6_8", label: "6–8 ans", min: 6, max: 8, emoji: "🪁" },
  { value: "AGE_9_12", label: "9–12 ans", min: 9, max: 12, emoji: "🎮" },
  { value: "AGE_13_PLUS", label: "13+ ans", min: 13, max: 120, emoji: "🎓" },
] as const;

export type AgeTierValue = (typeof AGE_TIERS)[number]["value"];

/** Difficultés standard des jeux. */
export type DifficultyKey = "easy" | "medium" | "hard";

export const DIFFICULTIES: {
  value: DifficultyKey;
  label: string;
  emoji: string;
  stars: number;
}[] = [
  { value: "easy", label: "Facile", emoji: "⭐", stars: 1 },
  { value: "medium", label: "Moyen", emoji: "⭐⭐", stars: 2 },
  { value: "hard", label: "Difficile", emoji: "⭐⭐⭐", stars: 3 },
];

export const LOCALES = [
  { code: "fr", label: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ar", label: "العربية", flag: "🇲🇦", dir: "rtl" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
