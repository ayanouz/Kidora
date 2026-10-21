// ══════════════════════════════════════════════════════════════════
//  KIDORA — Plugin de sécurité (défense en profondeur)
//
//  1. Vérification d'Origin sur toutes les mutations → anti-CSRF
//     (complément de SameSite=Lax : double protection)
//  2. L'API n'accepte que du JSON (Content-Type strict)
//  3. Suppression des en-têtes révélateurs
// ══════════════════════════════════════════════════════════════════

import fp from "fastify-plugin";
import { allowedOrigins, isProd } from "../config/env";
import { ForbiddenError } from "../lib/errors";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const JSON_CONTENT_TYPES = ["application/json", "application/x-www-form-urlencoded"];

export default fp(async (app) => {
  app.addHook("onRequest", async (request, _reply) => {
    if (!MUTATING_METHODS.has(request.method)) return;

    // ── 1. Contrôle d'Origin (anti-CSRF) ─────────────────────────
    const origin = request.headers.origin;
    if (origin) {
      const normalized = origin.replace(/\/$/, "");
      if (!allowedOrigins.includes(normalized)) {
        app.log.warn(
          { origin, ip: request.ip, url: request.url, security: true },
          "Origin refusée (CSRF ?)",
        );
        throw new ForbiddenError("Origine non autorisée.");
      }
    }

    // ── 2. Content-Type strict pour les corps JSON ───────────────
    if (isProd) {
      const contentType = (request.headers["content-type"] ?? "").split(";")[0].trim();
      const hasBody = request.headers["content-length"] !== "0" && request.headers["content-length"] !== undefined;
      if (hasBody && contentType && !JSON_CONTENT_TYPES.includes(contentType)) {
        throw new ForbiddenError("Type de contenu non autorisé.");
      }
    }
  });

  // ── 3. En-têtes de réponse minimaux ────────────────────────────
  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.removeHeader("X-Powered-By");
  });
});
