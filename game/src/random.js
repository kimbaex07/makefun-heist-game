// Velvet Vault — a tiny seeded RNG (mulberry32) so a ?seed=N run always plays
// the same patrols and loot, which is what makes the staged screenshots stable.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandom(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
