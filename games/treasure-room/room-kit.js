// Loads the CC0 KayKit models, measures each with Box3 and re-origins it: centred on x and z, base at y = 0.
// The wall is also turned so its long side runs along x. Needs the import map (the loader imports 'three').
import * as THREE from '../../assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../assets/vendor/three/loaders/GLTFLoader.js';

export const MODEL_FILES = ['floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_big_spikes', 'wall', 'wall_corner', 'chest_gold', 'coin_stack_medium', 'torch_lit'];

const cache = new Map();

async function loadOne(loader, base, name) {
  const res = await fetch(new URL(`${name}.glb`, base));
  if (!res.ok) throw new Error(`${name}.glb: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const gltf = await new Promise((ok, fail) => loader.parse(buf, base.href, ok, fail));
  const inner = new THREE.Group();
  inner.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  gltf.scene.position.set(-c.x, -box.min.y, -c.z);
  let dims = { w: size.x, h: size.y, d: size.z };
  if (name === 'wall' && size.z > size.x) { inner.rotation.y = Math.PI / 2; dims = { w: size.z, h: size.y, d: size.x }; }
  inner.updateMatrixWorld(true);
  const meshes = [];
  inner.traverse(o => { if (o.isMesh) meshes.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone() }); });
  return { name, dims, bytes: buf.byteLength, meshes };
}

// One download per page: later mounts share the same promise. A failed load is forgotten so a later mount can try again. onFile fires once per file loaded (not on a cache hit).
export function loadKit(base = new URL('./models/', import.meta.url), onFile) {
  const key = String(base);
  if (!cache.has(key)) {
    const loader = new GLTFLoader();
    const p = Promise.all(MODEL_FILES.map(n => loadOne(loader, base, n).then(r => { onFile?.(); return r; }))).then(list => {
      const dims = {}, byName = {};
      let bytes = 0;
      for (const m of list) { dims[m.name] = m.dims; byName[m.name] = m.meshes; bytes += m.bytes; }
      // instancesOf(name): the model's meshes as { geometry, material, local } so the scene can draw N copies per mesh.
      return { dims, bytes, instancesOf: name => byName[name] };
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}
