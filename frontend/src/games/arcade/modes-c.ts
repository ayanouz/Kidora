// ══════════════════════════════════════════════════════════════════
//  KIDORA — Arcade (3/3) : ping-pong, piano, rythme, réflexe, panier
// ══════════════════════════════════════════════════════════════════

import { clamp, drawEmoji, near, roundRect, tier, choice, type AnyArcadeMode } from "./types";

// ── Ping-Pong ────────────────────────────────────────────────────

interface PongState {
  playerY: number;
  aiY: number;
  ball: { x: number; y: number; vx: number; vy: number; r: number };
  paddleH: number;
  speed: number;
  aiSpeed: number;
  keys: { up: boolean; down: boolean };
  goals: number;
  conceded: number;
}

function resetPongBall(state: PongState, w: number, h: number, direction: number): void {
  state.ball = {
    x: w / 2,
    y: h / 2,
    vx: direction * state.speed,
    vy: (Math.random() - 0.5) * state.speed * 0.7,
    r: 9,
  };
}

export const pongGame: AnyArcadeMode = {
  time: 60,
  lives: 3,
  init(w, h, api) {
    const difficulty = tier(api.difficulty);
    const state: PongState = {
      playerY: h / 2,
      aiY: h / 2,
      ball: { x: w / 2, y: h / 2, vx: 0, vy: 0, r: 9 },
      paddleH: Math.max(70, h * 0.19),
      speed: [250, 310, 370][difficulty],
      aiSpeed: [170, 230, 300][difficulty],
      keys: { up: false, down: false },
      goals: 0,
      conceded: 0,
    };
    resetPongBall(state, w, h, Math.random() < 0.5 ? -1 : 1);
    return state;
  },
  update(state: PongState, dt, api, w, h) {
    const move = (state.keys.down ? 1 : 0) - (state.keys.up ? 1 : 0);
    state.playerY = clamp(state.playerY + move * 420 * dt, state.paddleH / 2, h - state.paddleH / 2);

    const target = state.ball.y;
    const diff = target - state.aiY;
    state.aiY = clamp(
      state.aiY + clamp(diff, -state.aiSpeed * dt, state.aiSpeed * dt),
      state.paddleH / 2,
      h - state.paddleH / 2,
    );

    const ball = state.ball;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
    }
    if (ball.y + ball.r > h) {
      ball.y = h - ball.r;
      ball.vy = -Math.abs(ball.vy);
    }

    const playerX = 26;
    const aiX = w - 26;
    if (
      ball.vx < 0 &&
      ball.x - ball.r < playerX + 7 &&
      ball.x + ball.r > playerX - 7 &&
      Math.abs(ball.y - state.playerY) < state.paddleH / 2 + ball.r
    ) {
      ball.x = playerX + 7 + ball.r;
      ball.vx = Math.abs(ball.vx) * 1.015;
      ball.vy += (ball.y - state.playerY) * 3.2;
      api.sound("click");
    }
    if (
      ball.vx > 0 &&
      ball.x + ball.r > aiX - 7 &&
      ball.x - ball.r < aiX + 7 &&
      Math.abs(ball.y - state.aiY) < state.paddleH / 2 + ball.r
    ) {
      ball.x = aiX - 7 - ball.r;
      ball.vx = -Math.abs(ball.vx) * 1.015;
      ball.vy += (ball.y - state.aiY) * 2.2;
    }

    if (ball.x < -30) {
      state.conceded += 1;
      api.sound("wrong");
      api.loseLife();
      resetPongBall(state, w, h, -1);
    } else if (ball.x > w + 30) {
      state.goals += 1;
      api.award(100);
      api.sound("bonus");
      resetPongBall(state, w, h, 1);
    }
  },
  draw(state: PongState, c, _api, w, h) {
    c.fillStyle = "#0E5A4A";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.22)";
    c.lineWidth = 3;
    c.setLineDash([10, 14]);
    c.beginPath();
    c.moveTo(w / 2, 8);
    c.lineTo(w / 2, h - 8);
    c.stroke();
    c.setLineDash([]);

    c.fillStyle = "rgba(255,255,255,0.12)";
    c.fillRect(0, 0, w, 6);
    c.fillRect(0, h - 6, w, 6);

    c.fillStyle = "#FFFFFF";
    roundRect(c, 19, state.playerY - state.paddleH / 2, 14, state.paddleH, 7);
    c.fill();
    roundRect(c, w - 33, state.aiY - state.paddleH / 2, 14, state.paddleH, 7);
    c.fill();

    c.fillStyle = "#FDCB6E";
    c.beginPath();
    c.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "rgba(255,255,255,0.65)";
    c.font = "bold 16px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`${state.goals}  ·  ${state.conceded}`, w / 2, 28);
    c.font = "12px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("👆 / ← →", 12, h - 14);
  },
  pointer(state, _x, y, _type, _api, _w, h) {
    state.playerY = clamp(y, state.paddleH / 2, h - state.paddleH / 2);
  },
  key(state, key, down) {
    if (key === "ArrowUp" || key === "w" || key === "z") state.keys.up = down;
    if (key === "ArrowDown" || key === "s") state.keys.down = down;
  },
};

// ── Piano Magique ────────────────────────────────────────────────

interface PianoTile {
  lane: number;
  y: number;
}

interface PianoState {
  tiles: PianoTile[];
  spawn: number;
  speed: number;
  interval: number;
  hits: number;
  lastLane: number;
}

const PIANO_COLORS = ["#FF5A5F", "#FDCB6E", "#00B8A9", "#6C5CE7"];

export const pianoTiles: AnyArcadeMode = {
  time: 60,
  lives: 3,
  init(_w, _h, api) {
    const difficulty = tier(api.difficulty);
    return {
      tiles: [],
      spawn: 0.6,
      speed: [230, 290, 360][difficulty],
      interval: [0.75, 0.55, 0.4][difficulty],
      hits: 0,
      lastLane: 1,
    } satisfies PianoState;
  },
  update(state: PianoState, dt, api, w, h) {
    state.spawn -= dt;
    if (state.spawn <= 0) {
      let lane = Math.floor(Math.random() * 4);
      if (lane === state.lastLane) lane = (lane + 1 + Math.floor(Math.random() * 2)) % 4;
      state.lastLane = lane;
      state.tiles.push({ lane, y: -50 });
      state.spawn = state.interval;
    }

    state.tiles.forEach((tile) => {
      tile.y += state.speed * dt;
    });

    const missed = state.tiles.filter((tile) => tile.y > h + 40);
    if (missed.length > 0) {
      state.tiles = state.tiles.filter((tile) => tile.y <= h + 40);
      api.sound("wrong");
      api.loseLife();
    }
  },
  draw(state: PianoState, c, _api, w, h) {
    c.fillStyle = "#16162B";
    c.fillRect(0, 0, w, h);
    const laneW = w / 4;
    for (let lane = 0; lane < 4; lane++) {
      c.fillStyle = lane % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.01)";
      c.fillRect(lane * laneW, 0, laneW, h);
      c.fillStyle = "rgba(255,255,255,0.15)";
      c.fillRect(lane * laneW, 0, 1, h);
      if (lane > 0) c.fillRect(lane * laneW, 0, 1, h);
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.font = "13px Nunito, sans-serif";
      c.textAlign = "center";
      c.fillText(["1", "2", "3", "4"][lane], lane * laneW + laneW / 2, h - 12);
      c.fillStyle = PIANO_COLORS[lane];
      c.globalAlpha = 0.2;
      roundRect(c, lane * laneW + 8, h - 86, laneW - 16, 44, 10);
      c.fill();
      c.globalAlpha = 1;
    }

    state.tiles.forEach((tile) => {
      const x = tile.lane * laneW + 7;
      c.fillStyle = PIANO_COLORS[tile.lane];
      roundRect(c, x, tile.y, laneW - 14, 54, 9);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(c, x + 5, tile.y + 5, laneW - 24, 6, 3);
      c.fill();
      drawEmoji(c, "🎵", x + (laneW - 14) / 2, tile.y + 30, 20);
    });

    c.fillStyle = "#FDCB6E";
    c.fillRect(0, h - 86, w, 3);
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.font = "bold 13px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`🎹 ${state.hits}`, 12, 22);
  },
  pointer(state: PianoState, x, _y, type, api, w, h) {
    if (type !== "down") return;
    const lane = clamp(Math.floor(x / (w / 4)), 0, 3);
    const candidates = state.tiles
      .filter((tile) => tile.lane === lane && tile.y > h * 0.5 && tile.y < h + 30)
      .sort((a, b) => b.y - a.y);
    if (candidates.length > 0) {
      state.tiles = state.tiles.filter((tile) => tile !== candidates[0]);
      state.hits += 1;
      api.award(25);
      api.sound("pop");
    } else {
      api.sound("click");
    }
  },
  key(state: PianoState, key, down, api, w, h) {
    if (!down) return;
    const lanes: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, d: 0, f: 1, j: 2, k: 3 };
    const lane = lanes[key.toLowerCase()];
    if (lane === undefined) return;
    const candidates = state.tiles
      .filter((tile) => tile.lane === lane && tile.y > h * 0.5 && tile.y < h + 30)
      .sort((a, b) => b.y - a.y);
    if (candidates.length > 0) {
      state.tiles = state.tiles.filter((tile) => tile !== candidates[0]);
      state.hits += 1;
      api.award(25);
      api.sound("pop");
    }
    void w;
  },
};

// ── Rythme Endiablé ──────────────────────────────────────────────

interface DrumState {
  clock: number;
  interval: number;
  lastBeat: number;
  hits: number;
  perfects: number;
  pulse: number;
}

export const drumBeat: AnyArcadeMode = {
  time: 30,
  lives: null,
  init(_w, _h, api) {
    return {
      clock: 0,
      interval: [0.85, 0.7, 0.55][tier(api.difficulty)],
      lastBeat: -1,
      hits: 0,
      perfects: 0,
      pulse: 0,
    } satisfies DrumState;
  },
  update(state, dt) {
    state.clock += dt;
    state.pulse = (state.clock % state.interval) / state.interval;
  },
  draw(state, c, _api, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const gradient = c.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h));
    gradient.addColorStop(0, "#3B1E54");
    gradient.addColorStop(1, "#0F0B1E");
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);

    c.strokeStyle = "rgba(253,203,110,0.25)";
    c.lineWidth = 2;
    [0.28, 0.4, 0.52].forEach((ratio) => {
      c.beginPath();
      c.arc(cx, cy, Math.min(w, h) * ratio, 0, Math.PI * 2);
      c.stroke();
    });

    const radius = Math.min(w, h) * (0.52 - state.pulse * 0.24);
    c.strokeStyle = "rgba(255,255,255,0.5)";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.stroke();

    const beatPulse = 1 + Math.sin(state.clock * 2 * Math.PI / state.interval) * 0.03;
    c.fillStyle = "#FDCB6E";
    c.beginPath();
    c.arc(cx, cy, Math.min(w, h) * 0.13 * beatPulse, 0, Math.PI * 2);
    c.fill();
    drawEmoji(c, "🥁", cx, cy, Math.min(w, h) * 0.14);

    c.fillStyle = "rgba(255,255,255,0.85)";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`🥁 ${state.hits}   ✨ ${state.perfects}`, 14, 26);
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.font = "13px Nunito, sans-serif";
    c.fillText("👆 / ␣", 14, h - 18);
  },
  pointer(state, _x, _y, type, api) {
    if (type !== "down") return;
    const nearest = Math.round(state.clock / state.interval);
    if (nearest === state.lastBeat) return;
    const diff = Math.abs(state.clock - nearest * state.interval);
    if (diff <= 0.16) {
      state.lastBeat = nearest;
      state.hits += 1;
      if (diff <= 0.07) {
        state.perfects += 1;
        api.award(35);
      } else {
        api.award(18);
      }
      api.sound("pop");
    } else {
      api.sound("click");
    }
  },
  key(state, key, down, api) {
    if (!down) return;
    if (key === " " || key === "Enter") {
      const nearest = Math.round(state.clock / state.interval);
      if (nearest === state.lastBeat) return;
      const diff = Math.abs(state.clock - nearest * state.interval);
      if (diff <= 0.16) {
        state.lastBeat = nearest;
        state.hits += 1;
        if (diff <= 0.07) {
          state.perfects += 1;
          api.award(35);
        } else {
          api.award(18);
        }
        api.sound("pop");
      }
    }
  },
};

// ── Réflexe Éclair ───────────────────────────────────────────────

interface ReactionState {
  phase: "wait" | "go" | "result";
  timer: number;
  clock: number;
  greenAt: number;
  round: number;
  result: number;
  falseStart: boolean;
}

export const reactionTime: AnyArcadeMode = {
  time: 40,
  lives: null,
  init() {
    return {
      phase: "wait",
      timer: 1.2 + Math.random() * 1.4,
      clock: 0,
      greenAt: 0,
      round: 0,
      result: 0,
      falseStart: false,
    } satisfies ReactionState;
  },
  update(state, dt, api) {
    state.clock += dt;
    if (state.phase === "wait") {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.phase = "go";
        state.greenAt = state.clock;
        api.sound("tick");
      }
      return;
    }
    if (state.phase === "result") {
      state.timer -= dt;
      if (state.timer <= 0) {
        if (state.round >= 4) {
          api.finish(true);
          return;
        }
        state.round += 1;
        state.phase = "wait";
        state.timer = 1 + Math.random() * 1.5;
        state.falseStart = false;
      }
      return;
    }
    if (state.clock - state.greenAt > 2.4) {
      state.phase = "result";
      state.timer = 0.8;
      state.result = 2400;
      api.sound("wrong");
    }
  },
  draw(state, c, _api, w, h) {
    const ready = state.phase === "go";
    const result = state.phase === "result";
    const color = result ? "#FDCB6E" : ready ? "#00C853" : "#D63031";
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);

    c.fillStyle = "rgba(255,255,255,0.16)";
    c.beginPath();
    c.arc(w / 2, h / 2, Math.min(w, h) * 0.34, 0, Math.PI * 2);
    c.fill();

    drawEmoji(c, ready ? "⚡" : result ? "⏱️" : "👆", w / 2, h / 2 - 12, Math.min(w, h) * 0.24);

    c.fillStyle = "#FFFFFF";
    c.textAlign = "center";
    c.font = "bold 24px Nunito, sans-serif";
    if (result) {
      c.fillText(`${Math.round(state.result)} ms`, w / 2, h / 2 + Math.min(w, h) * 0.26);
    } else if (state.phase === "wait") {
      c.font = "bold 18px Nunito, sans-serif";
      c.fillText("…", w / 2, h / 2 + Math.min(w, h) * 0.26);
    }

    c.fillStyle = "rgba(255,255,255,0.85)";
    c.textAlign = "left";
    c.font = "bold 14px Nunito, sans-serif";
    c.fillText(`${state.round + 1}/5`, 14, 26);
  },
  pointer(state, _x, _y, type, api) {
    if (type !== "down") return;
    if (state.phase === "wait") {
      state.falseStart = true;
      state.timer = Math.max(0.5, state.timer);
      state.clock += 0.001; // pas de triche : le prochain tap reste valide
      api.sound("wrong");
      return;
    }
    if (state.phase !== "go") return;
    const ms = (state.clock - state.greenAt) * 1000;
    state.result = ms;
    state.phase = "result";
    state.timer = 1.1;
    if (ms <= 300) api.award(60);
    else if (ms <= 500) api.award(40);
    else if (ms <= 800) api.award(25);
    else api.award(12);
    api.sound("bonus");
  },
};

// ── Panier de Fruits ─────────────────────────────────────────────

interface CatchState {
  basketX: number;
  items: { x: number; y: number; vy: number; kind: string }[];
  spawn: number;
  caught: number;
  left: boolean;
  right: boolean;
}

export const fruitCatcher: AnyArcadeMode = {
  time: 60,
  lives: 3,
  init(w, _h) {
    return {
      basketX: w / 2,
      items: [],
      spawn: 0.55,
      caught: 0,
      left: false,
      right: false,
    } satisfies CatchState;
  },
  update(state: CatchState, dt, api, w, h) {
    const move = (state.right ? 1 : 0) - (state.left ? 1 : 0);
    state.basketX = clamp(state.basketX + move * 430 * dt, 48, w - 48);

    state.spawn -= dt;
    if (state.spawn <= 0) {
      const bomb = Math.random() < [0.16, 0.22, 0.28][tier(api.difficulty)];
      state.items.push({
        x: 30 + Math.random() * (w - 60),
        y: -26,
        vy: [110, 145, 180][tier(api.difficulty)] + Math.random() * 40,
        kind: bomb ? "💣" : choice(["🍎", "🍌", "🍇", "🍓", "🍊", "🍐"]),
      });
      state.spawn = [0.85, 0.65, 0.48][tier(api.difficulty)] * (0.75 + Math.random() * 0.5);
    }

    state.items.forEach((item) => {
      item.y += item.vy * dt;
      if (item.y > h - 64 && item.y < h - 24 && Math.abs(item.x - state.basketX) < 52) {
        item.y = h + 100;
        if (item.kind === "💣") {
          api.sound("wrong");
          api.loseLife();
        } else {
          state.caught += 1;
          api.award(20);
          api.sound("pop");
        }
      }
    });
    state.items = state.items.filter((item) => item.y < h + 40);
  },
  draw(state: CatchState, c, _api, w, h) {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#A8E6CF");
    sky.addColorStop(1, "#FDFFB6");
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(255,255,255,0.45)";
    for (let index = 0; index < 5; index++) {
      c.beginPath();
      c.arc((index * 160 + 40) % w, 30 + (index % 3) * 32, 24, 0, Math.PI * 2);
      c.fill();
    }

    c.fillStyle = "#7BD389";
    c.beginPath();
    c.moveTo(0, h - 20);
    c.quadraticCurveTo(w * 0.25, h - 60, w * 0.5, h - 20);
    c.quadraticCurveTo(w * 0.75, h - 70, w, h - 20);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();

    state.items.forEach((item) => {
      drawEmoji(c, item.kind, item.x, item.y, 36);
    });

    drawEmoji(c, "🧺", state.basketX, h - 40, 56);

    c.fillStyle = "rgba(45,52,54,0.7)";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`🧺 ${state.caught}`, 14, 24);
  },
  pointer(state, x, _y, type, _api, w) {
    if (type === "move" || type === "down") state.basketX = clamp(x, 48, w - 48);
  },
  key(state, key, down) {
    if (key === "ArrowLeft" || key === "a" || key === "q") state.left = down;
    if (key === "ArrowRight" || key === "d") state.right = down;
  },
};
