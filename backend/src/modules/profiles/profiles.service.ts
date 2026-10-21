// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Profils joueurs
//  • Un utilisateur possède 1..N profils (parent → ses enfants)
//  • Toute action vérifie la PROPRIÉTÉ (anti-IDOR)
// ══════════════════════════════════════════════════════════════════

import type { AgeTier, Profile } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors";
import { hashPin } from "../../lib/crypto";
import { toPublicProfile, type PublicProfile } from "../../lib/serializers";

export const MAX_PROFILES_PER_USER = 6;
export const DEFAULT_AVATARS = [
  "🐼", "🦊", "🦁", "🐯", "🐸", "🐙", "🦄", "🐲", "🐧", "🦉", "🐨", "🐰",
  "🦖", "🐳", "🦋", "🌟", "🚀", "⚽",
];

// ── Lecture ────────────────────────────────────────────────────────

export async function listProfiles(userId: string): Promise<PublicProfile[]> {
  const profiles = await prisma.profile.findMany({
    where: { userId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return profiles.map(toPublicProfile);
}

/**
 * Profil actif de l'utilisateur : celui enregistré, sinon le premier.
 * Auto-réparateur : le champ est corrigé si le profil n'existe plus.
 */
export async function getActiveProfile(userId: string): Promise<Profile> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { activeProfileId: true },
  });

  if (user.activeProfileId) {
    const profile = await prisma.profile.findFirst({
      where: { id: user.activeProfileId, userId, isActive: true },
    });
    if (profile) return profile;
  }

  const fallback = await prisma.profile.findFirst({
    where: { userId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!fallback) throw new NotFoundError("Aucun profil trouvé pour ce compte.");

  await prisma.user.update({
    where: { id: userId },
    data: { activeProfileId: fallback.id },
  });
  return fallback;
}

/** Vérifie que l'utilisateur peut agir sur ce profil (propriétaire ou tuteur). */
export async function assertProfileAccess(profileId: string, userId: string): Promise<Profile> {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, isActive: true },
    include: { guardianLinks: true },
  });
  if (!profile) throw new NotFoundError("Profil introuvable.");

  const isOwner = profile.userId === userId;
  const isGuardian = profile.guardianLinks.some((link) => link.parentId === userId);
  if (!isOwner && !isGuardian) {
    throw new ForbiddenError("Tu n'as pas accès à ce profil.");
  }
  return profile;
}

// ── Création / mise à jour ─────────────────────────────────────────

export interface CreateProfileInput {
  displayName: string;
  avatar: string;
  ageTier: AgeTier;
  pin?: string;
}

export async function createProfile(
  userId: string,
  input: CreateProfileInput,
): Promise<PublicProfile> {
  const count = await prisma.profile.count({ where: { userId, isActive: true } });
  if (count >= MAX_PROFILES_PER_USER) {
    throw new ValidationError([
      { path: "profiles", message: `Maximum ${MAX_PROFILES_PER_USER} profils par compte.` },
    ]);
  }

  const profile = await prisma.$transaction(async (tx) => {
    const created = await tx.profile.create({
      data: {
        userId,
        displayName: input.displayName,
        avatar: input.avatar,
        ageTier: input.ageTier,
        pinHash: input.pin ? await hashPin(input.pin) : null,
      },
    });
    // Le parent qui crée un profil en devient tuteur automatiquement.
    await tx.parentChild.create({
      data: { parentId: userId, profileId: created.id },
    });
    return created;
  });

  return toPublicProfile(profile);
}

export interface UpdateProfileInput {
  displayName?: string;
  avatar?: string;
  ageTier?: AgeTier;
  leaderboardOptIn?: boolean;
  /** PIN de connexion enfant : null = supprimer, string 4-6 chiffres = définir. */
  pin?: string | null;
}

export async function updateProfile(
  profileId: string,
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicProfile> {
  await assertProfileAccess(profileId, userId);

  const data: Record<string, unknown> = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.avatar !== undefined) data.avatar = input.avatar;
  if (input.ageTier !== undefined) data.ageTier = input.ageTier;
  if (input.leaderboardOptIn !== undefined) data.leaderboardOptIn = input.leaderboardOptIn;
  if (input.pin !== undefined) {
    data.pinHash = input.pin === null ? null : await hashPin(input.pin);
  }

  const updated = await prisma.profile.update({ where: { id: profileId }, data });
  return toPublicProfile(updated);
}

export async function deleteProfile(profileId: string, userId: string): Promise<void> {
  const profile = await assertProfileAccess(profileId, userId);

  // Un utilisateur ne peut pas se retrouver sans aucun profil actif.
  const remaining = await prisma.profile.count({
    where: { userId: profile.userId, isActive: true, id: { not: profileId } },
  });
  if (remaining === 0) {
    throw new ValidationError([
      { path: "profile", message: "Impossible de supprimer le dernier profil." },
    ]);
  }

  // Suppression réelle : toutes les données de l'enfant sont effacées (cascade).
  await prisma.profile.delete({ where: { id: profileId } });

  // Si c'était le profil actif, on bascule sur un autre.
  const user = await prisma.user.findUnique({ where: { id: profile.userId } });
  if (user?.activeProfileId === profileId) {
    const next = await prisma.profile.findFirst({
      where: { userId: profile.userId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    await prisma.user.update({
      where: { id: profile.userId },
      data: { activeProfileId: next?.id ?? null },
    });
  }
}

export async function selectProfile(profileId: string, userId: string): Promise<PublicProfile> {
  const profile = await assertProfileAccess(profileId, userId);
  await prisma.user.update({
    where: { id: userId },
    data: { activeProfileId: profileId },
  });
  return toPublicProfile(profile);
}
