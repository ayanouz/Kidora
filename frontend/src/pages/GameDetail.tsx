// ══════════════════════════════════════════════════════════════════
//  KIDORA — Page d'un jeu (§37/§41)
//  Le GameShell occupe le haut de page ; dessous : stats, derniers
//  scores et mini-classement, rafraîchis après chaque partie.
// ══════════════════════════════════════════════════════════════════

import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { FavoriteButton } from "../components/game/FavoriteButton";
import { Avatar, Stars } from "../components/ui/Display";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";
import { ROUTES } from "../config";
import { GameShell } from "../games/engine/GameShell";
import { getGameComponent } from "../games/registry";
import { useAsync, usePageTitle } from "../hooks/utils";
import { useI18n } from "../i18n";
import { gamesService } from "../services/games.service";
import { billingService } from "../services/billing.service";
import { useAuthStore } from "../store/auth.store";

const DIFFICULTY_STARS: Record<string, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };

function formatDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function GameDetail() {
  const { slug = "" } = useParams();
  const { t, lang } = useI18n();
  const authStatus = useAuthStore((s) => s.status);

  const detail = useAsync(async (signal) => gamesService.get(slug, signal), [slug]);
  const game = detail.data?.game;

  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const [premiumChecked, setPremiumChecked] = useState(false);

  useEffect(() => {
    if (!game?.premium) {
      setPremiumChecked(true);
      return;
    }
    if (authStatus !== "authenticated") {
      setHasPremiumAccess(false);
      setPremiumChecked(true);
      return;
    }
    let cancelled = false;
    setPremiumChecked(false);
    billingService
      .me()
      .then((overview) => {
        if (!cancelled) {
          setHasPremiumAccess(overview.premium);
          setPremiumChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setPremiumChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [game?.premium, authStatus]);

  usePageTitle(game?.title ?? t("games.title"), game?.description);

  if (detail.loading) return <Spinner className="py-24" label={t("common.loading")} />;
  if (detail.error || !detail.data || !game) return <ErrorState onRetry={detail.reload} />;

  const GameComponent = getGameComponent(game.engine);
  const recentScores = detail.data.recentScores;
  const leaderboard = detail.data.leaderboard;
  const difficultyLabel = t(`difficulty.${game.difficulty.toLowerCase()}`);

  return (
    <div className="flex flex-col gap-6">
      {/* ── En-tête ───────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start gap-4">
        <span
          className="flex h-20 w-20 items-center justify-center rounded-3xl text-5xl shadow-soft"
          style={{ background: `${game.color}22` }}
          aria-hidden="true"
        >
          {game.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl leading-tight">{game.title}</h1>
          <p className="mt-1 max-w-2xl text-ink-soft">{game.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Link to={ROUTES.category(game.category.slug)} className="chip bg-primary-soft text-primary-dark">
              {game.category.emoji} {game.category.name}
            </Link>
            <span className="chip bg-secondary-soft text-secondary-dark">🎂 {game.minAge}+</span>
            {game.premium && (
              <span className="chip bg-accent-soft font-bold text-ink">👑 {t("premium.badge")}</span>
            )}
            <span className="chip bg-accent-soft text-ink" title={t("game.recommendedAge")}>
              {"⭐".repeat(DIFFICULTY_STARS[game.difficulty] ?? 1)} {difficultyLabel}
            </span>
            <span className="chip bg-white text-ink-soft shadow-soft">
              🎮 {t("game.playsCount", { count: game.playCount })}
            </span>
          </div>
        </div>
        <FavoriteButton gameId={game.id} initial={game.personal?.isFavorite ?? false} />
      </header>

      {/* ── Le jeu (GameShell + composant du registre) ────────── */}
      {game.premium && !premiumChecked ? (
        <Spinner className="py-12" label={t("common.loading")} />
      ) : game.premium && !hasPremiumAccess ? (
        <section className="card relative overflow-hidden border-2 border-accent/30 p-6 text-center sm:p-10">
          <span className="text-6xl" aria-hidden="true">👑</span>
          <h2 className="mt-3 text-2xl text-primary-dark">{t("premium.lockedTitle")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-ink-soft">{t("premium.lockedText")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm font-bold">
            <span className="chip bg-success-soft text-success">✨ {t("premium.featurePremiumGames")}</span>
            <span className="chip bg-primary-soft text-primary-dark">🚫 {t("premium.noCommitment")}</span>
            <span className="chip bg-secondary-soft text-secondary-dark">🎁 {t("premium.trial", { days: 7 })}</span>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {authStatus === "authenticated" ? (
              <Link to={ROUTES.premium} className="btn btn-primary">
                👑 {t("premium.unlockCta")}
              </Link>
            ) : (
              <Link
                to={ROUTES.login}
                state={{ from: ROUTES.game(game.slug) }}
                className="btn btn-primary"
              >
                {t("premium.loginToSubscribe")}
              </Link>
            )}
            <Link to={ROUTES.games} className="btn btn-outline">
              {t("premium.freeCta")}
            </Link>
          </div>
        </section>
      ) : GameComponent ? (
        <GameShell
          game={game}
          onSessionFinished={() => {
            detail.reload();
          }}
        >
          {(ctx) => <GameComponent ctx={ctx} />}
        </GameShell>
      ) : (
        <EmptyState
          icon="🚧"
          title={t("common.upcoming")}
          text={t("game.adaptiveHint")}
          actionLabel={t("pages.backToGames")}
          actionTo={ROUTES.games}
        />
      )}

      {/* ── Stats + historique ────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5" aria-labelledby="gd-stats">
          <h2 id="gd-stats" className="mb-3 text-xl">
            {t("game.yourStats")}
          </h2>
          {game.personal ? (
            <ul className="flex flex-col gap-2.5 text-sm font-semibold">
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-soft">🏆 {t("game.yourBest")}</span>
                <span className="text-lg tabular-nums text-primary">{game.personal.bestScore}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-soft">🎮 {t("game.plays")}</span>
                <span className="tabular-nums">{game.personal.plays}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-soft">🎯 {t("game.difficulty")}</span>
                <Stars value={game.personal.stars} size="sm" />
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-soft">⭐ {t("profile.level", { level: game.personal.level })}</span>
              </li>
            </ul>
          ) : (
            <p className="text-ink-soft">{t("leaderboard.notRanked")}</p>
          )}
        </section>

        <section className="card p-5" aria-labelledby="gd-recent">
          <h2 id="gd-recent" className="mb-3 text-xl">
            {t("game.recentScores")}
          </h2>
          {recentScores.length === 0 ? (
            <p className="text-ink-soft">{t("profile.noRecent")}</p>
          ) : (
            <ul className="flex flex-col gap-2.5 text-sm font-semibold">
              {recentScores.map((score, index) => (
                <li key={`${score.createdAt}-${index}`} className="flex items-center justify-between gap-2">
                  <span className="tabular-nums">
                    {score.isWin ? "🎉" : "💪"} {score.score}
                  </span>
                  <Stars value={score.stars} size="sm" />
                  <span className="text-xs font-medium text-ink-faint">
                    {formatDate(score.createdAt, lang)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5" aria-labelledby="gd-top">
          <h2 id="gd-top" className="mb-3 text-xl">
            {t("game.leaderboard")}
          </h2>
          {leaderboard.length === 0 ? (
            <p className="text-ink-soft">{t("leaderboard.noEntries")}</p>
          ) : (
            <ol className="flex flex-col gap-2.5 text-sm font-semibold">
              {leaderboard.map((entry) => (
                <li key={`${entry.rank}-${entry.displayName}`} className="flex items-center gap-2.5">
                  <span className="w-6 text-center tabular-nums text-ink-faint">{entry.rank}</span>
                  <Avatar emoji={entry.avatar} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{entry.displayName}</span>
                  <span className="tabular-nums text-primary">{entry.score}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <p className="text-center">
        <Link to={ROUTES.games} className="btn btn-outline">
          ← {t("game.backToGames")}
        </Link>
      </p>
    </div>
  );
}
