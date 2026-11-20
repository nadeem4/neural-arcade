// three.js glue for the taxi: turns taxi-model.js parts into meshes (a rounded body, a glass cabin, wheels that spin and the
// front pair steer, head and brake lamps, a soft contact shadow) and lights the brake lamps. Primitives only, no model file.
import * as THREE from '../../assets/vendor/three/three.module.min.js';
import { taxiParts, wheelAngle, steerAngle } from './taxi-model.js';
import { ENV_INTENSITY } from './scene-look.js';
import { ROAD_Y, MARK_Y } from './scene-math.js';
import { createGlow, brakeGlow } from './glow.js';

const BRAKE_ON = '#FF4A3A', BRAKE_OFF = '#6A1818'; // a dim dark red at rest, a bright hot red when braking
export const TAXI_SCALE = 1.5; // metres to scene units: the 4.2 m model becomes a car about half a 12 m tile wide
export const TAXI_Y = ROAD_Y;  // the tyres rest on the road surface
export const SHADOW_Y = MARK_Y + 0.1; // the shadow's height in the scene: just above the lane marks, so neither hides it

// A side profile [[z, y], ...] pushed across `width`, with a rounded edge. Shape x is the car's z, so it is turned to face +z.
function extrudeGeometry(profile, width) {
  const bevel = 0.1;
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 1 });
  g.translate(0, 0, -(width - 2 * bevel) / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

// A soft dark oval under the car: a radial gradient on a flat plane, so the car sits on the road instead of hovering.
function shadowMaterial() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), grad = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false });
}
function contactShadow(material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 5.6), material);
  m.rotation.x = -Math.PI / 2; m.position.y = (SHADOW_Y - TAXI_Y) / TAXI_SCALE; m.renderOrder = 2; m.userData.flat = true; // flat: casts no shadow itself
  return m;
}

// tint: { body, cab } swaps the yellow for a second car's colours.
export function createTaxiMaker(tint = null, { glow = false } = {}) {
  const cache = {};
  const std = (colour, role, extra = {}) => (cache[colour + role] ??= new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6, emissive: role === 'body' || role === 'cab' ? colour : '#000000', emissiveIntensity: 0.3, envMapIntensity: ENV_INTENSITY, ...extra }));
  const lampMat = (colour) => (cache[colour + 'lamp'] ??= new THREE.MeshBasicMaterial({ color: colour, toneMapped: false }));
  const brakeMats = [];
  let brakeDots = null, braking = null; // bloom (high tier): a red dot over each brake lamp of the last car made, lit while braking
  let wheels = []; // { steer: Group | null, spin: Group } for the last car made
  return {
    // A group at the origin; `setBraking(on)` lights both brake lamps, `setPose(distance, curvature)` spins the wheels and
    // steers the front pair. Geometry is the caller's to dispose.
    make() {
      const g = new THREE.Group();
      for (const m of brakeMats) m.dispose();
      brakeMats.length = 0; wheels = [];
      for (const p of taxiParts()) {
        const colour = tint && tint[p.role] ? tint[p.role] : p.colour;
        if (p.kind === 'wheel') {
          const steer = new THREE.Group(), spin = new THREE.Group();
          steer.position.set(...p.pos);
          const R = p.size[1] / 2;
          const tyre = new THREE.Mesh(new THREE.CylinderGeometry(R, R, p.size[0], 18).rotateZ(Math.PI / 2), std(colour, 'wheel', { roughness: 0.9 }));
          const hub = new THREE.Mesh(new THREE.BoxGeometry(p.size[0] + 0.02, R * 1.1, 0.1), std('#C9CDD3', 'hub', { roughness: 0.4, metalness: 0.5 })); // a bar across the wheel, so the spin shows
          spin.add(tyre, hub); steer.add(spin); g.add(steer);
          wheels.push({ steer: p.front ? steer : null, spin });
          continue;
        }
        let geo;
        if (p.kind === 'extrude') geo = extrudeGeometry(p.profile, p.size[0]);
        else geo = new THREE.BoxGeometry(...p.size);
        let m;
        if (p.role === 'brake') { m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: BRAKE_OFF, toneMapped: false })); brakeMats.push(m.material); }
        else if (p.role === 'head') m = new THREE.Mesh(geo, lampMat(colour));
        else if (p.role === 'glass') m = new THREE.Mesh(geo, std(colour, 'glass', { roughness: 0.15, metalness: 0.6, emissiveIntensity: 0.1 }));
        else m = new THREE.Mesh(geo, std(colour, p.role));
        if (p.kind !== 'extrude') m.position.set(...p.pos); // a profile is already placed in car coordinates
        g.add(m);
      }
      if (glow) {
        const lamps = taxiParts().filter((p) => p.role === 'brake');
        brakeDots?.dispose();
        brakeDots = createGlow(lamps.map((p) => ({ x: p.pos[0], y: p.pos[1], z: p.pos[2], r: 0, g: 0, b: 0 })), { size: 2.2 });
        g.add(brakeDots.points); braking = null;
      }
      g.add(contactShadow((cache.shadow ??= shadowMaterial()))); // one texture and material for every car this maker makes
      g.scale.setScalar(TAXI_SCALE);
      return g;
    },
    setBraking(on) {
      for (const m of brakeMats) m.color.set(on ? BRAKE_ON : BRAKE_OFF);
      if (brakeDots && braking !== on) { braking = on; const k = brakeGlow(on); for (let i = 0; i < brakeDots.colours.length / 3; i++) brakeDots.setColour(i, k, k * 0.25, k * 0.2); }
    },
    setPose(distance, curvature) {
      const spin = wheelAngle(distance ?? 0), steer = steerAngle(curvature ?? 0);
      for (const w of wheels) { w.spin.rotation.x = spin; if (w.steer) w.steer.rotation.y = steer; }
    },
    dispose() { brakeDots?.dispose(); for (const m of [...Object.values(cache), ...brakeMats]) { m.map?.dispose(); m.dispose(); } },
  };
}
