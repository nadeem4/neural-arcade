// The taxi as plain data, in metres, centred on its footprint; forward is +z, up is +y. Pure, no three.js.
// scene-taxi.js turns each part into a mesh. Every part has size [w, h, l] and pos [x, y, z] (its bounding box centre).
// kind 'box' (default) is a block, 'extrude' a side profile [[z, y], ...] pushed across the width with a rounded edge,
// 'wheel' a cylinder lying across the car.
export const TAXI_YELLOW = '#F5B820';
export const WHEEL_RADIUS = 0.34;
export const WHEELBASE = 2.6; // front axle to rear axle
const MAX_STEER = 0.6; // radians, about 34 degrees

// Side silhouette of the lower body, nose at +z: a flat floor, rounded nose and tail, a low bonnet and boot.
const BODY = [[-2.1, 0.5], [-2.05, 0.35], [-1.85, 0.3], [1.85, 0.3], [2.05, 0.35], [2.1, 0.5], [2.08, 0.72], [1.9, 0.86], [1.1, 0.92], [0.8, 0.94], [-1.5, 0.94], [-1.95, 0.86], [-2.08, 0.72]];
// The glass cabin: a raked windscreen at the front, a shorter rear window.
const CABIN = [[-1.25, 0.94], [-0.95, 1.4], [0.55, 1.4], [1.0, 0.94]];

// The wheel spin (radians) after the car has driven `distance` metres.
export const wheelAngle = (distance) => distance / WHEEL_RADIUS;
// The front wheel turn (radians) for a path curvature (1/m, positive when the heading increases). Bicycle model, capped.
export function steerAngle(curvature) {
  if (!Number.isFinite(curvature) || curvature === 0) return 0;
  return Math.max(-MAX_STEER, Math.min(MAX_STEER, Math.atan(WHEELBASE * curvature)));
}

export function taxiParts() {
  const wheel = (x, z, front) => ({ kind: 'wheel', front, size: [0.3, WHEEL_RADIUS * 2, WHEEL_RADIUS * 2], pos: [x, WHEEL_RADIUS, z], colour: '#1B1F27', role: 'wheel' });
  const lamp = (role, x, z, colour) => ({ size: [0.36, 0.2, 0.12], pos: [x, 0.72, z], colour, role }); // a lamp block, standing a little proud of the body
  const arch = (x, z) => ({ size: [0.06, 0.46, 0.82], pos: [x, 0.5, z], colour: '#14171D', role: 'arch' }); // a dark patch on the body side round each wheel, so the tyre reads against it
  return [
    { kind: 'extrude', profile: BODY, size: [1.9, 0.64, 4.2], pos: [0, 0.62, 0], colour: TAXI_YELLOW, role: 'body' },
    { kind: 'extrude', profile: CABIN, size: [1.6, 0.46, 2.25], pos: [0, 1.17, -0.125], colour: '#243542', role: 'glass' },
    { size: [1.62, 0.06, 1.5], pos: [0, 1.43, -0.2], colour: '#FFD25A', role: 'cab' },
    { size: [0.6, 0.12, 0.3], pos: [0, 1.52, -0.2], colour: '#1B1F27', role: 'sign' },
    wheel(-0.9, 1.3, true), wheel(0.9, 1.3, true), wheel(-0.9, 1.3 - WHEELBASE, false), wheel(0.9, 1.3 - WHEELBASE, false),
    arch(-0.97, 1.3), arch(0.97, 1.3), arch(-0.97, 1.3 - WHEELBASE), arch(0.97, 1.3 - WHEELBASE),
    lamp('brake', -0.62, -2.12, '#6A1818'), lamp('brake', 0.62, -2.12, '#6A1818'),
    lamp('head', -0.62, 2.12, '#FFF3C4'), lamp('head', 0.62, 2.12, '#FFF3C4'),
  ];
}
