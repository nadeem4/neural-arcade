// The taxi as plain box parts, in metres, centred on its footprint; forward is +z, up is +y. Pure, no three.js.
export const TAXI_YELLOW = '#F5B820';

// Each part: { size: [w, h, l], pos: [x, y, z] (its centre), colour, role }. scene.js turns these into meshes.
export function taxiParts() {
  const wheel = (x, z) => ({ size: [0.2, 0.6, 0.6], pos: [x, 0.3, z], colour: '#1B1F27', role: 'wheel' });
  const brake = (x) => ({ size: [0.4, 0.2, 0.08], pos: [x, 0.65, -2.06], colour: '#7A1F1F', role: 'brake' });
  return [
    { size: [1.9, 0.55, 4.2], pos: [0, 0.55, 0], colour: TAXI_YELLOW, role: 'body' },
    { size: [1.6, 0.45, 2.0], pos: [0, 1.05, -0.2], colour: '#FFD25A', role: 'cab' },
    { size: [0.6, 0.12, 0.3], pos: [0, 1.34, -0.2], colour: '#1B1F27', role: 'sign' },
    wheel(-0.85, 1.3), wheel(0.85, 1.3), wheel(-0.85, -1.3), wheel(0.85, -1.3),
    brake(-0.6), brake(0.6),
  ];
}
