// Velvet Vault — the simulation: thief movement, guard patrols and vision cones,
// sweeping cameras, loot grabs, tools (EMP, noisemaker) and the alarm meter.
// Pure logic: no DOM, no canvas here, so the same step function drives both the
// live game and the screenshot staging. updateWorld returns event names the
// caller turns into sounds and screen changes.
import {
  ALARM, CONE, EMP, GRAB_SECONDS, GUARD, NOISE, NOISEMAKER, SPOT, STEP,
  THIEF, WORLD_H, WORLD_W,
} from './config.js';
import { LOOT_BIG, LOOT_VALUE, ROOMS } from './level.js';

export const EVENT_PICKUP = 'pickup';
export const EVENT_GRAB = 'grabDone';
export const EVENT_SPOTTED = 'spotted';
export const EVENT_CAUGHT = 'caught';
export const EVENT_ROOM_CLEAR = 'roomClear';
export const EVENT_EMP = 'emp';
export const EVENT_PING = 'ping';

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Slab test: does segment (x1,y1)-(x2,y2) cross rect r?
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export function clearSight(state, x1, y1, x2, y2) {
  for (const w of state.room.walls) {
    if (segmentHitsRect(x1, y1, x2, y2, w)) return false;
  }
  return true;
}

function circleHitsRect(x, y, r, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r;
}

function blockedAt(state, x, y, radius, thief) {
  if (x < radius || x > WORLD_W - radius || y < radius || y > WORLD_H - radius) return true;
  for (const w of state.room.walls) {
    if (circleHitsRect(x, y, radius, w)) return true;
  }
  if (thief) {
    for (const rope of state.room.ropes) {
      if (circleHitsRect(x, y, radius, rope)) return true;
    }
  }
  return false;
}

// Move a circle axis by axis so it slides along walls instead of sticking.
function slideMove(state, body, dx, dy, radius, thief) {
  const nx = body.x + dx;
  if (!blockedAt(state, nx, body.y, radius, thief)) body.x = nx;
  const ny = body.y + dy;
  if (!blockedAt(state, body.x, ny, radius, thief)) body.y = ny;
}

// Detection rate (0..~1.5 per second) for a watcher at (wx,wy) facing `dir`.
function spotRate(state, wx, wy, dir, range, half, tx, ty, sneaking) {
  const d = dist(wx, wy, tx, ty);
  if (d > range) return 0;
  if (angleDiff(Math.atan2(ty - wy, tx - wx), dir) > half) return 0;
  if (!clearSight(state, wx, wy, tx, ty)) return 0;
  let rate = d < 70 ? SPOT.near : d < 130 ? SPOT.mid : SPOT.far;
  if (sneaking) rate *= SPOT.sneakMul;
  return rate;
}

// How dangerous is standing at (x,y) right now (0 = unseen)? Used by the
// screenshot autopilot and exposed for the HUD's "eyes on you" hint.
export function dangerAt(state, x, y) {
  let danger = 0;
  for (const g of state.guards) {
    danger = Math.max(danger, spotRate(state, g.x, g.y, g.dir, CONE.guardRange, CONE.guardHalf, x, y, false));
  }
  if (state.empT <= 0) {
    for (const c of state.cameras) {
      danger = Math.max(danger, spotRate(state, c.x, c.y, c.angle, CONE.camRange, CONE.camHalf, x, y, false) * 1.4);
    }
  }
  return danger;
}

export function createWorld(roomIndex, totalLoot = 0, totalTime = 0) {
  const room = ROOMS[roomIndex];
  const guards = room.guards.map((g) => ({
    x: g.path[0][0], y: g.path[0][1],
    dir: Math.atan2(g.path[1][1] - g.path[0][1], g.path[1][0] - g.path[0][0]),
    path: g.path, wp: 1, pause: g.pause, pauseT: 0,
    suspicion: 0, mode: 'patrol', modeT: 0, lastSeen: null, seen: false,
  }));
  const cameras = room.cameras.map((c) => ({
    x: c.x, y: c.y, base: c.base, sweep: c.sweep, period: c.period,
    angle: c.base, alert: 0, t: 0,
  }));
  const loot = room.loot.map((l) => ({ x: l.x, y: l.y, kind: l.kind, taken: false }));
  return {
    roomIndex, room, guards, cameras, loot,
    thief: { x: room.start.x, y: room.start.y, dir: -Math.PI / 2, sneak: false, grabT: 0, moveX: null, moveY: null },
    alarm: 0, peakAlarm: 0,
    lootValue: 0, totalLoot, totalTime,
    time: 0, emp: EMP.perRoom, noise: NOISEMAKER.perRoom, empT: 0,
    ping: null, pingT: 0,
    exitOpen: false, caughtReason: null, over: false, won: false,
    toast: '', toastT: 0,
  };
}

function setToast(state, text) {
  state.toast = text;
  state.toastT = 3;
}

export function updateWorld(state, input, dt = STEP) {
  const events = [];
  if (state.over) return events;
  const room = state.room;
  const thief = state.thief;
  state.time += dt;
  state.totalTime += dt;
  if (state.toastT > 0) state.toastT -= dt;
  if (state.empT > 0) state.empT -= dt;
  if (state.pingT > 0) {
    state.pingT -= dt;
    if (state.pingT <= 0) state.ping = null;
  }

  // --- tools ---
  if (input.emp && state.emp > 0 && state.empT <= 0) {
    state.emp -= 1;
    state.empT = EMP.seconds;
    for (const c of state.cameras) c.alert = 0;
    events.push(EVENT_EMP);
    setToast(state, 'EMP burst — cameras blind for 6s!');
  }
  if (input.noise && state.noise > 0 && !state.ping) {
    state.noise -= 1;
    const px = clamp(thief.x + Math.cos(thief.dir) * NOISE.throwDist, 20, WORLD_W - 20);
    const py = clamp(thief.y + Math.sin(thief.dir) * NOISE.throwDist, 20, WORLD_H - 20);
    state.ping = { x: px, y: py };
    state.pingT = NOISE.lureSeconds;
    for (const g of state.guards) {
      if (g.mode !== 'chase' && dist(g.x, g.y, px, py) < NOISE.radius) {
        g.mode = 'investigate';
        g.modeT = NOISE.lureSeconds;
        g.lastSeen = { x: px, y: py };
      }
    }
    events.push(EVENT_PING);
    setToast(state, 'Noisemaker tossed — guards go look.');
  }

  // --- thief movement ---
  let mx = 0;
  let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (mx === 0 && my === 0 && input.click) {
    thief.moveX = input.click.x;
    thief.moveY = input.click.y;
  }
  if (mx !== 0 || my !== 0) {
    thief.moveX = null;
    thief.moveY = null;
  } else if (thief.moveX !== null) {
    const d = dist(thief.x, thief.y, thief.moveX, thief.moveY);
    if (d < 10) {
      thief.moveX = null;
      thief.moveY = null;
    } else {
      mx = (thief.moveX - thief.x) / d;
      my = (thief.moveY - thief.y) / d;
    }
  }
  const moving = mx !== 0 || my !== 0;
  if (moving) {
    const len = Math.hypot(mx, my) || 1;
    thief.sneak = !!input.sneak;
    const speed = thief.sneak ? THIEF.sneak : THIEF.walk;
    const step = speed * dt;
    slideMove(state, thief, (mx / len) * step, (my / len) * step, THIEF.radius, true);
    thief.dir = Math.atan2(my, mx);
  } else {
    thief.sneak = false;
  }

  // --- loot: small pieces auto-grab on touch, the tiara needs hold-E ---
  let nearBig = null;
  for (const l of state.loot) {
    if (l.taken) continue;
    const d = dist(thief.x, thief.y, l.x, l.y);
    if (LOOT_BIG[l.kind]) {
      if (d < 48) nearBig = l;
      continue;
    }
    if (d < 28) {
      l.taken = true;
      state.lootValue += LOOT_VALUE[l.kind];
      state.totalLoot += LOOT_VALUE[l.kind];
      events.push(EVENT_PICKUP);
    }
  }
  if (nearBig) {
    if (input.grab) {
      thief.grabT += dt;
      if (thief.grabT >= GRAB_SECONDS) {
        nearBig.taken = true;
        state.lootValue += LOOT_VALUE[nearBig.kind];
        state.totalLoot += LOOT_VALUE[nearBig.kind];
        thief.grabT = 0;
        events.push(EVENT_GRAB);
        setToast(state, 'Sunburst Tiara lifted — $1000!');
      }
    } else {
      thief.grabT = Math.max(0, thief.grabT - dt * 2);
    }
  } else {
    thief.grabT = 0;
  }
  state.nearBig = nearBig;
  if (!state.exitOpen && state.lootValue >= room.goal) {
    state.exitOpen = true;
    setToast(state, 'Goal met — the getaway door is open!');
    events.push('exitOpen');
  }

  // --- cameras ---
  let camSeeing = false;
  for (const c of state.cameras) {
    c.t += dt;
    c.angle = c.base + c.sweep * Math.sin((Math.PI * 2 * c.t) / c.period);
    if (state.empT > 0) {
      c.alert = Math.max(0, c.alert - dt);
      continue;
    }
    const rate = spotRate(state, c.x, c.y, c.angle, CONE.camRange, CONE.camHalf, thief.x, thief.y, thief.sneak);
    if (rate > 0) {
      camSeeing = true;
      c.alert = clamp(c.alert + rate * dt * 0.9, 0, 1);
      if (c.alert >= 1) {
        c.alert = 0.4;
        state.alarm = clamp(state.alarm + 20, 0, 100);
        setToast(state, 'Camera flagged you — alarm +20!');
        events.push('cameraTrip');
      }
    } else {
      c.alert = Math.max(0, c.alert - dt * 0.5);
    }
  }

  // --- guards ---
  let anySpot = false;
  let maxSuspicion = 0;
  for (const g of state.guards) {
    const rate = spotRate(state, g.x, g.y, g.dir, CONE.guardRange, CONE.guardHalf, thief.x, thief.y, thief.sneak);
    const wasSeen = g.seen;
    g.seen = rate > 0;
    if (rate > 0) {
      anySpot = true;
      g.suspicion = clamp(g.suspicion + rate * dt, 0, 1);
      g.lastSeen = { x: thief.x, y: thief.y };
      if (g.suspicion > 0.55 && g.mode !== 'chase') {
        g.mode = 'chase';
        g.modeT = 5;
        if (!wasSeen) events.push(EVENT_SPOTTED);
        setToast(state, 'Guard spotted you — RUN!');
      }
    } else {
      g.suspicion = Math.max(0, g.suspicion - SPOT.decay * dt);
    }
    maxSuspicion = Math.max(maxSuspicion, g.suspicion);

    if (g.mode === 'chase') {
      g.modeT -= dt;
      const d = dist(g.x, g.y, thief.x, thief.y);
      if (d < 24) {
        state.caughtReason = 'guard';
        state.over = true;
        events.push(EVENT_CAUGHT);
        return events;
      }
      if (g.lastSeen) {
        const a = Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x);
        g.dir = a;
        slideMove(state, g, Math.cos(a) * GUARD.chase * dt, Math.sin(a) * GUARD.chase * dt, GUARD.radius, false);
      }
      if (g.modeT <= 0) {
        g.mode = g.lastSeen ? 'investigate' : 'patrol';
        g.modeT = g.mode === 'investigate' ? 3 : 0;
      }
    } else if (g.mode === 'investigate') {
      g.modeT -= dt;
      if (g.lastSeen) {
        const a = Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x);
        const d = dist(g.x, g.y, g.lastSeen.x, g.lastSeen.y);
        if (d > 16) {
          g.dir = a;
          slideMove(state, g, Math.cos(a) * GUARD.investigate * dt, Math.sin(a) * GUARD.investigate * dt, GUARD.radius, false);
        } else {
          g.dir += dt * 1.5;
        }
      }
      if (g.modeT <= 0) {
        g.mode = 'patrol';
        g.suspicion = Math.max(0, g.suspicion - 0.4);
      }
    } else {
      // Patrol: walk to the next waypoint, pause there, turn to face the walk.
      if (g.pauseT > 0) {
        g.pauseT -= dt;
        g.dir += dt * 0.4;
      } else {
        const wp = g.path[g.wp];
        const d = dist(g.x, g.y, wp[0], wp[1]);
        if (d < 8) {
          g.wp = (g.wp + 1) % g.path.length;
          g.pauseT = g.pause;
        } else {
          const a = Math.atan2(wp[1] - g.y, wp[0] - g.x);
          const ox = g.x;
          const oy = g.y;
          g.dir = a;
          slideMove(state, g, Math.cos(a) * GUARD.patrol * dt, Math.sin(a) * GUARD.patrol * dt, GUARD.radius, false);
          if (Math.hypot(g.x - ox, g.y - oy) < 0.01) g.wp = (g.wp + 1) % g.path.length;
        }
      }
    }
  }

  // --- alarm ---
  if (anySpot || camSeeing) {
    const rise = ALARM.rise * (0.4 + maxSuspicion) + (camSeeing ? ALARM.camRise * 0.5 : 0);
    state.alarm = clamp(state.alarm + rise * dt, 0, 100);
  } else {
    state.alarm = clamp(state.alarm - ALARM.decay * dt, 0, 100);
  }
  state.peakAlarm = Math.max(state.peakAlarm, state.alarm);
  if (state.alarm >= 100) {
    state.caughtReason = 'alarm';
    state.over = true;
    events.push(EVENT_CAUGHT);
    return events;
  }

  // --- exit ---
  const e = room.exit;
  if (state.exitOpen && thief.x > e.x - 6 && thief.x < e.x + e.w + 6 && thief.y > e.y - 6 && thief.y < e.y + e.h + 6) {
    state.over = true;
    state.won = true;
    events.push(EVENT_ROOM_CLEAR);
  }
  return events;
}
