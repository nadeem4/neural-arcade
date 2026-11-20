// Throwaway spike: Treasure Room Value level in 3D. Sim and heat maths come from the real game modules.
import * as THREE from 'three';
import { OrbitControls } from './vendor/controls/OrbitControls.js';
import { ROOM, START, sweepOnce } from '../../games/treasure-room/sim.js';
import { heatOf, uphillWalk } from '../../games/treasure-room/level-value.js';
import { loadKit } from './kit.js';
import { buildRoom } from './room.js';

const $ = id => document.getElementById(id);
const showError = e => { console.error(e); const el = $('err'); el.hidden = false; el.textContent += `${e?.message || e}\n`; };
addEventListener('error', ev => showError(ev.error || ev.message));
addEventListener('unhandledrejection', ev => showError(ev.reason));

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TWEEN = reduce ? 0 : 350, STEP = reduce ? 0 : 450;
const COOL = new THREE.Color('#2b7bff'), WARM = new THREE.Color('#ff5a1f');
const isFloor = (x, y) => !'TX#'.includes(ROOM.cells[y][x]);
const ease = k => 1 - (1 - k) ** 3;

async function main() {
  const t0 = performance.now();
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: $('c') });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0F1319');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x20242c, 0.9));
  const sun = new THREE.DirectionalLight(0xbcd0ff, 1.1);
  sun.position.set(3, 7, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
  scene.add(sun);

  const kit = await loadKit();
  const R = buildRoom(kit, ROOM);
  scene.add(R.group);
  if (new URLSearchParams(location.search).has('torchShadow')) R.torches.forEach(l => { l.castShadow = true; l.shadow.mapSize.set(512, 512); });
  try { await document.fonts.ready; } catch { /* labels still draw with the fallback font */ }

  // Value overlays: a flat tinted plane and a number sprite per floor cell.
  const cells = [];
  const planeGeo = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
  for (let y = 0; y < ROOM.h; y++) for (let x = 0; x < ROOM.w; x++) {
    if (!isFloor(x, y)) continue;
    const p = R.cell(x, y);
    const plane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    plane.position.copy(p).setY(0.02); scene.add(plane);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    sprite.scale.set(0.5, 0.25, 1); sprite.position.copy(p).setY(0.3); scene.add(sprite);
    cells.push({ id: y * ROOM.w + x, plane, sprite, cv, tex, text: null, v: 0, h: 0, from: { v: 0, h: 0 }, to: { v: 0, h: 0 }, t: 0 });
  }
  const label = c => {
    const text = c.v === 0 ? '0' : c.v.toFixed(1);
    if (text === c.text) return;
    c.text = text;
    const g = c.cv.getContext('2d');
    g.clearRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(15,19,25,0.78)'; g.beginPath(); g.roundRect(4, 8, 120, 48, 14); g.fill();
    g.fillStyle = '#E9EDF2'; g.font = '700 34px "JetBrains Mono", ui-monospace, Consolas, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 33);
    c.tex.needsUpdate = true;
  };

  // Agent: capsule body, sphere head, dark visor on the front, in the signal orange.
  const agent = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.5, emissive: 0x401400 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.22, 4, 12), orange); body.position.y = 0.24;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), orange); head.position.y = 0.6;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x0f1319 }));
  visor.position.set(0, 0.62, 0.11);
  agent.add(body, head, visor); agent.traverse(o => { o.castShadow = true; });
  scene.add(agent);
  const startPos = R.cell(START.x, START.y);
  agent.position.copy(startPos);
  let move = null; // { from, to, t, done }
  const moveAgent = to => new Promise(done => {
    const from = agent.position.clone();
    if (to.distanceTo(from) > 0.01) agent.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    if (!STEP) { agent.position.copy(to); done(); return; }
    move = { from, to, t: performance.now(), done };
  });

  // State and controls.
  const gammaEl = $('gamma'); let gamma = Number(gammaEl.value), values = new Array(ROOM.w * ROOM.h).fill(0), sweeps = 0, busy = false;
  const setBusy = b => { busy = b; for (const id of ['sweep', 'reset', 'walk']) $(id).disabled = b; };
  const retarget = () => {
    const heat = heatOf(values, ROOM), now = performance.now();
    for (const c of cells) { c.from = { v: c.v, h: c.h }; c.to = { v: values[c.id], h: heat[c.id] }; c.t = now; }
    $('count').textContent = `Sweep ${sweeps}`;
  };
  const home = () => { move = null; agent.position.copy(startPos); agent.rotation.y = 0; };
  $('sweep').onclick = () => { values = sweepOnce(ROOM, values, { gamma }); sweeps++; home(); retarget(); };
  const reset = () => { values = values.map(() => 0); sweeps = 0; home(); retarget(); $('msg').textContent = ''; };
  $('reset').onclick = reset;
  gammaEl.oninput = () => { gamma = Number(gammaEl.value); $('gammaOut').textContent = gamma.toFixed(2); reset(); };
  $('front').onclick = () => { R.front.visible = !R.front.visible; $('front').setAttribute('aria-pressed', String(R.front.visible)); };
  $('walk').onclick = async () => {
    const w = uphillWalk(ROOM, values, START);
    $('msg').textContent = '';
    if (w.outcome !== 'treasure') { $('msg').textContent = sweeps ? 'No better tile next door: sweep more.' : 'Sweep first.'; return; }
    setBusy(true); home();
    try { for (const s of w.path.slice(1)) await moveAgent(R.cell(s.x, s.y)); $('msg').textContent = `Reached the treasure in ${w.path.length - 1} steps.`; }
    catch (e) { showError(e); }
    setBusy(false);
  };

  // Camera: fixed three-quarter view, distance fitted to the viewport; OrbitControls turn it within limits.
  const dir = new THREE.Vector3(0.45, 1.0, 0.95).normalize();
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enablePan: false, enableDamping: true, maxPolarAngle: Math.PI * 0.45, minPolarAngle: 0.35 });
  controls.target.set(0, 0.2, 0);
  const fit = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const fov = THREE.MathUtils.degToRad(camera.fov), r = R.half * 1.2 + 0.2;
    const d = Math.max(r / Math.sin(fov / 2), r / Math.sin(Math.atan(Math.tan(fov / 2) * camera.aspect)));
    controls.minDistance = d * 0.6; controls.maxDistance = d * 1.4;
    const cur = camera.position.clone().sub(controls.target);
    camera.position.copy(controls.target).add(cur.lengthSq() ? cur.setLength(d) : dir.clone().multiplyScalar(d));
  };
  camera.position.copy(controls.target).add(dir);
  fit(); addEventListener('resize', fit);

  // Frame loop.
  let frames = 0, last = performance.now(), first = true;
  const stats = { bytes: kit.bytes };
  const tick = now => {
    requestAnimationFrame(tick);
    try {
      for (const c of cells) {
        const k = TWEEN ? Math.min(1, (now - c.t) / TWEEN) : 1, e = ease(k);
        c.v = c.from.v + (c.to.v - c.from.v) * e; c.h = c.from.h + (c.to.h - c.from.h) * e;
        c.plane.material.color.lerpColors(COOL, WARM, c.h);
        c.plane.material.opacity = sweeps ? 0.18 + 0.4 * c.h : 0;
        label(c);
      }
      if (move) {
        const k = Math.min(1, (now - move.t) / STEP);
        agent.position.lerpVectors(move.from, move.to, ease(k)).y += Math.sin(Math.PI * k) * 0.18;
        if (k >= 1) { const d = move.done; move = null; d(); }
      }
      controls.update();
      renderer.render(scene, camera);
      frames++;
      if (first) { first = false; stats.first = performance.now(); console.log(`[spike] first frame ${stats.first.toFixed(0)} ms after navigation start (${(stats.first - t0).toFixed(0)} ms after main start)`); }
      if (now - last >= 1000) {
        const fps = frames * 1000 / (now - last); frames = 0; last = now;
        const i = renderer.info;
        $('stats').textContent = `${fps.toFixed(0)} fps | ${i.render.calls} calls | ${(i.render.triangles / 1000).toFixed(1)}k tris | ${(stats.bytes / 1024).toFixed(0)} KB models | first frame ${stats.first.toFixed(0)} ms`;
      }
    } catch (e) { showError(e); }
  };
  requestAnimationFrame(tick);
  $('count').textContent = 'Sweep 0';
}

main().catch(showError);
