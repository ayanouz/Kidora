// ══════════════════════════════════════════════════════════════════
//  KIDORA — Jeu 11 : Arkadaş (moteur « arkadas »)
//  Remake du jeu Fıstık « Arkadaş » : crée ton copain rigolo (flèches),
//  puis tape-le avec le bon outil pendant 3 manches chronométrées.
//  🖐️ gifle · 🤏 pince · 🤗 caresse — suis la cible affichée !
//  Canvas procédural — zéro asset, zéro texte en dur (§33/§44).
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyKey } from "../../config";
import { useCanvas, useCountdown } from "../engine/hooks";
import type { GameProps } from "../registry";

// ── Réglages ─────────────────────────────────────────────────────

type LookKey = "head" | "hair" | "eyes" | "nose" | "mouth" | "beard";
type Look = Record<LookKey, number>;
type ToolId = 1 | 2 | 3;
type Expr = "idle" | "pain" | "squeeze" | "joy" | "sad";
type Phase = "create" | "fight";

const ROUND_SEC: Record<DifficultyKey, number> = { easy: 16, medium: 18, hard: 20 };
/** Nombre de coups « parfaits » couverts par le plafond (marge anti-triche). */
const HIT_BUDGET = 55;

const DEFAULT_LOOK: Look = { head: 1, hair: 1, eyes: 1, nose: 1, mouth: 1, beard: 1 };

const CATS: { key: LookKey; emoji: string; n: number }[] = [
  { key: "head", emoji: "🙂", n: 5 },
  { key: "hair", emoji: "💇", n: 5 },
  { key: "eyes", emoji: "👀", n: 5 },
  { key: "nose", emoji: "👃", n: 4 },
  { key: "mouth", emoji: "👄", n: 4 },
  { key: "beard", emoji: "🧔", n: 3 },
];

const TOOLS: { id: ToolId; emoji: string }[] = [
  { id: 1, emoji: "🖐️" },
  { id: 2, emoji: "🤏" },
  { id: 3, emoji: "🤗" },
];

const TARGET_EMOJI: Record<ToolId, string> = { 1: "🖐️", 2: "🤏", 3: "🤗" };

interface Reaction {
  kind: 0 | ToolId;
  t: number;
  dur: number;
  side: 1 | -1;
}

interface Particle {
  e: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

interface HandFx {
  kind: ToolId;
  x: number;
  y: number;
  side: 1 | -1;
  t: number;
}

// ── Palette & petites aides de dessin ────────────────────────────

const TAU = Math.PI * 2;
const SKIN = "#f2c7a0";
const INK = "#3a2a20";
const HAIR = "#2b2320";
const HAIR_L = "#5b4a3f";
const TANK = "#fbf7ef";

const HEAD: Record<number, { w: number; h: number; sq: number }> = {
  1: { w: 92, h: 122, sq: 0.15 },
  2: { w: 86, h: 106, sq: 0.55 },
  3: { w: 98, h: 114, sq: 0.85 },
  4: { w: 78, h: 130, sq: 0.2 },
  5: { w: 106, h: 104, sq: 0.5 },
};

function rr(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
}

function ellipse(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = 0,
): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
}

// ── Tête, corps, cou, oreilles ───────────────────────────────────

function headPath(c: CanvasRenderingContext2D, v: number): void {
  const { w, h, sq } = HEAD[v] ?? HEAD[1];
  c.beginPath();
  c.moveTo(0, -h);
  c.bezierCurveTo(w * 0.92, -h, w, -h * 0.28, w, 8);
  c.bezierCurveTo(w, h * (0.62 + sq * 0.18), w * 0.52, h, 0, h);
  c.bezierCurveTo(-w * 0.52, h, -w, h * (0.62 + sq * 0.18), -w, 8);
  c.bezierCurveTo(-w, -h * 0.28, -w * 0.92, -h, 0, -h);
  c.closePath();
}

function drawBody(c: CanvasRenderingContext2D): void {
  // Torse (peau) — les épaules sont coupées par le bas du plateau.
  c.beginPath();
  c.moveTo(-168, 300);
  c.quadraticCurveTo(-142, 198, -54, 174);
  c.lineTo(54, 174);
  c.quadraticCurveTo(142, 198, 168, 300);
  c.closePath();
  c.fillStyle = SKIN;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.stroke();

  // Débardeur blanc.
  c.beginPath();
  c.moveTo(-140, 312);
  c.quadraticCurveTo(-120, 212, -46, 186);
  c.lineTo(-32, 186);
  c.lineTo(-25, 232);
  c.quadraticCurveTo(0, 245, 25, 232);
  c.lineTo(32, 186);
  c.lineTo(46, 186);
  c.quadraticCurveTo(120, 212, 140, 312);
  c.closePath();
  c.fillStyle = TANK;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 2.6;
  c.stroke();

  c.strokeStyle = "rgba(58,42,32,.22)";
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-46, 194);
  c.quadraticCurveTo(-84, 224, -92, 284);
  c.stroke();
  c.beginPath();
  c.moveTo(46, 194);
  c.quadraticCurveTo(84, 224, 92, 284);
  c.stroke();
}

function drawNeck(c: CanvasRenderingContext2D): void {
  rr(c, -25, 76, 50, 168, 20);
  c.fillStyle = SKIN;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 2.6;
  c.stroke();

  c.strokeStyle = "rgba(150,90,55,.35)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-15, 152);
  c.quadraticCurveTo(0, 158, 15, 152);
  c.stroke();
  c.beginPath();
  c.moveTo(-14, 176);
  c.quadraticCurveTo(0, 182, 14, 176);
  c.stroke();
}

function drawEars(c: CanvasRenderingContext2D, hw: number): void {
  for (const s of [-1, 1]) {
    ellipse(c, s * (hw - 2), 6, 22, 30, s * 0.1);
    c.fillStyle = SKIN;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
    ellipse(c, s * (hw - 2), 8, 11, 17, s * 0.1);
    c.strokeStyle = "rgba(150,90,55,.5)";
    c.lineWidth = 1.6;
    c.stroke();
  }
}

// ── Yeux & sourcils ──────────────────────────────────────────────

function drawBrows(
  c: CanvasRenderingContext2D,
  mode: number,
  expr: Expr,
): void {
  const y = expr === "sad" || expr === "pain" ? -48 : -52;
  c.strokeStyle = HAIR;
  c.lineWidth = mode === 5 ? 7 : 9;
  c.lineCap = "round";
  for (const s of [-1, 1]) {
    c.beginPath();
    if (expr === "sad" || expr === "pain") {
      c.moveTo(s * 18, y - 2);
      c.lineTo(s * 58, y + 8);
    } else if (expr === "joy") {
      c.moveTo(s * 20, y + 3);
      c.quadraticCurveTo(s * 38, y - 8, s * 56, y);
    } else if (mode === 3) {
      c.moveTo(s * 18, y + 7);
      c.lineTo(s * 58, y - 3);
    } else if (mode === 2) {
      c.moveTo(s * 20, y + 1);
      c.quadraticCurveTo(s * 38, y - 5, s * 57, y + 1);
    } else {
      c.moveTo(s * 20, y + 4);
      c.quadraticCurveTo(s * 38, y - 4, s * 56, y + 2);
    }
    c.stroke();
  }
}

function drawEyes(
  c: CanvasRenderingContext2D,
  mode: number,
  expr: Expr,
  blink: boolean,
  lookX: number,
): void {
  const EY = -26;
  const EX = 38;

  if (mode === 5) {
    // Lunettes de soleil.
    c.fillStyle = "#221c18";
    rr(c, -60, -40, 48, 26, 8);
    c.fill();
    rr(c, 12, -40, 48, 26, 8);
    c.fill();
    c.strokeStyle = "#221c18";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-12, -28);
    c.lineTo(12, -28);
    c.stroke();
    c.fillStyle = "rgba(150,220,255,.28)";
    rr(c, -54, -36, 18, 8, 4);
    c.fill();
    rr(c, 18, -36, 18, 8, 4);
    c.fill();
    return;
  }

  for (const s of [-1, 1]) {
    const x = s * EX;

    if (expr === "pain") {
      c.strokeStyle = INK;
      c.lineWidth = 3.6;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x - 9, EY - 8);
      c.lineTo(x + 9, EY + 8);
      c.moveTo(x + 9, EY - 8);
      c.lineTo(x - 9, EY + 8);
      c.stroke();
      continue;
    }

    if (expr === "joy" || expr === "squeeze" || blink || mode === 4) {
      c.strokeStyle = INK;
      c.lineWidth = 3.2;
      c.lineCap = "round";
      c.beginPath();
      if (expr === "joy" || mode === 4) {
        c.arc(x, EY + 3, 12, Math.PI * 1.13, Math.PI * 1.87);
      } else {
        c.moveTo(x - 12, EY + 1);
        c.quadraticCurveTo(x, EY + 6, x + 12, EY + 1);
      }
      c.stroke();
      continue;
    }

    ellipse(c, x, EY, 19, 13);
    c.fillStyle = "#fffdf7";
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.stroke();

    const ix = lookX * 4 + (mode === 3 ? s * 2 : 0);
    circle(c, x + ix, EY + 1, 7);
    c.fillStyle = "#6b4326";
    c.fill();
    circle(c, x + ix, EY + 1, 3.4);
    c.fillStyle = "#1b120c";
    c.fill();

    const drop = expr === "sad" ? 6 : mode === 2 ? -7 : mode === 3 ? 1 : 4;
    c.beginPath();
    c.moveTo(x - 22, EY - 18);
    c.lineTo(x + 22, EY - 18);
    c.lineTo(x + 22, EY - 3);
    c.quadraticCurveTo(x, EY + drop, x - 22, EY - 3);
    c.closePath();
    c.fillStyle = SKIN;
    c.fill();

    c.beginPath();
    c.moveTo(x - 20, EY - 3);
    c.quadraticCurveTo(x, EY + drop, x + 20, EY - 3);
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.stroke();
  }
}

// ── Nez & bouche ─────────────────────────────────────────────────

function drawNose(c: CanvasRenderingContext2D, v: number): void {
  const cfg =
    [
      { rx: 21, tip: 30, bridge: 9 },
      { rx: 15, tip: 26, bridge: 7 },
      { rx: 12, tip: 40, bridge: 6 },
      { rx: 26, tip: 24, bridge: 11 },
    ][v - 1] ?? { rx: 21, tip: 30, bridge: 9 };
  const { rx, tip, bridge } = cfg;

  c.beginPath();
  c.moveTo(-bridge, -10);
  c.quadraticCurveTo(0, -17, bridge, -10);
  c.bezierCurveTo(bridge + 3, 8, rx * 0.8, tip - 10, rx, tip);
  c.quadraticCurveTo(0, tip + 15, -rx, tip);
  c.bezierCurveTo(-rx * 0.8, tip - 10, -bridge - 3, 8, -bridge, -10);
  c.closePath();
  c.fillStyle = SKIN;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 2.5;
  c.stroke();

  c.strokeStyle = "rgba(130,75,45,.4)";
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(-rx * 0.45, tip + 2, 4.5, 0.15, Math.PI - 0.15);
  c.stroke();
  c.beginPath();
  c.arc(rx * 0.45, tip + 2, 4.5, 0.15, Math.PI - 0.15);
  c.stroke();

  c.fillStyle = "rgba(255,255,255,.28)";
  ellipse(c, -rx * 0.3, tip - 7, 5, 3, -0.4);
  c.fill();
}

function drawMouth(
  c: CanvasRenderingContext2D,
  v: number,
  expr: Expr,
): void {
  const y = 74;

  if (expr === "pain") {
    ellipse(c, 0, y + 2, 26, 20);
    c.fillStyle = "#5a2020";
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
    c.fillStyle = "#fffdf3";
    rr(c, -18, y - 10, 36, 9, 3);
    c.fill();
    ellipse(c, 2, y + 12, 11, 6);
    c.fillStyle = "#d96b6b";
    c.fill();
    return;
  }

  if (expr === "squeeze") {
    c.strokeStyle = INK;
    c.lineWidth = 2.8;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-16, y);
    c.quadraticCurveTo(-8, y + 5, 0, y);
    c.quadraticCurveTo(8, y - 5, 16, y);
    c.stroke();
    return;
  }

  if (expr === "sad") {
    c.strokeStyle = INK;
    c.lineWidth = 2.8;
    c.lineCap = "round";
    c.beginPath();
    c.arc(0, y + 16, 18, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
    return;
  }

  if (expr === "joy") {
    c.beginPath();
    c.moveTo(-28, y - 6);
    c.quadraticCurveTo(0, y + 28, 28, y - 6);
    c.quadraticCurveTo(0, y + 12, -28, y - 6);
    c.closePath();
    c.fillStyle = "#5a2020";
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
    c.fillStyle = "#fffdf3";
    rr(c, -16, y - 5, 32, 8, 3);
    c.fill();
    ellipse(c, 4, y + 14, 10, 6);
    c.fillStyle = "#d96b6b";
    c.fill();
    return;
  }

  if (v === 1) {
    // Dents de lapin + lèvre tombante (le classique).
    c.beginPath();
    c.moveTo(-34, y - 4);
    c.quadraticCurveTo(0, y - 16, 34, y - 4);
    c.quadraticCurveTo(0, y + 20, -34, y - 4);
    c.closePath();
    c.fillStyle = "#5a2020";
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
    c.fillStyle = "#fffdf3";
    for (let i = 0; i < 4; i++) {
      rr(c, -22 + i * 11, y - 6, 9, 11, 2);
      c.fill();
    }
    c.strokeStyle = "rgba(60,25,15,.55)";
    c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(-19 + i * 11, y - 5);
      c.lineTo(-19 + i * 11, y + 4);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(0, y + 15);
    c.quadraticCurveTo(4, y + 19, 8, y + 15);
    c.strokeStyle = "rgba(130,75,45,.5)";
    c.lineWidth = 1.8;
    c.stroke();
  } else if (v === 2) {
    c.strokeStyle = INK;
    c.lineWidth = 2.8;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-26, y);
    c.quadraticCurveTo(0, y + 22, 26, y);
    c.stroke();
    c.strokeStyle = "rgba(130,75,45,.35)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-12, y + 18);
    c.quadraticCurveTo(0, y + 22, 12, y + 18);
    c.stroke();
  } else if (v === 3) {
    ellipse(c, 0, y + 2, 25, 19);
    c.fillStyle = "#5a2020";
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
    c.fillStyle = "#fffdf3";
    rr(c, -17, y - 10, 34, 8, 3);
    c.fill();
    ellipse(c, 2, y + 10, 12, 7);
    c.fillStyle = "#d96b6b";
    c.fill();
  } else {
    c.beginPath();
    c.moveTo(-26, y - 3);
    c.quadraticCurveTo(0, y + 16, 26, y - 3);
    c.closePath();
    c.fillStyle = "#5a2020";
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
    ellipse(c, 6, y + 6, 12, 8);
    c.fillStyle = "#d96b6b";
    c.fill();
    c.strokeStyle = "rgba(60,25,15,.4)";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(6, y + 2);
    c.lineTo(6, y + 10);
    c.stroke();
  }
}

// ── Barbe (points de barbe, bouc, moustache) ─────────────────────

const STUBBLE: { x: number; y: number; s: number }[] = (() => {
  let seed = 11;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const out: { x: number; y: number; s: number }[] = [];
  let guard = 0;
  while (out.length < 100 && guard++ < 5000) {
    const x = rnd() * 168 - 84;
    const jaw = 130 - Math.pow(Math.abs(x) / 84, 2) * 38;
    const y = 54 + rnd() * (jaw - 54);
    if (Math.abs(x) < 40 && y < 94) continue;
    if (y > jaw - 4) continue;
    out.push({ x, y, s: 0.7 + rnd() * 1.1 });
  }
  return out;
})();

function drawBeard(
  c: CanvasRenderingContext2D,
  v: number,
  hh: number,
): void {
  if (v === 1) {
    // Barbe de trois jours : un semis de petits points.
    c.beginPath();
    c.moveTo(-80, 44);
    c.bezierCurveTo(-90, 94, -50, 124, 0, 130);
    c.bezierCurveTo(50, 124, 90, 94, 80, 44);
    c.bezierCurveTo(70, 102, 40, 120, 0, 122);
    c.bezierCurveTo(-40, 120, -70, 102, -80, 44);
    c.closePath();
    c.fillStyle = "rgba(45,30,22,.07)";
    c.fill();
    c.fillStyle = "rgba(40,28,22,.42)";
    const ky = hh / 126;
    for (const d of STUBBLE) {
      circle(c, d.x, d.y * ky, d.s);
      c.fill();
    }
    return;
  }

  if (v === 2) {
    // Bouc / collier de barbe.
    c.beginPath();
    c.moveTo(-74, 20);
    c.bezierCurveTo(-84, hh * 0.55, -48, hh - 2, 0, hh + 4);
    c.bezierCurveTo(48, hh - 2, 84, hh * 0.55, 74, 20);
    c.bezierCurveTo(66, hh * 0.45, 40, hh - 16, 0, hh - 8);
    c.bezierCurveTo(-40, hh - 16, -66, hh * 0.45, -74, 20);
    c.closePath();
    c.fillStyle = HAIR;
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.35)";
    c.lineWidth = 2;
    c.stroke();

    const sy = Math.min(hh - 8, 108);
    c.beginPath();
    c.moveTo(0, sy - 12);
    c.quadraticCurveTo(9, sy, 0, sy + 10);
    c.quadraticCurveTo(-9, sy, 0, sy - 12);
    c.fillStyle = HAIR;
    c.fill();
    return;
  }

  // Moustache + petite mouche.
  c.strokeStyle = HAIR;
  c.lineWidth = 7;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-30, 66);
  c.quadraticCurveTo(-10, 58, 0, 66);
  c.quadraticCurveTo(10, 58, 30, 66);
  c.stroke();
  const sy = Math.min(hh - 8, 102);
  c.beginPath();
  c.moveTo(0, sy - 10);
  c.quadraticCurveTo(8, sy, 0, sy + 8);
  c.quadraticCurveTo(-8, sy, 0, sy - 10);
  c.fillStyle = HAIR;
  c.fill();
}

// ── Cheveux ──────────────────────────────────────────────────────

function drawHair(
  c: CanvasRenderingContext2D,
  v: number,
  headV: number,
): void {
  const hw = (HEAD[headV] ?? HEAD[1]).w;
  const k = hw / 92;

  if (v === 1) {
    // Hérissé.
    c.beginPath();
    c.moveTo(-hw - 2, -26);
    c.bezierCurveTo(-hw - 8, -88, -62, -128, -46, -132);
    const spikes: [number, number][] = [
      [-46, -132],
      [-38, -158],
      [-24, -134],
      [-10, -162],
      [4, -134],
      [20, -160],
      [34, -130],
      [50, -152],
      [62, -124],
      [78, -142],
      [86, -108],
    ];
    for (const [px, py] of spikes) c.lineTo(px * k, py);
    c.bezierCurveTo(hw + 6, -86, hw + 4, -52, hw + 2, -26);
    c.lineTo(hw - 8, -58);
    c.lineTo(hw - 22, -48);
    c.lineTo(hw - 34, -70);
    c.lineTo(hw - 52, -58);
    c.lineTo(hw - 64, -78);
    c.lineTo(hw - 82, -60);
    c.lineTo(-hw + 4, -34);
    c.closePath();
    c.fillStyle = HAIR;
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.5)";
    c.lineWidth = 1.6;
    c.stroke();

    c.strokeStyle = HAIR_L;
    c.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.moveTo((-44 + i * 18) * k, -132 + (i % 2) * 8);
      c.quadraticCurveTo((-20 + i * 14) * k, -100, (-6 + i * 10) * k, -70);
      c.stroke();
    }
  } else if (v === 2) {
    // Banane / pompadour.
    c.beginPath();
    c.moveTo(-hw + 4, -34);
    c.bezierCurveTo(-hw - 10, -92, -62, -136, -26, -140);
    c.bezierCurveTo(-2, -144, 12, -162, 20, -188);
    c.bezierCurveTo(34, -170, 44, -148, 56, -138);
    c.bezierCurveTo(78, -122, hw + 4, -84, hw - 2, -36);
    c.bezierCurveTo(hw - 26, -62, 40, -78, 8, -66);
    c.bezierCurveTo(-18, -56, -52, -34, -hw + 4, -34);
    c.closePath();
    c.fillStyle = "#3b3734";
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.5)";
    c.lineWidth = 1.6;
    c.stroke();

    c.strokeStyle = "rgba(255,255,255,.2)";
    c.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.moveTo(-50 + i * 12, -40 - i * 4);
      c.quadraticCurveTo(-20 + i * 14, -110 - i * 8, 6 + i * 10, -150 + i * 6);
      c.stroke();
    }
  } else if (v === 3) {
    // Chauve avec petites touffes.
    ellipse(c, 0, -HEAD[headV].h * 0.58, hw * 0.4, 13, 0);
    c.fillStyle = "rgba(255,255,255,.3)";
    c.fill();
    for (const s of [-1, 1]) {
      ellipse(c, s * (hw - 1), -4, 15, 24, s * 0.3);
      c.fillStyle = HAIR;
      c.fill();
      c.strokeStyle = "rgba(0,0,0,.4)";
      c.lineWidth = 1.4;
      c.stroke();
    }
  } else if (v === 4) {
    // Crête iroquoise.
    const top = -HEAD[headV].h + 6;
    c.beginPath();
    c.moveTo(-38, top + 12);
    c.lineTo(-30, -156);
    c.lineTo(-18, top + 6);
    c.lineTo(-8, -172);
    c.lineTo(2, top + 6);
    c.lineTo(12, -166);
    c.lineTo(22, top + 8);
    c.lineTo(32, -150);
    c.lineTo(38, top + 16);
    c.closePath();
    c.fillStyle = HAIR;
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.5)";
    c.lineWidth = 1.6;
    c.stroke();
    // Côtés rasés.
    c.fillStyle = "rgba(43,35,32,.35)";
    for (let i = 0; i < 14; i++) {
      const s = i % 2 === 0 ? 1 : -1;
      const x = s * (28 + ((i * 13) % 46));
      const y = -60 + ((i * 17) % 38);
      circle(c, x, y, 1.3);
      c.fill();
    }
  } else {
    // Bouclé.
    const curls: [number, number, number][] = [
      [-68, -78, 25],
      [-40, -108, 29],
      [-6, -120, 31],
      [30, -110, 28],
      [62, -84, 24],
      [-80, -40, 19],
      [80, -44, 19],
    ];
    for (const [x, y, r] of curls) {
      circle(c, x * k, y, r);
      c.fillStyle = HAIR;
      c.fill();
      c.strokeStyle = "rgba(0,0,0,.45)";
      c.lineWidth = 1.4;
      c.stroke();
    }
    c.strokeStyle = HAIR_L;
    c.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc((-46 + i * 30) * k, -96 + (i % 2) * 10, 12, 0.4, 2.4);
      c.stroke();
    }
  }
}

// ── Mains croisées + bave ───────────────────────────────────────

function drawOneHand(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rot: number,
  s: number,
): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(s, s);

  rr(c, -15, 16, 30, 34, 12);
  c.fillStyle = SKIN;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 3.2;
  c.stroke();

  rr(c, -20, -10, 40, 34, 13);
  c.fillStyle = SKIN;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.stroke();

  const fingers: [number, number, number][] = [
    [-14, -0.16, 28],
    [-5, -0.04, 35],
    [4, 0.03, 32],
    [13, 0.1, 26],
  ];
  for (const [fx, a, len] of fingers) {
    c.save();
    c.translate(fx, -8);
    c.rotate(a);
    rr(c, -4.5, -len, 9, len + 10, 4.5);
    c.fillStyle = SKIN;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();
    c.restore();
  }

  c.save();
  c.translate(-19, 6);
  c.rotate(-1);
  rr(c, -4.5, -10, 9, 24, 4.5);
  c.fillStyle = SKIN;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 2.4;
  c.stroke();
  c.restore();

  c.strokeStyle = "rgba(130,75,45,.32)";
  c.lineWidth = 1.1;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(-15 + i * 9, 4);
    c.lineTo(-15 + i * 9, 8);
    c.stroke();
  }
  c.restore();
}

function drawHands(c: CanvasRenderingContext2D, t: number): void {
  const s = Math.sin(t * 0.9) * 1.6;
  c.save();
  c.lineCap = "round";
  const arm = (x1: number, y1: number, x2: number, y2: number): void => {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = INK;
    c.lineWidth = 27;
    c.stroke();
    c.strokeStyle = SKIN;
    c.lineWidth = 21;
    c.stroke();
  };
  arm(-62 + s * 0.4, 252, -26 + s, 190);
  arm(62 + s * 0.4, 252, 26 + s, 190);
  c.restore();

  drawOneHand(c, 13 + s * 0.3, 164, -0.3, 0.95);
  drawOneHand(c, -13 + s * 0.3, 158, 0.3, 1);
}

function drawDrool(c: CanvasRenderingContext2D, t: number): void {
  const strands: [number, number, number, number, number, number][] = [
    [-10, 88, -24, 150, 0.4, 2.8],
    [6, 90, 16, 154, 1.9, 2.2],
    [18, 86, 32, 140, 3.2, 1.8],
  ];
  c.save();
  c.lineCap = "round";
  for (const [x1, y1, x2, y2, ph, w] of strands) {
    const wob = Math.sin(t * 1.3 + ph) * 5;
    c.beginPath();
    c.moveTo(x1, y1);
    c.bezierCurveTo(x1 + wob, y1 + 24, x2 - wob, y2 - 28, x2, y2);
    c.strokeStyle = "rgba(210,245,255,.55)";
    c.lineWidth = w;
    c.stroke();
    c.strokeStyle = "rgba(245,254,255,.8)";
    c.lineWidth = w * 0.45;
    c.stroke();
    ellipse(c, x2, y2 + 2, 2.6, 4);
    c.fillStyle = "rgba(220,250,255,.85)";
    c.fill();
  }
  c.restore();
}

// ── Grosse main d'action ────────────────────────────────────────

function drawBigHand(
  c: CanvasRenderingContext2D,
  kind: ToolId,
  x: number,
  y: number,
  s: number,
  rot: number,
): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(s, s);
  c.lineJoin = "round";
  const fillStroke = (lw = 5): void => {
    c.fillStyle = SKIN;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = lw;
    c.stroke();
  };

  if (kind === 2) {
    // Pince : pouce + index qui se rejoignent, autres doigts repliés.
    for (let i = 0; i < 3; i++) {
      rr(c, 3, 12 + i * 11, 25, 10, 5);
      fillStroke(3.2);
    }

    // Index (doigt épais qui se courbe vers le haut).
    c.beginPath();
    c.moveTo(-22, 38);
    c.bezierCurveTo(-34, 4, -28, -30, -12, -38);
    c.bezierCurveTo(-4, -42, 2, -35, 2, -27);
    c.bezierCurveTo(-8, -27, -14, -10, -10, 8);
    c.lineTo(-6, 40);
    c.closePath();
    fillStroke(4.5);

    // Pouce.
    c.beginPath();
    c.moveTo(24, 44);
    c.bezierCurveTo(36, 18, 32, -16, 16, -30);
    c.bezierCurveTo(8, -37, 1, -30, 0, -22);
    c.bezierCurveTo(10, -18, 14, 2, 14, 26);
    c.closePath();
    fillStroke(4.5);

    // Paume.
    rr(c, -24, 26, 52, 34, 15);
    fillStroke();

    rr(c, -24, 58, 52, 22, 10);
    c.fillStyle = TANK;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
  } else {
    // Paume ouverte (gifle / caresse).
    rr(c, -34, 6, 68, 58, 20);
    fillStroke();
    const fingers: [number, number][] = [
      [-24, 20],
      [-8, 30],
      [8, 32],
      [24, 24],
    ];
    for (const [fx, len] of fingers) {
      c.save();
      c.translate(fx, 10);
      c.rotate(fx * 0.012);
      rr(c, -9, -len, 18, len + 16, 9);
      fillStroke(4);
      c.restore();
    }
    c.save();
    c.translate(-34, 24);
    c.rotate(-0.8);
    rr(c, -9, -18, 18, 42, 9);
    fillStroke(4);
    c.restore();
    rr(c, -34, 60, 68, 26, 10);
    c.fillStyle = TANK;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
  }
  c.restore();
}

// ── Marque de gifle ─────────────────────────────────────────────

function drawCheekMark(
  c: CanvasRenderingContext2D,
  side: 1 | -1,
): void {
  c.save();
  c.translate(side * 62, 26);
  c.fillStyle = "rgba(225,60,50,.3)";
  ellipse(c, 0, 0, 22, 27);
  c.fill();
  c.fillStyle = "rgba(225,60,50,.45)";
  for (let i = 0; i < 4; i++) {
    rr(c, -15 + i * 8, -20, 4, 18, 2);
    c.fill();
  }
  c.beginPath();
  c.arc(0, 20, 10, 0, Math.PI);
  c.fill();
  c.restore();
}

// ── Personnage complet ──────────────────────────────────────────

interface FaceFx {
  dx: number;
  dy: number;
  rot: number;
  cheek: 0 | 1 | -1;
  blink: boolean;
  lookX: number;
}

function drawFriend(
  c: CanvasRenderingContext2D,
  look: Look,
  fx: FaceFx,
  expr: Expr,
  t: number,
): void {
  const cfg = HEAD[look.head] ?? HEAD[1];
  c.save();
  c.translate(280 + fx.dx, 196 + fx.dy);
  c.rotate(fx.rot);

  drawBody(c);
  drawNeck(c);
  drawEars(c, cfg.w);

  headPath(c, look.head);
  c.fillStyle = SKIN;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 3.4;
  c.stroke();

  c.fillStyle = "rgba(190,120,80,.12)";
  ellipse(c, 0, -cfg.h * 0.55, cfg.w * 0.68, 17);
  c.fill();

  drawBrows(c, look.eyes, expr);
  drawEyes(c, look.eyes, expr, fx.blink, fx.lookX);
  drawNose(c, look.nose);
  drawMouth(c, look.mouth, expr);
  drawBeard(c, look.beard, cfg.h);
  drawHair(c, look.hair, look.head);

  if (fx.cheek !== 0) drawCheekMark(c, fx.cheek);

  drawHands(c, t);
  drawDrool(c, t);
  c.restore();
}

// ── Composant ────────────────────────────────────────────────────

export function Arkadas({ ctx }: GameProps) {
  const maxLevel = Math.max(1, ctx.game.config.levels ?? 1);
  const settings = ctx.game.config.settings as
    | { roundSec?: Partial<Record<DifficultyKey, number>> }
    | undefined;
  const roundSec = Math.max(6, settings?.roundSec?.[ctx.difficulty] ?? ROUND_SEC[ctx.difficulty]);
  // Plafond anti-triche : 95 % du maximum serveur (§44).
  const cap = Math.floor(
    (ctx.game.config.maxScore?.[ctx.difficulty] ?? ctx.game.maxScoreHint) * 0.95,
  );
  const pointsPerHit = Math.max(1, Math.floor(cap / HIT_BUDGET));

  const { canvasRef, size } = useCanvas(1.3);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const lookRef = useRef(look);
  lookRef.current = look;

  const [catIndex, setCatIndex] = useState(0);
  const catRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("create");
  const phaseRef = useRef<Phase>("create");

  const [tool, setTool] = useState<ToolId>(1);
  const toolRef = useRef<ToolId>(1);

  const [target, setTarget] = useState<ToolId>(1);
  const targetRef = useRef<ToolId>(1);

  const [hits, setHits] = useState(0);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const creditedRef = useRef(0);
  const finishedRef = useRef(false);
  const fightStartedRef = useRef(false);

  const reactionRef = useRef<Reaction | null>(null);
  const handRef = useRef<HandFx | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef(0);
  const cooldownRef = useRef(0);
  const tRef = useRef(0);
  const blinkRef = useRef(0);
  const blinkTimerRef = useRef(2.4);
  const pointerXRef = useRef(280);
  const bannerRef = useRef(0);
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0 });

  // Le canal onEnd passe par une ref : toujours la dernière version.
  const endHandlerRef = useRef<() => void>(() => undefined);
  const countdown = useCountdown(roundSec, {
    onEnd: () => endHandlerRef.current(),
  });
  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;

  // HUD : temps de la manche, ou rien pendant la création.
  useEffect(() => {
    ctxRef.current.setTimeLeft(
      phaseRef.current === "fight" && !finishedRef.current ? countdown.timeLeft : null,
    );
  }, [countdown.timeLeft, phase]);

  // Pause du shell → chrono en pause ; reprise → il repart.
  useEffect(() => {
    if (!fightStartedRef.current) return;
    if (ctx.running) countdown.resume();
    else countdown.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.running]);

  // ── Look ────────────────────────────────────────────────────────

  const selectCat = useCallback((i: number) => {
    const idx = Math.max(0, Math.min(CATS.length - 1, i));
    catRef.current = idx;
    setCatIndex(idx);
    ctxRef.current.sound.play("click");
  }, []);

  const cycleLook = useCallback((dir: 1 | -1) => {
    const cat = CATS[catRef.current] ?? CATS[0];
    setLook((prev) => {
      const next = ((prev[cat.key] - 1 + dir + cat.n) % cat.n) + 1;
      return { ...prev, [cat.key]: next };
    });
    ctxRef.current.sound.play("click");
  }, []);

  const chooseTool = useCallback((id: ToolId) => {
    toolRef.current = id;
    setTool(id);
    ctxRef.current.sound.play("click");
  }, []);

  // ── Manche ──────────────────────────────────────────────────────

  const startFight = useCallback(() => {
    if (
      !ctxRef.current.running ||
      phaseRef.current !== "create" ||
      finishedRef.current
    ) {
      return;
    }
    fightStartedRef.current = true;
    phaseRef.current = "fight";
    setPhase("fight");
    const first = (1 + Math.floor(Math.random() * 3)) as ToolId;
    targetRef.current = first;
    setTarget(first);
    reactionRef.current = null;
    handRef.current = null;
    particlesRef.current = [];
    cooldownRef.current = 0;
    countdownRef.current.start(roundSec);
    ctxRef.current.setTimeLeft(roundSec);
    ctxRef.current.sound.play("click");
  }, [roundSec]);

  const triggerStrike = useCallback(
    (side: 1 | -1, x: number, y: number) => {
      const current = ctxRef.current;
      if (!current.running || finishedRef.current) return;
      if (phaseRef.current !== "fight" || cooldownRef.current > 0) return;

      const selected = toolRef.current;
      const correct = selected === targetRef.current;
      cooldownRef.current = 0.3;
      reactionRef.current = {
        kind: correct ? selected : 0,
        t: 0,
        dur: 0.85,
        side,
      };
      handRef.current = { kind: selected, x, y, side, t: 0 };
      shakeRef.current = 0.55;

      const emoji = correct ? (selected === 1 ? "⭐" : selected === 2 ? "💧" : "💖") : "💢";
      const count = correct ? 6 : 4;
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          e: emoji,
          x: x + (Math.random() - 0.5) * 44,
          y: y + (Math.random() - 0.5) * 32,
          vx: (Math.random() - 0.5) * 160,
          vy: -60 - Math.random() * 140,
          life: 0.8 + Math.random() * 0.4,
          size: 16 + Math.random() * 10,
        });
      }
      if (particlesRef.current.length > 80) {
        particlesRef.current.splice(0, particlesRef.current.length - 80);
      }

      if (correct) {
        hitsRef.current += 1;
        setHits(hitsRef.current);
        const gain = Math.max(0, Math.min(pointsPerHit, cap - creditedRef.current));
        creditedRef.current += gain;
        current.signalCorrect(gain);

        let next = (1 + Math.floor(Math.random() * 3)) as ToolId;
        if (next === targetRef.current) next = ((next % 3) + 1) as ToolId;
        targetRef.current = next;
        setTarget(next);
      } else {
        missesRef.current += 1;
        current.signalWrong();
      }
    },
    [cap, pointsPerHit],
  );

  const handleRoundEnd = useCallback(() => {
    const current = ctxRef.current;
    if (finishedRef.current) return;

    if (current.level < maxLevel) {
      current.setLevel(current.level + 1);
      current.sound.play("level");
      bannerRef.current = 1.1;
      reactionRef.current = null;
      handRef.current = null;
      particlesRef.current = [];
      const next = (1 + Math.floor(Math.random() * 3)) as ToolId;
      targetRef.current = next;
      setTarget(next);
      countdownRef.current.start(roundSec);
      return;
    }

    finishedRef.current = true;
    countdownRef.current.stop();
    current.finish({
      isWin: true,
      levelReached: current.level,
      clientMeta: {
        hits: hitsRef.current,
        misses: missesRef.current,
        rounds: maxLevel,
        look: lookRef.current,
      },
    });
  }, [maxLevel, roundSec]);
  endHandlerRef.current = handleRoundEnd;

  // ── Clavier ─────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!ctxRef.current.running) return;
      const el = ev.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      if (phaseRef.current === "create") {
        if (ev.key >= "1" && ev.key <= "6") {
          selectCat(Number(ev.key) - 1);
          ev.preventDefault();
        } else if (ev.key === "ArrowLeft") {
          cycleLook(-1);
          ev.preventDefault();
        } else if (ev.key === "ArrowRight") {
          cycleLook(1);
          ev.preventDefault();
        } else if (ev.key === "Enter" || ev.key === " ") {
          startFight();
          ev.preventDefault();
        }
      } else if (ev.key >= "1" && ev.key <= "3") {
        chooseTool(Number(ev.key) as ToolId);
        ev.preventDefault();
      } else if (ev.key === "Enter" || ev.key === " ") {
        triggerStrike(1, 280, 224);
        ev.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooseTool, cycleLook, selectCat, startFight, triggerStrike]);

  // ── Boucle de jeu ───────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    let raf = 0;
    let last = performance.now();

    const update = (dt: number) => {
      tRef.current += dt;
      cooldownRef.current = Math.max(0, cooldownRef.current - dt);
      shakeRef.current = Math.max(0, shakeRef.current - dt * 2.2);
      bannerRef.current = Math.max(0, bannerRef.current - dt);

      blinkTimerRef.current -= dt;
      if (blinkTimerRef.current <= 0) {
        blinkRef.current = 0.12;
        blinkTimerRef.current = 2.2 + Math.random() * 3.2;
      }
      if (blinkRef.current > 0) blinkRef.current = Math.max(0, blinkRef.current - dt);

      const r = reactionRef.current;
      if (r) {
        r.t += dt;
        if (r.t >= r.dur) reactionRef.current = null;
      }
      const h = handRef.current;
      if (h) {
        h.t += dt;
        if (h.t > 0.82) handRef.current = null;
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
        return p.life > 0;
      });
    };

    const paint = () => {
      const { width, height } = sizeRef.current;
      c.clearRect(0, 0, width, height);
      c.fillStyle = "#0aa7a7";
      c.fillRect(0, 0, width, height);

      const scale = Math.min(width / 560, height / 420);
      const ox = (width - 560 * scale) / 2;
      const oy = (height - 420 * scale) / 2;
      viewRef.current = { scale, ox, oy };
      c.save();
      c.translate(ox, oy);
      c.scale(scale, scale);

      c.fillStyle = "#08a3a3";
      c.fillRect(0, 0, 560, 420);
      circle(c, 280, 216, 200);
      c.fillStyle = "#00b5b5";
      c.fill();
      c.fillStyle = "rgba(255,255,255,.06)";
      for (let i = 0; i < 28; i++) {
        const a = i * 2.37;
        const rad = 62 + ((i * 37) % 130);
        circle(c, 280 + Math.cos(a) * rad, 216 + Math.sin(a) * rad * 0.78, 1.6 + (i % 3) * 0.8);
        c.fill();
      }

      const r = reactionRef.current;
      const expr: Expr = r
        ? r.kind === 1
          ? "pain"
          : r.kind === 2
            ? "squeeze"
            : r.kind === 3
              ? "joy"
              : "sad"
        : "idle";
      const shake = shakeRef.current > 0 ? Math.sin(tRef.current * 42) * shakeRef.current * 4 : 0;
      const sway = Math.sin(tRef.current * 1.15) * 1.5;
      const rot =
        Math.sin(tRef.current * 0.8) * 0.008 -
        (r && r.kind !== 0 ? r.side * 0.22 * Math.exp(-r.t * 7) : 0);
      const bounce = r && r.kind === 3 ? -4 * Math.exp(-r.t * 8) : 0;

      drawFriend(
        c,
        lookRef.current,
        {
          dx: sway + shake,
          dy: bounce,
          rot,
          cheek: r && (r.kind === 1 || r.kind === 2) && r.t < 0.62 ? r.side : 0,
          blink: blinkRef.current > 0,
          lookX: Math.max(-1, Math.min(1, (pointerXRef.current - 280) / 240)),
        },
        expr,
        tRef.current,
      );

      const h = handRef.current;
      if (h) {
        // La main surgit du côté, s'arrête sur la joue, puis s'efface.
        const k = Math.min(1, h.t / 0.11);
        const fade = h.t < 0.58 ? 1 : Math.max(0, 1 - (h.t - 0.58) / 0.24);
        const startY = h.kind === 2 ? h.y + 72 : h.y + 12;
        const finalY = h.kind === 2 ? h.y + 38 : h.y - 18;
        c.save();
        c.globalAlpha = fade;
        drawBigHand(
          c,
          h.kind,
          h.x + h.side * 130 - h.side * 118 * k,
          startY + (finalY - startY) * k,
          h.kind === 2 ? 0.95 : 1.05,
          h.side * (h.kind === 2 ? -0.15 : -0.45),
        );
        c.restore();
      }

      c.textAlign = "center";
      c.textBaseline = "middle";
      for (const p of particlesRef.current) {
        c.globalAlpha = Math.min(1, p.life * 1.6);
        c.font = `${Math.round(p.size)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
        c.fillText(p.e, p.x, p.y);
      }
      c.globalAlpha = 1;

      if (bannerRef.current > 0) {
        c.globalAlpha = Math.min(1, bannerRef.current * 2);
        c.font = '44px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
        c.fillText("⭐", 280, 74);
        c.globalAlpha = 1;
      }

      c.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (ctxRef.current.running) update(dt);
      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);

  // ── Rendu ───────────────────────────────────────────────────────

  const currentCat = CATS[catIndex] ?? CATS[0];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <p className="chip bg-primary-soft text-primary-dark" aria-live="polite">
        {phase === "create" ? (
          <span>🎨 {currentCat.emoji}</span>
        ) : (
          <span>
            🎯{" "}
            <span className="inline-block align-middle text-2xl leading-none">
              {TARGET_EMOJI[target]}
            </span>{" "}
            · ✅ {hits}
          </span>
        )}
      </p>

      <div className="w-full max-w-[560px]">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const v = viewRef.current;
            const px =
              ((e.clientX - rect.left) * (sizeRef.current.width / rect.width) - v.ox) / v.scale;
            const py =
              ((e.clientY - rect.top) * (sizeRef.current.height / rect.height) - v.oy) / v.scale;
            pointerXRef.current = px;
            triggerStrike(px < 280 ? -1 : 1, px, py);
          }}
          onPointerMove={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const v = viewRef.current;
            const px =
              ((e.clientX - rect.left) * (sizeRef.current.width / rect.width) - v.ox) / v.scale;
            pointerXRef.current = px;
          }}
          className="touch-none rounded-2xl"
          aria-label="🙂"
        />
      </div>

      {phase === "create" ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-1.5">
            {CATS.map((cat, i) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => selectCat(i)}
                aria-label={cat.emoji}
                aria-pressed={i === catIndex}
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition ${
                  i === catIndex ? "bg-primary-soft ring-2 ring-primary" : "bg-surface"
                }`}
              >
                {cat.emoji}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => cycleLook(-1)}
              aria-label="◀"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-lg font-bold"
            >
              ◀
            </button>
            <div className="card flex h-12 w-24 items-center justify-center gap-1 text-xl font-bold tabular-nums">
              {look[currentCat.key]}
              <span className="text-sm font-semibold text-ink-soft">/{currentCat.n}</span>
            </div>
            <button
              type="button"
              onClick={() => cycleLook(1)}
              aria-label="▶"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-lg font-bold"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={startFight}
              aria-label="▶️"
              className="flex h-12 min-w-12 items-center justify-center rounded-xl bg-primary px-4 text-2xl text-white shadow"
            >
              ▶️
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => chooseTool(t.id)}
              aria-label={t.emoji}
              aria-pressed={tool === t.id}
              className={`relative flex h-14 w-14 items-center justify-center rounded-2xl text-3xl transition ${
                tool === t.id ? "bg-primary-soft ring-2 ring-primary" : "bg-surface"
              }`}
            >
              <span className={t.id === target ? "inline-block animate-bounce" : "inline-block"}>
                {t.emoji}
              </span>
              {t.id === target && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
