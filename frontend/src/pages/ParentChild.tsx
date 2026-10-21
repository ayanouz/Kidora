// ══════════════════════════════════════════════════════════════════
//  KIDORA — Espace Parents : tableau de bord d'un enfant (§25)
//  Temps de jeu, progression par compétence, activité par jeu,
//  historique récent et badges débloqués.
// ══════════════════════════════════════════════════════════════════

import { Link, useParams } from "react-router-dom";
import { Avatar, ProgressBar, Stars } from "../components/ui/Display";
import { ErrorState, Spinner } from "../components/ui/Feedback";
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

export function ParentChild() {
  const { t, lang } = useI18n();
  const { profileId } = useParams<{ profileId: string }>();
  usePageTitle(t("parent.dashboard"));

  const { data, loading, error, reload } = useAsync(async () => {
    if (!profileId) throw new Error("Profil enfant introuvable.");
    return parentService.dashboard(profileId);
  }, [profileId]);

  const dateFmt = new Intl.DateTimeFormat(lang, { dateStyle: "short" });
  const formatDate = (iso: string): string => dateFmt.format(new Date(iso));

  if (loading) return <Spinner className="py-16" label={t("common.loading")} />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const { profile } = data;

  const playtimeBoxes: { labelKey: string; ms: number }[] = [
    { labelKey: "parent.today", ms: data.playtime.today },
    { labelKey: "parent.week", ms: data.playtime.week },
    { labelKey: "parent.month", ms: data.playtime.month },
    { labelKey: "parent.allTime", ms: data.playtime.all },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête : avatar, pseudo, niveau */}
      <header className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar emoji={profile.avatar} size="xl" ring label={profile.displayName} />
        <div className="min-w-0">
          <h1 className="text-3xl">{profile.displayName}</h1>
          <span className="chip mt-1 bg-primary-soft text-xs text-primary-dark">
            {t("profile.level", { level: profile.level })}
          </span>
        </div>
      </header>

      {/* Temps de jeu */}
      <section className="card p-5">
        <h2 className="mb-3 text-xl">{t("parent.playtime")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {playtimeBoxes.map((box) => (
            <div key={box.labelKey} className="rounded-2xl bg-primary-soft/60 px-3 py-4 text-center">
              <p className="text-xs font-semibold text-ink-soft">{t(box.labelKey)}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatPlaytime(box.ms)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Progression par compétence */}
      <section className="card p-5">
        <h2 className="mb-4 text-xl">{t("parent.progression")}</h2>
        {data.skills.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("admin.empty")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.skills.map((skill) => (
              <div key={skill.category}>
                <ProgressBar
                  percent={skill.winRate}
                  label={`${skill.emoji} ${skill.category}`}
                  color={skill.color}
                />
                <p className="mt-1 flex items-center gap-3 text-xs text-ink-faint">
                  <span className="tabular-nums">🎮 {skill.played}</span>
                  <span className="tabular-nums">✅ {skill.wins}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activité par jeu */}
      <section className="card p-5">
        <h2 className="mb-3 text-xl">{t("parent.activity")}</h2>
        {data.activity.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("admin.empty")}</p>
        ) : (
          <ul className="divide-y divide-primary/10">
            {data.activity.map((item) => (
              <li
                key={item.game.slug}
                className="grid grid-cols-2 items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,2.5fr)_repeat(4,minmax(0,1fr))_minmax(0,1.2fr)]"
              >
                <span className="col-span-2 min-w-0 truncate font-semibold sm:col-span-1">
                  {item.game.emoji} {item.game.title}
                </span>
                <span className="text-sm tabular-nums text-ink-soft">🎮 {item.plays}</span>
                <span className="text-sm tabular-nums text-ink-soft">✅ {item.wins}</span>
                <span className="text-sm tabular-nums text-ink-soft">
                  🎯 {Math.round(item.winRate)}%
                </span>
                <span className="text-sm tabular-nums text-ink-soft">🏆 {item.bestScore}</span>
                <span className="text-xs text-ink-faint sm:text-end">
                  {item.lastPlayedAt ? formatDate(item.lastPlayedAt) : t("parent.never")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Historique récent */}
      <section className="card p-5">
        <h2 className="mb-3 text-xl">{t("profile.history")}</h2>
        {data.recentSessions.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("admin.empty")}</p>
        ) : (
          <ul className="divide-y divide-primary/10">
            {data.recentSessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {session.game.emoji} {session.game.title}
                </span>
                <span className="chip bg-primary-soft text-xs tabular-nums">
                  {t("gameOver.yourScore")} {session.score}
                </span>
                <Stars value={session.stars} size="sm" />
                <span className="text-xs text-ink-faint">
                  {session.finishedAt ? formatDate(session.finishedAt) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Badges débloqués */}
      <section className="card p-5">
        <h2 className="mb-3 text-xl">{t("profile.achievements")}</h2>
        {data.achievements.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("admin.empty")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.achievements.map((achievement) => (
              <li
                key={`${achievement.title}-${achievement.unlockedAt}`}
                className="flex items-center gap-3 rounded-2xl bg-primary-soft/50 px-3 py-2"
              >
                <span className="text-2xl" aria-hidden="true">
                  {achievement.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{achievement.title}</span>
                <span className="text-xs text-ink-faint">{formatDate(achievement.unlockedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Retour à la liste des enfants */}
      <div>
        <Link to={ROUTES.parent} className="btn btn-outline">
          {t("common.back")}
        </Link>
      </div>
    </div>
  );
}
