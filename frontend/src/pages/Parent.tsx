// ══════════════════════════════════════════════════════════════════
//  KIDORA — Espace Parents : liste des enfants (§25)
//  Une carte par profil enfant : niveau, parties, réussite, badges,
//  temps de jeu du jour / de la semaine et dernière partie.
//  Le titre est déjà affiché par ParentLayout.
// ══════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { Avatar } from "../components/ui/Display";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";
import { ROUTES } from "../config";
import { useAsync, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { parentService } from "../services/parent.service";

/** Millisecondes → « 0 min », « 42 min » ou « 3 h 07 ». */
function formatPlaytime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "0 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

export function Parent() {
  const { t, lang } = useI18n();
  usePageTitle(t("parent.title"));

  const { data, loading, error, reload } = useAsync(async () => parentService.children(), []);

  const dateFmt = new Intl.DateTimeFormat(lang, { dateStyle: "short" });

  if (loading) return <Spinner className="py-16" label={t("common.loading")} />;
  if (error || !data) return <ErrorState onRetry={reload} />;
  if (data.children.length === 0) {
    return <EmptyState icon="👧" title={t("parent.noChildren")} />;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {data.children.map((child) => {
        const stats = child.stats;
        return (
          <article key={child.profile.id} className="card card-hover flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar emoji={child.profile.avatar} size="lg" label={child.profile.displayName} />
              <div className="min-w-0">
                <h2 className="truncate text-xl">{child.profile.displayName}</h2>
                <span className="chip mt-1 bg-primary-soft text-xs text-primary-dark">
                  {t("profile.level", { level: child.profile.level })}
                </span>
              </div>
            </div>

            {/* Stats principales */}
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-primary-soft/60 px-2 py-3">
                <dt className="text-[11px] font-semibold text-ink-soft">{t("parent.sessions")}</dt>
                <dd className="text-lg font-bold tabular-nums">{stats.sessionsFinished}</dd>
              </div>
              <div className="rounded-2xl bg-secondary-soft px-2 py-3">
                <dt className="text-[11px] font-semibold text-ink-soft">{t("parent.winRate")}</dt>
                <dd className="text-lg font-bold tabular-nums">{Math.round(stats.winRate)}%</dd>
              </div>
              <div className="rounded-2xl bg-accent-soft px-2 py-3">
                <dt className="text-[11px] font-semibold text-ink-soft">
                  {t("profile.achievements")}
                </dt>
                <dd className="text-lg font-bold tabular-nums">{stats.achievements}</dd>
              </div>
            </dl>

            {/* Temps de jeu */}
            <dl className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-primary/5 px-2 py-2">
                <dt className="text-[11px] font-semibold text-ink-soft">{t("parent.today")}</dt>
                <dd className="text-sm font-bold tabular-nums">{formatPlaytime(stats.playtime.today)}</dd>
              </div>
              <div className="rounded-2xl bg-primary/5 px-2 py-2">
                <dt className="text-[11px] font-semibold text-ink-soft">{t("parent.week")}</dt>
                <dd className="text-sm font-bold tabular-nums">{formatPlaytime(stats.playtime.week)}</dd>
              </div>
            </dl>

            <p className="text-xs text-ink-faint">
              {stats.lastPlayedAt
                ? `${t("parent.lastPlayed")} · ${dateFmt.format(new Date(stats.lastPlayedAt))}`
                : t("parent.never")}
            </p>

            <Link
              to={ROUTES.parentDashboard(child.profile.id)}
              className="btn btn-primary mt-auto w-full"
            >
              {t("parent.viewDetails")}
            </Link>
          </article>
        );
      })}
    </div>
  );
}
