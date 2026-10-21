// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Profils
//   GET    /api/profile          → profil actif
//   PUT    /api/profile          → modifier le profil actif
//   GET    /api/profiles         → tous mes profils
//   POST   /api/profiles         → créer un profil enfant
//   PUT    /api/profiles/:id     → modifier un profil
//   DELETE /api/profiles/:id     → supprimer un profil
//   POST   /api/profiles/:id/select → changer de profil actif
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseBody, parseParams } from "../../middleware/validate";
import { UnauthorizedError } from "../../lib/errors";
import { requireAuth } from "../../plugins/auth.plugin";
import { toPublicProfile } from "../../lib/serializers";
import * as profilesService from "./profiles.service";

const avatarSchema = z
  .string()
  .trim()
  .min(1)
  .max(8, "Avatar invalide.")
  .refine((v) => !/[<>]/.test(v), "Avatar invalide.");

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Le pseudo est requis.")
  .max(20, "Le pseudo est trop long (20 caractères max).");

const ageTierSchema = z.enum(["AGE_3_5", "AGE_6_8", "AGE_9_12", "AGE_13_PLUS"]);

const pinSchema = z
  .string()
  .regex(/^\d{4,6}$/, "Le code doit contenir 4 à 6 chiffres.");

const createProfileSchema = z.object({
  displayName: displayNameSchema,
  avatar: avatarSchema.default("🐼"),
  ageTier: ageTierSchema,
  pin: pinSchema.optional(),
});

const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  avatar: avatarSchema.optional(),
  ageTier: ageTierSchema.optional(),
  leaderboardOptIn: z.boolean().optional(),
  pin: pinSchema.nullable().optional(),
});

const idParamSchema = z.object({ id: z.string().min(10).max(40) });

const profilesRoutes: FastifyPluginAsync = async (app) => {
  // ── Profil actif ───────────────────────────────────────────────
  app.get("/profile", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const profile = await profilesService.getActiveProfile(request.authUser.id);
    return reply.send({ profile: toPublicProfile(profile) });
  });

  app.put("/profile", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const input = parseBody(updateProfileSchema, request.body);
    const active = await profilesService.getActiveProfile(request.authUser.id);
    const profile = await profilesService.updateProfile(active.id, request.authUser.id, input);
    return reply.send({ profile });
  });

  // ── Liste / CRUD profils ───────────────────────────────────────
  app.get("/profiles", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const profiles = await profilesService.listProfiles(request.authUser.id);
    return reply.send({ profiles });
  });

  app.post("/profiles", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const input = parseBody(createProfileSchema, request.body);
    const profile = await profilesService.createProfile(request.authUser.id, input);
    return reply.status(201).send({ profile });
  });

  app.put("/profiles/:id", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(idParamSchema, request.params);
    const input = parseBody(updateProfileSchema, request.body);
    const profile = await profilesService.updateProfile(id, request.authUser.id, input);
    return reply.send({ profile });
  });

  app.delete("/profiles/:id", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(idParamSchema, request.params);
    await profilesService.deleteProfile(id, request.authUser.id);
    return reply.send({ deleted: true });
  });

  app.post("/profiles/:id/select", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { id } = parseParams(idParamSchema, request.params);
    const profile = await profilesService.selectProfile(id, request.authUser.id);
    return reply.send({ profile });
  });
};

export default profilesRoutes;
