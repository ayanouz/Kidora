// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Favoris (§39)
// ══════════════════════════════════════════════════════════════════

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { getActiveProfile } from "../profiles/profiles.service";
import { toPublicGame, type GameWithCategory } from "../../lib/serializers";

export async function listFavorites(authUserId: string) {
  const profile = await getActiveProfile(authUserId);

  const favorites = await prisma.favorite.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    include: { game: { include: { category: true } } },
  });

  return {
    favorites: favorites.map((f) => ({
      createdAt: f.createdAt.toISOString(),
      game: toPublicGame(f.game as GameWithCategory),
    })),
  };
}

export async function addFavorite(authUserId: string, gameId: string) {
  const profile = await getActiveProfile(authUserId);

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || !game.isPublished) throw new NotFoundError("Jeu introuvable.");

  await prisma.favorite.upsert({
    where: { profileId_gameId: { profileId: profile.id, gameId } },
    update: {},
    create: { profileId: profile.id, gameId },
  });

  return { favorite: true, gameId };
}

export async function removeFavorite(authUserId: string, gameId: string) {
  const profile = await getActiveProfile(authUserId);
  await prisma.favorite.deleteMany({
    where: { profileId: profile.id, gameId },
  });
  return { favorite: false, gameId };
}
