// Sky, fog, window pattern and heat fade for the 3D scene. Pure, no DOM, no three.js.
import { SWOOP_MS, PULLBACK_MS } from './director.js';

// Dusk (dark theme) is the mockup's blue to warm glow; the light theme is a plain daytime version.
export function skyColours(isDark) {
  return isDark ? { top: '#3D5A80', bottom: '#E9A86B' } : { top: '#8EC5F0', bottom: '#F6E7C8' };
}

// Distance fog, as multiples of the city radius: wide on the map (k = 0), close in the chase (k = 1, closer on a phone),
// blended in between so the swoop and pullback never fog the whole city out.
export function fogFor(k, radius, phone) {
  const cFar = radius * (phone ? 0.4 : 0.6);
  const near = radius * 2.5 + (cFar * 0.25 - radius * 2.5) * k, far = radius * 6 + (cFar - radius * 6) * k;
  return { near, far };
}

// A small seeded random generator (mulberry32) from a string key.
function rng(key) {
  let h = 1779033703;
  for (const ch of String(key)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// rows of booleans (h rows, w columns): true is a lit window. Deterministic per key; 30% to 40% lit.
export function windowPattern(seedKey, w, h) {
  const rand = rng(seedKey), n = w * h;
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const lit = Math.round(n * (0.3 + 0.1 * rand()));
  const grid = Array.from({ length: h }, () => new Array(w).fill(false));
  for (const i of order.slice(0, lit)) grid[Math.floor(i / w)][i % w] = true;
  return grid;
}

// The heat overlay: full on the map, fading out through the swoop, gone in the chase, back through the pullback.
export function heatOpacity(phase, t) {
  const p = (ms) => Math.min(1, Math.max(0, t / ms));
  if (phase === 'swoop') return 1 - p(SWOOP_MS);
  if (phase === 'pullback') return p(PULLBACK_MS);
  return phase === 'chase' ? 0 : 1;
}
