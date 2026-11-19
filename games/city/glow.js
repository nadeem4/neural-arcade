// A cheap bloom: a soft additive dot over each lit lamp (street lamp heads, lit signal lamps, the taxi's brake lamps), drawn as THREE.Points.
// It replaces a post-processing chain; it only runs on the high quality tier (quality.js bloom) and is the same in record mode.
// Nothing here reads a clock: a dot's strength is a pure function of the lamp's state (which the caller derives from ms).
import * as THREE from './vendor/three.module.min.js';

export const SIGNAL_GLOW = 0.8, LAMP_GLOW = 0.5, BRAKE_GLOW = 0.9; // linear strength of each kind of dot
export const LIT = 0.5; // a signal lamp whose brightest channel is above this is on (signal-heads.js COLOURS: on >= 0.76, off <= 0.3)

// The middle of each lamp quad of signal-heads.js buildSignalHeads: [{ x, y, z }] in the order of lamps.list.
export function lampCentres(lamps) {
  const p = lamps.positions;
  return lamps.list.map(({ first }) => {
    let x = 0, y = 0, z = 0;
    for (let v = 0; v < 4; v++) { x += p[(first + v) * 3]; y += p[(first + v) * 3 + 1]; z += p[(first + v) * 3 + 2]; }
    return { x: x / 4, y: y / 4, z: z / 4 };
  });
}

// Fills `out` (3 floats per lamp) with each lamp's glow colour: its own colour when lit, black when off or in `hidden` (a Set of lamp indices). Call after paintLamps.
export function signalGlow(lamps, out = new Float32Array(lamps.list.length * 3), hidden = null) {
  lamps.list.forEach(({ first }, i) => {
    const c = lamps.colors, r = c[first * 3], g = c[first * 3 + 1], b = c[first * 3 + 2], lit = Math.max(r, g, b) > LIT && !(hidden && hidden.has(i));
    out[i * 3] = lit ? r * SIGNAL_GLOW : 0; out[i * 3 + 1] = lit ? g * SIGNAL_GLOW : 0; out[i * 3 + 2] = lit ? b * SIGNAL_GLOW : 0;
  });
  return out;
}

export const brakeGlow = (on) => (on ? BRAKE_GLOW : 0);

let dot = null;
function dotTexture() {
  if (dot || typeof document === 'undefined') return dot;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (dot = new THREE.CanvasTexture(c));
}

// items: [{ x, y, z, r, g, b }] (colour is the dot's strength, black is invisible); size is the dot's width in scene units.
// Returns { points, move(i, x, y, z), setColour(i, r, g, b), dispose }. Positions and colours are in the geometry, so callers update them in place.
export function createGlow(items, { size = 4 } = {}) {
  const pos = new Float32Array(items.length * 3), col = new Float32Array(items.length * 3);
  items.forEach((it, i) => { pos.set([it.x, it.y, it.z], i * 3); col.set([it.r, it.g, it.b], i * 3); });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: dotTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.renderOrder = 3;
  return {
    points,
    colours: col,
    move(i, x, y, z) { pos.set([x, y, z], i * 3); geo.attributes.position.needsUpdate = true; },
    setColour(i, r, g, b) { col.set([r, g, b], i * 3); geo.attributes.color.needsUpdate = true; },
    refresh() { geo.attributes.color.needsUpdate = true; },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
