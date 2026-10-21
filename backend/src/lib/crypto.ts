// ══════════════════════════════════════════════════════════════════
//  KIDORA — Primitives cryptographiques
//  • Mots de passe : bcrypt cost 12 (jamais stockés en clair)
//  • Tokens opaques : 48 octets aléatoires, stockés hachés (SHA-256)
//  • IP : hachées avec un sel serveur (privacy-first, jamais en clair)
// ══════════════════════════════════════════════════════════════════

import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Token aléatoire opaque (refresh token, lien de reset…). */
export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

/** Empreinte SHA-256 (stockage des tokens côté serveur). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Comparaison à temps constant (protection timing attacks). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Hachage d'IP salé — permet la détection d'abus sans stocker l'IP. */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return sha256(`${env.SESSION_SECRET}:${ip}`).slice(0, 32);
}

/** PIN enfant : hash léger (4-6 chiffres). */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
