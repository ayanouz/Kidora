// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 09 : Attrape les Étoiles (moteur « catch-the-stars »)
//  60 secondes par niveau : attrape les étoiles filantes du ciel !
//  🌟 dorée = 3× plus, 🌙 bonus = 2×. 3 niveaux ; budget plafonné (§44).
//  Canvas procédural — zéro asset.
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { useCanvas, useCountdown } from "../engine/hooks";
import type { GameProps } from "../registry";

// ── Réglages (seed.ts : durationSec 60, spawnRateMs 800/600/420) ─

const DEFAULT_DURATION_SEC = 60;
const SPAWN_MS: Record<DifficultyKey, number> = { easy: 800, medium: 600, hard: 420 };
const EXPECTED_CATCHES: Record<DifficultyKey, number> = { easy: 55, medium: 80, hard: 105 };
const GOLDEN_MULTIPLIER = 3;
const MOON_MULTIPLIER = 2;
/** Marge : une partie parfaite frôle ~62 % du plafond, jamais plus. */
const RISK_FACTOR = 1.6;

type StarKind = "star" | "golden" | "moon";

interface Star {
  x: number;
  y: number;
  radius: number;
  /** Vitesse horizontale signée (px/s) : gauche → droite ou inverse. */
  speed: number;
  baseY: number;
  swayAmp: number;
  swayPhase: number;
  swayFreq: number;
  t: number;
  kind: StarKind;
}

interface Spark {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  hue: number;
}

/** Grain de poussière du ciel (scintillement). */
interface SkyDot {
  x: number;
  y: number;
  r: number;
  phase: number;
}

// ── Composant ────────────────────────────────────────────────────

export function CatchTheStars({ ctx }: GameProps) {
  const settings = ctx.game.config.settings as
    | { durationSec?: number; spawnRateMs?: Partial<Record<DifficultyKey, number>> }
    | undefined;
  const durationSec = settings?.durationSec ?? DEFAULT_DURATION_SEC;
  const spawnMs = settings?.spawnRateMs?.[ctx.difficulty] ?? SPAWN_MS[ctx.difficulty];
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);

  // Plafond anti-triche : 95 % du maximum serveur (§44).
  const cap = Math.floor(
    (ctx.game.config.maxScore?.[ctx.difficulty] ?? ctx.game.maxScoreHint) * 0.95,
  );
  const pointsPerCatch = Math.floor(
    cap / (EXPECTED_CATCHES[ctx.difficulty] * maxLevel * RISK_FACTOR),
  );

  const { canvasRef, size } = useCanvas(1);

  // Le canal onEnd passe par une ref : toujours la dernière version.
  const endHandlerRef = useRef<() => void>(() => undefined);
  const countdown = useCountdown(durationSec, { onEnd: () => endHandlerRef.current() });
  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const starsRef = useRef<Star[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const skyDotsRef = useRef<SkyDot[]>([]);
  const skySizeRef = useRef({ width: 0, height: 0 });
  const spawnAccRef = useRef(0);
  const timeRef = useRef(0);
  const caughtRef = useRef(0);
  const goldenRef = useRef(0);
  const moonRef = useRef(0);
  const creditedRef = useRef(0);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const [caught, setCaught] = useState(0);
  const [golden, setGolden] = useState(0);
  const [moons, setMoons] = useState(0);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  // Aucun minuteur ne survit au démontage.
  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  // Montage = début de partie : chrono du premier niveau.
  useEffect(() => {
    countdownRef.current.start(durationSec);
    return () => {
      countdownRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le HUD affiche le temps restant du chronomètre interne.
  useEffect(() => {
    ctxRef.current.setTimeLeft(countdown.timeLeft);
  }, [countdown.timeLeft]);

  // Pause du shell → chrono en pause ; reprise → il repart.
  useEffect(() => {
    if (ctx.running) countdown.resume();
    else countdown.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.running]);

  // Fin de partie : une seule fois, chrono arrêté d'abord.
  const finishRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    countdownRef.current.stop();
    ctxRef.current.finish({
      isWin: caughtRef.current > 0,
      levelReached: ctxRef.current.level,
      clientMeta: {
        caught: caughtRef.current,
        golden: goldenRef.current,
        moons: moonRef.current,
      },
    });
  }, []);

  // Fin du temps d'un niveau.
  const handleTimeEnd = useCallback(() => {
    const current = ctxRef.current;
    if (finishedRef.current) return;

    if (current.level < maxLevel) {
      // Niveau suivant : on repart sur un ciel tout neuf.
      current.sound.play("level");
      later(() => {
        const latest = ctxRef.current;
        latest.setLevel(Math.min(maxLevel, latest.level + 1));
        starsRef.current = [];
        sparksRef.current = [];
        spawnAccRef.current = 0;
        countdownRef.current.start(durationSec);
        if (!ctxRef.current.running) countdownRef.current.pause();
      }, 600);
      return;
    }
    finishRun();
  }, [durationSec, finishRun, later, maxLevel]);
  endHandlerRef.current = handleTimeEnd;

  // ── Étoiles ─────────────────────────────────────────────────────

  const spawnStar = useCallback(() => {
    const { width, height } = sizeRef.current;
    const minDim = Math.min(width, height);
    const levelBonus = 1 + (ctxRef.current.level - 1) * 0.1;

    // Rare : 🌟 dorée (3×) ; encore plus rare : 🌙 bonus (2×).
    const roll = Math.random();
    const kind: StarKind = roll < 0.1 ? "moon" : roll < 0.18 ? "golden" : "star";
    const radius =
      minDim *
      (kind === "golden" ? 0.055 : kind === "moon" ? 0.05 : 0.042) *
      (0.9 + Math.random() * 0.25);
    const fromLeft = Math.random() < 0.5;
    const speedBase = width / (kind === "golden" ? 2.7 : 3.6);
    const baseY = height * (0.14 + Math.random() * 0.7);

    const stars = starsRef.current;
    stars.push({
      x: fromLeft ? -radius * 2 : width + radius * 2,
      y: baseY,
      radius,
      speed: (fromLeft ? 1 : -1) * speedBase * levelBonus * (0.85 + Math.random() * 0.3),
      baseY,
      swayAmp: minDim * (0.03 + Math.random() * 0.07),
      swayPhase: Math.random() * Math.PI * 2,
      swayFreq: 0.5 + Math.random() * 0.8,
      t: 0,
      kind,
    });
    if (stars.length > 30) stars.shift();
  }, []);

  /** Petite étincelle qui s'ouvre à l'attrapage. */
  const spark = useCallback((x: number, y: number, radius: number, kind: StarKind) => {
    const sparks = sparksRef.current;
    const hue = kind === "golden" ? 46 : kind === "moon" ? 210 : 55;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      sparks.push({
        x: x + Math.cos(angle) * radius * 0.4,
        y: y + Math.sin(angle) * radius * 0.4,
        radius: Math.max(1.5, radius * 0.12),
        maxRadius: Math.max(4, radius * (0.35 + Math.random() * 0.4)),
        life: 1,
        hue,
      });
    }
    if (sparks.length > 140) sparks.splice(0, sparks.length - 140);
  }, []);

  const catchStar = useCallback(
    (index: number) => {
      const current = ctxRef.current;
      const star = starsRef.current[index];
      if (!star) return;
      starsRef.current.splice(index, 1);

      // Son court + étincelle ; les points sont crédités sans texte flottant.
      current.sound.play(star.kind === "moon" ? "bonus" : "pop");
      spark(star.x, star.y, star.radius, star.kind);

      caughtRef.current += 1;
      if (star.kind === "golden") goldenRef.current += 1;
      if (star.kind === "moon") moonRef.current += 1;
      setCaught(caughtRef.current);
      setGolden(goldenRef.current);
      setMoons(moonRef.current);

      // Budget de points : jamais au-delà de 95 % du plafond serveur.
      const multiplier =
        star.kind === "golden" ? GOLDEN_MULTIPLIER : star.kind === "moon" ? MOON_MULTIPLIER : 1;
      const gain = Math.max(
        0,
        Math.min(pointsPerCatch * multiplier, cap - creditedRef.current),
      );
      if (gain > 0) {
        creditedRef.current += gain;
        current.addScore(gain);
      }
    },
    [cap, pointsPerCatch, spark],
  );

  const handleTap = useCallback(
    (clientX: number, clientY: number) => {
      const current = ctxRef.current;
      if (!current.running || finishedRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const { width, height } = sizeRef.current;
      const x = (clientX - rect.left) * (width / rect.width);
      const y = (clientY - rect.top) * (height / rect.height);

      const stars = starsRef.current;
      for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        const reach = star.radius * 1.35;
        const dx = x - star.x;
        const dy = y - star.y;
        if (dx * dx + dy * dy <= reach * reach) {
          catchStar(i);
          return;
        }
      }
    },
    [canvasRef, catchStar],
  );

  // Clavier (contrat §31) : Espace attrape l'étoile la plus proche du centre.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Spacebar") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!ctxRef.current.running || finishedRef.current) return;
      const stars = starsRef.current;
      if (stars.length === 0) return;

      const { width, height } = sizeRef.current;
      const centerX = width / 2;
      const centerY = height / 2;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < stars.length; i++) {
        const dx = stars[i].x - centerX;
        const dy = stars[i].y - centerY;
        const distance = dx * dx + dy * dy;
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      }
      event.preventDefault();
      catchStar(nearest);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [catchStar]);

  // ── Boucle de rendu (pause = image figée) ───────────────────────

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const update = (dt: number) => {
      timeRef.current += dt;

      // Apparition régulière des étoiles.
      spawnAccRef.current += dt * 1000;
      const interval = Math.max(120, spawnMs);
      let guard = 0;
      while (spawnAccRef.current >= interval && guard < 4) {
        guard += 1;
        spawnAccRef.current -= interval;
        spawnStar();
      }

      // Trajectoire : traversée + léger arc vertical ; sortie = manquée.
      const { width, height } = sizeRef.current;
      const stars = starsRef.current;
      for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        star.t += dt;
        star.x += star.speed * dt;
        const sway =
          Math.sin(star.t * star.swayFreq * Math.PI * 2 + star.swayPhase) * star.swayAmp;
        star.y = Math.max(star.radius, Math.min(height - star.radius, star.baseY + sway));
        if (star.x < -star.radius * 4 || star.x > width + star.radius * 4) stars.splice(i, 1);
      }

      // Étincelles d'attrapage.
      const sparks = sparksRef.current;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sparkle = sparks[i];
        sparkle.life -= dt * 2.6;
        sparkle.radius += (sparkle.maxRadius - sparkle.radius) * Math.min(1, dt * 9);
        if (sparkle.life <= 0) sparks.splice(i, 1);
      }
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const { width, height } = sizeRef.current;

      // Ciel nocturne.
      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#0B1026");
      sky.addColorStop(0.55, "#141B3C");
      sky.addColorStop(1, "#232B57");
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);

      // Poussière d'étoiles (regénérée quand la taille change).
      const skySize = skySizeRef.current;
      if (skyDotsRef.current.length === 0 || skySize.width !== width || skySize.height !== height) {
        skySizeRef.current = { width, height };
        skyDotsRef.current = Array.from({ length: 70 }, () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.6 + Math.random() * 1.6,
          phase: Math.random() * Math.PI * 2,
        }));
      }
      for (const dot of skyDotsRef.current) {
        context.globalAlpha =
          0.25 + 0.55 * (0.5 + 0.5 * Math.sin(timeRef.current * 1.6 + dot.phase));
        context.beginPath();
        context.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        context.fillStyle = "#FFFFFF";
        context.fill();
      }
      context.globalAlpha = 1;

      // Étincelles.
      for (const sparkle of sparksRef.current) {
        context.globalAlpha = Math.max(0, sparkle.life) * 0.8;
        context.beginPath();
        context.arc(sparkle.x, sparkle.y, sparkle.radius, 0, Math.PI * 2);
        context.fillStyle = `hsl(${sparkle.hue} 95% 72%)`;
        context.fill();
      }
      context.globalAlpha = 1;

      // Étoiles filantes (emojis lumineux).
      for (const star of starsRef.current) {
        context.font = `${Math.round(star.radius * 2)}px serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        if (star.kind !== "star") {
          context.shadowColor =
            star.kind === "golden" ? "rgba(255,214,80,0.95)" : "rgba(190,215,255,0.9)";
          context.shadowBlur = star.kind === "golden" ? 20 : 14;
        }
        context.fillText(
          star.kind === "golden" ? "🌟" : star.kind === "moon" ? "🌙" : "⭐",
          star.x,
          star.y,
        );
        context.shadowBlur = 0;
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (ctxRef.current.running) update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, spawnStar, spawnMs]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <p className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        ⭐ {caught} · 🌟 {golden} · 🌙 {moons}
      </p>

      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          if (event.button > 0) return;
          handleTap(event.clientX, event.clientY);
        }}
        className="touch-none rounded-2xl"
        aria-label="⭐"
      />
    </div>
  );
}
