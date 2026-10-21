// ══════════════════════════════════════════════════════════════════
//  KIDORA — Plugin d'authentification
//
//  • Access token  : JWT court (15 min) dans un cookie HttpOnly
//  • Refresh token : token opaque révocable (rotatif), cookie HttpOnly
//  • Jamais de token dans localStorage → pas de vol par XSS
//  • CSRF : SameSite=Lax + vérification d'Origin (voir security.plugin)
// ══════════════════════════════════════════════════════════════════

import fp from "fastify-plugin";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";
import { env, isProd } from "../config/env";
import { prisma } from "../lib/prisma";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

export const ACCESS_COOKIE = "kidora_at";
export const REFRESH_COOKIE = "kidora_rt";

export interface AuthUser {
  id: string;
  role: Role;
  displayName: string;
  email: string | null;
  isActive: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// ── Déclaration de types Fastify ──────────────────────────────────
declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser | null;
  }
}

// ── Cookies ───────────────────────────────────────────────────────

function baseCookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProd,
    sameSite: "lax" as const,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    ...(maxAgeMs !== undefined ? { maxAge: Math.floor(maxAgeMs / 1000) } : {}),
  };
}

export function setAccessCookie(reply: FastifyReply, accessToken: string, maxAgeMs: number) {
  reply.setCookie(ACCESS_COOKIE, accessToken, baseCookieOptions(maxAgeMs));
}

export function setRefreshCookie(reply: FastifyReply, refreshToken: string, maxAgeMs: number) {
  // Le refresh token vit uniquement sur /api/auth pour limiter sa surface.
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(maxAgeMs),
    path: "/api/auth",
  });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE, { path: "/" });
  reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

// ── Tokens ────────────────────────────────────────────────────────

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    // L'env fournit une durée "ms-style" (ex. "15m") : cast car le typage
    // de la lib attend un template littéral strict.
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}

// ── Résolution de l'utilisateur courant ───────────────────────────

/**
 * Retourne l'utilisateur authentifié (ou null).
 * Vérifie : signature JWT, compte actif, non supprimé,
 * et invalidation globale (tokens_valid_after).
 */
export async function resolveAuthUser(request: FastifyRequest): Promise<AuthUser | null> {
  const token = request.cookies[ACCESS_COOKIE];
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      role: true,
      displayName: true,
      email: true,
      isActive: true,
      deletedAt: true,
      tokensValidAfter: true,
    },
  });
  if (!user || user.deletedAt) return null;
  if (!user.isActive) return null;

  // Invalidation globale (logout partout, changement de mot de passe…)
  if (user.tokensValidAfter && payload.iat) {
    if (payload.iat * 1000 < user.tokensValidAfter.getTime()) return null;
  }

  return {
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    email: user.email,
    isActive: user.isActive,
  };
}

// ── Gardiens (preHandlers) ────────────────────────────────────────

export async function requireAuth(request: FastifyRequest): Promise<void> {
  const user = await resolveAuthUser(request);
  if (!user) throw new UnauthorizedError();
  request.authUser = user;
}

export async function requireAdmin(request: FastifyRequest): Promise<void> {
  await requireAuth(request);
  if (request.authUser?.role !== "ADMIN") {
    throw new ForbiddenError("Réservé aux administrateurs.");
  }
}

export async function requireParent(request: FastifyRequest): Promise<void> {
  await requireAuth(request);
  const role = request.authUser?.role;
  if (role !== "PARENT" && role !== "ADMIN") {
    throw new ForbiddenError("Cette section est réservée aux parents.");
  }
}

/** Auth optionnelle : attache l'utilisateur s'il existe, sans bloquer. */
export async function optionalAuth(request: FastifyRequest): Promise<void> {
  request.authUser = await resolveAuthUser(request);
}

// ── Plugin ────────────────────────────────────────────────────────

export default fp(async (app) => {
  // Charge l'utilisateur courant sur toutes les requêtes (coût : 1 requête
  // DB uniquement si un cookie d'accès est présent).
  app.decorateRequest("authUser", null);
  app.addHook("onRequest", async (request) => {
    if (request.cookies[ACCESS_COOKIE]) {
      request.authUser = await resolveAuthUser(request);
    }
  });
});
