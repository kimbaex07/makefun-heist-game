// Velvet Vault — all sound is synthesized with WebAudio oscillators, so the
// game ships no audio files. Sounds start only after a user gesture (the
// browser's autoplay rule) and every call is guarded: silence is fine, a
// crash is not.
let ctx = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const ac = ensure();
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function tone(freq, seconds, type, gain, when = 0, slideTo = null) {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + seconds);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(amp).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

export const sfx = {
  pickup() { tone(880, 0.12, 'sine', 0.12); tone(1318, 0.16, 'sine', 0.1, 0.07); },
  grabTick() { tone(520, 0.06, 'square', 0.05); },
  grabDone() { tone(659, 0.14, 'sine', 0.12); tone(988, 0.2, 'sine', 0.12, 0.09); },
  emp() { tone(1400, 0.35, 'sawtooth', 0.07, 0, 180); },
  ping() { tone(1568, 0.3, 'sine', 0.1, 0, 1046); tone(1046, 0.4, 'sine', 0.08, 0.12); },
  spotted() { tone(220, 0.18, 'square', 0.09); tone(220, 0.18, 'square', 0.09, 0.2); },
  alarmTick() { tone(980, 0.07, 'square', 0.05); },
  caught() { tone(392, 0.25, 'sawtooth', 0.1, 0, 98); tone(196, 0.5, 'sawtooth', 0.1, 0.22, 65); },
  roomClear() { tone(523, 0.14, 'sine', 0.11); tone(659, 0.14, 'sine', 0.11, 0.1); tone(784, 0.28, 'sine', 0.12, 0.2); },
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'sine', 0.11, i * 0.12));
  },
  click() { tone(660, 0.05, 'sine', 0.07); },
};
