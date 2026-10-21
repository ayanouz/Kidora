// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Catégories
// ══════════════════════════════════════════════════════════════════

import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { toPublicCategory, type PublicCategory } from "../../lib/serializers";

export async function listCategories(): Promise<PublicCategory[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { games: { where: { isPublished: true } } } },
    },
  });
  return categories.map(toPublicCategory);
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      _count: { select: { games: { where: { isPublished: true } } } },
    },
  });
  if (!category || !category.isActive) {
    throw new NotFoundError("Catégorie introuvable.");
  }
  return toPublicCategory(category);
}
