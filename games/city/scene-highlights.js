// The in-world highlight of each recent offence, drawn from what highlights.js says is active. Three.js, thin: no decisions here.
// A pool of flat meshes is made once; update() only moves, turns, scales and fades them.
//   off   -> the tile flashes (a one-cell quad)    red   -> a red ring pulses on the road    wrong -> a red arrow on the road, pointing the legal way
import * as THREE from './vendor/three.module.min.js';
import { arrowPolys } from './street-model.js';
import { ROAD_Y } from './scene-math.js';

const Y = ROAD_Y + 0.7;   // above the road and the raised footpaths (they sit at ROAD_Y + 0.3)
const PER_TYPE = 4;       // the most highlights of one kind on screen at once
const ARROW_SCALE = 4;    // the road arrow is about 12 m long and 6 m wide
const AHEAD = 20;         // metres ahead of the taxi (the road arrow is drawn before the taxi reaches it)
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
    update(list) {
      clear();
      const used = { off: 0, red: 0, wrong: 0 };
      for (const h of list) {
        const m = pool[h.type]?.[used[h.type]++];
        if (!m) continue;
        m.visible = true;
        m.position.set(h.x, Y, h.z);
        m.rotation.y = h.type === 'wrong' ? h.heading : 0;
        if (h.type === 'wrong') m.position.set(h.x - Math.sin(h.heading) * AHEAD, Y, h.z - Math.cos(h.heading) * AHEAD); // the arrow points back at the taxi from the road ahead of it, where the camera sees it
        m.material.opacity = (h.type === 'wrong' ? 0.6 : 0.3) + 0.4 * h.k;
        if (h.type === 'red') m.scale.setScalar(1.6 - 0.4 * h.k);
      }
    },
    dispose() { for (const g of Object.values(geos)) g.dispose(); for (const mat of mats) mat.dispose(); for (const t of Object.keys(pool)) for (const m of pool[t]) scene.remove(m); },
  };
}
