// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Abonnements Premium
//
//  • Catalogue de plans (mensuel, annuel, famille)
//  • Accès Premium : abonnement ACTIF + période valide, ou admin
//  • Mode démo : activation locale quand Stripe n'est pas configuré
//  • Stripe : Checkout Session + confirmation serveur (sans webhook)
//
//  Aucune donnée de carte ne transite par Kidora : le paiement est
//  hébergé par Stripe Checkout. Sans clé Stripe, le mode démo permet
//  de tester le parcours de bout en bout localement.
// ══════════════════════════════════════════════════════════════════

import {
  type BillingInterval,
  type Plan,
  PaymentStatus,
  BillingProvider,
  SubscriptionStatus,
  type Subscription,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env, isProd } from "../../config/env";
import {
  BillingUnavailableError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PremiumRequiredError,
} from "../../lib/errors";

// ─────────────────────────────────────────────────────────────────
//  Types publics
// ─────────────────────────────────────────────────────────────────

export interface PublicPlan {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  priceCents: number;
  currency: string;
  interval: BillingInterval;
  trialDays: number;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
}

export interface PublicSubscription {
  id: string;
  status: SubscriptionStatus;
  provider: BillingProvider;
  plan: PublicPlan;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

export interface PublicPayment {
  id: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  provider: BillingProvider;
  createdAt: string;
  plan: { slug: string; name: string };
}

export interface BillingContext {
  stripeEnabled: boolean;
  demoMode: boolean;
  currency: string;
  trialDays: number;
}

export interface BillingOverview {
  premium: boolean;
  premiumSource: "free" | "subscription" | "admin";
  subscription: PublicSubscription | null;
  payments: PublicPayment[];
  billing: BillingContext;
}

export type CheckoutResult =
  | { mode: "demo"; activated: true; overview: BillingOverview }
  | { mode: "stripe"; url: string; sessionId: string };

type SubscriptionWithPlan = Subscription & { plan: Plan };

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_SECRET_KEY.startsWith("sk_"));
}

export function isDemoBillingEnabled(): boolean {
  // Jamais de démo activée par défaut en production.
  return env.BILLING_DEMO ?? !isProd;
}

function billingContext(): BillingContext {
  return {
    stripeEnabled: isStripeConfigured(),
    demoMode: isDemoBillingEnabled(),
    currency: "EUR",
    trialDays: 7,
  };
}

function parseFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function toPublicPlan(plan: Plan): PublicPlan {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    tagline: plan.tagline,
    description: plan.description,
    priceCents: plan.priceCents,
    currency: plan.currency,
    interval: plan.interval,
    trialDays: plan.trialDays,
    features: parseFeatures(plan.features),
    isPopular: plan.isPopular,
    sortOrder: plan.sortOrder,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addInterval(date: Date, interval: BillingInterval): Date {
  const end = new Date(date);
  if (interval === "YEAR") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

function serializeSubscription(sub: SubscriptionWithPlan): PublicSubscription {
  return {
    id: sub.id,
    status: sub.status,
    provider: sub.provider,
    plan: toPublicPlan(sub.plan),
    currentPeriodStart: sub.currentPeriodStart.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    canceledAt: sub.canceledAt?.toISOString() ?? null,
  };
}

async function findPlan(slug: string): Promise<Plan> {
  const plan = await prisma.plan.findUnique({ where: { slug } });
  if (!plan || !plan.isActive) throw new NotFoundError("Cette formule n'existe pas (ou plus).");
  return plan;
}

async function getSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
  return prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
}

/**
 * Expire paresseusement un abonnement arrivé à échéance.
 * Évite d'avoir besoin d'un cron pour le contrôle d'accès.
 */
async function refreshSubscription(
  sub: SubscriptionWithPlan | null,
): Promise<SubscriptionWithPlan | null> {
  if (!sub) return null;
  const expired =
    sub.status === SubscriptionStatus.ACTIVE && sub.currentPeriodEnd.getTime() <= Date.now();
  if (!expired) return sub;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: SubscriptionStatus.EXPIRED },
  });
  return getSubscription(sub.userId);
}

// ─────────────────────────────────────────────────────────────────
//  Accès Premium
// ─────────────────────────────────────────────────────────────────

export async function isPremiumUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      subscription: {
        select: { id: true, status: true, currentPeriodEnd: true },
      },
    },
  });
  if (!user) return false;

  // Les administrateurs gardent toujours l'accès complet (support).
  if (user.role === "ADMIN") return true;

  const sub = user.subscription;
  if (!sub) return false;

  if (sub.status === SubscriptionStatus.ACTIVE && sub.currentPeriodEnd.getTime() > Date.now()) {
    return true;
  }

  if (sub.status === SubscriptionStatus.ACTIVE) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  }
  return false;
}

export async function assertPremiumAccess(userId: string, gameSlug: string): Promise<void> {
  if (await isPremiumUser(userId)) return;
  throw new PremiumRequiredError(
    "Ce jeu est réservé aux abonnés Premium. Découvre les formules pour y jouer !",
    { gameSlug },
  );
}

// ─────────────────────────────────────────────────────────────────
//  Catalogue & tableau de bord
// ─────────────────────────────────────────────────────────────────

export async function listPlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return {
    plans: plans.map(toPublicPlan),
    billing: billingContext(),
  };
}

export async function getBillingOverview(userId: string): Promise<BillingOverview> {
  const [user, rawSubscription, payments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    getSubscription(userId),
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { plan: { select: { slug: true, name: true } } },
    }),
  ]);
  if (!user) throw new NotFoundError("Compte introuvable.");

  const subscription = await refreshSubscription(rawSubscription);

  const activeSubscription =
    subscription &&
    subscription.status === SubscriptionStatus.ACTIVE &&
    subscription.currentPeriodEnd.getTime() > Date.now()
      ? subscription
      : null;

  const premium = user.role === "ADMIN" || Boolean(activeSubscription);
  const premiumSource =
    user.role === "ADMIN" ? "admin" : activeSubscription ? "subscription" : "free";

  return {
    premium,
    premiumSource,
    subscription: subscription ? serializeSubscription(subscription) : null,
    payments: payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      createdAt: payment.createdAt.toISOString(),
      plan: payment.plan,
    })),
    billing: billingContext(),
  };
}

// ─────────────────────────────────────────────────────────────────
//  Stripe (API REST, sans SDK)
// ─────────────────────────────────────────────────────────────────

interface StripeErrorBody {
  error?: { message?: string };
}

interface StripeSubscriptionPayload {
  id: string;
  current_period_end?: number;
}

interface StripeSession {
  id: string;
  status: string;
  url?: string | null;
  payment_status: string;
  amount_total: number | null;
  client_reference_id: string | null;
  customer_email?: string | null;
  subscription: string | StripeSubscriptionPayload | null;
  payment_intent?: string | null;
  metadata?: Record<string, string>;
}

async function stripeRequest<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: URLSearchParams },
): Promise<T> {
  if (!isStripeConfigured()) throw new BillingUnavailableError();

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init.body?.toString(),
  });

  const body = (await response.json().catch(() => ({}))) as T & StripeErrorBody;
  if (!response.ok) {
    // Le message Stripe peut contenir des détails techniques : on le
    // garde côté serveur, jamais dans la réponse client.
    // eslint-disable-next-line no-console
    console.error("[billing] Erreur Stripe :", response.status, body?.error?.message ?? "inconnue");
    throw new BillingUnavailableError();
  }
  return body;
}

function stripePriceFor(plan: Plan): string | undefined {
  const envPrices: Record<string, string | undefined> = {
    monthly: env.STRIPE_PRICE_MONTHLY,
    yearly: env.STRIPE_PRICE_YEARLY,
    family: env.STRIPE_PRICE_FAMILY,
  };
  return plan.stripePriceId ?? envPrices[plan.slug];
}

// ─────────────────────────────────────────────────────────────────
//  Mode démo
// ─────────────────────────────────────────────────────────────────

async function activateDemoSubscription(
  userId: string,
  plan: Plan,
): Promise<BillingOverview> {
  if (!isDemoBillingEnabled()) {
    throw new BillingUnavailableError(
      "Le paiement n'est pas configuré sur ce serveur. Contacte l'administrateur.",
    );
  }

  const existing = await getSubscription(userId);
  const hadActive =
    existing?.status === SubscriptionStatus.ACTIVE &&
    existing.currentPeriodEnd.getTime() > Date.now();

  // Idempotence : même formule déjà active → aucun nouveau paiement.
  if (hadActive && existing.planId === plan.id && !existing.cancelAtPeriodEnd) {
    return getBillingOverview(userId);
  }

  const now = new Date();
  const trialDays = hadActive ? 0 : plan.trialDays;
  const periodEnd =
    trialDays > 0 ? addDays(now, trialDays) : addInterval(now, plan.interval);

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: {
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      provider: BillingProvider.DEMO,
      providerSubscriptionId: null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
    create: {
      userId,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      provider: BillingProvider.DEMO,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  await prisma.payment.create({
    data: {
      userId,
      planId: plan.id,
      subscriptionId: subscription.id,
      amountCents: trialDays > 0 ? 0 : plan.priceCents,
      currency: plan.currency,
      status: PaymentStatus.SUCCEEDED,
      provider: BillingProvider.DEMO,
    },
  });

  return getBillingOverview(userId);
}

// ─────────────────────────────────────────────────────────────────
//  Checkout / confirmation / annulation
// ─────────────────────────────────────────────────────────────────

export async function createCheckout(userId: string, planSlug: string): Promise<CheckoutResult> {
  const plan = await findPlan(planSlug);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      subscription: {
        select: { status: true, currentPeriodEnd: true, planId: true, providerSubscriptionId: true },
      },
    },
  });
  if (!user) throw new NotFoundError("Compte introuvable.");

  const hasActiveStripeSubscription =
    user.subscription?.status === SubscriptionStatus.ACTIVE &&
    user.subscription.currentPeriodEnd.getTime() > Date.now() &&
    Boolean(user.subscription.providerSubscriptionId);

  if (!isStripeConfigured()) {
    if (isDemoBillingEnabled()) {
      const overview = await activateDemoSubscription(userId, plan);
      return { mode: "demo", activated: true, overview };
    }
    throw new BillingUnavailableError(
      "Le paiement n'est pas configuré sur ce serveur. Contacte l'administrateur.",
    );
  }

  // Évite un double abonnement Stripe : la gestion d'un changement de
  // formule se fait après annulation (ou via le portail Stripe).
  if (hasActiveStripeSubscription) {
    throw new ConflictError(
      "CONFLICT",
      "Tu as déjà un abonnement actif. Annule-le avant de choisir une autre formule.",
    );
  }

  const priceId = stripePriceFor(plan);
  if (!priceId) {
    throw new BillingUnavailableError(
      "Cette formule n'est pas encore reliée à Stripe. Réessaie plus tard.",
    );
  }

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", `${env.FRONTEND_URL}/premium?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${env.FRONTEND_URL}/premium?checkout=cancel`);
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", userId);
  params.set("metadata[userId]", userId);
  params.set("metadata[planSlug]", plan.slug);
  params.set("subscription_data[metadata][userId]", userId);
  params.set("subscription_data[metadata][planSlug]", plan.slug);
  params.set("allow_promotion_codes", "true");
  params.set("locale", "fr");
  if (plan.trialDays > 0) {
    params.set("subscription_data[trial_period_days]", String(plan.trialDays));
  }
  if (user.email) params.set("customer_email", user.email);

  const session = await stripeRequest<StripeSession>("/checkout/sessions", {
    method: "POST",
    body: params,
  });
  if (!session.url) throw new BillingUnavailableError();

  return { mode: "stripe", url: session.url, sessionId: session.id };
}

export async function confirmCheckout(
  userId: string,
  sessionId: string,
): Promise<BillingOverview> {
  if (!isStripeConfigured()) {
    throw new BillingUnavailableError(
      "La confirmation Stripe n'est pas disponible : aucun paiement n'a été effectué.",
    );
  }

  const session = await stripeRequest<StripeSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
    { method: "GET" },
  );

  const ownerId = session.metadata?.userId ?? session.client_reference_id;
  if (ownerId !== userId) {
    throw new ForbiddenError("Cette session de paiement ne t'appartient pas.");
  }
  if  (session.status !== "complete") {
    throw new ConflictError("CONFLICT", "Le paiement n'est pas encore terminé.");
  }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    throw new ConflictError("CONFLICT", "Le paiement n'a pas été confirmé par Stripe.");
  }

  const planSlug = session.metadata?.planSlug;
  if (!planSlug) throw new NotFoundError("Formule introuvable pour cette session.");
  const plan = await findPlan(planSlug);

  const stripeSubscription =
    typeof session.subscription === "object" && session.subscription !== null
      ? session.subscription
      : null;
  const providerSubscriptionId =
    stripeSubscription?.id ??
    (typeof session.subscription === "string" ? session.subscription : null);

  const now = new Date();
  const stripePeriodEnd = stripeSubscription?.current_period_end
    ? new Date(stripeSubscription.current_period_end * 1000)
    : null;
  const periodEnd =
    stripePeriodEnd && stripePeriodEnd.getTime() > now.getTime()
      ? stripePeriodEnd
      : plan.trialDays > 0
        ? addDays(now, plan.trialDays)
        : addInterval(now, plan.interval);

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: {
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      provider: BillingProvider.STRIPE,
      providerSubscriptionId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
    create: {
      userId,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      provider: BillingProvider.STRIPE,
      providerSubscriptionId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  // Idempotence : la confirmation peut être rejouée (retour navigateur).
  const paymentId = session.payment_intent ?? session.id;
  const existingPayment = await prisma.payment.findUnique({
    where: { providerPaymentId: paymentId },
    select: { id: true },
  });
  if (!existingPayment) {
    await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        subscriptionId: subscription.id,
        amountCents: session.amount_total ?? 0,
        currency: plan.currency,
        status: PaymentStatus.SUCCEEDED,
        provider: BillingProvider.STRIPE,
        providerPaymentId: paymentId,
      },
    });
  }

  return getBillingOverview(userId);
}

async function setStripeCancelAtPeriodEnd(
  subscription: SubscriptionWithPlan,
  cancel: boolean,
): Promise<void> {
  if (!subscription.providerSubscriptionId) {
    throw new BillingUnavailableError("Abonnement Stripe introuvable.");
  }
  const params = new URLSearchParams();
  params.set("cancel_at_period_end", cancel ? "true" : "false");
  await stripeRequest<StripeSubscriptionPayload>(
    `/subscriptions/${encodeURIComponent(subscription.providerSubscriptionId)}`,
    { method: "POST", body: params },
  );
}

export async function cancelSubscription(userId: string): Promise<BillingOverview> {
  const subscription = await getSubscription(userId);
  if (
    !subscription ||
    subscription.status !== SubscriptionStatus.ACTIVE ||
    subscription.currentPeriodEnd.getTime() <= Date.now()
  ) {
    throw new NotFoundError("Aucun abonnement actif à annuler.");
  }
  if (subscription.cancelAtPeriodEnd) return getBillingOverview(userId);

  if (subscription.provider === BillingProvider.STRIPE) {
    await setStripeCancelAtPeriodEnd(subscription, true);
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
  });
  return getBillingOverview(userId);
}

export async function resumeSubscription(userId: string): Promise<BillingOverview> {
  const subscription = await getSubscription(userId);
  if (
    !subscription ||
    subscription.status !== SubscriptionStatus.ACTIVE ||
    !subscription.cancelAtPeriodEnd
  ) {
    throw new NotFoundError("Aucun abonnement en cours d'annulation.");
  }

  if (subscription.provider === BillingProvider.STRIPE) {
    await setStripeCancelAtPeriodEnd(subscription, false);
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: false, canceledAt: null },
  });
  return getBillingOverview(userId);
}
