// ══════════════════════════════════════════════════════════════════
//  KIDORA — Page Premium & tarifs
//  • Vitrine des formules (publique)
//  • Statut de l'abonnement, annulation / reprise
//  • Parcours Stripe Checkout, avec repli démo explicite
//  • Historique des paiements et FAQ
// ══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ErrorState, Spinner } from "../components/ui/Feedback";
import { ROUTES } from "../config";
import { useAsync, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { ApiError } from "../services/api";
import { billingService } from "../services/billing.service";
import { useAuthStore } from "../store/auth.store";
import type { BillingOverview, BillingPlan, BillingPlansResponse } from "../types";
import { cn } from "../utils/cn";

function formatPrice(cents: number, currency: string, lang: string): string {
  try {
    return new Intl.NumberFormat(lang, {
      style: "currency",
      currency,
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function formatDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function PlanCard({
  plan,
  demoMode,
  stripeEnabled,
  busy,
  isCurrent,
  onChoose,
}: {
  plan: BillingPlan;
  demoMode: boolean;
  stripeEnabled: boolean;
  busy: boolean;
  isCurrent: boolean;
  onChoose: () => void;
}) {
  const { t, lang } = useI18n();

  const translated = (field: string, fallback: string): string => {
    const key = `premium.plans.${plan.slug}.${field}`;
    const value = t(key);
    return value === key ? fallback : value;
  };

  const features = [1, 2, 3, 4]
    .map((index) => {
      const value = t(`premium.plans.${plan.slug}.f${index}`);
      return value === `premium.plans.${plan.slug}.f${index}`
        ? plan.features[index - 1]
        : value;
    })
    .filter((value): value is string => Boolean(value));

  const available = stripeEnabled || demoMode;
  const intervalLabel = plan.interval === "YEAR" ? t("premium.perYear") : t("premium.perMonth");

  return (
    <article
      className={cn(
        "card relative flex flex-col gap-4 p-6",
        plan.isPopular && "border-2 border-primary shadow-soft",
      )}
    >
      {plan.isPopular && (
        <span className="absolute -top-3 start-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-soft rtl:translate-x-1/2">
          👑 {t("premium.popular")}
        </span>
      )}

      <header>
        <h3 className="text-xl text-primary-dark">{translated("name", plan.name)}</h3>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          {translated("tagline", plan.tagline)}
        </p>
      </header>

      <p className="flex flex-wrap items-baseline gap-1">
        <span className="text-3xl font-black tabular-nums text-ink">
          {formatPrice(plan.priceCents, plan.currency, lang)}
        </span>
        <span className="text-sm font-semibold text-ink-faint">{intervalLabel}</span>
      </p>

      {plan.trialDays > 0 && (
        <p className="w-fit rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
          🎁 {t("premium.trial", { days: plan.trialDays })}
        </p>
      )}

      <ul className="flex flex-col gap-2 text-sm font-semibold text-ink-soft">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span aria-hidden="true" className="text-success">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onChoose}
        disabled={busy || isCurrent || !available}
        className={cn(
          "btn mt-auto w-full",
          plan.isPopular ? "btn-primary" : "btn-outline",
          (isCurrent || !available) && "opacity-60",
        )}
      >
        {isCurrent
          ? `✓ ${t("premium.currentPlan")}`
          : busy
            ? t("premium.processing")
            : demoMode && !stripeEnabled
              ? t("premium.demoButton")
              : t("premium.choose")}
      </button>
    </article>
  );
}

export function Premium() {
  const { t, lang } = useI18n();
  usePageTitle(t("premium.title"), t("premium.subtitle"));

  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const catalog = useAsync<BillingPlansResponse>(
    async (signal) => billingService.plans(signal),
    [],
  );

  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Charge le statut Premium dès qu'un utilisateur est connecté.
  useEffect(() => {
    if (status !== "authenticated") {
      setOverview(null);
      return;
    }
    let cancelled = false;
    setOverviewLoading(true);
    billingService
      .me()
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : t("errors.generic"),
        );
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, t]);

  // Retour depuis Stripe Checkout : confirmation côté serveur.
  const sessionId = searchParams.get("session_id");
  const confirmedRef = useRef(false);
  useEffect(() => {
    if (status !== "authenticated" || !sessionId || confirmedRef.current) return;
    confirmedRef.current = true;
    setConfirming(true);
    setError(null);
    billingService
      .confirm(sessionId)
      .then((result) => {
        setOverview(result);
        setMessage(t("premium.success"));
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : t("premium.confirmError"));
      })
      .finally(() => {
        setConfirming(false);
        navigate(ROUTES.premium, { replace: true });
      });
  }, [status, sessionId, navigate, t]);

  const choosePlan = async (plan: BillingPlan) => {
    setError(null);
    setMessage(null);
    if (status !== "authenticated") {
      navigate(ROUTES.login, { state: { from: ROUTES.premium } });
      return;
    }
    setBusyPlan(plan.slug);
    try {
      const result = await billingService.checkout(plan.slug);
      if (result.mode === "stripe") {
        setMessage(t("premium.stripeRedirect"));
        window.location.assign(result.url);
        return;
      }
      setOverview(result.overview);
      setMessage(t("premium.demoDone"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.generic"));
    } finally {
      setBusyPlan(null);
    }
  };

  const cancelSubscription = async () => {
    if (!window.confirm(t("premium.cancelConfirm"))) return;
    setError(null);
    setMessage(null);
    setCanceling(true);
    try {
      const result = await billingService.cancel();
      setOverview(result);
      setMessage(t("premium.cancelDone"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.generic"));
    } finally {
      setCanceling(false);
    }
  };

  const resumeSubscription = async () => {
    setError(null);
    setMessage(null);
    setCanceling(true);
    try {
      const result = await billingService.resume();
      setOverview(result);
      setMessage(t("premium.resumeDone"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.generic"));
    } finally {
      setCanceling(false);
    }
  };

  if (catalog.loading) return <Spinner className="py-24" label={t("common.loading")} />;
  if (catalog.error || !catalog.data) {
    return <ErrorState onRetry={catalog.reload} />;
  }

  const plans = [...catalog.data.plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const billing = overview?.billing ?? catalog.data.billing;
  const premium = overview?.premium ?? false;
  const isAdmin = overview?.premiumSource === "admin";
  const subscription = overview?.subscription;
  const activePlanSlug =
    subscription && subscription.status === "ACTIVE" ? subscription.plan.slug : null;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Héros ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white shadow-soft sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="chip w-fit bg-white/20 text-white">👑 {t("premium.badge")}</p>
          <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">{t("premium.title")}</h1>
          <p className="mt-3 text-base font-semibold text-white/90 sm:text-lg">
            {t("premium.subtitle")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
            <span className="chip bg-white/20 text-white">🔒 {t("premium.secure")}</span>
            <span className="chip bg-white/20 text-white">🚫📢 {t("premium.noCommitment")}</span>
          </div>
        </div>
        <span
          className="pointer-events-none absolute -end-6 -top-8 text-[11rem] opacity-20"
          aria-hidden="true"
        >
          👑
        </span>
      </section>

      {/* ── Mode démo ─────────────────────────────────────────── */}
      {billing.demoMode && (
        <div className="rounded-card border-2 border-dashed border-warning/40 bg-warning-soft px-4 py-3 text-sm font-semibold text-ink">
          🧪 {t("premium.demoNotice")}
        </div>
      )}

      {confirming && (
        <div className="flex items-center gap-3 rounded-card bg-primary-soft px-4 py-3 font-semibold text-primary-dark">
          <Spinner className="py-0" /> {t("premium.processing")}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-card bg-success-soft px-4 py-3 font-semibold text-success"
        >
          🎉 {message}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-card bg-danger-soft px-4 py-3 font-semibold text-danger"
        >
          🙈 {error}
        </div>
      )}

      {/* ── Statut de l'abonnement ────────────────────────────── */}
      {status === "authenticated" && overviewLoading && !overview && (
        <div className="card flex items-center gap-3 p-5 text-ink-soft">
          <Spinner className="py-0" /> {t("common.loading")}
        </div>
      )}

      {status === "guest" && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="font-semibold text-ink-soft">🔐 {t("premium.loginToSubscribe")}</p>
          <Link
            to={ROUTES.login}
            state={{ from: ROUTES.premium }}
            className="btn btn-primary btn-sm"
          >
            {t("nav.login")}
          </Link>
        </div>
      )}

      {status === "authenticated" && overview && (premium || subscription) && (
        <section
          className="card flex flex-col gap-4 border-2 border-success/25 p-6"
          aria-labelledby="premium-status"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="premium-status" className="text-2xl">
                👑 {t("premium.currentPlan")}
              </h2>
              {subscription ? (
                <p className="mt-1 text-lg font-bold text-primary-dark">
                  {t(`premium.plans.${subscription.plan.slug}.name`)}
                </p>
              ) : (
                <p className="mt-1 text-lg font-bold text-primary-dark">
                  {isAdmin ? t("premium.adminAccess") : t("premium.badge")}
                </p>
              )}
              {subscription && (
                <p
                  className={cn(
                    "mt-1 text-sm font-semibold",
                    subscription.cancelAtPeriodEnd ? "text-warning" : "text-success",
                  )}
                >
                  {subscription.cancelAtPeriodEnd
                    ? t("premium.cancelAtEnd", {
                        date: formatDate(subscription.currentPeriodEnd, lang),
                      })
                    : t("premium.activeUntil", {
                        date: formatDate(subscription.currentPeriodEnd, lang),
                      })}
                </p>
              )}
            </div>
            <Link to={ROUTES.games} className="btn btn-primary">
              🎮 {t("premium.backToGames")}
            </Link>
          </div>

          {subscription && subscription.status === "ACTIVE" && (
            <div className="flex flex-wrap gap-2">
              {subscription.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={() => void resumeSubscription()}
                  disabled={canceling}
                  className="btn btn-outline btn-sm"
                >
                  ↻ {t("premium.resume")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void cancelSubscription()}
                  disabled={canceling}
                  className="btn btn-ghost btn-sm text-danger"
                >
                  {canceling ? t("premium.processing") : t("premium.cancel")}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Formules ──────────────────────────────────────────── */}
      {!premium && (
        <section aria-labelledby="premium-plans">
          <h2 id="premium-plans" className="mb-4 text-2xl">
            {t("premium.includes")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Offre gratuite */}
            <article className="card flex flex-col gap-4 p-6">
              <header>
                <h3 className="text-xl">{t("premium.freeTitle")}</h3>
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  {t("premium.freeF4")}
                </p>
              </header>
              <p className="flex flex-wrap items-baseline gap-1">
                <span className="text-3xl font-black tabular-nums text-ink">
                  {t("premium.freePrice")}
                </span>
                <span className="text-sm font-semibold text-ink-faint">
                  {t("premium.freePriceNote")}
                </span>
              </p>
              <ul className="flex flex-col gap-2 text-sm font-semibold text-ink-soft">
                {[1, 2, 3, 4].map((index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-success">✓</span>
                    <span>{t(`premium.freeF${index}`)}</span>
                  </li>
                ))}
              </ul>
              <Link to={ROUTES.games} className="btn btn-outline mt-auto w-full">
                {t("premium.freeCta")}
              </Link>
            </article>

            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                demoMode={billing.demoMode}
                stripeEnabled={billing.stripeEnabled}
                busy={busyPlan === plan.slug}
                isCurrent={activePlanSlug === plan.slug}
                onChoose={() => void choosePlan(plan)}
              />
            ))}
          </div>
          {!billing.stripeEnabled && !billing.demoMode && (
            <p className="mt-4 text-sm font-semibold text-danger">
              ⚠️ {t("premium.secure")} — {t("premium.demoNotice")}
            </p>
          )}
        </section>
      )}

      {/* ── Historique des paiements ─────────────────────────── */}
      {status === "authenticated" && overview && overview.payments.length > 0 && (
        <section className="card p-6" aria-labelledby="premium-payments">
          <h2 id="premium-payments" className="mb-4 text-2xl">
            🧾 {t("premium.paymentHistory")}
          </h2>
          <ul className="flex flex-col gap-2">
            {overview.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-semibold"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true">{payment.amountCents === 0 ? "🎁" : "💳"}</span>
                  <span>{payment.plan.name}</span>
                  {payment.provider === "DEMO" && (
                    <span className="chip bg-warning-soft text-xs text-ink">
                      {t("premium.demo")}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 text-ink-soft">
                  <span className="tabular-nums">
                    {payment.amountCents === 0
                      ? t("premium.freeTrial")
                      : formatPrice(payment.amountCents, payment.currency, lang)}
                  </span>
                  <span className="text-xs font-medium text-ink-faint">
                    {formatDate(payment.createdAt, lang)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-3" aria-labelledby="premium-faq">
        <h2 id="premium-faq" className="sr-only">
          {t("premium.faqTitle")}
        </h2>
        {[1, 2, 3].map((index) => (
          <article key={index} className="card p-5">
            <h3 className="text-lg">{t(`premium.faq${index}Q`)}</h3>
            <p className="mt-2 text-sm text-ink-soft">{t(`premium.faq${index}A`)}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
