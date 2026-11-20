// Loads the KayKit glb files, measures each with Box3, and re-origins it: centred on x and z, base at y = 0.
// Walls are also turned so their long side runs along x. Clones share geometry and materials.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const NAMES = ['floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_big_spikes', 'wall', 'wall_corner',
  'pillar', 'torch_lit', 'chest_gold', 'coin_stack_medium', 'barrel_large', 'banner_red'];

export async function loadKit(onStatus = () => {}) {
  const loader = new GLTFLoader();
  const parts = {}, dims = {};
  let bytes = 0;
  await Promise.all(NAMES.map(async name => {
    const res = await fetch(`./models/${name}.glb`);
    if (!res.ok) throw new Error(`${name}.glb: HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    bytes += buf.byteLength;
    const gltf = await new Promise((ok, fail) => loader.parse(buf, './models/', ok, fail));
    const inner = new THREE.Group();
    inner.add(gltf.scene);
    const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    gltf.scene.position.set(-c.x, -box.min.y, -c.z);
    let d = { w: size.x, h: size.y, d: size.z };
    if (name === 'wall' && size.z > size.x) { inner.rotation.y = Math.PI / 2; d = { w: size.z, h: size.y, d: size.x }; }
    dims[name] = d;
    parts[name] = inner;
    console.log(`[kit] ${name}: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)} (w x h x d), ${(buf.byteLength / 1024).toFixed(1)} KB`);
    onStatus(name);
  }));
  // A clone wrapped in a group, scaled so its width (x) or its height becomes `size`.
  const make = (name, { width, height, scale } = {}) => {
    const d = dims[name], g = new THREE.Group();
    g.add(parts[name].clone(true));
    const s = scale ?? (width ? width / d.w : height ? height / d.h : 1);
    g.scale.setScalar(s);
    g.userData.dims = { w: d.w * s, h: d.h * s, d: d.d * s };
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };
  return { make, dims, bytes };
}
