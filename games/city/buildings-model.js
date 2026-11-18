// What a building looks like, decided from its OSM tags and nothing else (no DOM, no three.js, no random calls).
// Same building, same look, every run. Tagged building:material and building:colour win; otherwise a seeded pick weighted by height
// (tall towers lean glass and steel, low ones brick and stone). geometry.js turns a spec into vertices; facade.js paints the windows.
import { mulberry32 } from '../../engine/rng.js';

export const FLOOR_H = 3.5; // metres per floor when the map does not say
export const KINDS = ['glass', 'steel', 'concrete', 'stone', 'brick'];

// Facade character per kind: bay = window repeat along the wall (m), fill = how much of each bay is glass.
const LOOK = {
  glass: { bay: 2.2, fill: 0.85 },
  steel: { bay: 2.6, fill: 0.7 },
  concrete: { bay: 3.0, fill: 0.5 },
  stone: { bay: 3.4, fill: 0.42 },
  brick: { bay: 3.2, fill: 0.38 },
};
// A restrained palette per kind: blue-grey glass, dark steel, concrete, limestone, brick.
const PALETTE = {
  glass: ['#7f96a6', '#6f8799', '#8ca1ae', '#5f7a8c'],
  steel: ['#565c64', '#5f656d', '#4c525a'],
  concrete: ['#a9a9a4', '#9a9c9b', '#b4b2aa'],
  stone: ['#c2b9a3', '#b8ae98', '#ccc3ae'],
  brick: ['#8e5b4c', '#7c4f44', '#9a6a55', '#6e4a42'],
};
// Pick weights [glass, steel, concrete, stone, brick] for tall (80 m and up), middle and low buildings.
const WEIGHTS = { tall: [0.55, 0.25, 0.15, 0.05, 0], mid: [0.3, 0.15, 0.3, 0.15, 0.1], low: [0.05, 0.05, 0.25, 0.25, 0.4] };
const MATERIAL = {
  glass: 'glass', metal: 'steel', steel: 'steel', brick: 'brick', stone: 'stone', limestone: 'stone', sandstone: 'stone',
  concrete: 'concrete', cement_block: 'concrete', plaster: 'concrete', stucco: 'concrete', reinforced_concrete: 'concrete',
};
const NAMED = {
  white: '#E8E8E4', lightgrey: '#C4C4C2', lightgray: '#C4C4C2', grey: '#8A8A88', gray: '#8A8A88', darkgrey: '#4A4A4A', black: '#2E2E2E',
  tan: '#C8B89A', beige: '#CFC4AA', brown: '#7A5A48', red: '#9A4A40', yellow: '#CFC090', orange: '#B8805A', blue: '#6F8799', cream: '#D8D0B8',
};

const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

// An OSM colour tag as a muted hex (mostly its own grey), or null if it is not one we know.
export function osmColour(tag) {
  if (typeof tag !== 'string') return null;
  const t = tag.trim().toLowerCase();
  const h = /^#[0-9a-f]{6}$/.test(t) ? t : NAMED[t];
  if (!h) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const grey = 0.3 * r + 0.59 * g + 0.11 * b;
  return toHex(r * 0.3 + grey * 0.7, g * 0.3 + grey * 0.7, b * 0.3 + grey * 0.7);
}

const openRing = (ring) => {
  const a = ring[0], b = ring[ring.length - 1];
  return ring.length > 1 && a[0] === b[0] && a[1] === b[1] ? ring.slice(0, -1) : ring;
};
const areaOf = (r) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const seedOf = (b, id) => {
  const [x, y] = b.ring[0];
  return (Math.imul(id + 1, 2654435761) ^ Math.imul(Math.round(x * 13), 40503) ^ Math.imul(Math.round(y * 7), 9973)) >>> 0;
};
const heightOf = (b) => b.h ?? 12;
const minHOf = (b) => b.minH ?? 0;

// Outlines that have separate parts are not drawn (their parts are); everything else is. Each entry keeps its index in the input as `id`.
export function drawnBuildings(buildings) {
  const out = [];
  buildings.forEach((b, id) => { if (!(b.hasParts && !b.part)) out.push({ b, id }); });
  return out;
}

export function buildingSpec(b, id) {
  const rng = mulberry32(seedOf(b, id));
  const h = heightOf(b), minH = minHOf(b), span = Math.max(1, h - minH);
  const cls = h >= 80 ? 'tall' : h >= 30 ? 'mid' : 'low';
  let kind = MATERIAL[String(b.material ?? '').toLowerCase()];
  const roll = rng(); // always drawn, so a tag changes the kind without shifting the colour pick
  if (!kind) {
    let acc = 0;
    kind = KINDS[KINDS.length - 1];
    for (let i = 0; i < KINDS.length; i++) { acc += WEIGHTS[cls][i]; if (roll < acc) { kind = KINDS[i]; break; } }
  }
  const pal = PALETTE[kind];
  const colour = osmColour(b.colour) ?? pal[Math.floor(rng() * pal.length)];
  const levels = b.levels > 0 ? b.levels : null;
  const floors = levels ?? Math.max(1, Math.round(span / FLOOR_H));
  const floorH = Math.min(4.5, Math.max(3, span / floors)); // 3.5 m when untagged, as tagged otherwise
  const shopH = minH > 0 || floors < 2 ? 0 : floorH; // the ground-floor band is one floor tall
  return { kind, colour, floors, floorH, shopH, bay: LOOK[kind].bay, fill: LOOK[kind].fill, seed: rng() };
}

const insideRing = (x, y, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// Rooftop clutter for big flat roofs: a few boxes (lift houses, air handlers) lined up with the longest wall. Each is { corners: 4 [x, y], h }.
export function roofBoxes(b, id) {
  const ring = openRing(b.ring);
  const area = areaOf(ring);
  if ((b.roof ?? 'flat') !== 'flat' || area < 300 || ring.length < 3) return [];
  const rng = mulberry32(seedOf(b, id) ^ 0x9e3779b1);
  let best = 0, ang = 0;
  ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > best) { best = l; ang = Math.atan2(q[1] - p[1], q[0] - p[0]); } });
  const ca = Math.cos(ang), sa = Math.sin(ang);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const want = area > 1500 ? 3 : area > 600 ? 2 : 1;
  const tall = heightOf(b) >= 100;
  const out = [], centres = [];
  const corners = (cx, cy, w, d) => [[-w, -d], [w, -d], [w, d], [-w, d]].map(([u, v]) => [cx + u * ca - v * sa, cy + u * sa + v * ca]);
  for (let t = 0; t < 40 && out.length < want; t++) {
    const cx = x0 + rng() * (x1 - x0), cy = y0 + rng() * (y1 - y0);
    const w = 1.5 + rng() * 2.5, d = 1.5 + rng() * 2, h = 2 + rng() * (tall ? 3.5 : 1.5);
    if (centres.some(([px, py]) => Math.hypot(px - cx, py - cy) < 9)) continue;
    if (!corners(cx, cy, w + 1.5, d + 1.5).every(([x, y]) => insideRing(x, y, ring))) continue; // a metre and a half clear of the parapet
    centres.push([cx, cy]);
    out.push({ corners: corners(cx, cy, w, d), h });
  }
  return out;
}

// sRGB hex to the linear floats three.js expects in a vertex colour.
export function linearRgb(hex) {
  return [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
}
