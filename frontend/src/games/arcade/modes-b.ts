// ══════════════════════════════════════════════════════════════════
//  KIDORA — Arcade (2/3) : casse-briques, tour, course, spatial
// ══════════════════════════════════════════════════════════════════

import { clamp, drawEmoji, near, roundRect, tier, choice, type AnyArcadeMode } from "./types";

// ── Casse-Briques ────────────────────────────────────────────────

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  color: string;
}

interface BreakoutState {
  paddleX: number;
  paddleW: number;
  ball: { x: number; y: number; vx: number; vy: number; r: number };
  bricks: Brick[];
  keys: { left: boolean; right: boolean };
  speed: number;
  rows: number;
  cols: number;
  top: number;
}

const BRICK_COLORS = ["#FF5A5F", "#FDCB6E", "#00B8A9", "#0984E3", "#E84393", "#6C5CE7"];

function buildBricks(state: BreakoutState, w: number): void {
  const gap = 5;
  const bw = (w - 32 - (state.cols - 1) * gap) / state.cols;
  state.bricks = [];
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      state.bricks.push({
        x: 16 + col * (bw + gap),
        y: state.top + row * 24,
        w: bw,
        h: 18,
        alive: true,
        color: BRICK_COLORS[row % BRICK_COLORS.length],
      });
    }
  }
}

function resetBall(state: BreakoutState, w: number, h: number): void {
  state.paddleX = w / 2;
  state.ball = {
    x: w / 2,
    y: h * 0.62,
    vx: (Math.random() < 0.5 ? -1 : 1) * state.speed * 0.7,
    vy: -state.speed,
    r: 9,
  };
}

export const breakout: AnyArcadeMode = {
  time: 60,
  lives: 3,
  init(w, h, api) {
    const difficulty = tier(api.difficulty);
    const state: BreakoutState = {
      paddleX: w / 2,
      paddleW: Math.max(76, w * 0.18),
      ball: { x: w / 2, y: h * 0.62, vx: 0, vy: 0, r: 9 },
      bricks: [],
      keys: { left: false, right: false },
      speed: [230, 280, 330][difficulty],
      rows: [3, 4, 5][difficulty],
      cols: 7,
      top: 54,
    };
    buildBricks(state, w);
    resetBall(state, w, h);
    return state;
  },
  update(state: BreakoutState, dt, api, w, h) {
    const move = (state.keys.left ? -1 : 0) + (state.keys.right ? 1 : 0);
    state.paddleX = clamp(state.paddleX + move * 460 * dt, state.paddleW / 2, w - state.paddleW / 2);

    const ball = state.ball;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.r > w) {
      ball.x = w - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
    }

    const paddleY = h - 34;
    if (
      ball.vy > 0 &&
      ball.y + ball.r > paddleY &&
      ball.y - ball.r < paddleY + 14 &&
      Math.abs(ball.x - state.paddleX) < state.paddleW / 2 + ball.r
    ) {
      ball.y = paddleY - ball.r;
      ball.vy = -Math.abs(ball.vy);
      ball.vx += ((ball.x - state.paddleX) / state.paddleW) * 170;
      ball.vx = clamp(ball.vx, -state.speed * 1.5, state.speed * 1.5);
      api.sound("click");
    }

    if (ball.y - ball.r > h) {
      api.sound("wrong");
      api.loseLife();
      resetBall(state, w, h);
      return;
    }

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const closestX = clamp(ball.x, brick.x, brick.x + brick.w);
      const closestY = clamp(ball.y, brick.y, brick.y + brick.h);
      if (near(ball.x, ball.y, closestX, closestY, ball.r)) {
        brick.alive = false;
        ball.vy = -ball.vy;
        api.award(15);
        api.sound("pop");
        break;
      }
    }

    if (state.bricks.every((brick) => !brick.alive)) {
      api.award(80);
      api.sound("bonus");
      buildBricks(state, w);
      resetBall(state, w, h);
    }
  },
  draw(state: BreakoutState, c, _api, w, h) {
    const gradient = c.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#1A1A3A");
    gradient.addColorStop(1, "#2D1B4E");
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);

    c.fillStyle = "rgba(255,255,255,0.35)";
    for (let index = 0; index < 24; index++) {
      c.beginPath();
      c.arc((index * 83) % w, (index * 47) % h, 1.5, 0, Math.PI * 2);
      c.fill();
    }

    state.bricks.forEach((brick) => {
      if (!brick.alive) return;
      c.fillStyle = brick.color;
      roundRect(c, brick.x, brick.y, brick.w, brick.h, 5);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.25)";
      c.fillRect(brick.x + 4, brick.y + 3, brick.w - 8, 4);
    });

    c.fillStyle = "#FFFFFF";
    roundRect(c, state.paddleX - state.paddleW / 2, h - 34, state.paddleW, 14, 7);
    c.fill();
    c.fillStyle = "#6C5CE7";
    roundRect(c, state.paddleX - state.paddleW / 2 + 4, h - 31, state.paddleW - 8, 5, 3);
    c.fill();

    c.fillStyle = "#FDCB6E";
    c.beginPath();
    c.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.beginPath();
    c.arc(state.ball.x - 2, state.ball.y - 2, 3, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "rgba(255,255,255,0.7)";
    c.font = "13px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("👆 / ← →", 12, 22);
  },
  pointer(state, x, _y, _type, _api, _w, _h) {
    state.paddleX = x;
  },
  key(state, key, down) {
    if (key === "ArrowLeft" || key === "a" || key === "q") state.keys.left = down;
    if (key === "ArrowRight" || key === "d") state.keys.right = down;
  },
};

// ── Tour Magique ─────────────────────────────────────────────────

interface StackState {
  blocks: { x: number; w: number; color: string }[];
  current: { x: number; w: number; dir: number; speed: number };
  blockH: number;
  perfects: number;
}

const STACK_COLORS = ["#6C5CE7", "#E84393", "#00B8A9", "#FDCB6E", "#FF5A5F", "#0984E3"];

function newBlock(width: number, speed: number): StackState["current"] {
  return {
    x: Math.random() < 0.5 ? 0 : 320 - width,
    w: width,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed,
  };
}

function dropBlock(state: StackState, api: { award: (n: number) => void; finish: (won?: boolean) => void; sound: (n: "pop" | "level") => void }, h: number): void {
  const top = state.blocks[state.blocks.length - 1];
  const left = Math.max(top.x, state.current.x);
  const right = Math.min(top.x + top.w, state.current.x + state.current.w);
  const overlap = right - left;
  if (overlap <= 2) {
    api.sound("pop");
    api.finish(false);
    return;
  }
  const perfect = Math.abs(state.current.x - top.x) < 4;
  const block = { x: left, w: overlap, color: STACK_COLORS[state.blocks.length % STACK_COLORS.length] };
  state.blocks.push(block);
  state.perfects += perfect ? 1 : 0;
  api.award(perfect ? 50 : 20);
  api.sound("pop");
  const speed = Math.min(260, state.current.speed + 14);
  state.current = newBlock(overlap, speed);

  if (state.blocks.length * state.blockH > h - 70) {
    api.sound("level");
    api.finish(true);
  }
}

export const stackTower: AnyArcadeMode = {
  time: 45,
  lives: null,
  init(_w, h) {
    const baseW = 110;
    const state: StackState = {
      blocks: [{ x: (320 - baseW) / 2, w: baseW, color: STACK_COLORS[0] }],
      current: { x: 0, w: baseW, dir: 1, speed: 130 },
      blockH: clamp(h / 16, 16, 26),
      perfects: 0,
    };
    state.current = newBlock(baseW, 130);
    return state;
  },
  update(state: StackState, dt) {
    state.current.x += state.current.dir * state.current.speed * dt;
    if (state.current.x <= 0) {
      state.current.x = 0;
      state.current.dir = 1;
    }
    if (state.current.x + state.current.w >= 320) {
      state.current.x = 320 - state.current.w;
      state.current.dir = -1;
    }
  },
  draw(state: StackState, c, _api, w, h) {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#C7ECFF");
    sky.addColorStop(1, "#FFE8B3");
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    c.fillStyle = "#7BD389";
    c.fillRect(0, h - 34, w, 34);

    const scaleX = w / 320;
    const baseY = h - 34;
    const visible = Math.min(state.blocks.length, 14);
    const start = state.blocks.length - visible;
    for (let index = 0; index < visible; index++) {
      const block = state.blocks[start + index];
      // Position absolue : quand la tour dépasse la zone visible, les
      // blocs ne doivent pas se superposer au bas de l'écran.
      const y = baseY - (start + index + 1) * state.blockH;
      c.fillStyle = block.color;
      roundRect(c, block.x * scaleX, y, block.w * scaleX, state.blockH - 2, 4);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.25)";
      c.fillRect(block.x * scaleX + 3, y + 3, Math.max(0, block.w * scaleX - 6), 4);
    }

    const nextY = baseY - (state.blocks.length + 1) * state.blockH;
    const bob = Math.sin(Date.now() / 180) * 2;
    c.fillStyle = STACK_COLORS[state.blocks.length % STACK_COLORS.length];
    roundRect(c, state.current.x * scaleX, nextY + bob, state.current.w * scaleX, state.blockH - 2, 4);
    c.fill();

    c.fillStyle = "rgba(45,52,54,0.7)";
    c.font = "bold 15px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`🧱 ${state.blocks.length - 1}`, 12, 24);
    c.fillText("👆 / ␣", 12, 44);
  },
  pointer(_state, _x, _y, type, api, _w, h) {
    if (type === "down") dropBlock(_state, api, h);
  },
  key(state, key, down, api, _w, h) {
    if (!down) return;
    if (key === " " || key === "Enter" || key === "ArrowDown") dropBlock(state, api, h);
  },
};

// ── Course Préhistorique ─────────────────────────────────────────

interface RunnerState {
  y: number;
  vy: number;
  speed: number;
  obstacles: { x: number; w: number; h: number; kind: string }[];
  spawn: number;
  invuln: number;
  runFrame: number;
  jump: boolean;
}

export const dinoRunner: AnyArcadeMode = {
  time: 60,
  lives: 3,
  init(_w, h, api) {
    return {
      y: 0,
      vy: 0,
      speed: [230, 280, 330][tier(api.difficulty)],
      obstacles: [],
      spawn: 1.1,
      invuln: 0,
      runFrame: 0,
      jump: false,
    } satisfies RunnerState;
  },
  update(state: RunnerState, dt, api, w, h) {
    const ground = h - 44;
    if (state.jump && state.y >= 0) {
      state.vy = -660;
      state.jump = false;
      api.sound("click");
    }
    state.vy += 1700 * dt;
    state.y += state.vy * dt;
    if (state.y > 0) {
      state.y = 0;
      state.vy = 0;
      state.jump = true;
    }
    state.invuln = Math.max(0, state.invuln - dt);
    state.runFrame += dt * 12;

    state.spawn -= dt;
    if (state.spawn <= 0) {
      const tall = Math.random() < 0.35;
      state.obstacles.push({
        x: w + 30,
        w: tall ? 24 : 36,
        h: tall ? 56 : 32,
        kind: tall ? "🌵" : "🪨",
      });
      state.spawn = [1.45, 1.2, 0.95][tier(api.difficulty)] * (0.8 + Math.random() * 0.5);
    }

    state.obstacles.forEach((obstacle) => {
      obstacle.x -= state.speed * dt;
      const dinoBottom = ground + state.y;
      const collision =
        obstacle.x < 118 && obstacle.x + obstacle.w > 64 && dinoBottom > ground - obstacle.h + 6;
      if (collision && state.invuln <= 0) {
        api.sound("wrong");
        api.loseLife();
        state.invuln = 1.4;
        state.obstacles = [];
        state.y = 0;
        state.vy = 0;
      } else if (!collision && obstacle.x + obstacle.w < 64) {
        if (!("passed" in obstacle)) {
          (obstacle as { passed?: boolean }).passed = true;
          api.award(20);
        }
      }
    });
    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x > -60);
  },
  draw(state: RunnerState, c, _api, w, h) {
    const sky = c.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, "#FFD3A5");
    sky.addColorStop(1, "#FFF2CC");
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    c.fillStyle = "#F7B267";
    c.beginPath();
    c.moveTo(0, h - 80);
    c.quadraticCurveTo(w * 0.25, h - 150, w * 0.5, h - 80);
    c.quadraticCurveTo(w * 0.75, h - 140, w, h - 80);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();

    c.fillStyle = "#D9A066";
    c.fillRect(0, h - 44, w, 44);
    c.fillStyle = "#C08650";
    for (let x = 0; x < w; x += 30) c.fillRect(x, h - 44, 14, 5);
    c.fillStyle = "#B87943";
    c.fillRect(0, h - 14, w, 14);

    state.obstacles.forEach((obstacle) => {
      drawEmoji(c, obstacle.kind, obstacle.x + obstacle.w / 2, h - 44 - obstacle.h / 2 + 4, obstacle.h);
    });

    const dinoY = h - 44 + state.y - 26;
    c.save();
    if (state.invuln > 0 && Math.floor(state.invuln * 8) % 2 === 0) c.globalAlpha = 0.5;
    drawEmoji(c, "🦖", 88, dinoY, 52);
    c.restore();

    c.fillStyle = "rgba(45,52,54,0.65)";
    c.font = "bold 14px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText("👆 / ␣", 12, 24);
  },
  pointer(_state, _x, _y, type) {
    if (type === "down") (_state as RunnerState).jump = true;
  },
  key(state, key, down) {
    if (!down) return;
    if (key === " " || key === "ArrowUp" || key === "w" || key === "z") state.jump = true;
  },
};

// ── Défense Spatiale ─────────────────────────────────────────────

interface ShooterState {
  shipX: number;
  bullets: { x: number; y: number }[];
  enemies: { x: number; y: number; vy: number; emoji: string }[];
  spawn: number;
  cooldown: number;
  left: boolean;
  right: boolean;
  invuln: number;
  hits: number;
}

export const spaceShooter: AnyArcadeMode = {
  time: 60,
  lives: 3,
  init(w, _h) {
    return {
      shipX: w / 2,
      bullets: [],
      enemies: [],
      spawn: 0.8,
      cooldown: 0,
      left: false,
      right: false,
      invuln: 0,
      hits: 0,
    } satisfies ShooterState;
  },
  update(state: ShooterState, dt, api, w, h) {
    const speed = 380;
    state.shipX = clamp(
      state.shipX + ((state.right ? 1 : 0) - (state.left ? 1 : 0)) * speed * dt,
      30,
      w - 30,
    );
    state.invuln = Math.max(0, state.invuln - dt);
    state.cooldown -= dt;
    if (state.cooldown <= 0) {
      state.cooldown = 0.32;
      state.bullets.push({ x: state.shipX, y: h - 66 });
      api.sound("click");
    }

    state.bullets.forEach((bullet) => {
      bullet.y -= 520 * dt;
    });
    state.bullets = state.bullets.filter((bullet) => bullet.y > -20);

    state.spawn -= dt;
    if (state.spawn <= 0) {
      state.enemies.push({
        x: 40 + Math.random() * (w - 80),
        y: -30,
        vy: [55, 85, 115][tier(api.difficulty)] + Math.random() * 30,
        emoji: choice(["👾", "🛸", "☄️"]),
      });
      state.spawn = [1.2, 0.95, 0.7][tier(api.difficulty)] * (0.8 + Math.random() * 0.4);
    }

    state.enemies.forEach((enemy) => {
      enemy.y += enemy.vy * dt;
      if (enemy.y > h - 50 && state.invuln <= 0) {
        enemy.y = h + 100;
        api.sound("wrong");
        api.loseLife();
        state.invuln = 1.3;
      }
    });
    state.enemies = state.enemies.filter((enemy) => enemy.y < h + 60);

    for (let bulletIndex = state.bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
      const bullet = state.bullets[bulletIndex];
      let consumed = false;
      for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
        const enemy = state.enemies[enemyIndex];
        if (near(bullet.x, bullet.y, enemy.x, enemy.y, 32)) {
          state.enemies.splice(enemyIndex, 1);
          state.bullets.splice(bulletIndex, 1);
          state.hits += 1;
          api.award(25);
          api.sound("pop");
          consumed = true;
          break;
        }
      }
      if (consumed) continue;
    }
  },
  draw(state: ShooterState, c, _api, w, h) {
    c.fillStyle = "#0B132B";
    c.fillRect(0, 0, w, h);

    c.fillStyle = "rgba(255,255,255,0.7)";
    for (let index = 0; index < 46; index++) {
      const x = (index * 97) % w;
      const y = (index * 53 + (Date.now() / 40) * (index % 3 === 0 ? 1 : 0.4)) % h;
      c.fillRect(x, y, index % 4 === 0 ? 2 : 1, index % 4 === 0 ? 2 : 1);
    }

    c.fillStyle = "#FDCB6E";
    state.bullets.forEach((bullet) => {
      roundRect(c, bullet.x - 2.5, bullet.y - 12, 5, 16, 2.5);
      c.fill();
    });

    state.enemies.forEach((enemy) => {
      drawEmoji(c, enemy.emoji, enemy.x, enemy.y, 40);
    });

    c.save();
    if (state.invuln > 0 && Math.floor(state.invuln * 8) % 2 === 0) c.globalAlpha = 0.5;
    drawEmoji(c, "🚀", state.shipX, h - 52, 46);
    c.restore();

    c.fillStyle = "rgba(255,255,255,0.75)";
    c.font = "13px Nunito, sans-serif";
    c.textAlign = "left";
    c.fillText(`👾 ${state.hits}`, 12, 22);
  },
  pointer(state, x, _y, type, _api, w) {
    if (type === "move" || type === "down") state.shipX = clamp(x, 30, w - 30);
  },
  key(state, key, down) {
    if (key === "ArrowLeft" || key === "a" || key === "q") state.left = down;
    if (key === "ArrowRight" || key === "d") state.right = down;
  },
};
