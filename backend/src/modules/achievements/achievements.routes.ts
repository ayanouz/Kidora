// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Achievements
//   GET /api/achievements        → tous + débloqués (profil actif)
//   GET /api/achievements/recent → derniers déblocages
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { UnauthorizedError } from "../../lib/errors";
import { requireAuth } from "../../plugins/auth.plugin";
import * as achievementsService from "./achievements.service";

const achievementsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const result = await achievementsService.listAchievements(request.authUser.id);
    return reply.send(result);
  });

  app.get("/recent", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const recent = await achievementsService.listRecentUnlocks(request.authUser.id);
    return reply.send({ recent });
  });
};

export default achievementsRoutes;
