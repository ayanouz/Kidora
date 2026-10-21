// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 08 : Bubble Pop (moteur « bubble-pop »)
//  60 secondes par niveau : éclate un maximum de bulles !
//  Les bulles dorées (⭐) valent 3× plus. 3 niveaux ; budget plafonné.
//  Canvas procédural — zéro asset (§33/§44).
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { useCanvas, useCountdown } from "../engine/hooks";
import type { GameProps } from "../registry";

// ── Réglages (seed.ts : durationSec 60, spawnRateMs 900/650/450) ─

const DEFAULT_DURATION_SEC = 60;
const SPAWN_MS: Record<DifficultyKey, number> = { easy: 900, medium: 650, hard: 450 };
const EXPECTED_POPS: Record<DifficultyKey, number> = { easy: 60, medium: 85, hard: 110 };
const GOLDEN_CHANCE = 0.08;
const GOLDEN_MULTIPLIER = 3;
/** Marge : une partie parfaite frôle ~62 % du plafond, jamais plus. */
const RISK_FACTOR = 1.6;

interface Bubble {
  x: number;
  y: number;
  /** Position horizontale de repos (oscillation sinusoïdale autour). */
  baseX: number;
  radius: number;
  /** Vitesse de montée en px/s. */
  speed: number;
  swayAmp: number;
  swayPhase: number;
  swayFreq: number;
  hue: number;
  golden: boolean;
  t: number;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  hue: number;
}

// ── Composant ────────────────────────────────────────────────────

export function BubblePop({ ctx }: GameProps) {
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
  const pointsPerPop = Math.floor(
    cap / (EXPECTED_POPS[ctx.difficulty] * maxLevel * RISK_FACTOR),
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

  const bubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const spawnAccRef = useRef(0);
  const poppedRef = useRef(0);
  const goldenRef = useRef(0);
  const creditedRef = useRef(0);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const [popped, setPopped] = useState(0);
  const [golden, setGolden] = useState(0);

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
      isWin: poppedRef.current > 0,
      levelReached: ctxRef.current.level,
      clientMeta: { popped: poppedRef.current, golden: goldenRef.current },
    });
  }, []);

  // Fin du temps d'un niveau.
  const handleTimeEnd = useCallback(() => {
    const current = ctxRef.current;
    if (finishedRef.current) return;

    if (current.level < maxLevel) {
      // Niveau suivant : on repart sur une scène propre.
      current.sound.play("level");
      later(() => {
        const latest = ctxRef.current;
        latest.setLevel(Math.min(maxLevel, latest.level + 1));
        bubblesRef.current = [];
        particlesRef.current = [];
        spawnAccRef.current = 0;
        countdownRef.current.start(durationSec);
        if (!ctxRef.current.running) countdownRef.current.pause();
      }, 600);
      return;
    }
    finishRun();
  }, [durationSec, finishRun, later, maxLevel]);
  endHandlerRef.current = handleTimeEnd;

  // ── Bulles ──────────────────────────────────────────────────────

  const spawnBubble = useCallback(() => {
    const { width, height } = sizeRef.current;
    const minDim = Math.min(width, height);
    const radius = minDim * (0.06 + Math.random() * 0.03);
    const goldenBubble = Math.random() < GOLDEN_CHANCE;
    const levelBonus = 1 + (ctxRef.current.level - 1) * 0.08;
    const bubbles = bubblesRef.current;

    bubbles.push({
      x: 0,
      y: height + radius,
      baseX: radius + Math.random() * Math.max(1, width - radius * 2),
      radius,
      speed:
        (height / 4.6) * levelBonus * (0.85 + Math.random() * 0.3) * (goldenBubble ? 1.25 : 1),
      swayAmp: minDim * (0.02 + Math.random() * 0.05),
      swayPhase: Math.random() * Math.PI * 2,
      swayFreq: 0.6 + Math.random() * 0.9,
      hue: 180 + Math.random() * 160,
      golden: goldenBubble,
      t: 0,
    });
    if (bubbles.length > 40) bubbles.shift();
  }, []);

  /** Gerbe de petits cercles qui s'ouvrent à l'éclatement. */
  const burst = useCallback((x: number, y: number, radius: number, hue: number) => {
    const particles = particlesRef.current;
    const count = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      particles.push({
        x: x + Math.cos(angle) * radius * 0.5,
        y: y + Math.sin(angle) * radius * 0.5,
        radius: Math.max(2, radius * 0.16),
        maxRadius: Math.max(6, radius * (0.45 + Math.random() * 0.4)),
        life: 1,
        hue,
      });
    }
    if (particles.length > 160) particles.splice(0, particles.length - 160);
  }, []);

  const popBubble = useCallback(
    (index: number) => {
      const current = ctxRef.current;
      const bubble = bubblesRef.current[index];
      if (!bubble) return;
      bubblesRef.current.splice(index, 1);

      current.sound.play("pop");
      burst(bubble.x, bubble.y, bubble.radius, bubble.hue);

      poppedRef.current += 1;
      if (bubble.golden) goldenRef.current += 1;
      setPopped(poppedRef.current);
      setGolden(goldenRef.current);

      // Budget de points : jamais au-delà de 95 % du plafond serveur.
      const base = pointsPerPop * (bubble.golden ? GOLDEN_MULTIPLIER : 1);
      const gain = Math.max(0, Math.min(base, cap - creditedRef.current));
      if (gain > 0) {
        creditedRef.current += gain;
        current.addScore(gain);
      }
    },
    [burst, cap, pointsPerPop],
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

      const bubbles = bubblesRef.current;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        const reach = bubble.radius * 1.1;
        const dx = x - bubble.x;
        const dy = y - bubble.y;
        if (dx * dx + dy * dy <= reach * reach) {
          popBubble(i);
          return;
        }
      }
    },
    [canvasRef, popBubble],
  );

  // Clavier (contrat §31) : Espace éclate la bulle la plus basse.
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
      const bubbles = bubblesRef.current;
      if (bubbles.length === 0) return;
      event.preventDefault();
      let lowest = 0;
      for (let i = 1; i < bubbles.length; i++) {
        if (bubbles[i].y > bubbles[lowest].y) lowest = i;
      }
      popBubble(lowest);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [popBubble]);

  // ── Boucle de rendu (pause = image figée) ───────────────────────

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const update = (dt: number) => {
      // Apparition régulière des bulles.
      spawnAccRef.current += dt * 1000;
      const interval = Math.max(120, spawnMs);
      let guard = 0;
      while (spawnAccRef.current >= interval && guard < 4) {
        guard += 1;
        spawnAccRef.current -= interval;
        spawnBubble();
      }

      // Montée + oscillation horizontale ; au sommet, disparition muette.
      const bubbles = bubblesRef.current;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        bubble.t += dt;
        bubble.y -= bubble.speed * dt;
        bubble.x =
          bubble.baseX +
          Math.sin(bubble.t * bubble.swayFreq * Math.PI * 2 + bubble.swayPhase) * bubble.swayAmp;
        if (bubble.y + bubble.radius < -8) bubbles.splice(i, 1);
      }

      // Particules d'éclatement.
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.life -= dt * 2.4;
        particle.radius += (particle.maxRadius - particle.radius) * Math.min(1, dt * 10);
        if (particle.life <= 0) particles.splice(i, 1);
      }
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const { width, height } = sizeRef.current;

      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, "#EAF2FF");
      background.addColorStop(1, "#F7F6FF");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      // Particules : cercles qui s'ouvrent en s'estompant.
      for (const particle of particlesRef.current) {
        context.globalAlpha = Math.max(0, particle.life) * 0.7;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = `hsl(${particle.hue} 90% 70%)`;
        context.fill();
      }
      context.globalAlpha = 1;

      // Bulles : dégradé + anneau ; les dorées portent une ⭐.
      for (const bubble of bubblesRef.current) {
        const gradient = context.createRadialGradient(
          bubble.x - bubble.radius * 0.35,
          bubble.y - bubble.radius * 0.35,
          bubble.radius * 0.15,
          bubble.x,
          bubble.y,
          bubble.radius,
        );
        if (bubble.golden) {
          gradient.addColorStop(0, "#FFF7DC");
          gradient.addColorStop(0.55, "#FFD34D");
          gradient.addColorStop(1, "#F5A623");
        } else {
          gradient.addColorStop(0, "rgba(255,255,255,0.95)");
          gradient.addColorStop(0.4, `hsl(${bubble.hue} 85% 80%)`);
          gradient.addColorStop(1, `hsl(${bubble.hue} 78% 62%)`);
        }

        context.beginPath();
        context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        context.fillStyle = gradient;
        context.fill();

        context.lineWidth = Math.max(2, bubble.radius * 0.08);
        context.strokeStyle = bubble.golden ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)";
        context.stroke();

        // Reflet de verre.
        context.beginPath();
        context.arc(
          bubble.x - bubble.radius * 0.34,
          bubble.y - bubble.radius * 0.34,
          bubble.radius * 0.16,
          0,
          Math.PI * 2,
        );
        context.fillStyle = "rgba(255,255,255,0.85)";
        context.fill();

        if (bubble.golden) {
          context.font = `${Math.round(bubble.radius * 1.1)}px serif`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText("⭐", bubble.x, bubble.y + bubble.radius * 0.05);
        }
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
  }, [canvasRef, spawnBubble, spawnMs]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <p className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        🫧 {popped} · ⭐ {golden}
      </p>

      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          if (event.button > 0) return;
          handleTap(event.clientX, event.clientY);
        }}
        className="touch-none rounded-2xl"
        aria-label="🫧"
      />
    </div>
  );
}
