// The people as two InstancedMesh (a capsule body and a sphere head), one instance per person.
// Draw calls: 2 on a phone; 2 on desktop plus the same 2 again in the shadow pass (phones do not cast shadows).
// Instances: the first `drawn` of the baked people (quality.js peopleDrawn: 60 on desktop, 24 on a phone). The rest are baked, just not drawn.
// Everything moves from the trip clock handed to update(t): a small walk bob and, for a scared person, the hop sideways.
import * as THREE from '../../assets/vendor/three/three.module.min.js';
import { newPoses, outfitOf, SURF_WALK, SURF_PARK, SURF_CROSS } from './people.js';
import { Y_CROSS, Y_WALK } from './street-model.js';
import { TAXI_SCALE } from './scene-taxi.js';

const BODY = { radius: 0.28, length: 0.9 };  // metres; a capsule 1.46 m tall
const HEAD = { radius: 0.2, y: 1.6 };
const BOB = 0.12;                            // metres of up and down while walking
// Feet stand on the surface drawn under them: the raised sidewalk, the park, the zebra crossing. Y_PARK is the park height scene.js draws at.
export const Y_PARK = 0.4;
export const surfaceY = (code) => (code === SURF_CROSS ? Y_CROSS : code === SURF_PARK ? Y_PARK : Y_WALK);
const BOB_RATE = Math.PI * 0.9;              // radians per tick: about two steps a second at 400 ms a tick

// scene: the THREE scene. baked: people.js bakePeople. Returns { count, drawCalls, update(t), dispose() }.
export function createPeopleLayer(scene, baked, { drawn = baked.count, shadows = true, seed = 1 } = {}) {
  const n = Math.min(baked.count, drawn);
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
  for (const m of [bodies, heads]) { m.castShadow = shadows; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  scene.add(bodies, heads);
  const poses = newPoses(baked.count), m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(TAXI_SCALE, TAXI_SCALE, TAXI_SCALE);

  return {
    count: n,
    drawCalls: shadows ? 4 : 2,
    update(t) {
      baked.fillPoses(t, poses);
      for (let i = 0; i < n; i++) {
        const bob = poses.walking[i] ? Math.abs(Math.sin(t * BOB_RATE + i)) * BOB : 0;
        const lift = surfaceY(poses.surface[i]) + (bob + poses.y[i]) * TAXI_SCALE;
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
