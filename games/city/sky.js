// Sky, fog, window pattern and heat fade for the 3D scene. Pure, no DOM, no three.js.
import { SWOOP_MS, PULLBACK_MS } from './director.js';

// One time of day for map and chase, whatever the page theme: late afternoon. Colours are named here so they are easy to tune.
const SUN_AZIMUTH = 0.0, SUN_ELEVATION = 0.38; // radians: elevation about 22 degrees, a low warm sun
export function skyColours() {
  return { top: '#3E78C2', mid: '#8DB9EA', bottom: '#C9D8E8', haze: '#C9D8E8', sun: '#FFE9CF', sunGlow: '#FFE6C4', hemiSky: '#D9DEE4', hemiGround: '#8A8A88' };
}

// The direction towards the sun, a unit vector [x, y, z].
export function sunDirection() {
  const c = Math.cos(SUN_ELEVATION);
  return [Math.cos(SUN_AZIMUTH) * c, Math.sin(SUN_ELEVATION), Math.sin(SUN_AZIMUTH) * c];
}

// Where a direction lands on a three.js sphere's equirectangular texture: u across, v down from the zenith (0) to the nadir (1).
export function sunUv([x, y, z]) {
  const phi = Math.atan2(z, -x);
  return { u: ((phi / (2 * Math.PI)) % 1 + 1) % 1, v: Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI };
}

// The sun's placement for the shadow camera: the same direction on the map and in the chase; the shadow box covers the whole city
// on the map and a patch around the taxi (x, z) in the chase.
export function sunPlacement({ chase, radius, cx, cz, x = cx, z = cz }) {
  const d = sunDirection(), dist = chase ? 300 : radius * 1.8;
  const half = chase ? 160 : radius;
  return { position: [x + d[0] * dist, d[1] * dist, z + d[2] * dist], target: [x, 0, z], half, far: chase ? 700 : radius * 4 };
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

// A few cloud sprites: unit directions above the horizon and a size each, from a fixed seed so every run is the same.
export function cloudLayout(count) {
  const rand = rng('reward-city-clouds');
  return Array.from({ length: count }, () => {
    const az = rand() * 2 * Math.PI, el = 0.2 + rand() * 0.5, c = Math.cos(el);
    return { dir: [Math.cos(az) * c, Math.sin(el), Math.sin(az) * c], size: 0.18 + rand() * 0.14 };
  });
}

// The heat overlay: full on the map, fading out through the swoop, gone in the chase, back through the pullback.
export function heatOpacity(phase, t) {
  const p = (ms) => Math.min(1, Math.max(0, t / ms));
  if (phase === 'swoop') return 1 - p(SWOOP_MS);
  if (phase === 'pullback') return p(PULLBACK_MS);
  return phase === 'chase' ? 0 : 1;
}
