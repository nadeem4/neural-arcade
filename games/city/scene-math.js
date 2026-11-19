// Pure helpers for the 3D scene: camera clamps and the colour tokens (no DOM, no three.js).
export const MIN_PITCH = 0.2;
export const MAX_PITCH = 1.45; // just short of straight down

export const clampPitch = (p) => Math.min(MAX_PITCH, Math.max(MIN_PITCH, p));
// Camera distance from the city centre, between 0.4 and 3 city radii.
const MAX_DIST = 3, DOME = 6;
export const clampDistance = (d, radius) => Math.min(radius * MAX_DIST, Math.max(radius * 0.4, d));
// The sky dome is centred on the city; the far plane must reach its far side from the farthest orbit camera.
export const domeRadius = (radius) => radius * DOME;
export const cameraFar = (radius) => (radius * MAX_DIST + domeRadius(radius)) * 1.1;

export const CHASE = { back: 18, up: 8, ahead: 14 }; // behind and above the taxi, looking down the street ahead of it
export const MIN_CAM_DIST = 4; // the clipped camera never comes closer to the taxi than this; a taxi on a road tile is at least half a tile from any building
const BUILDING = 3; // sim.js kind code for a building cell

export const ROAD_Y = 0.8;          // the road surface height; the taxi's tyres, its shadow, the pins and the camera floor are all measured from it
export const MARK_Y = ROAD_Y + 0.2; // the lane marks, just above the road
const DEFAULT_H = 12;       // a building with no height in the map (buildings-model.js uses the same)

// The tallest building over each grid cell's centre, in metres (0 where there is none): a Float32Array cols*rows, row 0 north.
// Pure; city is the chicago.json shape ({ cols, rows, cellM, buildings: [{ ring: [[x, y]], h }] }, y = -z).
export function cellHeights(city) {
  const { cols, rows, cellM } = city, out = new Float32Array(cols * rows);
  for (const b of city.buildings ?? []) {
    const ring = b.ring, h = b.h ?? DEFAULT_H;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let r = Math.max(0, rows - 1 - Math.floor(y1 / cellM)); r <= Math.min(rows - 1, rows - 1 - Math.floor(y0 / cellM)); r++) {
      for (let c = Math.max(0, Math.floor(x0 / cellM)); c <= Math.min(cols - 1, Math.floor(x1 / cellM)); c++) {
        const px = (c + 0.5) * cellM, py = (rows - 1 - r + 0.5) * cellM;
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i], [xj, yj] = ring[j];
          if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside && h > out[r * cols + c]) out[r * cols + c] = h;
      }
    }
  }
  return out;
}

// Keeps the camera out of buildings and above the ground. Marches from the taxi (target) out towards the camera in
// quarter-cell steps; at the first building the line passes through (below that cell's height) it stops, backs off by
// `margin` m, and puts the camera there on the same line (never closer than MIN_CAM_DIST). world: { cols, rows, kind,
// height } as sim.js loadWorld plus cellHeights (without it every building is DEFAULT_TALL m). Row 0 is the north edge, z = -y.
// Returns { pos, clipped, k }. Pure: a function of its arguments only, so record mode stays deterministic.
const DEFAULT_TALL = 40;
const ROOF_CLEAR = 6; // metres a camera must stay above a roof it passes over
export function clipCamera(camPos, target, world, cellM, margin = 2, minY = 1) {
  const dx = camPos[0] - target[0], dy = camPos[1] - target[1], dz = camPos[2] - target[2];
  const len = Math.hypot(dx, dy, dz);
  const roof = (x, z) => { // the height of the building at (x, z), or 0
    const c = Math.floor(x / cellM), r = world.rows - 1 - Math.floor(-z / cellM);
    if (c < 0 || c >= world.cols || r < 0 || r >= world.rows || world.kind[r * world.cols + c] !== BUILDING) return 0;
    return (world.height ? world.height[r * world.cols + c] || DEFAULT_H : DEFAULT_TALL) + ROOF_CLEAR; // a camera skimming a roof just above it is clipped too
  };
  let pos = [camPos[0], Math.max(minY, camPos[1]), camPos[2]], clipped = false, k = 1;
  if (len > 0 && !roof(target[0], target[2])) {
    const step = cellM / 4;
    for (let t = step; t <= len + step; t += step) {
      const s = Math.min(t, len) / len;
      if (target[1] + dy * s >= roof(target[0] + dx * s, target[2] + dz * s)) continue; // open air, or clear above the roof
      let lo = Math.max(0, t - step), hi = Math.min(t, len); // the wall begins somewhere in the last step: find where
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2, m = mid / len;
        if (target[1] + dy * m >= roof(target[0] + dx * m, target[2] + dz * m)) lo = mid; else hi = mid;
      }
      const d = Math.max(MIN_CAM_DIST, lo - margin) / len;
      pos = [target[0] + dx * d, Math.max(minY, target[1] + dy * d), target[2] + dz * d];
      clipped = true; k = d;
      break;
    }
  }
  return { pos, clipped, k }; // k: the fraction of the way from the taxi to the camera that was kept
}

// clipCamera with the pull-in eased over time, so the camera slides in before a wall and out after it instead of popping.
// Samples the trip every 50 ms over ms - span .. ms + span; a clip at a sample counts less the further that sample is
// from ms (linearly, to nothing at span), and the camera takes the strongest pull. at(ms) -> { pos, target }. Pure in ms.
export function clipEased(at, ms, world, cellM, { margin = 2, minY = 1, span = 500 } = {}) {
  const now = at(ms), step = 50;
  let k = 1;
  for (let o = -span; o <= span; o += step) {
    const c = at(Math.max(0, ms + o));
    const out = clipCamera(c.pos, c.target, world, cellM, margin, minY);
    if (out.clipped) k = Math.min(k, 1 - (1 - out.k) * (1 - Math.abs(o) / span));
  }
  const t = now.target;
  return { pos: [t[0] + (now.pos[0] - t[0]) * k, Math.max(minY, t[1] + (now.pos[1] - t[1]) * k), t[2] + (now.pos[2] - t[2]) * k], clipped: k < 1 };
}

// 0..1: how much of the pickup or drop-off pin to show, from how far the camera is from it on the ground. The pin is
// tower-sized; with the camera right beside it (the start of a drive, where the taxi sits on the pin) it would fill the lens.
export function pinFade(camPos, pinPos, near = 20, far = 45) {
  const d = Math.hypot(camPos[0] - pinPos[0], camPos[2] - pinPos[2]);
  return Math.min(1, Math.max(0, (d - near) / (far - near)));
}

// Pixels to slide the picture up when a phone bottom sheet covers `sheetPx` of a `viewH` tall stage: half the sheet puts the
// map centre (and so the drop-off pin) in the middle of the part still visible. At most 40% of the height.
export const insetOffset = (viewH, sheetPx) => Math.min(Math.max(0, sheetPx), viewH * 0.4) / 2;

// One heat cell: the four corners (x y z each) of a square at height y, pulled in by HEAT_INSET on every side. Neighbouring cells then never share
// an edge, so no pixel is covered twice by the additive blend and two renders of one frame match exactly (multisampling can disagree on a shared edge).
export const HEAT_INSET = 0.15;
export function heatQuad(x, z, half, y = 1.2) {
  const h = half - HEAT_INSET;
  return [x - h, y, z - h, x + h, y, z - h, x + h, y, z + h, x - h, y, z + h];
}

const FIXED = {
  road: '#3A3D42', walk: '#A9A9A4', park: '#5E9A4C', water: '#4F8EC0', mark: '#EDEDE8', centre: '#E6B422',
  ground: '#9B9C98', farGround: '#68705F', building: '#FFFFFF', leaf: '#4E9A48', pin: '#FACC15',
};
// Sky and accent follow the studio.css tokens; the map colours are the mockup's.
export function readColors(style) {
  const get = (k, fallback) => style.getPropertyValue(k).trim() || fallback;
  return { ...FIXED, sky: get('--stage', '#0F1319'), accent: get('--signal', '#FF5A1F') };
}

// Which trees (flat xyz triples) to hide in the chase view: any within `near` m of the camera, or within `lineR` m of the
// sight line from the camera to the taxi. Points are [x, z]. Returns tree indices.
export function treesToHide(pos, cam, taxi, near = 15, lineR = 6) {
  const out = [];
  const dx = taxi[0] - cam[0], dz = taxi[1] - cam[1], len2 = dx * dx + dz * dz || 1;
  for (let i = 0; i < pos.length / 3; i++) {
    const px = pos[i * 3] - cam[0], pz = pos[i * 3 + 2] - cam[1];
    const t = Math.max(0, Math.min(1, (px * dx + pz * dz) / len2)); // 0..1 along camera to taxi, clamped to the segment
    if (Math.hypot(px, pz) < near || Math.hypot(px - dx * t, pz - dz * t) < lineR) out.push(i);
  }
  return out;
}
