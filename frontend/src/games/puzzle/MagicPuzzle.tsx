// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 02 : Puzzle Magique (moteur « puzzle »)
//  Reconstitue le dessin magique (peint au canvas : ciel, soleil,
//  arc-en-ciel, collines, étoiles) en échangeant les pièces taquins.
//  Contrôles : glisser-déposer, tap-tap et clavier (flèches + Entrée).
//  Zéro asset : le dessin est 100 % procédural (§5 du contrat).
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { cn } from "../../utils/cn";
import { formatMs, maxScoreFor } from "../engine/components";
import type { GameProps } from "../registry";

/** Résolution logique d'une pièce (avant mise à l'échelle CSS/DPR). */
const TILE_RES = 160;
/** Taille maximale de la grille (n × n). */
const MAX_GRID = 6;

/** Événement clavier minimal (inutile d'importer les types React). */
interface KeyLike {
  key: string;
  preventDefault: () => void;
}

/** Événement pointeur minimal. */
interface PointerLike {
  clientX: number;
  clientY: number;
}

// ── Le « dessin magique » 100 % procédural ────────────────────────

/** Petite étincelle à 4 branches (étoile décorative). */
function sparkle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.quadraticCurveTo(cx, cy, cx + r, cy);
  g.quadraticCurveTo(cx, cy, cx, cy + r);
  g.quadraticCurveTo(cx, cy, cx - r, cy);
  g.quadraticCurveTo(cx, cy, cx, cy - r);
  g.closePath();
  g.fill();
}

/** Peint la scène complète dans un espace logique w × h (déterministe). */
function drawScene(g: CanvasRenderingContext2D, w: number, h: number): void {
  const unit = Math.min(w, h);

  // 1. Ciel en dégradé (bleu → lumière chaude).
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#5FBFF2");
  sky.addColorStop(0.5, "#A9E0FF");
  sky.addColorStop(1, "#FFE3B0");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // 2. Soleil rayonnant.
  const sunX = w * 0.76;
  const sunY = h * 0.17;
  const sunR = unit * 0.1;
  const glow = g.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 2.4);
  glow.addColorStop(0, "rgba(255, 226, 110, 0.9)");
  glow.addColorStop(1, "rgba(255, 226, 110, 0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(sunX, sunY, sunR * 2.4, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "rgba(255, 208, 51, 0.9)";
  g.lineWidth = Math.max(1.5, unit * 0.018);
  g.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const inner = sunR * 1.35;
    const outer = sunR * (i % 2 === 0 ? 1.85 : 1.6);
    g.beginPath();
    g.moveTo(sunX + Math.cos(angle) * inner, sunY + Math.sin(angle) * inner);
    g.lineTo(sunX + Math.cos(angle) * outer, sunY + Math.sin(angle) * outer);
    g.stroke();
  }
  g.fillStyle = "#FFD93D";
  g.beginPath();
  g.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  g.fill();

  // 3. Nuages doux.
  const clouds: [number, number, number][] = [
    [0.16, 0.2, 0.075],
    [0.5, 0.11, 0.06],
    [0.9, 0.34, 0.07],
  ];
  g.fillStyle = "rgba(255, 255, 255, 0.88)";
  for (const [fx, fy, fr] of clouds) {
    const cx = fx * w;
    const cy = fy * h;
    const cr = fr * unit;
    g.beginPath();
    g.ellipse(cx, cy, cr * 1.7, cr, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cx + cr * 0.9, cy + cr * 0.15, cr * 1.1, cr * 0.75, 0, 0, Math.PI * 2);
    g.fill();
  }

  // 4. Arc-en-ciel.
  const rainbow = ["#FF5A5F", "#FF8A3D", "#FFD93D", "#4CD97B", "#4EA8FF", "#7C6BFF"];
  const arcX = w * 0.3;
  const arcY = h * 1.02;
  const arcR = unit * 0.46;
  const band = unit * 0.036;
  g.save();
  g.globalAlpha = 0.82;
  g.lineWidth = band;
  g.lineCap = "butt";
  rainbow.forEach((color, index) => {
    g.strokeStyle = color;
    g.beginPath();
    g.arc(arcX, arcY, arcR - index * band, Math.PI, Math.PI * 2);
    g.stroke();
  });
  g.restore();

  // 5. Collines vertes.
  g.fillStyle = "#8BD98C";
  g.beginPath();
  g.moveTo(-w * 0.05, h + 1);
  g.quadraticCurveTo(w * 0.3, h - unit * 0.42, w * 0.7, h + 1);
  g.closePath();
  g.fill();

  g.fillStyle = "#57C06B";
  g.beginPath();
  g.moveTo(w * 0.28, h + 1);
  g.quadraticCurveTo(w * 0.74, h - unit * 0.34, w * 1.05, h + 1);
  g.closePath();
  g.fill();

  // 6. Fleurs coquettes sur la colline avant.
  const flowers: [number, number, string][] = [
    [0.4, 0.9, "#FF8AB8"],
    [0.52, 0.94, "#FFF3DC"],
    [0.64, 0.88, "#FFD93D"],
    [0.76, 0.93, "#FF8AB8"],
    [0.88, 0.9, "#FFF3DC"],
    [0.46, 0.97, "#FFD93D"],
  ];
  for (const [fx, fy, color] of flowers) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(fx * w, fy * h, unit * 0.014, 0, Math.PI * 2);
    g.fill();
  }

  // 7. Étoiles scintillantes (le côté « magique » du dessin).
  const stars: [number, number, number][] = [
    [0.05, 0.07, 0.02],
    [0.17, 0.13, 0.014],
    [0.28, 0.05, 0.017],
    [0.4, 0.12, 0.013],
    [0.53, 0.04, 0.018],
    [0.65, 0.1, 0.014],
    [0.86, 0.07, 0.017],
    [0.94, 0.2, 0.013],
    [0.1, 0.3, 0.013],
    [0.34, 0.28, 0.011],
    [0.6, 0.24, 0.015],
    [0.72, 0.3, 0.011],
    [0.22, 0.42, 0.012],
    [0.82, 0.44, 0.012],
  ];
  g.fillStyle = "rgba(255, 255, 255, 0.95)";
  for (const [fx, fy, fr] of stars) {
    sparkle(g, fx * w, fy * h, fr * unit);
  }
}

// ── Une pièce : un petit canvas qui montre SA portion du dessin ────

interface TileCanvasProps {
  /** Position d'origine de la pièce (0 → n² - 1). */
  piece: number;
  /** Taille de la grille (n). */
  grid: number;
}

function TileCanvas({ piece, grid }: TileCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(TILE_RES * dpr);
    canvas.height = Math.round(TILE_RES * dpr);
    const g = canvas.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, TILE_RES, TILE_RES);
    // Décale la scène pour n'afficher que la case d'origine de la pièce.
    g.save();
    g.translate(-(piece % grid) * TILE_RES, -Math.floor(piece / grid) * TILE_RES);
    drawScene(g, grid * TILE_RES, grid * TILE_RES);
    g.restore();
    // Fin liseré pour bien séparer les pièces.
    g.strokeStyle = "rgba(45, 42, 69, 0.14)";
    g.lineWidth = 2;
    g.strokeRect(1, 1, TILE_RES - 2, TILE_RES - 2);
  }, [piece, grid]);

  return <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />;
}

// ── Mélange : 200 échanges aléatoires, jamais résolu, jamais trop lisse ──

function shufflePieces(total: number): number[] {
  const minimumOff = Math.min(12, Math.max(2, total - 2));
  for (let attempt = 0; attempt < 60; attempt++) {
    const pieces = Array.from({ length: total }, (_, index) => index);
    for (let move = 0; move < 200; move++) {
      const a = Math.floor(Math.random() * total);
      let b = Math.floor(Math.random() * total);
      if (b === a) b = (b + 1) % total;
      [pieces[a], pieces[b]] = [pieces[b], pieces[a]];
    }
    const wrong = pieces.reduce(
      (count, piece, index) => (piece === index ? count : count + 1),
      0,
    );
    if (wrong >= minimumOff) return pieces;
  }
  // Secours (très improbable) : rotation garantie non résolue.
  return Array.from({ length: total }, (_, index) => (index + 1) % total);
}

function isSolved(pieces: number[]): boolean {
  return pieces.every((piece, index) => piece === index);
}

// ── Le jeu ────────────────────────────────────────────────────────

export function MagicPuzzle({ ctx }: GameProps) {
  const settings = ctx.game.config.settings as
    | { sizes?: Partial<Record<DifficultyKey, number>> }
    | undefined;
  const baseSize = settings?.sizes?.[ctx.difficulty] ?? 3;
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);
  const level = Math.min(Math.max(1, ctx.level), maxLevel);
  const size = Math.min(MAX_GRID, Math.max(2, baseSize + (level - 1)));

  // Budget : une partie parfaite ≈ 95 % du plafond serveur (§3).
  const cap = maxScoreFor(ctx.game, ctx.difficulty);
  const levelPoints = Math.max(1, Math.floor((cap * 0.95) / maxLevel));

  const [arrangement, setArrangement] = useState<number[]>(() => shufflePieces(size * size));
  const [moves, setMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const arrangementRef = useRef(arrangement);
  arrangementRef.current = arrangement;
  const selectedRef = useRef<number | null>(null);
  const dragRef = useRef<{ index: number; x: number; y: number; active: boolean } | null>(null);
  const hoverRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const lockedRef = useRef(false);
  const finishedRef = useRef(false);
  const totalMovesRef = useRef(0);
  const levelMovesRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const clockRef = useRef({ last: performance.now(), acc: 0 });

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  // Nouveau mélange à chaque niveau (montage = début de partie).
  useEffect(() => {
    const pieces = shufflePieces(size * size);
    arrangementRef.current = pieces;
    setArrangement(pieces);
    selectedRef.current = null;
    setSelected(null);
    dragRef.current = null;
    hoverRef.current = null;
    setDragIndex(null);
    setHoverCell(null);
    lockedRef.current = false;
    levelMovesRef.current = 0;
    setMoves(totalMovesRef.current);
    setCursor(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, size]);

  // Chronomètre affiché (mis en pause avec la partie, jamais négatif).
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      const clock = clockRef.current;
      if (ctxRef.current.running) clock.acc += now - clock.last;
      clock.last = now;
      setElapsedMs(clock.acc);
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const completeLevel = useCallback(() => {
    const current = ctxRef.current;
    if (finishedRef.current) return;
    const minMoves = size * size;
    const quality = Math.min(
      1,
      Math.max(0.35, 1 - (levelMovesRef.current - minMoves) / (minMoves * 3)),
    );
    current.addScore(Math.round(levelPoints * quality));
    if (level >= maxLevel) {
      // Fin de partie : le shell joue le son de victoire (§4).
      finishedRef.current = true;
      current.finish({
        clientMeta: { moves: totalMovesRef.current, levelMoves: levelMovesRef.current },
      });
    } else {
      current.sound.play("level");
      later(() => {
        const latest = ctxRef.current;
        latest.setLevel(Math.min(maxLevel, latest.level + 1));
      }, 600);
    }
  }, [later, level, levelPoints, maxLevel, size]);

  const swap = useCallback(
    (a: number, b: number) => {
      const current = ctxRef.current;
      if (!current.running || lockedRef.current || a === b) return;
      const next = [...arrangementRef.current];
      [next[a], next[b]] = [next[b], next[a]];
      arrangementRef.current = next;
      setArrangement(next);
      totalMovesRef.current += 1;
      levelMovesRef.current += 1;
      setMoves(totalMovesRef.current);
      current.sound.play("pop");
      if (isSolved(next)) {
        lockedRef.current = true;
        selectedRef.current = null;
        setSelected(null);
        completeLevel();
      }
    },
    [completeLevel],
  );

  // Tap-tap, clic souris ou Entrée/Espace (activation native du bouton).
  const activate = useCallback(
    (index: number) => {
      const current = ctxRef.current;
      if (!current.running || lockedRef.current || suppressClickRef.current) return;
      const picked = selectedRef.current;
      if (picked === null) {
        selectedRef.current = index;
        setSelected(index);
        current.sound.play("flip");
        return;
      }
      if (picked === index) {
        selectedRef.current = null;
        setSelected(null);
        current.sound.play("click");
        return;
      }
      selectedRef.current = null;
      setSelected(null);
      swap(picked, index);
    },
    [swap],
  );

  const startPointer = useCallback((index: number, event: PointerLike) => {
    if (!ctxRef.current.running || lockedRef.current) return;
    dragRef.current = { index, x: event.clientX, y: event.clientY, active: false };
  }, []);

  // Glisser-déposer (souris et tactile) : suivi global du pointeur.
  useEffect(() => {
    const clearDrag = () => {
      dragRef.current = null;
      hoverRef.current = null;
      setDragIndex(null);
      setHoverCell(null);
    };

    const cellAt = (x: number, y: number): number | null => {
      const found = document.elementFromPoint(x, y);
      const cell = found instanceof Element ? found.closest("[data-cell]") : null;
      const raw = cell?.getAttribute("data-cell");
      if (raw === null || raw === undefined) return null;
      const value = Number(raw);
      return Number.isInteger(value) ? value : null;
    };

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.active) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (dx * dx + dy * dy < 36) return; // < 6 px : c'est un simple tap
        drag.active = true;
        setDragIndex(drag.index);
      }
      const target = cellAt(event.clientX, event.clientY);
      if (hoverRef.current !== target) {
        hoverRef.current = target;
        setHoverCell(target);
      }
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const wasActive = drag.active;
      const source = drag.index;
      clearDrag();
      if (!wasActive) return; // tap → géré par onClick
      // Un vrai glisser-déposer ne doit pas déclencher le clic de sélection.
      suppressClickRef.current = true;
      later(() => {
        suppressClickRef.current = false;
      }, 80);
      const target = cellAt(event.clientX, event.clientY);
      if (target === null || target === source) return;
      selectedRef.current = null;
      setSelected(null);
      swap(source, target);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", clearDrag);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", clearDrag);
    };
  }, [later, swap]);

  // Flèches : déplace la sélection clavier ; Entrée/Espace : échange.
  const handleTileKey = (index: number, event: KeyLike): void => {
    const col = index % size;
    const row = Math.floor(index / size);
    let next = index;
    if (event.key === "ArrowLeft" && col > 0) next = index - 1;
    else if (event.key === "ArrowRight" && col < size - 1) next = index + 1;
    else if (event.key === "ArrowUp" && row > 0) next = index - size;
    else if (event.key === "ArrowDown" && row < size - 1) next = index + size;
    else return;
    event.preventDefault();
    setCursor(next);
    buttonsRef.current[next]?.focus();
  };

  const total = size * size;
  const tiles =
    arrangement.length === total
      ? arrangement
      : Array.from({ length: total }, (_, index) => index);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <p className="chip bg-primary-soft text-primary-dark" aria-live="polite">
          🔄 {moves}
        </p>
        <p className="chip bg-secondary-soft text-ink">⏱ {formatMs(elapsedMs)}</p>
      </div>

      <div
        role="group"
        aria-label="🧩"
        dir="ltr"
        className="grid w-full max-w-[min(88vw,520px)] touch-none gap-[3px] rounded-2xl bg-white p-[3px] shadow-soft"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {tiles.map((piece, index) => (
          <button
            key={index}
            type="button"
            ref={(element) => {
              buttonsRef.current[index] = element;
            }}
            data-cell={index}
            tabIndex={cursor === index ? 0 : -1}
            aria-label={`${index + 1}`}
            aria-pressed={selected === index}
            onFocus={() => setCursor(index)}
            onKeyDown={(event) => handleTileKey(index, event)}
            onPointerDown={(event) => startPointer(index, event)}
            onClick={() => activate(index)}
            className={cn(
              "relative aspect-square w-full overflow-hidden rounded-[10px] bg-primary-soft no-select touch-none transition-all duration-150",
              selected === index && "z-10 scale-95 ring-4 ring-primary",
              dragIndex === index && "z-10 scale-105 shadow-pop ring-4 ring-primary-light",
              dragIndex !== null && hoverCell === index && dragIndex !== index && "ring-4 ring-accent",
            )}
          >
            <TileCanvas piece={piece} grid={size} />
          </button>
        ))}
      </div>
    </div>
  );
}
