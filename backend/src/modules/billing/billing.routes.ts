// ══════════════════════════════════════════════════════════════════
//  KIDORA — Routes Abonnements Premium
//   GET  /api/billing/plans    → catalogue public des formules
//   GET  /api/billing/me       → statut Premium + historique
//   POST /api/billing/checkout → Stripe Checkout ou activation démo
//   POST /api/billing/confirm  → vérification serveur après Stripe
//   POST /api/billing/cancel   → annulation en fin de période
//   POST /api/billing/resume   → annuler l'annulation
// ══════════════════════════════════════════════════════════════════

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseBody } from "../../middleware/validate";
import { UnauthorizedError } from "../../lib/errors";
import { requireAuth } from "../../plugins/auth.plugin";
import * as billingService from "./billing.service";

const checkoutSchema = z.object({
  planSlug: z.string().trim().min(2).max(40),
});

const confirmSchema = z.object({
  sessionId: z.string().trim().min(10).max(200),
});

const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/plans", async (_request, reply) => {
    const result = await billingService.listPlans();
    return reply.send(result);
  });

  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const result = await billingService.getBillingOverview(request.authUser.id);
    return reply.send(result);
  });

  app.post(
    "/checkout",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      if (!request.authUser) throw new UnauthorizedError();
      const { planSlug } = parseBody(checkoutSchema, request.body);
      const result = await billingService.createCheckout(request.authUser.id, planSlug);
      return reply.status(201).send(result);
    },
  );

  app.post(
    "/confirm",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      if (!request.authUser) throw new UnauthorizedError();
      const { sessionId } = parseBody(confirmSchema, request.body);
      const result = await billingService.confirmCheckout(request.authUser.id, sessionId);
      return reply.send(result);
    },
  );

  app.post("/cancel", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const result = await billingService.cancelSubscription(request.authUser.id);
    return reply.send(result);
  });

  app.post("/resume", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.authUser) throw new UnauthorizedError();
    const result = await billingService.resumeSubscription(request.authUser.id);
    return reply.send(result);
  });
};

export default billingRoutes;
