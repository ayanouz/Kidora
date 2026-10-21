// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Sessions de jeu
//   POST /api/sessions/start        → démarrer une partie
//   POST /api/sessions/:id/finish   → terminer (validation anti-cheat)
//   POST /api/sessions/:id/abandon  → abandonner
//   GET  /api/sessions/resume/:slug → état de reprise (§40)
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseBody, parseParams } from "../../middleware/validate";
import { UnauthorizedError } from "../../lib/errors";
import { requireAuth } from "../../plugins/auth.plugin";
import * as sessionsService from "./sessions.service";

const startSchema = z.object({
  gameSlug: z.string().trim().min(2).max(60),
  difficulty: z
    .enum(["EASY", "MEDIUM", "HARD", "easy", "medium", "hard"])
    .default("easy"),
});

const finishSchema = z.object({
  score: z.number().int().min(0).max(1_000_000),
  durationMs: z.number().int().min(0).max(6 * 60 * 60 * 1000),
  isWin: z.boolean(),
  levelReached: z.number().int().min(0).max(1000).default(1),
  clientMeta: z.record(z.unknown()).optional(),
});

const paramsSchema = z.object({ id: z.string().min(10).max(40) });
const slugParamsSchema = z.object({ slug: z.string().trim().min(2).max(60) });

const sessionsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/start", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const input = parseBody(startSchema, request.body);
    const result = await sessionsService.startSession(request.authUser.id, input, {
      ip: request.ip,
    });
    return reply.status(201).send(result);
  });

  app.post("/:id/finish", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(paramsSchema, request.params);
    const input = parseBody(finishSchema, request.body);
    const result = await sessionsService.finishSession(request.authUser.id, id, input, {
      ip: request.ip,
      log: { warn: (m) => app.log.warn(m) },
    });
    return reply.send(result);
  });

  app.post("/:id/abandon", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(paramsSchema, request.params);
    await sessionsService.abandonSession(request.authUser.id, id);
    return reply.send({ abandoned: true });
  });

  app.get("/resume/:slug", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { slug } = parseParams(slugParamsSchema, request.params);
    const state = await sessionsService.getResumeState(request.authUser.id, slug);
    return reply.send(state);
  });
};

export default sessionsRoutes;
