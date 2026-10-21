// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Catégories
//   GET /api/categories        → liste + nombre de jeux publiés
//   GET /api/categories/:slug  → détail d'une catégorie
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseParams } from "../../middleware/validate";
import * as categoriesService from "./categories.service";

const slugParamSchema = z.object({ slug: z.string().trim().min(2).max(60) });

const categoriesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_request, reply) => {
    const categories = await categoriesService.listCategories();
    return reply.send({ categories });
  });

  app.get("/:slug", async (request, reply) => {
    const { slug } = parseParams(slugParamSchema, request.params);
    const category = await categoriesService.getCategoryBySlug(slug);
    return reply.send({ category });
  });
};

export default categoriesRoutes;
