// ══════════════════════════════════════════════════════════════════
//  KIDORA — Hooks du moteur de jeu
//  useSound · useCountdown · useGameSession · useCanvas
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrefsStore } from "../../store/prefs.store";
import { useAuthStore } from "../../store/auth.store";
import { sessionsService } from "../../services/gameplay.service";
import { ApiError } from "../../services/api";
import { SoundManager } from "./SoundManager";
import { GameStorage } from "./GameStorage";
import type { SoundName, SoundApi, LocalResult } from "./types";
import type { DifficultyKey } from "../../config";
import type { FinishSessionResponse } from "../../types";

// ── useSound (§33) ────────────────────────────────────────────────

export function useSound(): SoundApi {
  const soundEnabled = usePrefsStore((s) => s.soundEnabled);
  const toggleSound = usePrefsStore((s) => s.toggleSound);

  useEffect(() => {
    SoundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const play = useCallback(
    (name: SoundName) => {
      if (soundEnabled) SoundManager.play(name);
    },
    [soundEnabled],
  );

  return useMemo(
    () => ({ play, enabled: soundEnabled, toggle: toggleSound }),
    [play, soundEnabled, toggleSound],
  );
}

// ── useCountdown : chronomètre précis (performance.now) ───────────

export interface CountdownApi {
  /** Secondes restantes (arrondi supérieur), null si inactif. */
  timeLeft: number | null;
  running: boolean;
  start: (seconds?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Temps écoulé total en ms (même en pause). */
  elapsedMs: () => number;
}

export function useCountdown(
  initialSeconds: number,
  options: { onEnd?: () => void } = {},
): CountdownApi {
  const [timeLeft, setTimeLeft] = useState<number | null>(initialSeconds);
  const [running, setRunning] = useState(false);

  const deadlineRef = useRef<number | null>(null);
  const remainingAtPauseRef = useRef<number>(initialSeconds * 1000);
  const startedAtRef = useRef<number>(performance.now());
  const onEndRef = useRef(options.onEnd);
  onEndRef.current = options.onEnd;

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      if (deadlineRef.current === null) return;
      const remaining = deadlineRef.current - performance.now();
      if (remaining <= 0) {
        deadlineRef.current = null;
        setTimeLeft(0);
        setRunning(false);
        onEndRef.current?.();
      } else {
        setTimeLeft(Math.ceil(remaining / 1000));
      }
    };

    tick();
    const interval = window.setInterval(tick, 200);
    return () => window.clearInterval(interval);
  }, [running]);

  const start = useCallback(
    (seconds?: number) => {
      const total = (seconds ?? initialSeconds) * 1000;
      deadlineRef.current = performance.now() + total;
      remainingAtPauseRef.current = total;
      startedAtRef.current = performance.now();
      setTimeLeft(Math.ceil(total / 1000));
      setRunning(true);
    },
    [initialSeconds],
  );

  const pause = useCallback(() => {
    if (deadlineRef.current !== null) {
      remainingAtPauseRef.current = Math.max(0, deadlineRef.current - performance.now());
      deadlineRef.current = null;
    }
    setRunning(false);
  }, []);

  const resume = useCallback(() => {
    deadlineRef.current = performance.now() + remainingAtPauseRef.current;
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    deadlineRef.current = null;
    setRunning(false);
  }, []);

  const elapsedMs = useCallback(() => performance.now() - startedAtRef.current, []);

  return { timeLeft, running, start, pause, resume, stop, elapsedMs };
}

// ── useGameSession : cycle start → finish → abandon (anti-cheat) ──

export interface GameSessionApi {
  sessionId: string | null;
  /** Lance la partie côté serveur (silencieux si hors-ligne). */
  start: (difficulty: DifficultyKey) => Promise<void>;
  /** Envoie le résultat validé par le serveur. */
  finish: (result: LocalResult) => Promise<FinishSessionResponse | null>;
  abandon: () => void;
  /** Meilleur score local, affiché instantanément avant le serveur. */
  localBest: number;
}

export function useGameSession(gameSlug: string): GameSessionApi {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const status = useAuthStore((s) => s.status);

  const start = useCallback(
    async (difficulty: DifficultyKey) => {
      // Session de jeu uniquement pour les utilisateurs connectés
      // (les invités jouent en local, sans sauvegarde).
      if (status !== "authenticated") {
        setSessionId(null);
        sessionRef.current = null;
        return;
      }
      try {
        const session = await sessionsService.start(gameSlug, difficulty);
        sessionRef.current = session.sessionId;
        setSessionId(session.sessionId);
      } catch {
        // Hors-ligne : on joue quand même, sans enregistrement serveur.
        sessionRef.current = null;
        setSessionId(null);
      }
    },
    [gameSlug, status],
  );

  const finish = useCallback(async (result: LocalResult): Promise<FinishSessionResponse | null> => {
    const id = sessionRef.current;
    if (!id) return null;
    sessionRef.current = null;
    try {
      const response = await sessionsService.finish(id, {
        score: result.score,
        durationMs: Math.round(result.durationMs),
        isWin: result.isWin,
        levelReached: result.levelReached,
        clientMeta: result.clientMeta,
      });
      return response;
    } catch (err) {
      if (err instanceof ApiError && err.code === "SCORE_REJECTED") {
        throw err; // remonté au shell pour afficher un message doux
      }
      return null; // réseau → mode hors-ligne
    } finally {
      setSessionId(null);
    }
  }, []);

  const abandon = useCallback(() => {
    const id = sessionRef.current;
    if (id) {
      sessionRef.current = null;
      void sessionsService.abandon(id).catch(() => undefined);
    }
  }, []);

  // Quitter la page en pleine partie → session abandonnée côté serveur
  useEffect(() => {
    return () => {
      const id = sessionRef.current;
      if (id) {
        sessionRef.current = null;
        void sessionsService.abandon(id).catch(() => undefined);
      }
    };
  }, []);

  // Meilleur score local (affiché instantanément, avant le serveur)
  const localBest = useMemo(() => GameStorage.bestScore(gameSlug), [gameSlug]);

  return { sessionId, start, finish, abandon, localBest };
}

// ── useCanvas : canvas responsive (DPR + ResizeObserver) ──────────

export interface CanvasApi {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Taille CSS disponible (px logiques). */
  size: { width: number; height: number };
}

export function useCanvas(aspectRatio = 1): CanvasApi {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 300, height: 300 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const measure = () => {
      const width = Math.max(120, parent.clientWidth);
      const height = Math.min(
        Math.round(width / aspectRatio),
        Math.max(200, window.innerHeight - 260),
      );
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      setSize({ width, height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [aspectRatio]);

  return { canvasRef, size };
}
