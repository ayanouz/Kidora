// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Catalogue de jeux
//   GET /api/games            → liste (recherche, filtres, tris)
//   GET /api/games/:slug      → détail + scores perso + top 5
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseParams, parseQuery } from "../../middleware/validate";
import { optionalAuth } from "../../plugins/auth.plugin";
import { getActiveProfile } from "../profiles/profiles.service";
import * as gamesService from "./games.service";

const listQuerySchema = z.object({
  search: z.string().trim().max(60).optional(),
  category: z.string().trim().max(40).optional(),
  age: z.coerce.number().int().min(3).max(120).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "easy", "medium", "hard"]).optional(),
  sort: z.enum(["popular", "newest", "score", "name"]).default("popular"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  favorites: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

const slugParamSchema = z.object({ slug: z.string().trim().min(2).max(60) });

const gamesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    { preHandler: optionalAuth },
    async (request, reply) => {
      const query = parseQuery(listQuerySchema, request.query);

      // Personnalisation si connecté (meilleur score, favoris…)
      let profileId: string | undefined;
      if (request.authUser) {
        try {
          const profile = await getActiveProfile(request.authUser.id);
          profileId = profile.id;
        } catch {
          profileId = undefined;
        }
      }

      const result = await gamesService.listGames({
        search: query.search,
        categorySlug: query.category,
        age: query.age,
        difficulty: query.difficulty,
        sort: query.sort,
        page: query.page,
        limit: query.limit,
        favoritesOnly: query.favorites,
        profileId,
      });
      return reply.send(result);
    },
  );

  app.get(
    "/:slug",
    { preHandler: optionalAuth },
    async (request, reply) => {
      const { slug } = parseParams(slugParamSchema, request.params);

      let profileId: string | undefined;
      if (request.authUser) {
        try {
          const profile = await getActiveProfile(request.authUser.id);
          profileId = profile.id;
        } catch {
          profileId = undefined;
        }
      }

      const result = await gamesService.getGameBySlug(slug, profileId);
      return reply.send(result);
    },
  );
};

export default gamesRoutes;
