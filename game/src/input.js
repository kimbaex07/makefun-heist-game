// Velvet Vault — keyboard and mouse input. The game reads a plain state object
// every frame ({ up, down, left, right, sneak, grab, emp, noise, confirm,
// pause, retry, click }) so the world logic never touches the DOM directly.
// Edge-triggered actions (emp, noise, confirm, pause, retry, grab) are consumed
// by the caller through take(), so one keypress never fires twice.
import { KEYS } from './config.js';

function matches(list, code) {
  return list.indexOf(code) !== -1;
}

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let click = null;

  const state = {
    up: false, down: false, left: false, right: false, sneak: false,
    grab: false, emp: false, noise: false, confirm: false,
    pause: false, retry: false, click: null,
  };

  function onKeyDown(event) {
    if (matches(KEYS.up, event.code) || matches(KEYS.down, event.code) ||
        matches(KEYS.left, event.code) || matches(KEYS.right, event.code) ||
        matches(KEYS.confirm, event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    click = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onBlur() {
    held.clear();
    pressed.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);

  // Refresh the held-key view and report edge-triggered presses since last call.
  function poll() {
    state.up = KEYS.up.some((c) => held.has(c));
    state.down = KEYS.down.some((c) => held.has(c));
    state.left = KEYS.left.some((c) => held.has(c));
    state.right = KEYS.right.some((c) => held.has(c));
    state.sneak = KEYS.sneak.some((c) => held.has(c));
    state.grab = KEYS.grab.some((c) => held.has(c));
    state.emp = take(KEYS.emp);
    state.noise = take(KEYS.noise);
    state.confirm = take(KEYS.confirm);
    state.pause = take(KEYS.pause);
    state.retry = take(KEYS.retry);
    state.click = click;
    click = null;
    return state;
  }

  function take(list) {
    for (const code of list) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
    }
    return false;
  }

  return { poll };
}
