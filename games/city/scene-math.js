// Pure helpers for the 3D scene: camera clamps and the colour tokens (no DOM, no three.js).
export const MIN_PITCH = 0.2;
export const MAX_PITCH = 1.45; // just short of straight down

export const clampPitch = (p) => Math.min(MAX_PITCH, Math.max(MIN_PITCH, p));
// Camera distance from the city centre, between 0.4 and 3 city radii.
export const clampDistance = (d, radius) => Math.min(radius * 3, Math.max(radius * 0.4, d));

const FIXED = {
  road: '#4B5565', walk: '#6B7689', park: '#2E5E3E', water: '#2F5E8A', mark: '#C9D1DB',
  ground: '#1C222B', building: '#5A6578', leaf: '#3E8A55', pin: '#FACC15',
};
// Sky and accent follow the studio.css tokens; the map colours are the mockup's.
export function readColors(style) {
  const get = (k, fallback) => style.getPropertyValue(k).trim() || fallback;
  return { ...FIXED, sky: get('--stage', '#0F1319'), accent: get('--signal', '#FF5A1F') };
}
