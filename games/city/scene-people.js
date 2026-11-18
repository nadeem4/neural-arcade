// The people as two InstancedMesh (a capsule body and a sphere head), one instance per person.
// Draw calls: 2 on a phone; 2 on desktop plus the same 2 again in the shadow pass (phones do not cast shadows).
// Instances: baked.count, which people.js sets per tier (60 on desktop, 24 on a phone).
// Everything moves from the trip clock handed to update(t): a small walk bob and, for a scared person, the hop sideways.
import * as THREE from './vendor/three.module.min.js';
import { newPoses, outfitOf } from './people.js';
import { TAXI_SCALE } from './scene-taxi.js';

const BODY = { radius: 0.28, length: 0.9 };  // metres; a capsule 1.46 m tall
const HEAD = { radius: 0.2, y: 1.6 };
const BOB = 0.12;                            // metres of up and down while walking
const BOB_RATE = Math.PI * 0.9;              // radians per tick: about two steps a second at 400 ms a tick

// scene: the THREE scene. baked: people.js bakePeople. Returns { count, drawCalls, update(t), dispose() }.
export function createPeopleLayer(scene, baked, { phone = false, seed = 1 } = {}) {
  const n = baked.count;
  const bodyGeo = new THREE.CapsuleGeometry(BODY.radius, BODY.length, 2, 6);
  bodyGeo.translate(0, BODY.radius + BODY.length / 2, 0);
  const headGeo = new THREE.SphereGeometry(HEAD.radius, 8, 6);
  const clothMat = new THREE.MeshLambertMaterial({ color: 0xffffff }), skinMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const bodies = new THREE.InstancedMesh(bodyGeo, clothMat, n);
  const heads = new THREE.InstancedMesh(headGeo, skinMat, n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const o = outfitOf(seed, i);
    bodies.setColorAt(i, c.setHex(o.cloth));
    heads.setColorAt(i, c.setHex(o.skin));
  }
  for (const m of [bodies, heads]) { m.castShadow = !phone; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  scene.add(bodies, heads);
  const poses = newPoses(n), m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(TAXI_SCALE, TAXI_SCALE, TAXI_SCALE);

  return {
    count: n,
    drawCalls: phone ? 2 : 4,
    update(t) {
      baked.fillPoses(t, poses);
      for (let i = 0; i < n; i++) {
        const bob = poses.walking[i] ? Math.abs(Math.sin(t * BOB_RATE + i)) * BOB : 0;
        const lift = (bob + poses.y[i]) * TAXI_SCALE;
        bodies.setMatrixAt(i, m.compose(pos.set(poses.x[i], lift, poses.z[i]), q, s));
        heads.setMatrixAt(i, m.compose(pos.set(poses.x[i], lift + HEAD.y * TAXI_SCALE, poses.z[i]), q, s));
      }
      bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(bodies, heads);
      bodyGeo.dispose(); headGeo.dispose(); clothMat.dispose(); skinMat.dispose();
      bodies.dispose(); heads.dispose();
    },
  };
}
