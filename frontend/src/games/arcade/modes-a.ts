// ══════════════════════════════════════════════════════════════════
//  KIDORA — Arcade (1/3) : taupes, fruits, ballon, serpent
// ══════════════════════════════════════════════════════════════════

import { clamp, drawEmoji, near, roundRect, tier, choice, type AnyArcadeMode, type ModeApi } from "./types";

// ── Tape les Taupes ──────────────────────────────────────────────

interface Mole {
  hole: number;
  ttl: number;
  total: number;
}

interface WhackState {
  holes: { x: number; y: number; r: number }[];
  moles: Mole[];
  spawn: number;
  hits: number;
}

export const whackAMole: AnyArcadeMode = {
  time: 45,
  lives: null,
  init(w, h) {
    const holes = Array.from({ length: 9 }, (_, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        x: w * (0.22 + col * 0.28),
        y: h * (0.34 + row * 0.24),
        r: Math.min(w, h) * 0.075,
      };
    });
    return { holes, moles: [], spawn: 0.9, hits: 0 } satisfies WhackState;
  },
  update(state: WhackState, dt, api) {
    const difficulty = tier(api.difficulty);
    const maxMoles = [1, 2, 3][difficulty];
    const ttl = [1.7, 1.35, 1.05][difficulty];
    const interval = [1.05, 0.8, 0.55][difficulty];

    state.spawn -= dt;
    if (state.spawn <= 0 && state.moles.length < maxMoles) {
      const busy = new Set(state.moles.map((mole) => mole.hole));
      const free = state.holes.map((_, index) => index).filter((index) => !busy.has(index));
      if (free.length > 0) {
        const hole = choice(free);
        state.moles.push({ hole, ttl, total: ttl });
      }
      state.spawn = interval * (0.8 + Math.random() * 0.5);
    }
    state.moles = state.moles.filter((mole) => {
      mole.ttl -= dt;
      return mole.ttl > 0;
    });
  },
  draw(state: WhackState, c, _api, w, h) {
    const gradient = c.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#B8F2E6");
    gradient.addColorStop(1, "#7BD389");
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);

    state.holes.forEach((hole) => {
      c.fillStyle = "rgba(60, 90, 40, 0.25)";
      c.beginPath();
      c.ellipse(hole.x, hole.y + hole.r * 0.15, hole.r * 1.15, hole.r * 0.7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#5B3A29";
      c.beginPath();
      c.ellipse(hole.x, hole.y, hole.r, hole.r * 0.55, 0, 0, Math.PI * 2);
      c.fill();
    });

    state.moles.forEach((mole) => {
      const hole = state.holes[mole.hole];
      if (!hole) return;
      const appear = clamp((mole.total - mole.ttl) * 6, 0, 1);
      const y = hole.y - hole.r * 0.7 * appear;
      c.fillStyle = "#8B5E3C";
      c.beginPath();
      c.ellipse(hole.x, y + hole.r * 0.75, hole.r * 0.8, hole.r * 0.5, 0, 0, Math.PI * 2);
      c.fill();
      drawEmoji(c, "🐹", hole.x, y, hole.r * 2.2);
    });

    c.fillStyle = "rgba(255,255,255,0.85)";
    roundRect(c, w - 92, 10, 78, 30, 15);
    c.fill();
    c.fillStyle = "#2D3436";
    c.font = "bold 15px Nunito, sans-serif";
    c.textAlign = "center";
    c.fillText(`🐹 ${state.hits}`, w - 53, 30);
  },
  pointer(state, x, y, type, api) {
    if (type !== "down") return;
    for (let index = state.moles.length - 1; index >= 0; index--) {
      const mole = state.moles[index];
      const hole = state.holes[mole.hole];
      if (hole && near(x, y, hole.x, hole.y - hole.r * 0.5, hole.r * 1.35)) {
        state.moles.splice(index, 1);
        state.hits += 1;
        api.award(40);
        api.sound("pop");
        return;
      }
    }
  },
};

// ── Fruit Tranche ────────────────────────────────────────────────

const FRUITS = ["🍎", "🍉", "🍌", "🍇", "🍓", "🍊"];

interface FallingFruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: string;
  spin: number;
  rotation: number;
}

interface FruitState {
  fruits: FallingFruit[];
  spawn: number;
  sliced: number;
}

export const fruitSlice: AnyArcadeMode = {
  time: 60,
  lives: 3,
  init() {
    return { fruits: [], spawn: 0.5, sliced: 0 } satisfies FruitState;
  },
  update(state: FruitState, dt, api, w, h) {
    const difficulty = tier(api.difficulty);
    const interval = [0.9, 0.65, 0.45][difficulty];
    const fall = [120, 160, 200][difficulty];

    state.spawn -= dt;
    if (state.spawn <= 0) {
      const bomb = Math.random() < [0.16, 0.22, 0.28][difficulty];
      state.fruits.push({
        x: 30 + Math.random() * (w - 60),
        y: -30,
        vx: (Math.random() - 0.5) * 70,
        vy: fall + Math.random() * 70,
        kind: bomb ? "💣" : choice(FRUITS),
        spin: (Math.random() - 0.5) * 3,
        rotation: 0,
      });
      state.spawn = interval * (0.7 + Math.random() * 0.6);
    }
    state.fruits.forEach((fruit) => {
      fruit.x += fruit.vx * dt;
      fruit.y += fruit.vy * dt;
      fruit.rotation += fruit.spin * dt;
    });
    state.fruits = state.fruits.filter((fruit) => fruit.y < h + 50 && fruit.x > -50 && fruit.x < w + 50);
  },
  draw(state: FruitState, c, _api, w, h) {
    const gradient = c.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#FFF3C4");
    gradient.addColorStop(1, "#FFD6A5");
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(255,255,255,0.5)";
    for (let index = 0; index < 6; index++) {
      c.beginPath();
      c.arc((index * 137) % w, (index * 89) % h, 22 + (index % 2) * 12, 0, Math.PI * 2);
      c.fill();
    }
    state.fruits.forEach((fruit) => {
      c.save();
      c.translate(fruit.x, fruit.y);
      c.rotate(fruit.rotation);
      drawEmoji(c, fruit.kind, 0, 0, fruit.kind === "💣" ? 46 : 42);
      c.restore();
    });
    c.fillStyle = "rgba(45,52,54,0.8)";
    c.font = "bold 15px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`🍉 ${state.sliced}`, 14, 28);
  },
  pointer(state, x, y, type, api) {
    if (type !== "down") return;
    for (let index = state.fruits.length - 1; index >= 0; index--) {
      const fruit = state.fruits[index];
      if (near(x, y, fruit.x, fruit.y, 42)) {
        state.fruits.splice(index, 1);
        if (fruit.kind === "💣") {
          api.sound("wrong");
          api.loseLife();
        } else {
          state.sliced += 1;
          api.award(30);
          api.sound("pop");
        }
        return;
      }
    }
  },
};

// ── Ballon Volant ────────────────────────────────────────────────

interface Pipe {
  x: number;
  gap: number;
  height: number;
  passed: boolean;
}

interface FlappyState {
  y: number;
  vy: number;
  pipes: Pipe[];
  spawn: number;
  invuln: number;
  ground: number;
}

export const flappyBalloon: AnyArcadeMode = {
  time: 60,
  lives: 3,
  init(_w, h) {
    return { y: h * 0.4, vy: 0, pipes: [], spawn: 0.9, invuln: 1, ground: h - 22 } satisfies FlappyState;
  },
  update(state: FlappyState, dt, api, w, h) {
    const difficulty = tier(api.difficulty);
    const gap = [190, 160, 135][difficulty];
    const speed = [140, 175, 210][difficulty];
    const ground = h - 22;
    state.ground = ground;

    state.vy += 1250 * dt;
    state.y += state.vy * dt;
    state.invuln = Math.max(0, state.invuln - dt);

    if (state.y > ground - 20) {
      state.y = ground - 20;
      state.vy = 0;
      if (state.invuln <= 0) {
        api.loseLife();
        state.invuln = 1.4;
      }
    }
    if (state.y < 22) {
      state.y = 22;
      state.vy = 0;
    }

    state.spawn -= dt;
    if (state.spawn <= 0) {
      state.pipes.push({
        x: w + 50,
        gap,
        height: 40 + Math.random() * (h - gap - 120),
        passed: false,
      });
      state.spawn = [1.7, 1.5, 1.3][difficulty];
    }

    state.pipes.forEach((pipe) => {
      pipe.x -= speed * dt;
      if (!pipe.passed && pipe.x + 38 < w * 0.26) {
        pipe.passed = true;
        api.award(25);
      }
    });
    state.pipes = state.pipes.filter((pipe) => pipe.x > -80);

    if (state.invuln <= 0) {
      const birdX = w * 0.26;
      const hit = state.pipes.some((pipe) => {
        const top = pipe.height;
        const bottom = pipe.height + pipe.gap;
        return birdX + 18 > pipe.x && birdX - 18 < pipe.x + 70 && (state.y - 18 < top || state.y + 18 > bottom);
      });
      if (hit) {
        api.sound("wrong");
        api.loseLife();
        state.invuln = 1.4;
        state.vy = 0;
        state.y = h * 0.4;
      }
    }
  },
  draw(state: FlappyState, c, _api, w, h) {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#89CFF0");
    sky.addColorStop(1, "#DFF6FF");
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    c.fillStyle = "rgba(255,255,255,0.8)";
    [
      [w * 0.15, h * 0.18, 34],
      [w * 0.55, h * 0.12, 26],
      [w * 0.8, h * 0.28, 38],
    ].forEach(([x, y, r]) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.arc(x + r * 0.8, y + r * 0.15, r * 0.7, 0, Math.PI * 2);
      c.arc(x - r * 0.8, y + r * 0.2, r * 0.6, 0, Math.PI * 2);
      c.fill();
    });

    state.pipes.forEach((pipe) => {
      c.fillStyle = "#2ECC71";
      const topHeight = pipe.height;
      const bottomY = pipe.height + pipe.gap;
      roundRect(c, pipe.x, 0, 70, topHeight, 10);
      c.fill();
      roundRect(c, pipe.x, bottomY, 70, h - bottomY, 10);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.25)";
      c.fillRect(pipe.x + 8, 0, 10, topHeight);
      c.fillRect(pipe.x + 8, bottomY, 10, h - bottomY);
      c.fillStyle = "#27AE60";
      roundRect(c, pipe.x - 5, topHeight - 18, 80, 18, 6);
      c.fill();
      roundRect(c, pipe.x - 5, bottomY, 80, 18, 6);
      c.fill();
    });

    c.fillStyle = "#8ED081";
    c.fillRect(0, h - 20, w, 20);
    c.fillStyle = "#6AAF5B";
    for (let x = 0; x < w; x += 24) c.fillRect(x, h - 20, 12, 4);

    c.save();
    if (state.invuln > 0 && Math.floor(state.invuln * 8) % 2 === 0) c.globalAlpha = 0.55;
    drawEmoji(c, "🎈", w * 0.26, state.y, 46);
    c.restore();

    c.fillStyle = "rgba(45,52,54,0.75)";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("👆 / ␣", 12, 24);
  },
  pointer(_state, _x, _y, type, _api) {
    if (type === "down") {
      const state = _state as FlappyState;
      state.vy = -420;
    }
  },
  key(state, key, down) {
    if (!down) return;
    if (key === " " || key === "ArrowUp" || key === "w" || key === "z") {
      state.vy = -420;
    }
  },
};

// ── Serpent Gourmand ─────────────────────────────────────────────

interface Cell {
  x: number;
  y: number;
}

interface SnakeState {
  cell: number;
  cols: number;
  rows: number;
  body: Cell[];
  dir: Cell;
  next: Cell;
  food: Cell;
  timer: number;
  step: number;
  swipe: { x: number; y: number } | null;
  flash: number;
}

function placeFood(state: SnakeState): Cell {
  const free: Cell[] = [];
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (!state.body.some((cell) => cell.x === x && cell.y === y)) free.push({ x, y });
    }
  }
  return free.length > 0 ? choice(free) : { x: 0, y: 0 };
}

function resetSnake(state: SnakeState): void {
  const cx = Math.floor(state.cols / 2);
  const cy = Math.floor(state.rows / 2);
  state.body = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  state.dir = { x: 1, y: 0 };
  state.next = { x: 1, y: 0 };
  state.timer = 0;
}

export const snakeGame: AnyArcadeMode = {
  time: 60,
  lives: 1,
  init(w, h, api) {
    const cell = Math.max(14, Math.floor(Math.min(w, h) / 18));
    const state: SnakeState = {
      cell,
      cols: Math.floor(w / cell),
      rows: Math.floor(h / cell),
      body: [],
      dir: { x: 1, y: 0 },
      next: { x: 1, y: 0 },
      food: { x: 2, y: 2 },
      timer: 0,
      step: [0.22, 0.17, 0.13][tier(api.difficulty)],
      swipe: null,
      flash: 0,
    };
    resetSnake(state);
    state.food = placeFood(state);
    return state;
  },
  update(state: SnakeState, dt, api) {
    state.flash = Math.max(0, state.flash - dt);
    state.timer += dt;
    if (state.timer < state.step) return;
    state.timer = 0;

    state.dir = state.next;
    const head = state.body[0];
    const nextHead = { x: head.x + state.dir.x, y: head.y + state.dir.y };
    const wall = nextHead.x < 0 || nextHead.x >= state.cols || nextHead.y < 0 || nextHead.y >= state.rows;
    const self = state.body.some((cell) => cell.x === nextHead.x && cell.y === nextHead.y);
    if (wall || self) {
      state.flash = 0.4;
      api.sound("wrong");
      api.loseLife();
      resetSnake(state);
      return;
    }

    state.body.unshift(nextHead);
    if (nextHead.x === state.food.x && nextHead.y === state.food.y) {
      api.award(20);
      api.sound("pop");
      state.food = placeFood(state);
    } else {
      state.body.pop();
    }
  },
  draw(state: SnakeState, c, _api, w, h) {
    c.fillStyle = "#102A2E";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.05)";
    c.lineWidth = 1;
    for (let x = 0; x <= state.cols; x++) {
      c.beginPath();
      c.moveTo(x * state.cell, 0);
      c.lineTo(x * state.cell, h);
      c.stroke();
    }
    for (let y = 0; y <= state.rows; y++) {
      c.beginPath();
      c.moveTo(0, y * state.cell);
      c.lineTo(w, y * state.cell);
      c.stroke();
    }

    drawEmoji(c, "🍎", (state.food.x + 0.5) * state.cell, (state.food.y + 0.5) * state.cell, state.cell * 0.9);

    state.body.forEach((cell, index) => {
      c.fillStyle = index === 0 ? "#7BF1A8" : `rgba(46, 204, 113, ${0.9 - index * 0.015})`;
      roundRect(
        c,
        cell.x * state.cell + 2,
        cell.y * state.cell + 2,
        state.cell - 4,
        state.cell - 4,
        state.cell * 0.3,
      );
      c.fill();
    });

    const head = state.body[0];
    if (head) {
      c.fillStyle = "#102A2E";
      const eye = state.cell * 0.16;
      c.beginPath();
      c.arc((head.x + 0.35) * state.cell, (head.y + 0.38) * state.cell, eye, 0, Math.PI * 2);
      c.arc((head.x + 0.7) * state.cell, (head.y + 0.38) * state.cell, eye, 0, Math.PI * 2);
      c.fill();
    }

    if (state.flash > 0) {
      c.fillStyle = `rgba(255, 90, 95, ${state.flash})`;
      c.fillRect(0, 0, w, h);
    }

    c.fillStyle = "rgba(255,255,255,0.7)";
    c.font = "13px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("⌨️ ← ↑ ↓ → / 👆", 12, 22);
  },
  pointer(state, x, y, type) {
    if (type === "down") {
      state.swipe = { x, y };
      return;
    }
    if (!state.swipe) return;
    const dx = x - state.swipe.x;
    const dy = y - state.swipe.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;

    let next: Cell;
    if (Math.abs(dx) > Math.abs(dy)) next = { x: dx > 0 ? 1 : -1, y: 0 };
    else next = { x: 0, y: dy > 0 ? 1 : -1 };
    if (state.dir.x + next.x !== 0 || state.dir.y + next.y !== 0) {
      if (!(state.dir.x === next.x && state.dir.y === next.y)) state.next = next;
    }
    state.swipe = { x, y };
  },
  key(state, key, down) {
    if (!down) return;
    const map: Record<string, Cell> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
      z: { x: 0, y: -1 },
      q: { x: -1, y: 0 },
    };
    const next = map[key];
    if (!next) return;
    if (state.dir.x + next.x !== 0 || state.dir.y + next.y !== 0) state.next = next;
  },
};
