// ══════════════════════════════════════════════════════════════════
//  KIDORA — Page d'inscription
//  Création du compte famille : prénom, email, mot de passe,
//  tranche d'âge facultative et acceptation des conditions.
// ══════════════════════════════════════════════════════════════════

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { AGE_TIERS, ROUTES, type AgeTierValue } from "../config";
import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { ApiError } from "../services/api";
import { useAuthStore } from "../store/auth.store";

export function Register() {
  const { t } = useI18n();
  usePageTitle(t("auth.registerTitle"));

  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ageTier, setAgeTier] = useState<AgeTierValue | "">("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    if (!acceptTerms) {
      setError(t("auth.acceptTerms"));
      return;
    }

    setLoading(true);
    try {
      await useAuthStore.getState().register({
        displayName: displayName.trim(),
        email,
        password,
        ageTier: ageTier === "" ? undefined : ageTier,
        acceptTerms: true,
      });
      navigate(ROUTES.home);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "EMAIL_TAKEN" || err.code === "EMAIL_EXISTS")) {
        setError(t("errors.emailTaken"));
      } else if (err instanceof ApiError && err.code === "NETWORK_ERROR") {
        setError(t("errors.network"));
      } else {
        setError(t("errors.generic"));
      }
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      <h1 className="mb-6 text-2xl sm:text-3xl">{t("auth.registerTitle")}</h1>

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        {error && (
          <div
            role="alert"
            className="rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger"
          >
            🙈 {error}
          </div>
        )}

        <div>
          <label className="label" htmlFor="register-name">
            {t("auth.firstName")}
          </label>
          <input
            id="register-name"
            className="input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={2}
            maxLength={40}
            autoComplete="nickname"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="register-email">
            {t("auth.email")}
          </label>
          <input
            id="register-email"
            type="email"
            className="input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("auth.emailHint")}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="register-password">
            {t("auth.password")}
          </label>
          <input
            id="register-password"
            type="password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            autoComplete="new-password"
            aria-describedby="register-password-hint"
            required
          />
          <p id="register-password-hint" className="mt-1 text-xs text-ink-faint">
            {t("auth.passwordHint")}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="register-confirm">
            {t("auth.confirmPassword")}
          </label>
          <input
            id="register-confirm"
            type="password"
            className="input"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="register-age">
            {t("auth.ageLabel")}
          </label>
          <select
            id="register-age"
            className="input"
            value={ageTier}
            onChange={(event) => setAgeTier(event.target.value as AgeTierValue | "")}
          >
            <option value="">{t("auth.ageOptional")}</option>
            {AGE_TIERS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.emoji} {tier.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-3 font-semibold text-ink-soft">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            required
          />
          <span>{t("auth.acceptTerms")}</span>
        </label>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t("auth.registerButton")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm font-semibold text-ink-soft">
        {t("auth.hasAccount")}{" "}
        <Link to={ROUTES.login} className="text-primary hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
