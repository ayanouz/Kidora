// ══════════════════════════════════════════════════════════════════
//  KIDORA — Client Prisma (singleton)
// ══════════════════════════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";
import { isProd } from "../config/env";

/**
 * En développement, le hot-reload de tsx watch peut recharger le module :
 * on conserve l'instance sur globalThis pour éviter d'ouvrir des dizaines
 * de pools de connexions.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ["error", "warn"] : ["error", "warn"],
  });

if (!isProd) globalForPrisma.prisma = prisma;

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

/** Health check base de données. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
