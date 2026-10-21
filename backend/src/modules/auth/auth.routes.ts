// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Auth (contrôleurs fins)
//  Les handlers ne font que : valider → appeler le service → répondre.
//  Toute la logique vit dans auth.service.ts.
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { parseBody } from "../../middleware/validate";
import { UnauthorizedError } from "../../lib/errors";
import { daysToMs, parseDuration } from "../../lib/duration";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  requireAuth,
  setAccessCookie,
  setRefreshCookie,
} from "../../plugins/auth.plugin";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.schemas";
import * as authService from "./auth.service";

/** Rate limiting renforcé sur toutes les routes sensibles d'auth. */
const authRateLimit = {
  rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, timeWindow: "1 minute" },
};

const logoutSchema = z.object({ allSessions: z.boolean().optional().default(false) });

const authRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /api/auth/register ────────────────────────────────────
  app.post("/register", { config: authRateLimit }, async (request, reply) => {
    const input = parseBody(registerSchema, request.body);
    const { user, session } = await authService.register(input, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    setAccessCookie(reply, session.accessToken, parseDuration(env.ACCESS_TOKEN_TTL));
    setRefreshCookie(reply, session.refreshToken, daysToMs(env.REFRESH_TOKEN_TTL_DAYS));

    const payload = await authService.getMe({
      id: user.id,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
      isActive: user.isActive,
    });

    return reply.status(201).send(payload);
  });

  // ── POST /api/auth/login ───────────────────────────────────────
  app.post("/login", { config: authRateLimit }, async (request, reply) => {
    const input = parseBody(loginSchema, request.body);
    const { user, session } = await authService.login(input, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    setAccessCookie(reply, session.accessToken, parseDuration(env.ACCESS_TOKEN_TTL));
    setRefreshCookie(reply, session.refreshToken, daysToMs(env.REFRESH_TOKEN_TTL_DAYS));

    const payload = await authService.getMe({
      id: user.id,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
      isActive: user.isActive,
    });

    return reply.send(payload);
  });

  // ── POST /api/auth/refresh ─────────────────────────────────────
  app.post("/refresh", { config: authRateLimit }, async (request, reply) => {
    const rawToken = request.cookies[REFRESH_COOKIE];
    try {
      const { session } = await authService.refreshSession(rawToken, {
        userAgent: request.headers["user-agent"],
        ip: request.ip,
      });
      setAccessCookie(reply, session.accessToken, parseDuration(env.ACCESS_TOKEN_TTL));
      setRefreshCookie(reply, session.refreshToken, daysToMs(env.REFRESH_TOKEN_TTL_DAYS));
      return reply.send({ refreshed: true });
    } catch (err) {
      clearAuthCookies(reply);
      throw err;
    }
  });

  // ── POST /api/auth/logout ──────────────────────────────────────
  app.post("/logout", async (request, reply) => {
    const body = parseBody(logoutSchema, request.body ?? {});
    await authService.logout(
      request.cookies[REFRESH_COOKIE],
      body.allSessions,
      request.authUser?.id,
    );
    clearAuthCookies(reply);
    return reply.send({ loggedOut: true });
  });

  // ── POST /api/auth/forgot-password ─────────────────────────────
  app.post("/forgot-password", { config: authRateLimit }, async (request, reply) => {
    const input = parseBody(forgotPasswordSchema, request.body);
    await authService.requestPasswordReset(
      input.email,
      { ip: request.ip, userAgent: request.headers["user-agent"] },
      { info: (m) => app.log.info(m), warn: (m) => app.log.warn(m) },
    );
    // Réponse identique que l'email existe ou non (anti-énumération)
    return reply.send({
      message:
        "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
    });
  });

  // ── POST /api/auth/reset-password ──────────────────────────────
  app.post("/reset-password", { config: authRateLimit }, async (request, reply) => {
    const input = parseBody(resetPasswordSchema, request.body);
    await authService.resetPassword(input.token, input.password, { ip: request.ip });
    return reply.send({ message: "Mot de passe mis à jour. Tu peux te connecter !" });
  });

  // ── GET /api/auth/me ───────────────────────────────────────────
  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const me = await authService.getMe(request.authUser);
    return reply.send(me);
  });
};

export default authRoutes;
