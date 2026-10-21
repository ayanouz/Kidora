// ══════════════════════════════════════════════════════════════════
//  KIDORA — Point d'entrée du serveur
//  • Démarrage HTTP (derrière Nginx en production)
//  • Arrêt propre (SIGINT / SIGTERM)
//  • Tâches de maintenance périodiques (tokens expirés, vieux logs)
// ══════════════════════════════════════════════════════════════════

import "./load-env";
import { buildApp } from "./app";
import { env } from "./config/env";
import { disconnectPrisma, prisma } from "./lib/prisma";
import { purgeOldSecurityLogs } from "./services/security-log.service";

const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000; // toutes les 6 heures

async function runMaintenance(log: { info: (m: string) => void; warn: (m: string) => void }) {
  try {
    // 1. Tokens expirés ou révoqués depuis longtemps
    const tokens = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    // 2. Demandes de reset expirées
    const resets = await prisma.passwordReset.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    // 3. Sessions de jeu restées ACTIVE (jeu jamais terminé) > 24h
    const stale = await prisma.gameSession.updateMany({
      where: {
        status: "ACTIVE",
        startedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      data: { status: "ABANDONED" },
    });
    // 4. Vieux logs de sécurité (rétention 180 jours)
    const logs = await purgeOldSecurityLogs(180);

    log.info(
      `[maintenance] tokens:${tokens.count} resets:${resets.count} sessions abandonnées:${stale.count} logs purgés:${logs}`,
    );
  } catch (err) {
    log.warn(`[maintenance] échec : ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  const app = await buildApp();

  // Maintenance au démarrage puis périodiquement
  void runMaintenance(app.log);
  const maintenanceTimer = setInterval(() => {
    void runMaintenance(app.log);
  }, MAINTENANCE_INTERVAL_MS);
  maintenanceTimer.unref();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`🚀 Kidora API prête — ${env.API_URL} (env: ${env.NODE_ENV})`);
  } catch (err) {
    app.log.error(err, "Impossible de démarrer le serveur");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Signal ${signal} reçu — arrêt propre…`);
    clearInterval(maintenanceTimer);
    try {
      await app.close();
      await disconnectPrisma();
      process.exit(0);
    } catch (err) {
      app.log.error(err, "Erreur pendant l'arrêt");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
