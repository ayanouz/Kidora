// ══════════════════════════════════════════════════════════════════
//  KIDORA — Page Classement (§38)
//  Podium du top 3, liste des joueurs suivants, position « toi »
//  épinglée en bas, et option d'apparition dans le classement.
//  PRIVACY-FIRST : pseudonymes et avatars uniquement.
// ══════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Avatar } from "../components/ui/Display";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";
import { useAsync, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { leaderboardService } from "../services/gameplay.service";
import { profileService } from "../services/profile.service";
import { useAuthStore } from "../store/auth.store";
import { cn } from "../utils/cn";
import type { LeaderboardPeriod } from "../types";

const PERIODS: { value: LeaderboardPeriod; labelKey: string }[] = [
  { value: "day", labelKey: "leaderboard.periodDay" },
  { value: "week", labelKey: "leaderboard.periodWeek" },
  { value: "month", labelKey: "leaderboard.periodMonth" },
  { value: "all", labelKey: "leaderboard.periodAll" },
];

const MEDALS = ["🥇", "🥈", "🥉"] as const;
/** Ordre visuel du podium sur sm+ : 2e, 1er, 3e (empilé 1-2-3 sur mobile). */
const PODIUM_ORDER = ["sm:order-2", "sm:order-1", "sm:order-3"] as const;

export function Leaderboard() {
  const { t } = useI18n();
  usePageTitle(t("leaderboard.title"));

  const [period, setPeriod] = useState<LeaderboardPeriod>("day");
  const { data, loading, error, reload } = useAsync(
    async () => leaderboardService.get(period),
    [period],
  );

  const authStatus = useAuthStore((s) => s.status);
  const activeProfile = useAuthStore((s) => s.activeProfile);
  const setActiveProfileLocal = useAuthStore((s) => s.setActiveProfileLocal);
  const [savingOptIn, setSavingOptIn] = useState(false);

  const handleOptIn = async (next: boolean): Promise<void> => {
    setSavingOptIn(true);
    try {
      const result = await profileService.updateActive({ leaderboardOptIn: next });
      setActiveProfileLocal(result.profile);
      reload(); // Le classement peut gagner/perdre la ligne « toi ».
    } catch {
      // Erreur réseau : la case reste pilotée par le store, rien d'autre à faire.
    } finally {
      setSavingOptIn(false);
    }
  };

  const podium = data ? data.entries.slice(0, 3) : [];
  const rest = data ? data.entries.slice(3) : [];
  const me = data?.me ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-5">
        <h1 className="text-3xl">{t("leaderboard.title")}</h1>
        <p className="text-ink-soft">{t("leaderboard.subtitle")}</p>
      </header>

      {/* Sélecteur de période */}
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label={t("leaderboard.title")}>
        {PERIODS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={period === item.value}
            onClick={() => setPeriod(item.value)}
            className={cn("btn btn-sm", period === item.value ? "btn-primary" : "btn-outline")}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner className="py-12" label={t("common.loading")} />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data || data.entries.length === 0 ? (
        <EmptyState icon="🏆" title={t("leaderboard.noEntries")} />
      ) : (
        <div className="space-y-6">
          {/* Podium du top 3 */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-center sm:gap-6">
            {podium.map((entry, index) => (
              <div
                key={entry.rank}
                className={cn(
                  "card flex w-full max-w-[240px] flex-col items-center gap-2 px-4 py-5 text-center",
                  PODIUM_ORDER[index],
                  index === 0 && "sm:border-2 sm:border-accent sm:shadow-pop",
                )}
              >
                <span className="text-4xl" aria-hidden="true">
                  {MEDALS[index]}
                </span>
                <Avatar
                  emoji={entry.avatar}
                  size={index === 0 ? "xl" : "lg"}
                  label={entry.displayName}
                />
                <p className={cn("max-w-full truncate font-bold", index === 0 ? "text-lg" : "text-base")}>
                  {entry.displayName}
                  {entry.isMe && <span className="text-primary"> ({t("leaderboard.you")})</span>}
                </p>
                <span className="chip bg-primary-soft text-xs text-primary-dark">
                  {t("profile.level", { level: entry.level })}
                </span>
                <p
                  className={cn(
                    "font-bold tabular-nums text-primary-dark",
                    index === 0 ? "text-2xl" : "text-lg",
                  )}
                >
                  {entry.points}
                  <span className="ms-1 text-xs font-semibold text-ink-faint">
                    {t("profile.points")}
                  </span>
                </p>
              </div>
            ))}
          </div>

          {/* Joueurs suivants */}
          {rest.length > 0 && (
            <ul className="card divide-y divide-primary/10 px-4 py-1">
              {rest.map((entry) => (
                <li
                  key={entry.rank}
                  className={cn(
                    "flex items-center gap-3 py-3",
                    entry.isMe && "rounded-xl bg-primary-soft px-3",
                  )}
                >
                  <span className="w-8 shrink-0 text-center font-bold tabular-nums text-ink-soft">
                    {entry.rank}
                  </span>
                  <Avatar emoji={entry.avatar} size="sm" label={entry.displayName} />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {entry.displayName}
                    {entry.isMe && <span className="text-primary"> ({t("leaderboard.you")})</span>}
                  </span>
                  <span className="chip bg-primary-soft text-xs text-primary-dark">
                    {t("profile.level", { level: entry.level })}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">
                    {entry.points}
                    <span className="ms-1 text-xs font-semibold text-ink-faint">
                      {t("profile.points")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Ma position, épinglée en bas si je suis hors du top 3 */}
          {me && me.rank > 3 && (
            <div className="sticky bottom-4 z-10">
              <div className="card flex items-center gap-3 border-2 border-primary/30 bg-white/95 px-4 py-3 shadow-pop backdrop-blur">
                <span className="chip shrink-0 bg-primary text-xs text-white">
                  {t("leaderboard.yourRank")}
                </span>
                <span className="shrink-0 font-bold tabular-nums">#{me.rank}</span>
                <Avatar emoji={me.avatar} size="sm" label={me.displayName} />
                <span className="min-w-0 flex-1 truncate font-semibold">{me.displayName}</span>
                <span className="chip bg-primary-soft text-xs text-primary-dark">
                  {t("profile.level", { level: me.level })}
                </span>
                <span className="shrink-0 font-bold tabular-nums">
                  {me.points}
                  <span className="ms-1 text-xs font-semibold text-ink-faint">
                    {t("profile.points")}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Apparition dans le classement (connecté) */}
      {authStatus === "authenticated" && activeProfile && (
        <section className="card mt-6 flex items-start gap-3 p-4">
          <input
            id="leaderboard-opt-in"
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
            checked={activeProfile.leaderboardOptIn}
            disabled={savingOptIn}
            onChange={(event) => {
              void handleOptIn(event.target.checked);
            }}
          />
          <label htmlFor="leaderboard-opt-in" className="cursor-pointer">
            <span className="block font-semibold">{t("settings.leaderboardOptIn")}</span>
            <span className="block text-sm text-ink-soft">{t("leaderboard.optInHint")}</span>
          </label>
        </section>
      )}

      {/* Note douce pour les invités */}
      {authStatus === "guest" && (
        <p className="mt-6 text-center text-sm text-ink-soft">
          <span aria-hidden="true">💡</span> {t("leaderboard.notRanked")}
        </p>
      )}
    </div>
  );
}
