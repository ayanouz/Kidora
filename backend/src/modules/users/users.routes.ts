// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Compte utilisateur
//   GET    /api/users/me           → compte + profils + stats
//   PUT    /api/users/me           → paramètres du compte
//   PUT    /api/users/me/password  → changer le mot de passe
//   POST   /api/users/me/export    → export RGPD (fichier JSON)
//   DELETE /api/users/me           → suppression du compte
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseBody } from "../../middleware/validate";
import { UnauthorizedError } from "../../lib/errors";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  requireAuth,
} from "../../plugins/auth.plugin";
import * as usersService from "./users.service";

const updateAccountSchema = z.object({
  displayName: z.string().trim().min(2).max(30, "Pseudo trop long (30 max).").optional(),
  avatar: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .refine((v) => !/[<>]/.test(v), "Avatar invalide.")
    .optional(),
  leaderboardOptIn: z.boolean().optional(),
});

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(100)
  .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre.")
  .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre.");

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: passwordSchema,
});

const deleteAccountSchema = z.object({
  password: z.string().min(1).max(100),
  confirm: z.literal("SUPPRIMER", {
    errorMap: () => ({ message: 'Écris exactement "SUPPRIMER" pour confirmer.' }),
  }),
});

const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const { prisma } = await import("../../lib/prisma");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.authUser.id } });
    const payload = await usersService.getAccount(user);
    return reply.send(payload);
  });

  app.put("/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const input = parseBody(updateAccountSchema, request.body);
    const user = await usersService.updateAccount(request.authUser.id, input);
    return reply.send({ user });
  });

  app.put("/me/password", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const input = parseBody(changePasswordSchema, request.body);
    const currentHash = usersService.hashRefreshToken(request.cookies[REFRESH_COOKIE]);
    await usersService.changePassword(
      request.authUser.id,
      input.currentPassword,
      input.newPassword,
      currentHash,
    );
    return reply.send({ updated: true });
  });

  app.post("/me/export", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const data = await usersService.exportUserData(request.authUser.id);
    return reply
      .header("Content-Type", "application/json")
      .header(
        "Content-Disposition",
        `attachment; filename="kidora-export-${Date.now()}.json"`,
      )
      .send(data);
  });

  app.delete("/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const input = parseBody(deleteAccountSchema, request.body);
    await usersService.deleteAccount(request.authUser.id, input.password);
    clearAuthCookies(reply);
    return reply.send({ deleted: true });
  });
};

export default usersRoutes;
