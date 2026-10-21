// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Abonnements Premium
//  Le serveur reste seul décisionnaire : le client ne fait qu'afficher
//  l'état renvoyé par /api/billing et déclencher les parcours.
// ══════════════════════════════════════════════════════════════════

import { api } from "./api";
import type {
  BillingOverview,
  BillingPlansResponse,
  CheckoutResponse,
} from "../types";

export const billingService = {
  plans(signal?: AbortSignal): Promise<BillingPlansResponse> {
    return api<BillingPlansResponse>("/billing/plans", { signal });
  },

  me(signal?: AbortSignal): Promise<BillingOverview> {
    return api<BillingOverview>("/billing/me", { signal });
  },

  checkout(planSlug: string): Promise<CheckoutResponse> {
    return api<CheckoutResponse>("/billing/checkout", {
      method: "POST",
      body: { planSlug },
    });
  },

  confirm(sessionId: string): Promise<BillingOverview> {
    return api<BillingOverview>("/billing/confirm", {
      method: "POST",
      body: { sessionId },
    });
  },

  cancel(): Promise<BillingOverview> {
    return api<BillingOverview>("/billing/cancel", { method: "POST", body: {} });
  },

  resume(): Promise<BillingOverview> {
    return api<BillingOverview>("/billing/resume", { method: "POST", body: {} });
  },
};
