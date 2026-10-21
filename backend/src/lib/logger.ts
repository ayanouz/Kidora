// ══════════════════════════════════════════════════════════════════
//  KIDORA — Logger structuré (Pino, intégré à Fastify)
//  Règles : jamais de mots de passe, tokens ou cookies dans les logs.
// ══════════════════════════════════════════════════════════════════

import type { FastifyServerOptions } from "fastify";
import { env, isProd, isTest } from "../config/env";

/** Chemins systématiquement expurgés des logs. */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "password",
  "*.password",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
  "tokenHash",
  "*.tokenHash",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
];

export function loggerOptions(): FastifyServerOptions["logger"] {
  if (isTest) return false;

  return {
    level: isProd ? "info" : "debug",
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    ...(isProd
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
            },
          },
        }),
    base: { service: "kidora-api", env: env.NODE_ENV },
  };
}
