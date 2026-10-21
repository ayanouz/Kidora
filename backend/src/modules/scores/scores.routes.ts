// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Scores
//   GET /api/scores        → scores récents du profil actif
//   GET /api/scores/best   → meilleurs scores par jeu
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseQuery } from "../../middleware/validate";
import { UnauthorizedError } from "../../lib/errors";
import { requireAuth } from "../../plugins/auth.plugin";
import * as scoresService from "./scores.service";

const listQuerySchema = z.object({
  gameId: z.string().min(10).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const bestQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

const scoresRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const query = parseQuery(listQuerySchema, request.query);
    const result = await scoresService.listRecentScores(request.authUser.id, {
      gameId: query.gameId,
      limit: query.limit,
      offset: query.offset,
    });
    return reply.send(result);
  });

  app.get("/best", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const query = parseQuery(bestQuerySchema, request.query);
    const best = await scoresService.listBestScores(request.authUser.id, query.limit);
    return reply.send({ best });
  });
};

export default scoresRoutes;
