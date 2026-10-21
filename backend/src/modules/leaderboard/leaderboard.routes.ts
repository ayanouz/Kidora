// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Classement (§38)
//   GET /api/leaderboard?period=day|week|month|all&limit=20
//   Aucune donnée personnelle exposée (pseudonymes uniquement).
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseQuery } from "../../middleware/validate";
import { optionalAuth } from "../../plugins/auth.plugin";
import * as leaderboardService from "./leaderboard.service";

const querySchema = z.object({
  period: z.enum(["day", "week", "month", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: optionalAuth }, async (request, reply) => {
    const query = parseQuery(querySchema, request.query);
    const result = await leaderboardService.getLeaderboard(
      query.period,
      query.limit,
      request.authUser?.id,
    );
    return reply.send(result);
  });
};

export default leaderboardRoutes;
