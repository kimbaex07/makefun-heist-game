// Velvet Vault — the three rooms of the Gilded Palm. Each room is one floor the
// thief crosses: solid walls block movement and sight, velvet ropes block only
// the thief (staff step over them), guards walk waypoint patrols, cameras sweep
// from the walls, loot waits to be grabbed, and the getaway door opens once
// the room's loot goal is met. Coordinates are world pixels (960 x 540).
// kind: 'case' (glass display), 'pillar' (marble column), 'vault' (steel), 'rope'.
export const ROOMS = [
  {
    name: 'Room 1 — The Gilded Palm Lobby',
    sub: 'Slip past the night shift. Grab $500, then reach the getaway door.',
    par: 75,
    goal: 500,
    start: { x: 70, y: 470 },
    exit: { x: 872, y: 40, w: 56, h: 56 },
    walls: [
      { x: 400, y: 210, w: 170, h: 90, kind: 'case' },
      { x: 215, y: 110, w: 44, h: 44, kind: 'pillar' },
      { x: 700, y: 360, w: 44, h: 44, kind: 'pillar' },
      { x: 640, y: 130, w: 130, h: 70, kind: 'case' },
      { x: 150, y: 300, w: 110, h: 60, kind: 'case' },
    ],
    ropes: [
      { x: 280, y: 400, w: 90, h: 8 },
      { x: 430, y: 400, w: 90, h: 8 },
      { x: 620, y: 300, w: 10, h: 110 },
    ],
    guards: [
      { path: [[300, 150], [680, 150], [680, 340], [300, 340]], pause: 1.2 },
      { path: [[520, 430], [880, 430], [880, 180]], pause: 1.6 },
    ],
    cameras: [
      { x: 480, y: 8, base: Math.PI / 2, sweep: 0.7, period: 5 },
      { x: 952, y: 280, base: Math.PI, sweep: 0.6, period: 6 },
    ],
    loot: [
      { x: 180, y: 450, kind: 'gold' },
      { x: 850, y: 470, kind: 'gem' },
      { x: 520, y: 70, kind: 'gold' },
      { x: 760, y: 300, kind: 'gold' },
      { x: 90, y: 140, kind: 'gem' },
    ],
  },
  {
    name: 'Room 2 — Gallery of Kings',
    sub: 'The Sunburst Tiara hangs in the middle. Hold E beside it to lift it.',
    par: 90,
    goal: 900,
    start: { x: 70, y: 70 },
    exit: { x: 872, y: 444, w: 56, h: 56 },
    walls: [
      { x: 300, y: 120, w: 200, h: 60, kind: 'case' },
      { x: 560, y: 300, w: 200, h: 60, kind: 'case' },
      { x: 180, y: 300, w: 44, h: 44, kind: 'pillar' },
      { x: 760, y: 140, w: 44, h: 44, kind: 'pillar' },
      { x: 380, y: 420, w: 140, h: 50, kind: 'case' },
    ],
    ropes: [
      { x: 200, y: 200, w: 10, h: 100 },
      { x: 700, y: 200, w: 120, h: 8 },
    ],
    guards: [
      { path: [[250, 90], [720, 90], [720, 200], [250, 200]], pause: 1.0 },
      { path: [[150, 450], [330, 450], [330, 260], [560, 260]], pause: 1.4 },
      { path: [[860, 420], [860, 120]], pause: 1.8 },
    ],
    cameras: [
      { x: 300, y: 8, base: Math.PI / 2, sweep: 0.75, period: 5.5 },
      { x: 952, y: 150, base: Math.PI, sweep: 0.6, period: 7 },
    ],
    loot: [
      { x: 480, y: 270, kind: 'tiara' },
      { x: 120, y: 480, kind: 'gold' },
      { x: 880, y: 70, kind: 'gem' },
      { x: 650, y: 470, kind: 'chips' },
      { x: 250, y: 350, kind: 'gold' },
      { x: 700, y: 60, kind: 'gem' },
    ],
  },
  {
    name: 'Room 3 — The Vault Floor',
    sub: 'The last tiara, the heaviest patrol. Grab $1000 and vanish.',
    par: 100,
    goal: 1000,
    start: { x: 70, y: 470 },
    exit: { x: 872, y: 40, w: 56, h: 56 },
    walls: [
      { x: 420, y: 200, w: 140, h: 120, kind: 'vault' },
      { x: 180, y: 140, w: 150, h: 60, kind: 'case' },
      { x: 650, y: 320, w: 150, h: 60, kind: 'case' },
      { x: 300, y: 380, w: 44, h: 44, kind: 'pillar' },
      { x: 640, y: 120, w: 44, h: 44, kind: 'pillar' },
    ],
    ropes: [
      { x: 480, y: 60, w: 10, h: 90 },
      { x: 240, y: 300, w: 130, h: 8 },
    ],
    guards: [
      { path: [[200, 90], [620, 90]], pause: 1.0 },
      { path: [[300, 480], [760, 480], [760, 400]], pause: 1.2 },
      { path: [[880, 300], [880, 480], [500, 480]], pause: 1.5 },
      { path: [[120, 250], [340, 250], [340, 120]], pause: 1.0 },
    ],
    cameras: [
      { x: 700, y: 8, base: Math.PI / 2, sweep: 0.7, period: 5 },
      { x: 952, y: 420, base: Math.PI, sweep: 0.65, period: 6.5 },
      { x: 8, y: 270, base: 0, sweep: 0.6, period: 7.5 },
    ],
    loot: [
      { x: 490, y: 340, kind: 'tiara' },
      { x: 120, y: 120, kind: 'gold' },
      { x: 850, y: 470, kind: 'gem' },
      { x: 480, y: 60, kind: 'chips' },
      { x: 850, y: 200, kind: 'gold' },
      { x: 150, y: 380, kind: 'gem' },
    ],
  },
];

export const LOOT_VALUE = { gold: 150, gem: 250, chips: 100, tiara: 1000 };
export const LOOT_BIG = { tiara: true };
