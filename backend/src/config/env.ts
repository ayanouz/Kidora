// ══════════════════════════════════════════════════════════════════
//  KIDORA — Configuration & validation des variables d'environnement
//  Toute variable manquante ou invalide fait échouer le démarrage
//  immédiatement (fail-fast) avec un message clair.
// ══════════════════════════════════════════════════════════════════

import { z } from "zod";

/** Transforme "true"/"false" (string) en booléen — z.coerce.boolean() piègerait "false". */
const boolFromString = (defaultValue: "true" | "false") =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? defaultValue === "true" : v === "true"));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),

  FRONTEND_URL: z.string().default("http://localhost:5173"),
  API_URL: z.string().default("http://localhost:4000"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET doit faire au moins 32 caractères (utilisez openssl rand -base64 48)"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET doit faire au moins 32 caractères"),

  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  COOKIE_SECURE: boolFromString("false"),
  COOKIE_DOMAIN: z.string().optional().transform((v) => (v === "" ? undefined : v)),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  MAX_SESSIONS_PER_HOUR: z.coerce.number().int().positive().default(60),

  MAIL_FROM: z.string().default("Kidora <no-reply@kidora.local>"),
  SMTP_HOST: z.string().optional().transform((v) => (v === "" ? undefined : v)),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().transform((v) => (v === "" ? undefined : v)),
  SMTP_PASS: z.string().optional().transform((v) => (v === "" ? undefined : v)),
  MAIL_DRY_RUN: boolFromString("true"),

  // ── Paiement Premium ────────────────────────────────────────────
  // Sans clé Stripe, le mode démo permet d'activer un abonnement
  // localement (jamais activé par défaut en production).
  STRIPE_SECRET_KEY: z.string().optional().transform((v) => (v === "" ? undefined : v)),
  STRIPE_PRICE_MONTHLY: z.string().optional().transform((v) => (v === "" ? undefined : v)),
  STRIPE_PRICE_YEARLY: z.string().optional().transform((v) => (v === "" ? undefined : v)),
  STRIPE_PRICE_FAMILY: z.string().optional().transform((v) => (v === "" ? undefined : v)),
  BILLING_DEMO: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : v === "true")),
});

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(racine)"} : ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`\n❌ Configuration invalide (.env) :\n${issues}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Origines autorisées pour CORS + vérification d'Origin (défense CSRF). */
export const allowedOrigins: string[] = (() => {
  const origins = new Set<string>([env.FRONTEND_URL]);
  if (!isProd) {
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:5173");
    origins.add("http://localhost:4173");
  }
  return [...origins];
})();
