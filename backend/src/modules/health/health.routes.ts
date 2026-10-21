// ══════════════════════════════════════════════════════════════════
//  KIDORA — Health check (§63) + Sitemap dynamique (§36)
//  GET /api/health     → { status, database, uptime, version }
//  GET /api/sitemap.xml → sitemap SEO (jeux publiés + catégories)
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { checkDatabase } from "../../lib/prisma";
import { env } from "../../config/env";
import { getSitemapEntries } from "../games/games.service";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const healthRoutes: FastifyPluginAsync = async (app) => {
  const startedAt = Date.now();

  app.get("/health", async (_request, reply) => {
    const databaseOk = await checkDatabase();
    const healthy = databaseOk;

    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      database: databaseOk ? "connected" : "unreachable",
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/sitemap.xml", async (_request, reply) => {
    const base = env.FRONTEND_URL.replace(/\/$/, "");
    const entries = await getSitemapEntries();

    const urls = entries
      .map(
        (e) =>
          `  <url>\n    <loc>${escapeXml(`${base}${e.loc}`)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

    return reply
      .header("Content-Type", "application/xml; charset=utf-8")
      .header("Cache-Control", "public, max-age=3600")
      .send(xml);
  });
};

export default healthRoutes;
