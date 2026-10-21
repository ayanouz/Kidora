// ══════════════════════════════════════════════════════════════════
//  KIDORA — Mon profil (§23/§24)
//  Niveau, XP, points, talents, meilleurs scores, historique,
//  édition du pseudo / avatar / tranche d'âge.
// ══════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, ProgressBar, Stars } from "../components/ui/Display";
import { Button } from "../components/ui/Button";
import { ErrorState, Spinner } from "../components/ui/Feedback";
import { AGE_TIERS, AVATARS, ROUTES } from "../config";
import type { AgeTierValue } from "../config";
import { useAsync, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { profileService } from "../services/profile.service";
import { progressService } from "../services/gameplay.service";
import { useAuthStore } from "../store/auth.store";
import { cn } from "../utils/cn";

export function Profile() {
  const { t } = useI18n();
  usePageTitle(t("profile.title"));

  const activeProfile = useAuthStore((s) => s.activeProfile);
  const setActiveProfileLocal = useAuthStore((s) => s.setActiveProfileLocal);

  const progress = useAsync(async () => progressService.overview(), []);

  const [name, setName] = useState(activeProfile?.displayName ?? "");
  const [avatar, setAvatar] = useState(activeProfile?.avatar ?? AVATARS[0]);
  const [ageTier, setAgeTier] = useState<AgeTierValue>(activeProfile?.ageTier ?? "AGE_6_8");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (progress.loading) return <Spinner className="py-24" label={t("common.loading")} />;
  if (progress.error || !progress.data) return <ErrorState onRetry={progress.reload} />;

  const data = progress.data;
  const profile = data.profile;
  const { totals, skills, bestScores, recentSessions } = data;

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await profileService.updateActive({
        displayName: name.trim(),
        avatar,
        ageTier,
      });
      setActiveProfileLocal(response.profile);
      setSaved(true);
      progress.reload();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <Avatar emoji={profile.avatar} size="xl" ring color="#6C5CE7" label={profile.displayName} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl">{profile.displayName}</h1>
          <p className="text-ink-soft">
            {t("profile.level", { level: profile.level })} · ⭐ {profile.xp} {t("profile.xp")} · 🎯{" "}
            {profile.points} {t("profile.points")}
          </p>
          <ProgressBar
            percent={profile.progress.percent}
            label={`${profile.progress.currentLevelXp} / ${profile.progress.nextLevelXp} XP`}
            className="mt-2 max-w-md"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={ROUTES.favorites} className="btn btn-outline btn-sm">
            ❤️ {t("profile.favorites")}
          </Link>
          <Link to={ROUTES.achievements} className="btn btn-outline btn-sm">
            🏅 {t("profile.achievements")}
          </Link>
          <Link to={ROUTES.settings} className="btn btn-outline btn-sm">
            ⚙️ {t("nav.settings")}
          </Link>
        </div>
      </header>

      {/* ── Totaux ────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["🎮", t("profile.gamesPlayed"), totals.gamesPlayed],
            ["🏆", t("profile.wins"), totals.wins],
            ["🎯", t("profile.successRate"), `${Math.round(totals.winRate)}%`],
            ["🏅", t("profile.achievements"), totals.achievementsUnlocked],
          ] as const
        ).map(([emoji, label, value]) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <span className="text-2xl" aria-hidden="true">
              {emoji}
            </span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {label}
              </span>
              <span className="block text-xl font-bold tabular-nums">{value}</span>
            </span>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Édition du profil ──────────────────────────────── */}
        <section className="card p-5" aria-labelledby="pf-edit">
          <h2 id="pf-edit" className="mb-4 text-xl">
            ✏️ {t("profile.editName")}
          </h2>

          <label className="label" htmlFor="pf-name">
            {t("profile.editName")}
          </label>
          <input
            id="pf-name"
            className="input"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />

          <p className="label mt-4">{t("profile.editAvatar")}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("profile.editAvatar")}>
            {AVATARS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={avatar === option}
                onClick={() => setAvatar(option)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-2xl transition-all active:scale-90",
                  avatar === option
                    ? "border-primary bg-primary-soft"
                    : "border-primary/10 bg-white hover:border-primary/40",
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <label className="label mt-4" htmlFor="pf-age">
            {t("profile.editAge")}
          </label>
          <select
            id="pf-age"
            className="input"
            value={ageTier}
            onChange={(event) => setAgeTier(event.target.value as AgeTierValue)}
          >
            {AGE_TIERS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.emoji} {tier.label}
              </option>
            ))}
          </select>

          <div className="mt-5 flex items-center gap-3">
            <Button onClick={() => void save()} loading={saving} disabled={!name.trim()}>
              💾 {t("common.save")}
            </Button>
            {saved && (
              <span className="font-semibold text-success" role="status">
                ✓ {t("profile.saved")}
              </span>
            )}
            {error && (
              <span className="font-semibold text-danger" role="alert">
                {error}
              </span>
            )}
          </div>
        </section>

        {/* ── Talents ────────────────────────────────────────── */}
        <section className="card p-5" aria-labelledby="pf-skills">
          <h2 id="pf-skills" className="mb-4 text-xl">
            💪 {t("profile.skills")}
          </h2>
          {skills.length === 0 ? (
            <p className="text-ink-soft">{t("profile.noRecent")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {skills.map((skill) => (
                <li key={skill.category}>
                  <ProgressBar
                    percent={skill.winRate}
                    label={`${skill.emoji} ${skill.category}`}
                    color={skill.color}
                  />
                  <p className="mt-1 text-xs font-semibold text-ink-faint">
                    🎮 {skill.played} · ✅ {skill.wins} · 🏆 {skill.bestScore}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Meilleurs scores ───────────────────────────────── */}
        <section className="card p-5" aria-labelledby="pf-best">
          <h2 id="pf-best" className="mb-4 text-xl">
            🏆 {t("profile.bestScores")}
          </h2>
          {bestScores.length === 0 ? (
            <p className="text-ink-soft">{t("profile.noRecent")}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {bestScores.slice(0, 6).map((entry) => (
                <li key={entry.gameId} className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">
                    {entry.game.emoji}
                  </span>
                  <Link
                    to={ROUTES.game(entry.game.slug)}
                    className="min-w-0 flex-1 truncate font-semibold hover:text-primary"
                  >
                    {entry.game.title}
                  </Link>
                  <span className="font-bold tabular-nums text-primary">{entry.bestScore}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Historique ─────────────────────────────────────── */}
        <section className="card p-5" aria-labelledby="pf-history">
          <h2 id="pf-history" className="mb-4 text-xl">
            🕘 {t("profile.history")}
          </h2>
          {recentSessions.length === 0 ? (
            <p className="text-ink-soft">{t("profile.noRecent")}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {recentSessions.slice(0, 8).map((session) => (
                <li key={session.id} className="flex items-center gap-3 text-sm">
                  <span className="text-xl" aria-hidden="true">
                    {session.game.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {session.game.title}
                  </span>
                  <span className="tabular-nums">{session.score}</span>
                  <Stars value={session.stars} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
