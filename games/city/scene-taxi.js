// three.js glue for the taxi and the traffic lamp: turns taxi-model.js parts into meshes, lights the brake lamps.
import * as THREE from './vendor/three.module.min.js';
import { taxiParts } from './taxi-model.js';

const BRAKE_ON = '#FF2A2A', BRAKE_OFF = '#7A1F1F';
export const TAXI_SCALE = 1.5; // metres to scene units: the 4.2 m model becomes a car about half a 12 m tile wide

// tint: { body, cab } swaps the yellow for a second car's colours.
export function createTaxiMaker(tint = null) {
  const cache = {};
  const mat = (colour, role) => (cache[colour + role] ??= role === 'brake'
    ? new THREE.MeshBasicMaterial({ color: colour })
    : new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6, emissive: role === 'body' || role === 'cab' ? colour : '#000000', emissiveIntensity: 0.3 }));
  const brakeMats = [];
  return {
    // A group at the origin; `setBraking(on)` lights both brake lamps. Geometry is the caller's to dispose.
    make() {
      const g = new THREE.Group();
      for (const m of brakeMats) m.dispose();
      brakeMats.length = 0;
      for (const p of taxiParts()) {
        const colour = tint && tint[p.role] ? tint[p.role] : p.colour;
        const m = new THREE.Mesh(new THREE.BoxGeometry(...p.size), p.role === 'brake' ? new THREE.MeshBasicMaterial({ color: BRAKE_OFF }) : mat(colour, p.role));
        m.position.set(...p.pos);
        if (p.role === 'brake') brakeMats.push(m.material);
        g.add(m);
      }
      g.scale.setScalar(TAXI_SCALE);
      return g;
    },
    setBraking(on) { for (const m of brakeMats) m.color.set(on ? BRAKE_ON : BRAKE_OFF); },
    dispose() { for (const m of [...Object.values(cache), ...brakeMats]) m.dispose(); },
  };
}
