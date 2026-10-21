// ══════════════════════════════════════════════════════════════════
//  KIDORA — Paramètres
//  Sons, langue, mot de passe, confidentialité (classement),
//  export RGPD et suppression du compte (double confirmation).
// ══════════════════════════════════════════════════════════════════

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "../components/layout/LanguageSwitcher";
import { SoundToggle } from "../components/layout/SoundToggle";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/Feedback";
import { ROUTES, type LocaleCode } from "../config";
import { usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { ApiError } from "../services/api";
import { accountService, profileService } from "../services/profile.service";
import { useAuthStore } from "../store/auth.store";
import { usePrefsStore } from "../store/prefs.store";

/** Mot à recopier pour confirmer la suppression du compte, selon la langue. */
const DELETE_WORDS: Record<LocaleCode, string> = {
  fr: "SUPPRIMER",
  en: "DELETE",
  ar: "حذف",
};

export function Settings() {
  const { t, lang } = useI18n();
  usePageTitle(t("settings.title"));

  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const activeProfile = useAuthStore((s) => s.activeProfile);
  const soundEnabled = usePrefsStore((s) => s.soundEnabled);

  // Mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Confidentialité
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  // Export RGPD
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Suppression du compte
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const describeError = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.code === "NETWORK_ERROR") return t("errors.network");
      return err.message;
    }
    return t("errors.generic");
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordError(t("auth.passwordsMismatch"));
      return;
    }

    setPasswordLoading(true);
    try {
      await accountService.changePassword(currentPassword, newPassword);
      setPasswordMessage(t("settings.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setPasswordError(describeError(err));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLeaderboardOptIn = async (checked: boolean) => {
    setPrivacyError(null);
    setPrivacyLoading(true);
    try {
      const response = await profileService.updateActive({ leaderboardOptIn: checked });
      useAuthStore.getState().setActiveProfileLocal(response.profile);
    } catch (err) {
      setPrivacyError(describeError(err));
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      await accountService.exportData();
    } catch (err) {
      setExportError(describeError(err));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      await accountService.deleteAccount(deletePassword, deleteConfirm);
      useAuthStore.getState().clear();
      navigate(ROUTES.home);
    } catch (err) {
      setDeleteError(describeError(err));
    } finally {
      setDeleting(false);
    }
  };

  const expectedDeleteWord = DELETE_WORDS[lang];

  // Le routeur protège déjà la page ; on rend un état gracieux si besoin.
  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon="🔐"
          title={t("errors.unauthorized")}
          actionLabel={t("nav.login")}
          actionTo={ROUTES.login}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-3xl">{t("settings.title")}</h1>

      {/* ── Sons ─────────────────────────────────────────────── */}
      <section className="card p-6" aria-labelledby="settings-sound">
        <h2 id="settings-sound" className="mb-4 text-xl">
          🔊 {t("settings.sound")}
        </h2>
        <div className="flex items-center justify-between gap-4">
          <p className="font-semibold text-ink-soft">
            {soundEnabled ? t("settings.soundOn") : t("settings.soundOff")}
          </p>
          <SoundToggle />
        </div>
      </section>

      {/* ── Langue ───────────────────────────────────────────── */}
      <section className="card p-6" aria-labelledby="settings-language">
        <h2 id="settings-language" className="mb-4 text-xl">
          🌍 {t("settings.language")}
        </h2>
        <LanguageSwitcher className="w-full sm:w-64" />
      </section>

      {/* ── Mot de passe ─────────────────────────────────────── */}
      <section className="card p-6" aria-labelledby="settings-account">
        <h2 id="settings-account" className="mb-4 text-xl">
          🔑 {t("settings.account")}
        </h2>

        <form className="space-y-4" onSubmit={(event) => void handlePasswordSubmit(event)}>
          {passwordMessage && (
            <div
              role="status"
              className="rounded-xl bg-success-soft px-4 py-3 font-semibold text-ink"
            >
              ✓ {passwordMessage}
            </div>
          )}
          {passwordError && (
            <div
              role="alert"
              className="rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger"
            >
              🙈 {passwordError}
            </div>
          )}

          <div>
            <label className="label" htmlFor="settings-current-password">
              {t("auth.currentPassword")}
            </label>
            <input
              id="settings-current-password"
              type="password"
              className="input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="settings-new-password">
              {t("auth.newPassword")}
            </label>
            <input
              id="settings-new-password"
              type="password"
              className="input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              aria-describedby="settings-password-hint"
              required
            />
            <p id="settings-password-hint" className="mt-1 text-xs text-ink-faint">
              {t("auth.passwordHint")}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="settings-confirm-password">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              className="input"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>

          <Button type="submit" loading={passwordLoading}>
            {t("settings.changePassword")}
          </Button>
        </form>
      </section>

      {/* ── Confidentialité ──────────────────────────────────── */}
      <section className="card p-6" aria-labelledby="settings-privacy">
        <h2 id="settings-privacy" className="mb-4 text-xl">
          🛡️ {t("settings.privacyTitle")}
        </h2>

        {privacyError && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger"
          >
            🙈 {privacyError}
          </div>
        )}

        <label className="flex items-center gap-3 font-semibold text-ink-soft">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-primary"
            checked={activeProfile?.leaderboardOptIn ?? false}
            disabled={!activeProfile || privacyLoading}
            onChange={(event) => void handleLeaderboardOptIn(event.target.checked)}
          />
          {t("settings.leaderboardOptIn")}
        </label>
      </section>

      {/* ── Export RGPD ──────────────────────────────────────── */}
      <section className="card p-6" aria-labelledby="settings-export">
        <h2 id="settings-export" className="mb-2 text-xl">
          📦 {t("settings.exportData")}
        </h2>
        <p className="mb-4 text-ink-soft">{t("settings.exportHint")}</p>

        {exportError && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger"
          >
            🙈 {exportError}
          </div>
        )}

        <Button onClick={() => void handleExport()} loading={exporting}>
          ⬇️ {t("settings.exportData")}
        </Button>
      </section>

      {/* ── Suppression du compte ────────────────────────────── */}
      <section className="card p-6" aria-labelledby="settings-delete">
        <h2 id="settings-delete" className="mb-2 text-xl">
          🗑️ {t("settings.deleteAccount")}
        </h2>
        <p className="mb-4 font-semibold text-danger">{t("settings.deleteWarning")}</p>

        <form className="space-y-4" onSubmit={(event) => void handleDeleteSubmit(event)}>
          {deleteError && (
            <div
              role="alert"
              className="rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger"
            >
              🙈 {deleteError}
            </div>
          )}

          <div>
            <label className="label" htmlFor="settings-delete-password">
              {t("auth.password")}
            </label>
            <input
              id="settings-delete-password"
              type="password"
              className="input"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="settings-delete-confirm">
              {t("settings.deleteConfirm")}
            </label>
            <input
              id="settings-delete-confirm"
              type="text"
              className="input"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <Button
            type="submit"
            variant="danger"
            size="lg"
            loading={deleting}
            disabled={deleteConfirm !== expectedDeleteWord}
          >
            🗑️ {t("settings.deleteAccount")}
          </Button>
        </form>
      </section>
    </div>
  );
}
