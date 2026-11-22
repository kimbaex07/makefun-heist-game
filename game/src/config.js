// Velvet Vault — shared constants: canvas size, world size, movement and
// detection tuning, palette and key bindings. Nothing here draws or updates;
// every other module reads its numbers from here so tuning lives in one place.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 84;
export const WORLD_W = 960;
export const WORLD_H = 540;
export const STEP = 1 / 60;
export const BEST_KEY = 'velvet-vault-best';

// Thief movement (pixels per second). Sneaking is slower but much harder to spot.
export const THIEF = { radius: 13, walk: 168, sneak: 96 };
export const GUARD = { radius: 14, patrol: 62, chase: 132, investigate: 98 };

// Vision: how far a guard or camera sees, and how wide its cone is (radians).
export const CONE = { guardRange: 190, guardHalf: 0.62, camRange: 215, camHalf: 0.5 };
// Detection builds 0..1 while the thief is inside a cone with a clear line of sight.
export const SPOT = { near: 1.5, mid: 0.85, far: 0.5, sneakMul: 0.45, decay: 0.35 };
// Alarm 0..100. It climbs while anyone is spotting the thief and drains when calm.
export const ALARM = { rise: 7.5, camRise: 13, decay: 2.6, warn: 55, critical: 80 };
export const NOISE = { radius: 250, lureSeconds: 4.5, throwDist: 110 };
export const EMP = { seconds: 6, perRoom: 2 };
export const NOISEMAKER = { perRoom: 2 };
export const GRAB_SECONDS = 1.5;

export const KEYS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  grab: ['KeyE'],
  emp: ['Digit1'],
  noise: ['Digit2'],
  confirm: ['Enter', 'Space'],
  pause: ['KeyP', 'Escape'],
  retry: ['KeyR'],
};

// Art-deco casino palette: deep teal felt, gold trim, burgundy velvet, warm light.
export const PAL = {
  felt: '#0d2b2e',
  feltDark: '#082022',
  carpet: '#123a3c',
  gold: '#d9a441',
  goldBright: '#f2c14e',
  velvet: '#7a1f2b',
  velvetBright: '#a83240',
  marble: '#c9c2b4',
  marbleDark: '#8f887a',
  caseGlass: '#9fd8e8',
  wall: '#1c3f43',
  wallTop: '#2a565b',
  guard: '#2c4a6b',
  guardTrim: '#e8c96a',
  thief: '#8e2f3c',
  thiefTrim: '#f2c14e',
  cone: 'rgba(242, 193, 78, 0.20)',
  coneHot: 'rgba(232, 72, 72, 0.30)',
  camCone: 'rgba(120, 200, 255, 0.16)',
  lootGold: '#f2c14e',
  lootGem: '#5fe3e0',
  lootPink: '#ff7fb0',
  text: '#f4e8c8',
  textDim: '#b8a888',
  danger: '#ff5a4e',
  safe: '#6fe08a',
};
