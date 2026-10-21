// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Progression
//   GET /api/progress → vue complète du profil actif (§22)
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { UnauthorizedError } from "../../lib/errors";
import { requireAuth } from "../../plugins/auth.plugin";
import * as progressService from "./progress.service";

const progressRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const overview = await progressService.getProgressOverview(request.authUser.id);
    return reply.send(overview);
  });
};

export default progressRoutes;
