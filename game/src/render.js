// Velvet Vault — everything the player sees, drawn on one canvas in code (no
// image files): the casino floor, walls and velvet ropes, guards with their
// vision cones, sweeping cameras, loot, the alarm meter, and the title /
// caught / getaway screens. The world (960x540) is scaled to fit under the HUD.
import { ALARM, HUD_H, PAL, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

const SCALE = Math.min(VIEW_W / WORLD_W, (VIEW_H - HUD_H) / WORLD_H);
const OX = (VIEW_W - WORLD_W * SCALE) / 2;
const OY = HUD_H + ((VIEW_H - HUD_H) - WORLD_H * SCALE) / 2;

function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  function w2s(x, y) { return [OX + x * SCALE, OY + y * SCALE]; }

  function drawFloor(room) {
    ctx.fillStyle = PAL.felt;
    ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H);
    // Carpet checker, faint, so the floor reads as one big casino room.
    const [x0, y0] = w2s(0, 0);
    const w = WORLD_W * SCALE;
    const h = WORLD_H * SCALE;
    ctx.fillStyle = PAL.carpet;
    const cell = 60 * SCALE;
    for (let gy = 0; gy < 9; gy += 1) {
      for (let gx = 0; gx < 16; gx += 1) {
        if ((gx + gy) % 2 === 0) ctx.fillRect(x0 + gx * cell, y0 + gy * cell, cell, cell);
      }
    }
    // Gold carpet runner down the middle of the room.
    ctx.fillStyle = 'rgba(217, 164, 65, 0.10)';
    ctx.fillRect(x0, y0 + h * 0.42, w, h * 0.16);
    // Gold trim border around the play area.
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(217, 164, 65, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
  }

  function drawCone(x, y, dir, range, half, fill, hot) {
    const [sx, sy] = w2s(x, y);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, range * SCALE, dir - half, dir + half);
    ctx.closePath();
    const grad = ctx.createRadialGradient(sx, sy, 8, sx, sy, range * SCALE);
    grad.addColorStop(0, hot ? 'rgba(255, 90, 78, 0.42)' : fill);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function drawWall(wall) {
    const [sx, sy] = w2s(wall.x, wall.y);
    const w = wall.w * SCALE;
    const h = wall.h * SCALE;
    if (wall.kind === 'vault') {
      ctx.fillStyle = '#3a4148';
      ctx.fillRect(sx, sy, w, h);
      ctx.strokeStyle = '#9aa4ae';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);
      ctx.fillStyle = '#c8ccd2';
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(sx + 10 + i * ((w - 20) / 3), sy + 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + 10 + i * ((w - 20) / 3), sy + h - 10, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f2c14e';
      ctx.font = `bold ${Math.round(13 * SCALE)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('VAULT', sx + w / 2, sy + h / 2 + 5);
      return;
    }
    if (wall.kind === 'case') {
      ctx.fillStyle = '#274b52';
      ctx.fillRect(sx, sy, w, h);
      ctx.fillStyle = 'rgba(159, 216, 232, 0.35)';
      ctx.fillRect(sx + 4, sy + 4, w - 8, h - 8);
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(sx + 8, sy + h - 8);
      ctx.lineTo(sx + w * 0.4, sy + 8);
      ctx.lineTo(sx + w * 0.55, sy + 8);
      ctx.lineTo(sx + 16, sy + h - 8);
      ctx.closePath();
      ctx.fill();
      return;
    }
    // Pillar: marble column with gold band.
    ctx.fillStyle = PAL.marble;
    ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = PAL.marbleDark;
    ctx.fillRect(sx, sy + h - 6, w, 6);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(sx, sy + h / 2 - 2, w, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 1, sy + 1, w - 2, h - 2);
  }

  function drawRope(rope) {
    const [sx, sy] = w2s(rope.x, rope.y);
    ctx.strokeStyle = PAL.velvetBright;
    ctx.lineWidth = 5 * SCALE;
    ctx.beginPath();
    if (rope.w > rope.h) {
      ctx.moveTo(sx, sy + (rope.h * SCALE) / 2);
      ctx.lineTo(sx + rope.w * SCALE, sy + (rope.h * SCALE) / 2);
    } else {
      ctx.moveTo(sx + (rope.w * SCALE) / 2, sy);
      ctx.lineTo(sx + (rope.w * SCALE) / 2, sy + rope.h * SCALE);
    }
    ctx.stroke();
    ctx.fillStyle = PAL.gold;
    const post = (px, py) => { ctx.beginPath(); ctx.arc(px, py, 4 * SCALE, 0, Math.PI * 2); ctx.fill(); };
    if (rope.w > rope.h) {
      post(sx, sy + (rope.h * SCALE) / 2);
      post(sx + rope.w * SCALE, sy + (rope.h * SCALE) / 2);
    } else {
      post(sx + (rope.w * SCALE) / 2, sy);
      post(sx + (rope.w * SCALE) / 2, sy + rope.h * SCALE);
    }
  }

  function drawLoot(l, time) {
    if (l.taken) return;
    const [sx, sy] = w2s(l.x, l.y);
    const bob = Math.sin(time * 2 + l.x) * 2;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + l.y);
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.shadowColor = l.kind === 'tiara' ? '#ffd94e' : '#f2c14e';
    ctx.shadowBlur = l.kind === 'tiara' ? 18 : 8;
    if (l.kind === 'gold') {
      ctx.fillStyle = PAL.lootGold;
      ctx.fillRect(-11, -5, 22, 10);
      ctx.fillStyle = '#c98f2a';
      ctx.fillRect(-11, 2, 22, 3);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(-11, -5, 22, 3);
    } else if (l.kind === 'gem') {
      ctx.fillStyle = PAL.lootGem;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(4, -2);
      ctx.lineTo(-4, -2);
      ctx.closePath();
      ctx.fill();
    } else if (l.kind === 'chips') {
      const cols = ['#d94f4f', '#4f7fd9', '#f2c14e'];
      cols.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(0, 4 - i * 5, 9, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -6, 9, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Sunburst Tiara: gold crown with a pink gem, ringed by its glow.
      ctx.strokeStyle = `rgba(242, 193, 78, ${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 20 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PAL.goldBright;
      ctx.beginPath();
      ctx.moveTo(-14, 8);
      ctx.lineTo(-14, -4);
      ctx.lineTo(-7, 4);
      ctx.lineTo(0, -10);
      ctx.lineTo(7, 4);
      ctx.lineTo(14, -4);
      ctx.lineTo(14, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PAL.lootPink;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Value tag so loot is readable at a glance.
    ctx.fillStyle = PAL.text;
    ctx.font = `bold ${Math.round(11 * SCALE)}px sans-serif`;
    ctx.textAlign = 'center';
    const label = l.kind === 'tiara' ? '$1000' : l.kind === 'gem' ? '$250' : l.kind === 'gold' ? '$150' : '$100';
    ctx.fillText(label, sx, sy + 26 + bob);
  }

  function drawExit(world) {
    const e = world.room.exit;
    const [sx, sy] = w2s(e.x, e.y);
    const w = e.w * SCALE;
    const h = e.h * SCALE;
    const open = world.exitOpen;
    ctx.save();
    if (open) {
      ctx.shadowColor = '#6fe08a';
      ctx.shadowBlur = 22;
    }
    ctx.fillStyle = open ? '#1f6b3a' : '#5a1f24';
    ctx.fillRect(sx, sy, w, h);
    ctx.restore();
    ctx.strokeStyle = open ? PAL.safe : PAL.danger;
    ctx.lineWidth = 3;
    ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);
    ctx.fillStyle = open ? PAL.safe : '#ffb0a8';
    ctx.font = `bold ${Math.round(12 * SCALE)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'GETAWAY' : 'LOCKED', sx + w / 2, sy + h / 2 - 4);
    ctx.font = `${Math.round(10 * SCALE)}px sans-serif`;
    ctx.fillText(open ? 'VAN →' : 'need goal', sx + w / 2, sy + h / 2 + 12);
  }

  function drawThief(thief, time) {
    const [sx, sy] = w2s(thief.x, thief.y);
    const r = 13 * SCALE * (thief.sneak ? 0.85 : 1);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = PAL.thief;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Hood point in the facing direction.
    ctx.fillStyle = PAL.thief;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(thief.dir) * r * 1.5, sy + Math.sin(thief.dir) * r * 1.5);
    ctx.lineTo(sx + Math.cos(thief.dir + 2.4) * r * 0.9, sy + Math.sin(thief.dir + 2.4) * r * 0.9);
    ctx.lineTo(sx + Math.cos(thief.dir - 2.4) * r * 0.9, sy + Math.sin(thief.dir - 2.4) * r * 0.9);
    ctx.closePath();
    ctx.fill();
    // Mask band + eyes.
    ctx.strokeStyle = '#2b0d12';
    ctx.lineWidth = 3 * SCALE;
    ctx.beginPath();
    ctx.moveTo(sx - 6 * SCALE, sy - 2 * SCALE);
    ctx.lineTo(sx + 6 * SCALE, sy - 2 * SCALE);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx - 3.5 * SCALE, sy - 2 * SCALE, 1.8, 0, Math.PI * 2);
    ctx.arc(sx + 3.5 * SCALE, sy - 2 * SCALE, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Sneak ring so the player can see the quiet mode at a glance.
    if (thief.sneak) {
      ctx.strokeStyle = 'rgba(111, 224, 138, 0.8)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Tiara grab progress ring.
    if (thief.grabT > 0) {
      ctx.strokeStyle = PAL.goldBright;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 10, -Math.PI / 2, -Math.PI / 2 + (thief.grabT / 1.5) * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PAL.text;
      ctx.font = `bold ${Math.round(11 * SCALE)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('LIFTING…', sx, sy - r - 16);
    }
  }

  function drawGuard(g, time) {
    // Vision cone first (under the guard), hot red while chasing.
    const hot = g.mode === 'chase' || g.suspicion > 0.55;
    drawCone(g.x, g.y, g.dir, 190, 0.62, PAL.cone, hot);
    const [sx, sy] = w2s(g.x, g.y);
    const r = 14 * SCALE;
    ctx.fillStyle = PAL.guard;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.guardTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Cap brim in the facing direction.
    ctx.fillStyle = '#1c3247';
    ctx.beginPath();
    ctx.arc(sx + Math.cos(g.dir) * r * 0.7, sy + Math.sin(g.dir) * r * 0.7, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // Suspicion: a filling arc + ? / ! above the head.
    if (g.suspicion > 0.05) {
      ctx.strokeStyle = g.suspicion > 0.55 ? PAL.danger : PAL.goldBright;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 6, -Math.PI / 2, -Math.PI / 2 + g.suspicion * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = g.suspicion > 0.55 ? PAL.danger : PAL.goldBright;
      ctx.font = `bold ${Math.round(18 * SCALE)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(g.mode === 'chase' ? '!' : '?', sx, sy - r - 8);
    }
    if (g.mode === 'investigate') {
      ctx.fillStyle = PAL.text;
      ctx.font = `bold ${Math.round(13 * SCALE)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('…?', sx, sy - r - 8);
    }
  }

  function drawCamera(c, world, time) {
    const disabled = world.empT > 0;
    const [sx, sy] = w2s(c.x, c.y);
    if (!disabled) drawCone(c.x, c.y, c.angle, 215, 0.5, PAL.camCone, false);
    ctx.fillStyle = disabled ? '#5a5a5a' : '#222';
    ctx.fillRect(sx - 8, sy - 6, 16, 12);
    ctx.fillStyle = disabled ? '#888' : '#c8ccd2';
    ctx.beginPath();
    ctx.arc(sx + Math.cos(c.angle) * 12, sy + Math.sin(c.angle) * 12, 5, 0, Math.PI * 2);
    ctx.fill();
    const blink = Math.sin(time * 6) > 0;
    ctx.fillStyle = disabled ? '#666' : blink ? '#ff3b30' : '#7a1010';
    ctx.beginPath();
    ctx.arc(sx, sy - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    if (disabled) {
      ctx.fillStyle = PAL.text;
      ctx.font = `bold ${Math.round(10 * SCALE)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('EMP', sx, sy - 14);
    }
    // Camera alert arc.
    if (c.alert > 0.05 && !disabled) {
      ctx.strokeStyle = PAL.danger;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 14, -Math.PI / 2, -Math.PI / 2 + c.alert * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(world, screen) {
    ctx.fillStyle = '#0a1a1c';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HUD_H);
    ctx.lineTo(VIEW_W, HUD_H);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = PAL.goldBright;
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('VELVET VAULT', 20, 30);
    ctx.fillStyle = PAL.textDim;
    ctx.font = '13px sans-serif';
    ctx.fillText(world.room.name, 20, 52);
    // Loot tally.
    ctx.fillStyle = PAL.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`LOOT ${fmtMoney(world.lootValue)} / ${fmtMoney(world.room.goal)}`, 330, 32);
    ctx.fillStyle = PAL.textDim;
    ctx.font = '13px sans-serif';
    ctx.fillText(`total ${fmtMoney(world.totalLoot)}`, 330, 52);
    // Alarm meter.
    const ax = 620;
    const aw = 300;
    ctx.fillStyle = PAL.text;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('ALARM', ax, 24);
    ctx.fillStyle = '#1c2a2c';
    ctx.fillRect(ax, 30, aw, 16);
    const frac = world.alarm / 100;
    const alarmColor = world.alarm >= ALARM.critical ? PAL.danger : world.alarm >= ALARM.warn ? '#ff9f2e' : '#6fe08a';
    ctx.fillStyle = alarmColor;
    ctx.fillRect(ax, 30, aw * frac, 16);
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, 30, aw, 16);
    ctx.fillStyle = PAL.text;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(world.alarm)}%`, ax + aw + 44, 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = PAL.textDim;
    ctx.font = '12px sans-serif';
    ctx.fillText(world.alarm >= ALARM.critical ? 'LOCKDOWN IMMINENT' : world.alarm >= ALARM.warn ? 'guards on edge' : 'quiet… for now', ax, 62);
    // Tools + timer + room dots.
    ctx.fillStyle = PAL.text;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`EMP ×${world.emp}  •  NOISE ×${world.noise}`, 1000, 30);
    ctx.fillStyle = PAL.textDim;
    ctx.font = '13px sans-serif';
    const t = Math.floor(world.totalTime);
    ctx.fillText(`time ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, 1000, 52);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < world.roomIndex ? PAL.safe : i === world.roomIndex ? PAL.goldBright : '#3a4a4c';
      ctx.beginPath();
      ctx.arc(1000 + i * 18, 68, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Toast under the HUD.
    if (world.toastT > 0 && world.toast) {
      ctx.fillStyle = 'rgba(10, 26, 28, 0.85)';
      const tw = ctx.measureText(world.toast).width + 28;
      ctx.fillRect((VIEW_W - tw) / 2, HUD_H + 8, tw, 28);
      ctx.fillStyle = PAL.goldBright;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(world.toast, VIEW_W / 2, HUD_H + 27);
      ctx.textAlign = 'left';
    }
  }

  function drawHintBar() {
    ctx.fillStyle = 'rgba(10, 26, 28, 0.9)';
    ctx.fillRect(0, VIEW_H - 26, VIEW_W, 26);
    ctx.fillStyle = PAL.textDim;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASD / arrows move  •  Shift sneak  •  E lift the tiara  •  1 EMP  •  2 noisemaker  •  click to walk  •  P pause', VIEW_W / 2, VIEW_H - 8);
    ctx.textAlign = 'left';
  }

  function drawWorld(world, time) {
    drawFloor(world.room);
    for (const rope of world.room.ropes) drawRope(rope);
    for (const w of world.room.walls) drawWall(w);
    drawExit(world);
    for (const l of world.loot) drawLoot(l, time);
    if (world.ping) {
      const [px, py] = w2s(world.ping.x, world.ping.y);
      ctx.strokeStyle = `rgba(242, 193, 78, ${0.3 + 0.5 * (world.pingT / 4.5)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, (1 - world.pingT / 4.5) * 46 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PAL.goldBright;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♪', px, py - 12);
      ctx.textAlign = 'left';
    }
    for (const c of world.cameras) drawCamera(c, world, time);
    for (const g of world.guards) drawGuard(g, time);
    drawThief(world.thief, time);
  }

  function panel(title, lines, accent) {
    const pw = 640;
    const ph = 110 + lines.length * 30;
    const px = (VIEW_W - pw) / 2;
    const py = (VIEW_H - ph) / 2;
    ctx.fillStyle = 'rgba(8, 22, 24, 0.94)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = accent || PAL.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = PAL.goldBright;
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW_W / 2, py + 58);
    ctx.fillStyle = PAL.text;
    ctx.font = '16px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, py + 96 + i * 30));
    ctx.textAlign = 'left';
  }

  function draw(screen, world, opts) {
    const time = opts.time || 0;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (screen === SCREEN_TITLE) {
      drawWorld(world, time);
      ctx.fillStyle = 'rgba(4, 12, 13, 0.72)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('VELVET VAULT', [
        'A midnight heist at the Gilded Palm — three rooms, one tiara, no witnesses.',
        'Cross each room, grab the loot, slip out the getaway door before the alarm hits 100%.',
        'WASD move • Shift sneak • E lift the tiara • 1 EMP • 2 noisemaker • click to walk',
        'Read the cones before you move. Cameras sweep. Guards remember what they saw.',
        'Press ENTER or click to start the job.',
        opts.best > 0 ? `Best take so far: ${fmtMoney(opts.best)}` : 'First job tonight — make it clean.',
      ], PAL.gold);
      return;
    }
    drawHud(world, screen);
    drawWorld(world, time);
    drawHintBar();
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(4, 12, 13, 0.6)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('PAUSED', ['The crew waits in the dark. Press P to keep moving.'], PAL.gold);
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(20, 4, 6, 0.62)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const reason = world.caughtReason === 'guard' ? 'A guard grabbed your collar.'
        : world.caughtReason === 'alarm' ? 'The alarm hit 100% — lockdown, lights, sirens.'
        : 'A camera held you in frame until the alarm tripped.';
      panel('CAUGHT!', [
        reason,
        `You kept ${fmtMoney(world.totalLoot)} of the take.`,
        'Press R or ENTER to run it back.',
      ], PAL.danger);
    } else if (screen === SCREEN_CLEAR) {
      ctx.fillStyle = 'rgba(4, 12, 13, 0.45)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('ROOM CLEAR', [
        `Room ${world.roomIndex + 1} done — ${fmtMoney(world.lootValue)} lifted here.`,
        'Next room: press ENTER.',
      ], PAL.safe);
    } else if (screen === SCREEN_WIN) {
      ctx.fillStyle = 'rgba(4, 14, 8, 0.66)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const stats = opts.finalStats || { total: world.totalLoot, time: world.totalTime, peak: world.peakAlarm };
      const rating = stats.peak < 25 ? 'GHOST — never seen' : stats.peak < 60 ? 'SHADOW — a whisper' : 'LOUD — but rich';
      panel('GETAWAY!', [
        `The van pulls away. Total take: ${fmtMoney(stats.total)}.`,
        `Time ${Math.floor(stats.time / 60)}:${String(Math.floor(stats.time) % 60).padStart(2, '0')}  •  peak alarm ${Math.round(stats.peak)}%  •  ${rating}`,
        'Press ENTER to run the job again.',
      ], PAL.safe);
    }
  }

  return { draw, w2s };
}
