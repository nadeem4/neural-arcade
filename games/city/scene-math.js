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

const FIXED = {
  road: '#3A3D42', walk: '#A9A9A4', park: '#5E9A4C', water: '#4F8EC0', mark: '#EDEDE8', centre: '#E6B422',
  ground: '#9B9C98', building: '#FFFFFF', leaf: '#4E9A48', pin: '#FACC15',
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
