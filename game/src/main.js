// Velvet Vault — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between six screens:
// title, play, paused, caught, room clear and getaway. The best take is kept
// in localStorage.
//
// ?seed=N fixes the patrol timing. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_EMP, EVENT_GRAB, EVENT_PICKUP, EVENT_PING, EVENT_ROOM_CLEAR, EVENT_SPOTTED, updateWorld } from './world.js';
import { createInput } from './input.js';
import { sfx, unlockAudio } from './audio.js';
import { createRenderer, s2w, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { ROOMS } from './level.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
const CLEAR_HOLD_SECONDS = 1.4;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
void rng;
let world = createWorld(0);
const renderer = createRenderer(canvas);
const input = createInput(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best take then lasts this visit only.
  }
}

let best = readBest();
let screen = SCREEN_TITLE;
let clearT = 0;
let finalStats = null;
let alarmTickT = 0;

function setStatus(text) {
  if (status) status.textContent = text;
}

function startJob() {
  world = createWorld(0);
  finalStats = null;
  screen = SCREEN_PLAY;
  setStatus('The job is on. Cross the room, grab the loot, reach the getaway door.');
  sfx.click();
}

function nextRoom() {
  if (world.roomIndex + 1 >= ROOMS.length) {
    finishJob();
    return;
  }
  world = createWorld(world.roomIndex + 1, world.totalLoot, world.totalTime);
  screen = SCREEN_PLAY;
  setStatus(world.room.name + '. ' + world.room.sub);
}

function finishJob() {
  finalStats = { total: world.totalLoot, time: world.totalTime, peak: world.peakAlarm };
  if (world.totalLoot > best) {
    best = world.totalLoot;
    saveBest(best);
  }
  screen = SCREEN_WIN;
  setStatus(`Getaway! Total take $${world.totalLoot}.`);
  sfx.win();
}

function handleEvents(events) {
  for (const event of events) {
    if (event === EVENT_PICKUP) sfx.pickup();
    else if (event === EVENT_GRAB) sfx.grabDone();
    else if (event === EVENT_EMP) sfx.emp();
    else if (event === EVENT_PING) sfx.ping();
    else if (event === EVENT_SPOTTED) sfx.spotted();
    else if (event === 'exitOpen') sfx.roomClear();
    else if (event === EVENT_ROOM_CLEAR) {
      screen = SCREEN_CLEAR;
      clearT = 0;
      sfx.roomClear();
      if (world.roomIndex + 1 >= ROOMS.length) finishJob();
    } else if (event === EVENT_CAUGHT) {
      screen = SCREEN_OVER;
      if (world.totalLoot > best) {
        best = world.totalLoot;
        saveBest(best);
      }
      setStatus('Caught! Press R to run it back.');
      sfx.caught();
    }
  }
}

function step(inp, dt) {
  if (screen !== SCREEN_PLAY) return;
  const events = updateWorld(world, inp, dt);
  if (world.alarm > 55) {
    alarmTickT -= dt;
    if (alarmTickT <= 0) {
      alarmTickT = 0.7;
      sfx.alarmTick();
    }
  }
  handleEvents(events);
}

let last = performance.now();
function frame(now) {
  const inputState = input.poll();
  // Clicks arrive in canvas pixel coords; the world speaks world coords.
  // Convert at the boundary so click-to-move targets the point the player
  // actually clicked (was: raw canvas coords, ~160x126px off at centre).
  if (inputState.click) {
    const [wx, wy] = s2w(inputState.click.x, inputState.click.y);
    inputState.click = { x: wx, y: wy };
  }
  if (inputState.confirm) unlockAudio();
  if (screen === SCREEN_TITLE && (inputState.confirm || inputState.click)) startJob();
  else if (screen === SCREEN_OVER && (inputState.retry || inputState.confirm)) startJob();
  else if (screen === SCREEN_WIN && inputState.confirm) startJob();
  else if (screen === SCREEN_CLEAR && (inputState.confirm || clearT > CLEAR_HOLD_SECONDS)) nextRoom();
  else if (screen === SCREEN_PLAY && inputState.pause) screen = SCREEN_PAUSED;
  else if (screen === SCREEN_PAUSED && (inputState.pause || inputState.confirm)) screen = SCREEN_PLAY;
  if (screen === SCREEN_CLEAR) clearT += Math.min(MAX_FRAME, (now - last) / 1000);

  let elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  while (elapsed > 0) {
    const dt = Math.min(STEP, elapsed);
    step(inputState, dt);
    elapsed -= dt;
    if (screen !== SCREEN_PLAY) break;
  }
  renderer.draw(screen, world, { time: now / 1000, best, finalStats });
  requestAnimationFrame(frame);
}

// Debug hook for automated play-testing: read-only view of the live state.
window.__velvet = {
  get screen() { return screen; },
  get world() { return world; },
  get best() { return best; },
};

if (shot === 'start' || shot === 'play' || shot === 'end') {
  const staged = stageShot(shot, seed);
  screen = staged.screen;
  world = staged.world;
  finalStats = staged.finalStats;
  renderer.draw(screen, world, { time: 0, best, finalStats });
  renderer.draw(screen, world, { time: 0.5, best, finalStats });
  window.__shotReady = true;
} else {
  setStatus('Velvet Vault. Press Enter to start the job.');
  requestAnimationFrame(frame);
}
