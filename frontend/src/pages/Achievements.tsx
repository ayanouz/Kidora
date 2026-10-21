// ══════════════════════════════════════════════════════════════════
//  KIDORA — Page Mes badges
//  Grille des badges : débloqués en couleur avec récompense XP,
//  verrouillés en gris avec un cadenas. Compteur en en-tête.
// ══════════════════════════════════════════════════════════════════

import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";
import { useAsync, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { achievementsService } from "../services/gameplay.service";
import { cn } from "../utils/cn";

export function Achievements() {
  const { t } = useI18n();
  usePageTitle(t("achievements.title"));

  const { data, loading, error, reload } = useAsync(async () => achievementsService.list(), []);

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-3xl">{t("achievements.title")}</h1>
        {data && (
          <p className="text-ink-soft">
            {t("achievements.subtitle", {
              unlocked: data.summary.unlocked,
              total: data.summary.total,
            })}
          </p>
        )}
      </header>

      {loading ? (
        <Spinner className="py-16" label={t("common.loading")} />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data || data.achievements.length === 0 ? (
        <EmptyState icon="🏅" title={t("achievements.empty")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.achievements.map((achievement) => (
            <article
              key={achievement.id}
              className={cn(
                "card flex items-start gap-4 p-4",
                achievement.unlocked ? "border-2 border-primary/30" : "opacity-60 grayscale",
              )}
            >
              <span className="text-4xl" aria-hidden="true">
                {achievement.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg leading-tight">{achievement.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">{achievement.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {achievement.unlocked ? (
                    <>
                      <span className="chip bg-accent-soft text-xs">
                        <span aria-hidden="true">⭐</span>{" "}
                        {t("achievements.reward", { xp: achievement.xpReward })}
                      </span>
                      <span className="text-xs font-semibold text-success">
                        {t("achievements.unlocked")}
                      </span>
                    </>
                  ) : (
                    <span className="chip bg-primary/5 text-xs text-ink-soft">
                      <span aria-hidden="true">🔒</span> {t("achievements.locked")}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
