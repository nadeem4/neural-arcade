// Reward City traffic, drawn: other cars as instanced meshes. The positions come from traffic.js (pure); nothing here decides anything.
// Desktop: 3 draw calls (bodies and glass, head lamps, tail lamps). Phone: 1 draw call (bodies only, no lamps).
import * as THREE from './vendor/three.module.min.js';
import { createTraffic, taxiOf, newPoses, carColour } from './traffic.js';

const TRAFFIC_SEED = 1;       // every drive on the same route shows the same cars
export const CAR_SCALE = 1.5; // the same metres-to-scene scale as the taxi
const CAR_Y = 0.8;            // wheel bottoms sit on the road surface. replace with ROAD_Y from scene-math.js
const TAIL_DIM = 0.3, TAIL_BRAKE = 1; // linear brightness of the red lamps
const FLASH_HZ = 6;           // headlamp flash rate while a car is braking hard

// Merges boxes ({ size: [w, h, l], pos: [x, y, z], rgb }) into one geometry with vertex colours. Forward is +z.
function mergeBoxes(parts) {
  const pos = [], nor = [], col = [], idx = [];
  for (const { size, pos: p, rgb } of parts) {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const base = pos.length / 3, a = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < a.length; i += 3) { pos.push(a[i] + p[0], a[i + 1] + p[1], a[i + 2] + p[2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(...rgb); }
    for (const k of g.index.array) idx.push(base + k);
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// Body vertices are white so the per-car colour shows; glass and wheels are dark and stay dark.
const bodyGeometry = () => mergeBoxes([
  { size: [1.9, 0.55, 4.2], pos: [0, 0.55, 0], rgb: [1, 1, 1] },
  { size: [1.6, 0.45, 2.0], pos: [0, 1.05, -0.2], rgb: [0.09, 0.1, 0.12] },
  ...[[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]].map(([x, z]) => ({ size: [0.2, 0.6, 0.6], pos: [x, 0.3, z], rgb: [0.06, 0.06, 0.07] })),
]);
const lampGeometry = (z) => mergeBoxes([-0.6, 0.6].map((x) => ({ size: [0.4, 0.2, 0.08], pos: [x, 0.65, z], rgb: [1, 1, 1] })));

// Writes a Y rotation of `h`, uniform scale `s` and translation (x, y, z) into 16 floats at `o`.
function setPose(arr, o, x, y, z, h, s) {
  const c = Math.cos(h) * s, sn = Math.sin(h) * s;
  arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -sn; arr[o + 3] = 0;
  arr[o + 4] = 0; arr[o + 5] = s; arr[o + 6] = 0; arr[o + 7] = 0;
  arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0;
  arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
}

// tier: { count, lamps } from traffic.js trafficTier. Meshes are made once; begin(traffic) points them at a trip's cars.
export function createTrafficLayer({ tier }) {
  const group = new THREE.Group();
  group.visible = false;
  const max = tier.count;
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 });
  const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const geos = [bodyGeometry()];
  const make = (geo, mat) => {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.frustumCulled = false; m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, new THREE.Color(1, 1, 1)); // creates instanceColor
    group.add(m);
    return m;
  };
  const bodies = make(geos[0], bodyMat);
  bodies.castShadow = true;
  let heads = null, tails = null;
  if (tier.lamps) {
    geos.push(lampGeometry(2.06), lampGeometry(-2.06));
    heads = make(geos[1], lampMat); tails = make(geos[2], lampMat);
  }
  const meshes = group.children.slice();
  const poses = newPoses(max);
  let traffic = null, honkIdx = 0, tmp = new THREE.Color();

  return {
    group,
    drawCalls: meshes.length,
    get instances() { return bodies.count; },
    // Starts a trip: sizes the meshes to the cars it has and gives each its seeded body colour.
    begin(t) {
      traffic = t; honkIdx = 0;
      for (const m of meshes) m.count = t.count;
      for (let i = 0; i < t.count; i++) bodies.setColorAt(i, tmp.setHex(carColour(t.seed, i)));
      bodies.instanceColor.needsUpdate = true;
      group.visible = true;
    },
    // The page's call: the traffic for one trip (events from events.js tripEvents), with the tier's car count.
    startTrip(world, cellM, events) {
      this.begin(createTraffic(world, { seed: TRAFFIC_SEED, count: max, cellM, taxi: taxiOf(events) }));
    },
    stop() { traffic = null; group.visible = false; },
    // The cars at `tf` ticks into the trip. onHonk(h) is called at most once a frame, for the newest near miss within a tick of the clock. No allocation.
    update(tf, onHonk) {
      if (!traffic) return;
      traffic.posesAt(tf, poses);
      const n = traffic.count, flash = Math.floor(Math.max(0, tf) * FLASH_HZ) % 2 === 0;
      const ma = bodies.instanceMatrix.array;
      for (let i = 0; i < n; i++) setPose(ma, i * 16, poses.x[i], CAR_Y, poses.z[i], poses.h[i], CAR_SCALE);
      bodies.instanceMatrix.needsUpdate = true;
      if (heads) {
        heads.instanceMatrix.array.set(ma.subarray(0, n * 16)); tails.instanceMatrix.array.set(ma.subarray(0, n * 16));
        heads.instanceMatrix.needsUpdate = tails.instanceMatrix.needsUpdate = true;
        const hc = heads.instanceColor.array, tc = tails.instanceColor.array;
        for (let i = 0; i < n; i++) {
          const head = poses.alarm[i] ? (flash ? 1 : 0.1) : 0.7;
          hc[i * 3] = head; hc[i * 3 + 1] = head * 0.93; hc[i * 3 + 2] = head * 0.7;
          const tail = poses.braking[i] ? TAIL_BRAKE : TAIL_DIM;
          tc[i * 3] = tail; tc[i * 3 + 1] = tail * 0.06; tc[i * 3 + 2] = tail * 0.06;
        }
        heads.instanceColor.needsUpdate = tails.instanceColor.needsUpdate = true;
      }
      if (onHonk) {
        const honks = traffic.nearMisses(), k = Math.floor(Math.max(0, tf));
        let fresh = null; // one horn a frame; a honk more than a tick behind the clock (a background tab) is dropped
        while (honkIdx < honks.length && honks[honkIdx].tick <= k) { const h = honks[honkIdx++]; if (k - h.tick <= 1) fresh = h; }
        if (fresh) onHonk(fresh);
      }
    },
    dispose() { for (const g of geos) g.dispose(); bodyMat.dispose(); lampMat.dispose(); for (const m of meshes) m.dispose(); },
  };
}
