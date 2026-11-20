// The rogue: one KayKit character (CC0) with an idle, a walk and a cheer clip, hopping or sliding between tiles.
// Loaded by room-host.js with the scene. Needs the import map (the loader imports 'three').
import * as THREE from '../../assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../assets/vendor/three/loaders/GLTFLoader.js';
import { cellToWorld, facing, MOVE_MS, tweenAt } from './room-math.js';

const HEIGHT = 0.7; // the character stands about this much of a cell tall
const FADE = 0.12;  // seconds to blend between clips

// One download per page; every mount parses its own copy of the bytes, so no two mounts share a skeleton or its disposal.
const bytes = new Map();
const fetchBytes = url => {
  const key = String(url);
  if (!bytes.has(key)) {
    const p = fetch(url).then(res => {
      if (!res.ok) throw new Error(`rogue.glb: HTTP ${res.status}`);
      return res.arrayBuffer();
    });
    p.catch(() => bytes.delete(key));
    bytes.set(key, p);
  }
  return bytes.get(key);
};

export async function loadCharacter(base = new URL('./models/', import.meta.url)) {
  const url = new URL('rogue.glb', base);
  const buf = await fetchBytes(url);
  const gltf = await new Promise((ok, fail) => new GLTFLoader().parse(buf, url.href, ok, fail));
  return { spawn: (room, start) => spawn(gltf, room, start), bytes: buf.byteLength };
}

function spawn(gltf, room, start) {
  const root = new THREE.Group();
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = HEIGHT / size.y;
  const inner = new THREE.Group();
  model.position.set(-c.x, -box.min.y, -c.z);
  inner.scale.setScalar(k);
  inner.add(model);
  root.add(inner);
  model.traverse(o => { if (o.isMesh) o.castShadow = true; });

  const mixer = new THREE.AnimationMixer(model);
  const clip = name => THREE.AnimationClip.findByName(gltf.animations, name);
  const idle = mixer.clipAction(clip('Unarmed_Idle'));
  const walk = mixer.clipAction(clip('Walking_A'));
  const cheer = mixer.clipAction(clip('Cheer'));
  cheer.setLoop(THREE.LoopOnce, 1);
  cheer.clampWhenFinished = true;
  idle.play();
  mixer.update(0); // the idle pose shows even when the mixer is never advanced (reduced motion)
  const backToIdle = () => { idle.reset().fadeIn(FADE).play(); };
  mixer.addEventListener('finished', e => { if (e.action === cheer) { cheer.fadeOut(FADE); backToIdle(); } });

  let tween = null; // { from, to, t, style }
  const at = pos => { const w = cellToWorld(room, pos.x, pos.y); return { x: w.x, z: w.z }; };
  let cur = null; // the cell the character is on, or heading for
  const place = pos => {
    cur = pos;
    const w = at(pos);
    root.position.set(w.x, 0, w.z);
  };
  let wantCheer = false; // asked to cheer while still moving: it plays on arrival
  const startCheer = () => { idle.fadeOut(FADE); cheer.reset().fadeIn(FADE).play(); };
  const settle = arrived => {
    if (!tween) return;
    root.position.set(tween.to.x, 0, tween.to.z);
    tween = null;
    walk.fadeOut(FADE);
    if (arrived === true && wantCheer) startCheer(); else backToIdle();
    wantCheer = false;
  };
  if (start) place(start);

  return {
    object: root,
    place(pos) { wantCheer = false; settle(); cheer.stop(); place(pos); },
    // A move that arrives while one is running finishes the first at once.
    moveTo(pos, style) {
      wantCheer = false;
      settle();
      const from = cur;
      if (style === 'snap' || !from) { place(pos); return; }
      cur = pos;
      root.rotation.y = facing(from, pos);
      tween = { from: at(from), to: at(pos), t: 0, style };
      cheer.stop();
      idle.fadeOut(FADE);
      walk.reset().fadeIn(FADE).play();
    },
    cheer() { if (tween) wantCheer = true; else startCheer(); },
    update(dt) {
      mixer.update(dt);
      if (!tween) return;
      tween.t += dt * 1000 / MOVE_MS;
      const { k: e, lift } = tweenAt(tween.style, tween.t);
      root.position.set(tween.from.x + (tween.to.x - tween.from.x) * e, lift, tween.from.z + (tween.to.z - tween.from.z) * e);
      if (tween.t >= 1) settle(true);
    },
    destroy() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      model.traverse(o => {
        o.geometry?.dispose();
        o.skeleton?.dispose();
        for (const m of [].concat(o.material ?? [])) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
      });
      root.removeFromParent();
    },
  };
}
