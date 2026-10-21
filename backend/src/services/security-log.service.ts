// ══════════════════════════════════════════════════════════════════
//  KIDORA — Journal de sécurité (security_logs)
//  Best-effort : ne doit JAMAIS faire échouer une requête.
//  Ne contient que des métadonnées — jamais de secrets.
// ══════════════════════════════════════════════════════════════════

import type { Prisma, SecurityLogType } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface SecurityEvent {
  type: SecurityLogType;
  userId?: string | null;
  ipHash?: string | null;
  detail?: Prisma.InputJsonValue;
}

export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        type: event.type,
        userId: event.userId ?? null,
        ipHash: event.ipHash ?? null,
        detail: event.detail ?? {},
      },
    });
  } catch {
    // Silencieux : un log de sécurité ne doit jamais casser le flux principal.
  }
}

/** Nettoie les logs de sécurité plus vieux que N jours (rétention RGPD). */
export async function purgeOldSecurityLogs(days = 180): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.securityLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
