// ══════════════════════════════════════════════════════════════════
//  KIDORA — Écran de fin de partie (§41)
//  Toujours valorisant : score, étoiles, XP, badges, conseils.
//  Jamais de « perdu » brutal — des messages doux et encourageants.
// ══════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Confetti } from "../../components/ui/Confetti";
import { Stars } from "../../components/ui/Display";
import { Modal } from "../../components/ui/Modal";
import { ROUTES, type DifficultyKey } from "../../config";
import { useI18n } from "../../i18n";
import { useAuthStore } from "../../store/auth.store";
import { cn } from "../../utils/cn";
import type { Game } from "../../types";
import { maxScoreFor, formatMs } from "./components";
import { starsForScore } from "./difficulty";
import type { GameOverData } from "./types";

interface GameOverModalProps {
  open: boolean;
  game: Game;
  difficulty: DifficultyKey;
  data: GameOverData | null;
  /** Dernier niveau du jeu (pour proposer « Niveau suivant »). */
  maxLevel: number;
  onReplay: () => void;
  onNextLevel: () => void;
  onOtherGames: () => void;
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl px-2 py-3",
        accent ? "bg-primary-soft" : "bg-secondary-soft",
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {label}
      </span>
      <span
        className={cn(
          "text-xl font-bold tabular-nums sm:text-2xl",
          accent ? "text-primary" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function GameOverModal({
  open,
  game,
  difficulty,
  data,
  maxLevel,
  onReplay,
  onNextLevel,
  onOtherGames,
}: GameOverModalProps) {
  const { t } = useI18n();
  const authStatus = useAuthStore((s) => s.status);

  if (!data) return null;

  const { result, server, pending = false, notice } = data;
  const stars = server ? server.stars : starsForScore(result.score, maxScoreFor(game, difficulty));
  const xpGained = server ? server.xpGain + server.achievementXp : 0;
  const canNextLevel = result.isWin && result.levelReached < maxLevel;
  const achievements = server?.unlockedAchievements ?? [];
  const title = result.isWin ? t("gameOver.bravo") : t("gameOver.gameOverTitle");

  return (
    <>
      <Confetti active={open && result.isWin} />

      <Modal open={open} onClose={onOtherGames} title={title} size="md" preventBackdropClose>
        <div className="flex flex-col items-center gap-4 text-center">
          <Stars value={stars} size="lg" />

          {result.isWin && <p className="font-semibold text-secondary-dark">{t("gameOver.levelDone")}</p>}
          {result.isWin && stars === 3 && <p className="text-ink-soft">{t("gameOver.perfect")}</p>}

          <div className="flex flex-wrap justify-center gap-2">
            {!pending && data.isNewRecord && (
              <span className="chip bg-accent text-ink">{t("gameOver.newRecord")}</span>
            )}
            {server?.levelUp && (
              <span className="chip bg-primary-soft text-primary-dark">
                {t("gameOver.levelUp", { level: server.profile.level })}
              </span>
            )}
          </div>

          {/* Performance de la partie */}
          <p className="w-full text-start text-sm font-semibold uppercase tracking-wide text-ink-faint">
            {t("hud.performance")}
          </p>
          <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
            <Stat label={t("gameOver.yourScore")} value={result.score} accent />
            <Stat label={t("gameOver.bestScore")} value={data.bestScore} />
            <Stat label={t("hud.timePlayed")} value={formatMs(result.durationMs)} />
          </div>

          {/* Récompenses serveur */}
          {xpGained > 0 && (
            <span className="chip animate-pop-in bg-success-soft text-success text-base font-bold">
              {t("gameOver.xpEarned", { xp: xpGained })}
            </span>
          )}

          {achievements.length > 0 && (
            <div className="w-full rounded-2xl bg-accent-soft p-3 text-start">
              <p className="mb-2 text-sm font-bold text-ink">🏅 {t("hud.newBadges")}</p>
              <ul className="flex flex-col gap-1.5">
                {achievements.map((achievement) => (
                  <li key={achievement.code} className="flex items-center gap-2 text-sm font-semibold">
                    <span className="text-xl" aria-hidden="true">
                      {achievement.icon}
                    </span>
                    <span className="flex-1">{achievement.title}</span>
                    <span className="text-primary-dark">
                      {t("achievements.reward", { xp: achievement.xpReward })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Vérification du score / messages doux */}
          {pending && (
            <p className="flex items-center gap-2 text-ink-soft" role="status">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
                aria-hidden="true"
              />
              {t("hud.verifying")}
            </p>
          )}

          {!pending && notice === "offline" && (
            <p className="w-full rounded-2xl bg-secondary-soft p-3 text-sm font-semibold text-secondary-dark">
              {t("hud.offlineNotice")}
            </p>
          )}

          {!pending && notice === "rejected" && (
            <p className="w-full rounded-2xl bg-warning-soft p-3 text-sm font-semibold text-warning">
              {t("errors.scoreRejected")}
            </p>
          )}

          {!pending && !notice && !server && authStatus !== "authenticated" && (
            <p className="w-full rounded-2xl bg-primary-soft p-3 text-sm font-semibold text-primary-dark">
              {t("hud.guestNotice")}{" "}
              <Link to={ROUTES.login} className="underline">
                {t("auth.signIn")}
              </Link>
            </p>
          )}
        </div>

        <div className="mt-5 flex w-full flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={onReplay}>
              <span aria-hidden="true">🔄</span> {t("gameOver.playAgain")}
            </Button>
            {canNextLevel && (
              <Button size="lg" variant="success" onClick={onNextLevel}>
                <span aria-hidden="true">➡️</span> {t("gameOver.nextLevel")}
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onOtherGames}>
            <span aria-hidden="true">🎮</span> {t("gameOver.otherGames")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
