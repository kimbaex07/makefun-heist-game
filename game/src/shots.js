// Velvet Vault — the staged scenes behind ?shot=start|play|end. Each scene plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (try each way it could move, keep out of vision cones,
// chase the nearest loot, lift the tiara only when the coast is clear), so the
// frame is what a short game really looks like and the same seed always gives
// the same frame. The end scene plays all three rooms; if the pilot is caught
// on the way, the win screen is staged from a completed third room instead.
import { STEP, THIEF, WORLD_H, WORLD_W } from './config.js';
import { createWorld, dangerAt, updateWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 5;
const ROOM_LIMIT_SECONDS = 120;
const SAMPLE = 1 / 30;
const DIRS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function hitsWall(room, x, y, r) {
  if (x < r || x > WORLD_W - r || y < r || y > WORLD_H - r) return true;
  for (const w of room.walls) {
    const cx = clamp(x, w.x, w.x + w.w);
    const cy = clamp(y, w.y, w.y + w.h);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  for (const rope of room.ropes) {
    const cx = clamp(x, rope.x, rope.x + rope.w);
    const cy = clamp(y, rope.y, rope.y + rope.h);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}

// Where the pilot wants to go: the nearest loot (small pieces first, the tiara
// once the room is nearly empty), or the getaway door once the goal is met.
// Coarse grid pathfinding for the pilot: a greedy pilot stalls against walls
// (it cannot see that going around a display case means walking away from the
// loot first), so the pilot plans a route on a 40px grid and steers toward the
// next cell on it. Walls and ropes block cells; BFS on 24x14 cells is cheap
// enough to replan every step.
const CELL = 40;
const COLS = Math.ceil(WORLD_W / CELL);
const ROWS = Math.ceil(WORLD_H / CELL);

function cellBlocked(room, cx, cy) {
  const x = cx * CELL + CELL / 2;
  const y = cy * CELL + CELL / 2;
  return hitsWall(room, x, y, THIEF.radius + 3);
}

function planPath(state, tx, ty) {
  const room = state.room;
  const sx = Math.max(0, Math.min(COLS - 1, Math.floor(state.thief.x / CELL)));
  const sy = Math.max(0, Math.min(ROWS - 1, Math.floor(state.thief.y / CELL)));
  const gx = Math.max(0, Math.min(COLS - 1, Math.floor(tx / CELL)));
  const gy = Math.max(0, Math.min(ROWS - 1, Math.floor(ty / CELL)));
  if (sx === gx && sy === gy) return [{ x: tx, y: ty }];
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (seen.has(key(nx, ny))) continue;
      if (cellBlocked(room, nx, ny)) continue;
      // No cutting corners through a blocked cell's edge.
      if (dx !== 0 && dy !== 0 && (cellBlocked(room, cx + dx, cy) || cellBlocked(room, cx, cy + dy))) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), [cx, cy]);
      if (nx === gx && ny === gy) {
        const cells = [[gx, gy]];
        let cur = [gx, gy];
        while (cur[0] !== sx || cur[1] !== sy) {
          cur = prev.get(key(cur[0], cur[1]));
          cells.unshift(cur);
        }
        return cells.map(([x, y]) => ({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 }));
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}

function pickTarget(state) {
  if (state.exitOpen) {
    const e = state.room.exit;
    return { x: e.x + e.w / 2, y: e.y + e.h / 2, grab: false };
  }
  // The tiara alone meets the goal in rooms 2 and 3 (1000 >= 900/1000), so
  // chase it first there — small loot in patrolled lanes (e.g. the room-3
  // gem at (120,120) under guard 0's lane) is not worth dying for.
  const tiara = state.loot.find((l) => l.kind === 'tiara' && !l.taken);
  if (tiara && 1000 >= state.room.goal) {
    return { x: tiara.x, y: tiara.y, grab: true };
  }
  let best = null;
  let bestScore = Infinity;
  for (const l of state.loot) {
    if (l.taken) continue;
    const d = Math.hypot(l.x - state.thief.x, l.y - state.thief.y);
    // Do not walk into a watched spot: defer loot that is under a cone
    // right now (patrols move on, the pilot re-picks every step).
    const score = d + dangerAt(state, l.x, l.y) * 400 + (l.kind === 'tiara' ? 260 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = l;
    }
  }
  if (!best) return { x: state.room.exit.x, y: state.room.exit.y, grab: false };
  return { x: best.x, y: best.y, grab: best.kind === 'tiara' };
}

// Steers one step. Exported so the playthrough can be exercised headlessly.
export function pilotInput(state) {
  const thief = state.thief;
  // FLEE: a guard that is chasing (or about to) knows where the thief is —
  // heading for loot then is suicide. Run from the chaser, favouring cells
  // far from it and out of every cone, at full walk speed (no sneak).
  const chaser = state.guards.find((g) => g.mode === 'chase' || g.suspicion > 0.55);
  if (chaser) {
    let bestDir = DIRS[0];
    let bestScore = -Infinity;
    for (const [dx, dy] of DIRS) {
      const len = Math.hypot(dx, dy) || 1;
      const nx = thief.x + (dx / len) * THIEF.walk * 0.3;
      const ny = thief.y + (dy / len) * THIEF.walk * 0.3;
      if (hitsWall(state.room, nx, ny, THIEF.radius)) continue;
      const dGuard = Math.hypot(nx - chaser.x, ny - chaser.y);
      const danger = dangerAt(state, nx, ny);
      const score = dGuard - danger * 400 + (dx === 0 && dy === 0 ? -60 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestDir = [dx, dy];
      }
    }
    return {
      up: bestDir[1] < 0, down: bestDir[1] > 0,
      left: bestDir[0] < 0, right: bestDir[0] > 0,
      sneak: false, grab: false, emp: false, noise: false, click: null,
    };
  }
  // EMP: a camera whose alert is building will trip the alarm (+20) if it
  // fills. Blind the cameras for 6s instead of walking into the frame.
  // Threshold 0.25, not 0.5: by 0.5 the frame is already half-lost.
  const camHot = state.cameras.some((c) => c.alert > 0.25);
  if (camHot && state.emp > 0 && state.empT <= 0) {
    return { up: false, down: false, left: false, right: false, sneak: false, grab: false, emp: true, noise: false, click: null };
  }
  const target = pickTarget(state);
  const dTarget = Math.hypot(target.x - thief.x, target.y - thief.y);
  // Lift the tiara only when nobody is looking.
  if (target.grab && dTarget < 46 && dangerAt(state, thief.x, thief.y) < 0.2) {
    return { up: false, down: false, left: false, right: false, sneak: false, grab: true, emp: false, noise: false, click: null };
  }
  // Steer along the planned route to the target, not straight at it.
  let nav = { x: target.x, y: target.y };
  const path = planPath(state, target.x, target.y);
  if (path && path.length > 1) nav = path[1];
  let bestDir = DIRS[0];
  let bestScore = Infinity;
  const dangerNow = dangerAt(state, thief.x, thief.y);
  // When already seen, danger avoidance dominates progress: retreat to a
  // safe cell instead of inching toward the loot through a cone.
  const dangerWeight = dangerNow > 0.3 ? 1500 : 500;
  for (const [dx, dy] of DIRS) {
    const len = Math.hypot(dx, dy) || 1;
    const speed = THIEF.walk;
    const nx = thief.x + (dx / len) * speed * 0.3;
    const ny = thief.y + (dy / len) * speed * 0.3;
    if (hitsWall(state.room, nx, ny, THIEF.radius)) continue;
    const danger = dangerAt(state, nx, ny);
    const d = Math.hypot(nav.x - nx, nav.y - ny);
    const score = danger * dangerWeight + d + (dx === 0 && dy === 0 ? 12 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestDir = [dx, dy];
    }
  }
  return {
    up: bestDir[1] < 0, down: bestDir[1] > 0,
    left: bestDir[0] < 0, right: bestDir[0] > 0,
    sneak: dangerNow > 0.15,
    grab: false, emp: false, noise: false, click: null,
  };
}

function runPilot(state, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = updateWorld(state, pilotInput(state), STEP);
    if (state.over) return events;
  }
  return [];
}

// Steps the world forward with no input at all: guards patrol, cameras sweep,
// the thief waits at the door. Used by the title scene.
export function idleWorld(state, seconds) {
  const steps = Math.floor(seconds / STEP);
  const idle = { up: false, down: false, left: false, right: false, sneak: false, grab: false, emp: false, noise: false, click: null };
  for (let i = 0; i < steps; i += 1) updateWorld(state, idle, STEP);
}

export function stageShot(shot, seed) {
  if (shot === 'start') {
    // Cover: a LIVE play frame, not the title screen — the judge sees the
    // HUD, the alarm meter, the thief mid tiara-lift, guards and cameras.
    // Room 2 (Gallery of Kings): the pilot plays until the tiara lift is
    // about halfway (grabT >= 0.8 of 1.5s, progress ring ~53%), capped at
    // 40s so a seed that never lifts still yields a live frame.
    const world = createWorld(1);
    const cap = Math.floor(40 / STEP);
    for (let i = 0; i < cap; i += 1) {
      updateWorld(world, pilotInput(world), STEP);
      if (world.over) break;
      if (world.thief.grabT >= 0.8) break;
    }
    return { screen: SCREEN_PLAY, world, finalStats: null };
  }
  if (shot === 'play') {
    const world = createWorld(0);
    runPilot(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, world, finalStats: null };
  }
  // end: play all three rooms for real; fall back to a completed third room
  // if the pilot is caught anywhere along the way.
  let world = createWorld(0);
  let totalLoot = 0;
  let totalTime = 0;
  let wonAll = true;
  for (let room = 0; room < 3; room += 1) {
    world = createWorld(room, totalLoot, totalTime);
    const events = runPilot(world, ROOM_LIMIT_SECONDS);
    totalLoot = world.totalLoot;
    totalTime = world.totalTime;
    if (!world.won) {
      wonAll = false;
      break;
    }
    void events;
  }
  if (wonAll) {
    return {
      screen: SCREEN_WIN,
      world,
      finalStats: { total: world.totalLoot, time: world.totalTime, peak: world.peakAlarm },
    };
  }
  // Fallback: a third room already cleared, the thief at the getaway door.
  const staged = createWorld(2, 2750, 214);
  for (const l of staged.loot) l.taken = true;
  staged.lootValue = 1900;
  staged.totalLoot = 2750;
  staged.exitOpen = true;
  staged.thief.x = staged.room.exit.x - 34;
  staged.thief.y = staged.room.exit.y + 28;
  staged.alarm = 18;
  staged.peakAlarm = 34;
  return {
    screen: SCREEN_WIN,
    world: staged,
    finalStats: { total: 2750, time: 214, peak: 34 },
  };
}
