// ══════════════════════════════════════════════════════════════════
//  KIDORA — Mot de passe oublié
//  Envoie un lien de réinitialisation sans jamais révéler
//  si un compte existe avec cet email (réponse volontairement neutre).
// ══════════════════════════════════════════════════════════════════

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { ROUTES } from "../config";
import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { ApiError } from "../services/api";
import { authService } from "../services/auth.service";

export function ForgotPassword() {
  const { t } = useI18n();
  usePageTitle(t("auth.forgotTitle"));

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
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
      <h1 className="mb-2 text-2xl sm:text-3xl">{t("auth.forgotTitle")}</h1>
      <p className="mb-6 text-ink-soft">{t("auth.forgotText")}</p>

      {sent ? (
        <div
          role="status"
          className="rounded-xl bg-success-soft px-4 py-3 font-semibold text-ink"
        >
          ✅ {t("auth.forgotSent")}
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
            <label className="label" htmlFor="forgot-email">
              {t("auth.email")}
            </label>
            <input
              id="forgot-email"
              type="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("auth.emailHint")}
              autoComplete="email"
              required
            />
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {t("auth.sendLink")}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm font-semibold">
        <Link to={ROUTES.login} className="text-primary hover:underline">
          ← {t("common.back")}
        </Link>
      </p>
    </div>
  );
}
