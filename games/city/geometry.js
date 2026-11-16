import { mulberry32 } from '../../engine/rng.js';

// Pure geometry for the 3D city: map metres in (x east, y north), typed arrays out (y up, north is -z).

const open = (ring) => {
  const r = ring.slice();
  const a = r[0], b = r[r.length - 1];
  if (r.length > 1 && a[0] === b[0] && a[1] === b[1]) r.pop();
  return r;
};
// Signed area in the map plane (positive = counter-clockwise).
const signedArea = (r) => r.reduce((s, p, i) => {
  const q = r[(i + 1) % r.length];
  return s + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;

// Ear clipping on a simple polygon of [x, y] points (any winding, no closing point).
// Returns triangle corner indices into the input, each triangle counter-clockwise.
export function triangulate(pts) {
  const n = pts.length;
  if (n < 3) return [];
  const idx = pts.map((_, i) => i);
  if (signedArea(pts) < 0) idx.reverse();
  const cross = (a, b, c) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
  const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  const out = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if (cross(a, b, c) <= 1e-12) continue;
      if (idx.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      out.push(a, b, c);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) idx.splice(0, 1); // degenerate sliver: drop a vertex and carry on
  }
  if (idx.length === 3 && cross(idx[0], idx[1], idx[2]) > 1e-12) out.push(idx[0], idx[1], idx[2]);
  return out;
}

// Flip any triangle whose normal points down so every face looks up (flat meshes).
const faceUp = (P, I) => {
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
    const cy = (P[b * 3 + 2] - P[a * 3 + 2]) * (P[c * 3] - P[a * 3]) - (P[b * 3] - P[a * 3]) * (P[c * 3 + 2] - P[a * 3 + 2]);
    if (cy < 0) { I[t + 1] = c; I[t + 2] = b; }
  }
};

export function buildFlats(rings, y) {
  const positions = [], indices = [];
  for (const ring of rings) {
    const r = open(ring);
    const tri = triangulate(r);
    if (!tri.length) continue;
    const base = positions.length / 3;
    for (const [x, my] of r) positions.push(x, y, -my);
    indices.push(...tri.map((i) => base + i));
  }
  const P = new Float32Array(positions), I = new Uint32Array(indices);
  faceUp(P, I);
  return { positions: P, indices: I };
}

export function buildBuildings(buildings) {
  const positions = [], normals = [], indices = [];
  for (const { ring, h } of buildings) {
    const r = open(ring);
    const tri = triangulate(r);
    if (!tri.length) continue;
    const ccw = signedArea(r) > 0; // map plane
    let base = positions.length / 3;
    for (const [x, my] of r) { positions.push(x, h, -my); normals.push(0, 1, 0); }
    indices.push(...tri.map((i) => base + i));
    for (let i = 0; i < r.length; i++) {
      const [x0, y0] = r[i], [x1, y1] = r[(i + 1) % r.length];
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      // Outward normal in the map plane: right of the edge for CCW, left for CW; then z = -y.
      const s = ccw ? 1 : -1;
      const nx = (s * dy) / len, nz = (s * dx) / len;
      base = positions.length / 3;
      positions.push(x0, 0, -y0, x1, 0, -y1, x1, h, -y1, x0, h, -y0);
      for (let k = 0; k < 4; k++) normals.push(nx, 0, nz);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const P = new Float32Array(positions), N = new Float32Array(normals), I = new Uint32Array(indices);
  // Make every triangle's winding agree with its stored normal.
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
    const u = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k]);
    const w = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k]);
    const d = (u[1] * w[2] - u[2] * w[1]) * N[a * 3] + (u[2] * w[0] - u[0] * w[2]) * N[a * 3 + 1] + (u[0] * w[1] - u[1] * w[0]) * N[a * 3 + 2];
    if (d < 0) { I[t + 1] = c; I[t + 2] = b; }
  }
  return { positions: P, normals: N, indices: I };
}

// Ribbon along a polyline, half-width hw, mitred (clamped) at the joints.
function ribbon(pts, hw, y, positions, indices) {
  const n = pts.length;
  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy);
    segN.push(l < 1e-9 ? null : [-dy / l, dx / l]);
  }
  const first = segN.find(Boolean);
  if (!first) return;
  const base = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const a = segN[Math.max(0, i - 1)] ?? first, b = segN[Math.min(n - 2, i)] ?? a;
    let mx = a[0] + b[0], my = a[1] + b[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) { mx = a[0]; my = a[1]; } else { mx /= ml; my /= ml; }
    const k = Math.min(2, 1 / Math.max(0.5, mx * a[0] + my * a[1]));
    const [x, py] = pts[i];
    positions.push(x + mx * hw * k, y, -(py + my * hw * k), x - mx * hw * k, y, -(py - my * hw * k));
  }
  for (let i = 0; i < n - 1; i++) {
    const l = base + i * 2;
    indices.push(l, l + 1, l + 2, l + 1, l + 3, l + 2);
  }
}

const finishFlat = (positions, indices) => {
  const P = new Float32Array(positions), I = new Uint32Array(indices);
  faceUp(P, I);
  return { positions: P, indices: I };
};

// Roads, and footpaths too: any {pts, w} list.
export function buildRoadStrips(roads, y = 0.05) {
  const positions = [], indices = [];
  for (const r of roads) ribbon(r.pts, r.w / 2, y, positions, indices);
  return finishFlat(positions, indices);
}

const DASH = 3, GAP = 3, MARK_W = 0.3;

// Dashed centre lines on two-way roads at least 4 m wide.
export function buildLaneMarks(roads, y = 0.08) {
  const positions = [], indices = [];
  for (const r of roads) {
    if (r.oneway || r.w < 4) continue;
    let phase = 0; // distance along the road; dash on for the first DASH of each DASH+GAP
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x0, y0] = r.pts[i], [x1, y1] = r.pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      let d = 0;
      while (d < len) {
        const p = phase % (DASH + GAP);
        const step = Math.min(len - d, p < DASH ? DASH - p : DASH + GAP - p);
        if (p < DASH) {
          const f0 = d / len, f1 = (d + step) / len;
          ribbon([[x0 + (x1 - x0) * f0, y0 + (y1 - y0) * f0], [x0 + (x1 - x0) * f1, y0 + (y1 - y0) * f1]], MARK_W / 2, y, positions, indices);
        }
        d += step; phase += step;
      }
    }
  }
  return finishFlat(positions, indices);
}

const pointInRing = (x, y, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const TREE_AREA = 120, TREE_CAP = 600;

// x, y, z triples (y = 0), about one tree per 120 m2 of park, at most 600. Same seed, same trees.
export function treePositions(parks, seed) {
  const rng = mulberry32(seed);
  const rings = parks.map(open);
  const want = rings.map((r) => Math.abs(signedArea(r)) / TREE_AREA);
  const total = want.reduce((a, b) => a + b, 0);
  const scale = total > TREE_CAP ? TREE_CAP / total : 1;
  const out = [];
  rings.forEach((r, k) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const count = Math.round(want[k] * scale);
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 50 && out.length < TREE_CAP * 3; tries++) {
      const x = x0 + rng() * (x1 - x0), y = y0 + rng() * (y1 - y0);
      if (pointInRing(x, y, r)) { out.push(x, 0, -y); placed++; }
    }
  });
  return new Float32Array(out);
}

// Centre and radius (world x, z) containing every feature, for the camera.
export function cityBounds(city) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const see = ([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, -y); z1 = Math.max(z1, -y); };
  for (const b of city.buildings ?? []) b.ring.forEach(see);
  for (const r of city.roads ?? []) r.pts.forEach(see);
  for (const r of [...(city.parks ?? []), ...(city.water ?? [])]) r.forEach(see);
  if (x0 === Infinity) return { cx: 0, cz: 0, radius: 1 };
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, radius: Math.hypot(x1 - x0, z1 - z0) / 2 };
}
