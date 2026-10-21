// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Espace Parent (§25)
//   GET /api/parent/children                → mes enfants + résumé
//   GET /api/parent/dashboard/:profileId    → dashboard détaillé
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseParams } from "../../middleware/validate";
import { UnauthorizedError } from "../../lib/errors";
import { requireParent } from "../../plugins/auth.plugin";
import * as parentService from "./parent.service";

const paramsSchema = z.object({ profileId: z.string().min(10).max(40) });

const parentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/children", { preHandler: requireParent }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const result = await parentService.listChildren(request.authUser.id);
    return reply.send(result);
  });

  app.get("/dashboard/:profileId", { preHandler: requireParent }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { profileId } = parseParams(paramsSchema, request.params);
    const dashboard = await parentService.getChildDashboard(request.authUser.id, profileId);
    return reply.send(dashboard);
  });
};

export default parentRoutes;
