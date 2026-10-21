// ══════════════════════════════════════════════════════════════════
//  KIDORA — Page de connexion
//  Email + mot de passe, retour vers la page demandée,
//  messages d'erreur clairs et rassurants pour toute la famille.
// ══════════════════════════════════════════════════════════════════

import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { ROUTES } from "../config";
import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { ApiError } from "../services/api";
import { useAuthStore } from "../store/auth.store";

export function Login() {
  const { t } = useI18n();
  usePageTitle(t("auth.loginTitle"));

  const navigate = useNavigate();
  const location = useLocation();
  const status = useAuthStore((s) => s.status);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Déjà connecté → retour à l'accueil (pas de formulaire en double)
  if (status === "authenticated") {
    return <Navigate to={ROUTES.home} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await useAuthStore.getState().login(email, password);
      const from = (location.state as { from?: string } | null)?.from ?? ROUTES.home;
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (
          err.code === "INVALID_CREDENTIALS" ||
          err.code === "invalidCredentials" ||
          err.status === 401
        ) {
          setError(t("errors.invalidCredentials"));
        } else if (err.code === "NETWORK_ERROR") {
          setError(t("errors.network"));
        } else {
          setError(t("errors.generic"));
        }
      } else {
        setError(t("errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      <h1 className="mb-6 text-2xl sm:text-3xl">{t("auth.loginTitle")}</h1>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger"
        >
          🙈 {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label className="label" htmlFor="login-email">
            {t("auth.email")}
          </label>
          <input
            id="login-email"
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
          <label className="label" htmlFor="login-password">
            {t("auth.password")}
          </label>
          <input
            id="login-password"
            type="password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t("auth.loginButton")}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm font-semibold">
        <Link to={ROUTES.forgotPassword} className="text-primary hover:underline">
          {t("auth.forgotPassword")}
        </Link>
        <p className="text-ink-soft">
          {t("auth.noAccount")}{" "}
          <Link to={ROUTES.register} className="text-primary hover:underline">
            {t("auth.createOne")}
          </Link>
        </p>
      </div>
    </div>
  );
}
