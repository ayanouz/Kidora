// ══════════════════════════════════════════════════════════════════
//  KIDORA — Construction de l'application Fastify
//  (plugins, gestion d'erreurs, montage des modules API)
// ══════════════════════════════════════════════════════════════════

import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { Prisma } from "@prisma/client";

import { allowedOrigins, env, isProd, isTest } from "./config/env";
import { loggerOptions } from "./lib/logger";
import { isAppError } from "./lib/errors";

import authPlugin from "./plugins/auth.plugin";
import securityPlugin from "./plugins/security.plugin";

import healthRoutes from "./modules/health/health.routes";
import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import profilesRoutes from "./modules/profiles/profiles.routes";
import gamesRoutes from "./modules/games/games.routes";
import categoriesRoutes from "./modules/categories/categories.routes";
import sessionsRoutes from "./modules/sessions/sessions.routes";
import scoresRoutes from "./modules/scores/scores.routes";
import progressRoutes from "./modules/progress/progress.routes";
import favoritesRoutes from "./modules/favorites/favorites.routes";
import achievementsRoutes from "./modules/achievements/achievements.routes";
import leaderboardRoutes from "./modules/leaderboard/leaderboard.routes";
import parentRoutes from "./modules/parent/parent.routes";
import adminRoutes from "./modules/admin/admin.routes";
import billingRoutes from "./modules/billing/billing.routes";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(),
    trustProxy: true, // derrière Nginx : IP réelle pour rate-limit et logs
    bodyLimit: 128 * 1024, // 128 Ko : largement suffisant, limite les abus
    disableRequestLogging: isTest,
  });

  // ── Sécurité HTTP ──────────────────────────────────────────────
  await app.register(helmet, {
    // Le front est servi par Nginx (CSP définie côté Nginx) ; l'API ne
    // sert que du JSON, on garde donc les protections activées sans CSP.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  });

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    maxAge: 86400,
  });

  await app.register(cookie, {
    secret: env.SESSION_SECRET,
  });

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    allowList: [],
    errorResponseBuilder: () => ({
      error: {
        code: "RATE_LIMITED",
        message: "Trop de requêtes. Patiente un petit moment puis réessaie !",
      },
    }),
  });

  // ── Plugins maison ─────────────────────────────────────────────
  await app.register(authPlugin);
  await app.register(securityPlugin);

  // ── Gestion d'erreurs normalisée ───────────────────────────────
  app.setErrorHandler((err, request, reply) => {
    // 1. Erreurs applicatives (métier)
    if (isAppError(err)) {
      if (err.statusCode >= 500) request.log.error({ err }, "Erreur applicative");
      return reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }

    // 2. Rate limiting Fastify
    if (err.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: "RATE_LIMITED",
          message: "Trop de requêtes. Patiente un petit moment puis réessaie !",
        },
      });
    }

    // 3. Erreurs Prisma connues (jamais exposées telles quelles)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        request.log.warn({ code: err.code }, "Conflit d'unicité");
        return reply.status(409).send({
          error: { code: "CONFLICT", message: "Cet élément existe déjà." },
        });
      }
      if (err.code === "P2025") {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Élément introuvable." },
        });
      }
      request.log.error({ code: err.code }, "Erreur Prisma");
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "Une erreur est survenue." },
      });
    }

    // 4. Erreurs JSON malformées / payload trop grand
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "La requête est invalide.",
        },
      });
    }

    // 5. Inconnu → log complet côté serveur, message neutre côté client
    request.log.error({ err }, "Erreur interne non gérée");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Oups ! Une erreur est survenue. Réessaie dans un instant.",
        ...(isProd ? {} : { details: { debug: (err as Error).message } }),
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: "NOT_FOUND", message: `Route introuvable : ${request.method} ${request.url}` },
    });
  });

  // ── Routes de l'API ────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(usersRoutes, { prefix: "/api/users" });
  await app.register(profilesRoutes, { prefix: "/api" }); // /api/profile + /api/profiles
  await app.register(gamesRoutes, { prefix: "/api/games" });
  await app.register(categoriesRoutes, { prefix: "/api/categories" });
  await app.register(sessionsRoutes, { prefix: "/api/sessions" });
  await app.register(scoresRoutes, { prefix: "/api/scores" });
  await app.register(progressRoutes, { prefix: "/api/progress" });
  await app.register(favoritesRoutes, { prefix: "/api/favorites" });
  await app.register(achievementsRoutes, { prefix: "/api/achievements" });
  await app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });
  await app.register(parentRoutes, { prefix: "/api/parent" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(billingRoutes, { prefix: "/api/billing" });

  return app;
}
