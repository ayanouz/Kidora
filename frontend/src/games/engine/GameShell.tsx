// ══════════════════════════════════════════════════════════════════
//  KIDORA — GameShell : orchestrateur d'une partie (§33/§40/§41)
//  • Écran prêt → jeu → pause → fin de partie
//  • Session serveur : start → finish (le client n'écrit JAMAIS un
//    score directement — le serveur valide, §44)
//  • Meilleur score et difficulté sauvegardés localement (reprise)
//  • Difficulté adaptative : conseils après 2 réussites/échecs (§20)
// ══════════════════════════════════════════════════════════════════

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ROUTES, type DifficultyKey } from "../../config";
import { useI18n } from "../../i18n";
import { ApiError } from "../../services/api";
import { useAuthStore } from "../../store/auth.store";
import type { FinishSessionResponse, Game } from "../../types";
import { cn } from "../../utils/cn";
import {
  FeedbackFloat,
  GameHUD,
  PauseOverlay,
  ReadyScreen,
  type FeedbackMessage,
} from "./components";
import {
  canGoDown,
  canGoUp,
  nextDifficulty,
  recordOutcome,
  shouldDecrease,
  shouldIncrease,
  type StreakState,
} from "./difficulty";
import { GameOverModal } from "./GameOverModal";
import { GameStorage } from "./GameStorage";
import { useGameSession, useSound } from "./hooks";
import type { GameContext, GameOverData, GamePhase, LocalResult } from "./types";

interface GameShellProps {
  game: Game;
  /**
   * Le jeu reçoit le contexte. Il est REMONTÉ à chaque nouvelle partie
   * (`key` interne) : il peut donc initialiser son état au montage et
   * utiliser `ctx.running` pour mettre ses boucles en pause.
   */
  children: (ctx: GameContext) => ReactNode;
  /** Appelé après la validation serveur d'une partie (rafraîchir les stats). */
  onSessionFinished?: () => void;
  className?: string;
}

export function GameShell({ game, children, onSessionFinished, className }: GameShellProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const sound = useSound();
  const { start: startSession, finish: finishSession, abandon: abandonSession } = useGameSession(
    game.slug,
  );

  const maxLevel = Math.max(1, game.config.levels ?? 1);

  const initialSaved = useMemo(() => GameStorage.get(game.slug), [game.slug]);

  const [phase, setPhase] = useState<GamePhase>("ready");
  const [runId, setRunId] = useState(0);
  const [difficulty, setDifficulty] = useState<DifficultyKey>(initialSaved.difficulty);
  const [streak, setStreak] = useState<StreakState>(initialSaved.streak);
  const [best, setBest] = useState(initialSaved.bestScore);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [level, setLevel] = useState(initialSaved.level);
  const [roundsTotal, setRoundsTotal] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [quitOpen, setQuitOpen] = useState(false);

  // Refs : valeurs à jour pour les callbacks exposés aux jeux
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const comboRef = useRef(combo);
  comboRef.current = combo;
  const levelRef = useRef(level);
  levelRef.current = level;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const finishedRef = useRef(false);
  const startedAtRef = useRef(performance.now());
  const feedbackTimerRef = useRef(0);
  const onFinishedRef = useRef(onSessionFinished);
  onFinishedRef.current = onSessionFinished;

  useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), []);

  // ── Démarrage d'une partie ──────────────────────────────────────
  const startRun = useCallback(
    (nextDifficulty: DifficultyKey, nextLevel: number) => {
      window.clearTimeout(feedbackTimerRef.current);
      setFeedback(null);
      setGameOver(null);
      setScore(0);
      setCombo(0);
      setLives(null);
      setTimeLeft(null);
      setRoundsTotal(null);
      setLevel(Math.max(1, Math.min(maxLevel, nextLevel)));
      setDifficulty(nextDifficulty);
      setPhase("playing");
      setRunId((id) => id + 1);
      finishedRef.current = false;
      startedAtRef.current = performance.now();
      GameStorage.save(game.slug, { difficulty: nextDifficulty });
      void startSession(nextDifficulty);
      sound.play("click");
    },
    [game.slug, maxLevel, sound, startSession],
  );

  // ── Pause / reprise ─────────────────────────────────────────────
  const pause = useCallback(() => {
    if (phaseRef.current === "playing") {
      setPhase("paused");
      sound.play("click");
    }
  }, [sound]);

  const resume = useCallback(() => {
    if (phaseRef.current === "paused") {
      setPhase("playing");
      sound.play("click");
    }
  }, [sound]);

  // Onglet caché → pause automatique (équitable + économise la batterie)
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  // Échap → pause ↔ reprise (les jeux peuvent utiliser Espace/Entrée)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (phaseRef.current === "playing") {
        event.preventDefault();
        pause();
      } else if (phaseRef.current === "paused") {
        event.preventDefault();
        resume();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pause, resume]);

  // ── Feedback positif (§21) ──────────────────────────────────────
  const showFeedback = useCallback((message: Omit<FeedbackMessage, "id">) => {
    const id = Date.now() + Math.random();
    setFeedback({ id, ...message });
    window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 1100);
  }, []);

  const signalCorrect = useCallback(
    (points?: number) => {
      sound.play("correct");
      if (typeof points === "number" && points > 0) {
        setScore((current) => Math.max(0, current + points));
        scoreRef.current += points;
        showFeedback({ kind: "good", text: t("feedback.greatJob"), points });
      } else {
        showFeedback({ kind: "good", text: t("feedback.correct") });
      }
      const nextCombo = comboRef.current + 1;
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      if (nextCombo > 0 && nextCombo % 5 === 0) sound.play("bonus");
    },
    [showFeedback, sound, t],
  );

  const signalWrong = useCallback(() => {
    sound.play("wrong");
    comboRef.current = 0;
    setCombo(0);
    showFeedback({ kind: "bad", text: t("feedback.almost") });
  }, [showFeedback, sound, t]);

  const addScore = useCallback((points: number) => {
    setScore((current) => Math.max(0, current + points));
    scoreRef.current = Math.max(0, scoreRef.current + points);
  }, []);

  // ── Fin de partie : sauvegarde locale + validation serveur ──────
  const finish = useCallback(
    (partial?: Partial<LocalResult>) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const durationMs = Math.round(performance.now() - startedAtRef.current);
      const finalScore = Math.max(0, Math.round(partial?.score ?? scoreRef.current));
      const isWin = partial?.isWin ?? true;
      const levelReached = Math.max(1, Math.round(partial?.levelReached ?? levelRef.current));
      const result: LocalResult = {
        score: finalScore,
        durationMs,
        isWin,
        levelReached,
        clientMeta: partial?.clientMeta,
      };

      // Meilleur score local + streak d'adaptation (§20)
      const previousBest = GameStorage.bestScore(game.slug);
      const wasRecord = finalScore > previousBest;
      const nextStreak = recordOutcome(GameStorage.get(game.slug).streak, isWin);
      const saved = GameStorage.save(game.slug, {
        bestScore: finalScore,
        level: levelReached,
        streak: nextStreak,
      });

      setBest(saved.bestScore);
      setStreak(nextStreak);
      setPhase("over");
      sound.play(isWin ? "win" : "pop");

      // Écran immédiat (optimiste) ; le serveur valide en arrière-plan.
      setGameOver({
        result,
        server: null,
        pending: true,
        bestScore: saved.bestScore,
        isNewRecord: wasRecord,
      });

      const attemptedServer = useAuthStore.getState().status === "authenticated";

      void (async () => {
        let server: FinishSessionResponse | null = null;
        let notice: GameOverData["notice"];

        if (attemptedServer) {
          try {
            server = await finishSession(result);
          } catch (error) {
            notice = error instanceof ApiError && error.code === "SCORE_REJECTED"
              ? "rejected"
              : "offline";
          }
          if (!server && !notice) notice = "offline";
        }

        if (server) {
          const { profile } = server;
          useAuthStore.getState().applyProfileUpdate({
            level: profile.level,
            xp: profile.xp,
            points: profile.points,
          });
          if (server.unlockedAchievements.length > 0) sound.play("achievement");
        }

        // Ne pas écraser l'écran d'une partie plus récente.
        setGameOver((current) =>
          current && current.result === result
            ? {
                result,
                server,
                pending: false,
                notice,
                bestScore: Math.max(saved.bestScore, server?.bestScore ?? 0),
                isNewRecord: server ? server.isNewBest : wasRecord,
              }
            : current,
        );

        // Stats serveur mises à jour → la page peut se rafraîchir.
        onFinishedRef.current?.();
      })();
    },
    [finishSession, game.slug, sound],
  );

  // ── Quitter ─────────────────────────────────────────────────────
  const exitToGames = useCallback(() => {
    abandonSession();
    navigate(ROUTES.games);
  }, [abandonSession, navigate]);

  const onExitClick = useCallback(() => {
    // En pleine partie (même en pause) : confirmation douce avant de quitter.
    const current = phaseRef.current;
    if (current === "playing" || current === "paused") {
      setQuitOpen(true);
    } else {
      exitToGames();
    }
  }, [exitToGames]);

  // ── Contexte transmis au jeu ────────────────────────────────────
  const running = phase === "playing";

  const ctx = useMemo<GameContext>(
    () => ({
      game,
      difficulty,
      phase,
      running,
      score,
      setScore,
      addScore,
      combo,
      setCombo,
      lives,
      setLives,
      timeLeft,
      setTimeLeft,
      level,
      setLevel,
      roundsTotal,
      setRoundsTotal,
      bestScore: best,
      sound,
      pause,
      resume,
      finish,
      signalCorrect,
      signalWrong,
    }),
    [
      game, difficulty, phase, running, score, addScore, combo, lives, timeLeft,
      level, roundsTotal, best, sound, pause, resume, finish, signalCorrect, signalWrong,
    ],
  );

  const recommended = useMemo<DifficultyKey | null>(() => {
    if (shouldIncrease(streak) && canGoUp(difficulty)) return nextDifficulty(difficulty, 1);
    if (shouldDecrease(streak) && canGoDown(difficulty)) return nextDifficulty(difficulty, -1);
    return null;
  }, [streak, difficulty]);

  return (
    <section className={cn("w-full", className)}>
      <GameHUD
        title={game.title}
        emoji={game.emoji}
        score={score}
        best={best}
        combo={combo}
        lives={lives}
        level={phase === "ready" ? null : level}
        maxLevel={maxLevel}
        timeLeft={timeLeft}
        sound={sound}
        onPause={phase === "playing" ? pause : undefined}
        onExit={onExitClick}
      />

      <div className="relative mt-3">
        <div className="game-board flex min-h-[360px] flex-col p-2 sm:p-3">
          {phase === "ready" ? (
            <ReadyScreen
              game={game}
              best={best}
              difficulty={difficulty}
              recommended={recommended}
              onDifficultyChange={setDifficulty}
              onStart={() => startRun(difficulty, 1)}
            />
          ) : (
            <Fragment key={runId}>{children(ctx)}</Fragment>
          )}
        </div>

        <FeedbackFloat message={feedback} />

        <PauseOverlay
          open={phase === "paused"}
          onResume={resume}
          onRestart={() => startRun(difficulty, 1)}
          onQuit={exitToGames}
          sound={sound}
        />
      </div>

      <GameOverModal
        open={phase === "over"}
        game={game}
        difficulty={difficulty}
        data={gameOver}
        maxLevel={maxLevel}
        onReplay={() => startRun(difficulty, 1)}
        onNextLevel={() =>
          startRun(difficulty, Math.min(maxLevel, (gameOver?.result.levelReached ?? 1) + 1))
        }
        onOtherGames={exitToGames}
      />

      {/* Confirmation douce pour quitter en pleine partie */}
      <Modal open={quitOpen} onClose={() => setQuitOpen(false)} title={t("hud.quitTitle")} size="sm">
        <p className="text-center text-ink-soft">{t("hud.quitText")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button variant="success" onClick={() => setQuitOpen(false)}>
            {t("hud.quitStay")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setQuitOpen(false);
              exitToGames();
            }}
          >
            {t("hud.quit")}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
