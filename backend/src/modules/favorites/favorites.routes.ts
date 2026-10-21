// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Favoris (§39)
//   GET    /api/favorites            → mes favoris
//   POST   /api/favorites/:gameId    → ajouter
//   DELETE /api/favorites/:gameId    → retirer
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseParams } from "../../middleware/validate";
import { UnauthorizedError } from "../../lib/errors";
import { requireAuth } from "../../plugins/auth.plugin";
import * as favoritesService from "./favorites.service";

const paramsSchema = z.object({ gameId: z.string().min(10).max(40) });

const favoritesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const result = await favoritesService.listFavorites(request.authUser.id);
    return reply.send(result);
  });

  app.post("/:gameId", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { gameId } = parseParams(paramsSchema, request.params);
    const result = await favoritesService.addFavorite(request.authUser.id, gameId);
    return reply.send(result);
  });

  app.delete("/:gameId", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { gameId } = parseParams(paramsSchema, request.params);
    const result = await favoritesService.removeFavorite(request.authUser.id, gameId);
    return reply.send(result);
  });
};

export default favoritesRoutes;
