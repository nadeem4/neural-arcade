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

// Keeps the chase camera out of buildings and above the ground. Marches from the taxi (target) out towards the camera in
// quarter-cell steps; at the first building cell it stops, backs off by `margin` m, and puts the camera there on the same
// line (never closer than MIN_CAM_DIST). Buildings are solid only below maxY m, so the high swoop shot sails over them. world: { cols, rows, kind } as sim.js loadWorld; row 0 is the north edge, z = -y.
// Returns { pos, clipped }. Pure: a function of its arguments only, so record mode stays deterministic.
export function clipCamera(camPos, target, world, cellM, margin = 2, minY = 1, maxY = 40) {
  const dx = camPos[0] - target[0], dy = camPos[1] - target[1], dz = camPos[2] - target[2];
  const len = Math.hypot(dx, dy, dz);
  const solid = (x, z) => {
    const c = Math.floor(x / cellM), r = world.rows - 1 - Math.floor(-z / cellM);
    return c >= 0 && c < world.cols && r >= 0 && r < world.rows && world.kind[r * world.cols + c] === BUILDING;
  };
  let pos = [camPos[0], Math.max(minY, camPos[1]), camPos[2]], clipped = false;
  if (len > 0 && !solid(target[0], target[2])) {
    const step = cellM / 4;
    for (let t = step; t <= len + step; t += step) {
      const s = Math.min(t, len) / len;
      if (target[1] + dy * s > maxY || !solid(target[0] + dx * s, target[2] + dz * s)) continue; // above maxY the line clears the roofs (no heights here)
      const d = Math.max(MIN_CAM_DIST, Math.min(t, len) - step - margin) / len; // the wall begins somewhere in the last step
      pos = [target[0] + dx * d, Math.max(minY, target[1] + dy * d), target[2] + dz * d];
      clipped = true;
      break;
    }
  }
  return { pos, clipped };
}

// 0..1: how much of the pickup or drop-off pin to show, from how far the camera is from it on the ground. The pin is
// tower-sized; with the camera right beside it (the start of a drive, where the taxi sits on the pin) it would fill the lens.
export function pinFade(camPos, pinPos, near = 20, far = 45) {
  const d = Math.hypot(camPos[0] - pinPos[0], camPos[2] - pinPos[2]);
  return Math.min(1, Math.max(0, (d - near) / (far - near)));
}

const FIXED = {
  road: '#585A5E', walk: '#BDBEBE', park: '#5E9A4C', water: '#4F8EC0', mark: '#E6E2D6',
  ground: '#929491', building: '#FFFFFF', leaf: '#4E9A48', pin: '#FACC15',
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
