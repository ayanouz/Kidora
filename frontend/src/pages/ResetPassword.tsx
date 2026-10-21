// ══════════════════════════════════════════════════════════════════
//  KIDORA — Nouveau mot de passe
//  Lit le jeton dans l'URL (?token=…) et définit un nouveau mot
//  de passe, avec double saisie et message de confirmation.
// ══════════════════════════════════════════════════════════════════

import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/Feedback";
import { ROUTES } from "../config";
import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { ApiError } from "../services/api";
import { authService } from "../services/auth.service";

export function ResetPassword() {
  const { t } = useI18n();
  usePageTitle(t("auth.resetTitle"));

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Lien incomplet ou invalide → état d'erreur clair, jamais d'écran blanc
  if (!token) {
    return <ErrorState message={t("errors.generic")} />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("auth.passwordsMismatch"));
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NETWORK_ERROR") {
        setError(t("errors.network"));
      } else {
        setError(t("errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      <h1 className="mb-6 text-2xl sm:text-3xl">{t("auth.resetTitle")}</h1>

      {done ? (
        <div className="space-y-5">
          <div
            role="status"
            className="rounded-xl bg-success-soft px-4 py-3 font-semibold text-ink"
          >
            🎉 {t("auth.resetSuccess")}
          </div>
          <Link to={ROUTES.login} className="btn btn-primary btn-lg w-full">
            {t("auth.signIn")}
          </Link>
        </div>
      ) : (
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
            <label className="label" htmlFor="reset-password">
              {t("auth.newPassword")}
            </label>
            <input
              id="reset-password"
              type="password"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              aria-describedby="reset-password-hint"
              required
            />
            <p id="reset-password-hint" className="mt-1 text-xs text-ink-faint">
              {t("auth.passwordHint")}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="reset-confirm">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="reset-confirm"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {t("auth.resetButton")}
          </Button>
        </form>
      )}
    </div>
  );
}
