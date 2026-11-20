// The in-world highlight of each recent offence, drawn from what highlights.js says is active. Three.js, thin: no decisions here.
// A pool of flat meshes is made once; update() only moves, turns, scales and fades them.
//   off   -> the tile flashes (a one-cell quad)    red   -> a red ring pulses on the road    wrong -> a red arrow on the road, pointing the legal way
import * as THREE from '../../assets/vendor/three/three.module.min.js';
import { arrowPolys } from './street-model.js';
import { ROAD_Y } from './scene-math.js';
import { highlightLook } from './highlights.js';

const Y = ROAD_Y + 0.35;  // just above the raised footpaths (ROAD_Y + 0.3), low enough that cars and people stand through it
const PER_TYPE = 4;       // the most highlights of one kind on screen at once
const ARROW_SCALE = 4;    // the road arrow is about 12 m long and 6 m wide
const ARROW_OFFSET = -7;  // metres along the arrow's heading, overhead only: the arrow's head sits at its origin and its body runs behind
const COLOURS = { off: 0xffa030, red: 0xff2a20, wrong: 0xff2a20 };

// The arrow of street-model.js at the origin, pointing +z (the mesh's forward before it is turned by heading).
function arrowGeometry() {
  const pos = [], idx = [];
  for (const poly of arrowPolys(0, 0, 0, -1)) {
    const base = pos.length / 3;
    for (const [px, py] of poly) pos.push(px, 0, -py);
    for (let k = 1; k < poly.length - 1; k++) idx.push(base, base + k, base + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function createHighlights(scene, cellM) {
  const geos = {
    off: new THREE.PlaneGeometry(cellM, cellM).rotateX(-Math.PI / 2),
    red: new THREE.RingGeometry(cellM * 0.32, cellM * 0.5, 40).rotateX(-Math.PI / 2),
    wrong: arrowGeometry(),
  };
  const pool = {}, mats = [];
  for (const type of Object.keys(geos)) {
    pool[type] = Array.from({ length: PER_TYPE }, () => {
      const mat = new THREE.MeshBasicMaterial({ color: COLOURS[type], transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false, fog: false });
      const m = new THREE.Mesh(geos[type], mat);
      m.visible = false; m.renderOrder = 4; m.frustumCulled = false;
      if (type === 'wrong') m.scale.setScalar(ARROW_SCALE);
      scene.add(m); mats.push(mat);
      return m;
    });
  }
  const clear = () => { for (const t of Object.keys(pool)) for (const m of pool[t]) m.visible = false; };
  return {
    clear,
    // list: highlightsAt result. k (0 to 1) is the pulse; the ring also swells with it. Constant k = static.
    update(list, overhead = false) {
      clear();
      const used = { off: 0, red: 0, wrong: 0 };
      for (let j = list.length - 1; j >= 0; j--) { // newest last in the list: walk from the end so the newest take the pool
        const h = list[j];
        const m = pool[h.type]?.[used[h.type]++];
        if (!m) continue;
        m.visible = true;
        const off = overhead && h.type === 'wrong' ? ARROW_OFFSET : 0; // overhead the 2.5x taxi covers the arrow's tail: slide it clear of the taxi
        m.position.set(h.x + Math.sin(h.heading) * off, Y, h.z + Math.cos(h.heading) * off);
        m.rotation.y = h.type === 'wrong' ? h.heading : 0;
        const look = highlightLook(h.type, h.k, overhead);
        m.material.opacity = look.opacity;
        if (h.type === 'red') m.scale.setScalar((1.6 - 0.4 * h.k) * look.boost);
        else if (h.type === 'wrong') m.scale.setScalar(ARROW_SCALE * look.boost);
      }
    },
    dispose() { for (const g of Object.values(geos)) g.dispose(); for (const mat of mats) mat.dispose(); for (const t of Object.keys(pool)) for (const m of pool[t]) scene.remove(m); },
  };
}
