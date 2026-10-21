// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Administration (§26)
//   Le préfixe /api/admin est protégé par requireAdmin sur TOUT.
//   GET    /api/admin/stats           → KPIs
//   GET    /api/admin/users           → liste + recherche + filtres
//   PATCH  /api/admin/users/:id       → activer / désactiver
//   DELETE /api/admin/users/:id       → supprimer (anonymisation)
//   GET    /api/admin/games           → liste complète (publiés ou non)
//   POST   /api/admin/games           → créer
//   PUT    /api/admin/games/:id       → modifier (+ publier/dépublier)
//   DELETE /api/admin/games/:id       → supprimer
//   GET/POST/PUT/DELETE /api/admin/categories
//   GET    /api/admin/security-logs   → anomalies récentes
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseBody, parseParams, parseQuery } from "../../middleware/validate";
import { UnauthorizedError } from "../../lib/errors";
import { requireAdmin } from "../../plugins/auth.plugin";
import * as adminService from "./admin.service";

// ── Schémas ───────────────────────────────────────────────────────

const idParamsSchema = z.object({ id: z.string().min(10).max(40) });

const usersQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  role: z.enum(["PARENT", "CHILD", "ADMIN"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const setActiveSchema = z.object({ isActive: z.boolean() });

const slugField = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Slug invalide (minuscules, chiffres et tirets uniquement).");

const colorField = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format #RRGGBB).");

const gameSchema = z.object({
  slug: slugField,
  title: z.string().trim().min(2).max(60),
  description: z.string().trim().max(400).optional(),
  engine: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Identifiant de moteur invalide."),
  categoryId: z.string().min(10).max(40),
  minAge: z.number().int().min(3).max(18),
  maxAge: z.number().int().min(3).max(120).nullable().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  emoji: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .refine((v) => !/[<>]/.test(v), "Emoji invalide."),
  color: colorField,
  config: z.record(z.unknown()).optional(),
  maxScoreHint: z.number().int().min(100).max(1_000_000).optional(),
  isPublished: z.boolean().optional(),
});

const gameUpdateSchema = gameSchema.partial();

const categorySchema = z.object({
  slug: slugField,
  name: z.string().trim().min(2).max(40),
  emoji: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .refine((v) => !/[<>]/.test(v), "Emoji invalide."),
  color: colorField,
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

const categoryUpdateSchema = categorySchema.partial();

const gamesQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const logsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ── Routes ────────────────────────────────────────────────────────

const adminRoutes: FastifyPluginAsync = async (app) => {
  // Garde globale : tout le module est admin-only.
  app.addHook("preHandler", requireAdmin);

  // ── Dashboard ──────────────────────────────────────────────────
  app.get("/stats", async (_request, reply) => {
    const stats = await adminService.getStats();
    return reply.send(stats);
  });

  // ── Utilisateurs ───────────────────────────────────────────────
  app.get("/users", async (request, reply) => {
    const query = parseQuery(usersQuerySchema, request.query);
    const result = await adminService.listUsers(query);
    return reply.send(result);
  });

  app.patch("/users/:id", async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(idParamsSchema, request.params);
    const input = parseBody(setActiveSchema, request.body);
    await adminService.setUserActive(request.authUser.id, id, input.isActive);
    return reply.send({ updated: true });
  });

  app.delete("/users/:id", async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(idParamsSchema, request.params);
    await adminService.deleteUser(request.authUser.id, id);
    return reply.send({ deleted: true });
  });

  // ── Jeux ───────────────────────────────────────────────────────
  app.get("/games", async (request, reply) => {
    const query = parseQuery(gamesQuerySchema, request.query);
    const result = await adminService.listGamesAdmin(query);
    return reply.send(result);
  });

  app.post("/games", async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const input = parseBody(gameSchema, request.body);
    const game = await adminService.createGame(request.authUser.id, input);
    return reply.status(201).send({ game });
  });

  app.put("/games/:id", async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(idParamsSchema, request.params);
    const input = parseBody(gameUpdateSchema, request.body);
    const game = await adminService.updateGame(request.authUser.id, id, input);
    return reply.send({ game });
  });

  app.delete("/games/:id", async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(idParamsSchema, request.params);
    await adminService.deleteGame(request.authUser.id, id);
    return reply.send({ deleted: true });
  });

  // ── Catégories ─────────────────────────────────────────────────
  app.get("/categories", async (_request, reply) => {
    const categories = await adminService.listCategoriesAdmin();
    return reply.send({ categories });
  });

  app.post("/categories", async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const input = parseBody(categorySchema, request.body);
    const category = await adminService.createCategory(request.authUser.id, input);
    return reply.status(201).send({ category });
  });

  app.put("/categories/:id", async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(idParamsSchema, request.params);
    const input = parseBody(categoryUpdateSchema, request.body);
    const category = await adminService.updateCategory(request.authUser.id, id, input);
    return reply.send({ category });
  });

  app.delete("/categories/:id", async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(idParamsSchema, request.params);
    await adminService.deleteCategory(request.authUser.id, id);
    return reply.send({ deleted: true });
  });

  // ── Sécurité ───────────────────────────────────────────────────
  app.get("/security-logs", async (request, reply) => {
    const query = parseQuery(logsQuerySchema, request.query);
    const logs = await adminService.listSecurityLogs(query.limit);
    return reply.send({ logs });
  });
};

export default adminRoutes;
