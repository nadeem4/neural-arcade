// The 3D Treasure Room: renderer, instanced room, turnable camera, tile picking and the debug readout.
// Loaded only by room-host.js, and only when WebGL is there. Needs the import map (the vendored controls import 'three').
import * as THREE from '../../assets/vendor/three/three.module.min.js';
import { OrbitControls } from '../../assets/vendor/three/controls/OrbitControls.js';
import {
  VIEW, layoutRoom, nearSides, cameraPose, fitDistance, roomRadius, rayToCell, isTap, tierFor, frameGate, formatStats, moveStyle, atTreasure, labelScale,
} from './room-math.js';
import { OVERLAYS, overlayNames, marksList } from './room-overlays.js';
import { MESH_LAYERS, createMarks } from './room-overlay-meshes.js';

const NEAR_WALL_SCALE = 0.3; // a wall on the camera's side drops to this height so it never hides a tile
const TARGET = [0, 0.2, 0];
const BLOCK_COLOR = 0x6b7280;

const stageColor = () => {
  try { return getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#0F1319'; }
  catch { return '#0F1319'; }
};

// box: the .room element the canvas goes into. kit: the loaded models (room-kit.js). Returns the scene's controls.
export function createScene3d({ box, room, kit, character = null, reduceMotion = false, debug = false, preserveDrawingBuffer = false, onContextLost = () => {} }) {
  const t0 = performance.now();
  const L = layoutRoom(room, kit.dims);
  const tier = tierFor(box.clientWidth || 1280);

  const canvas = document.createElement('canvas');
  canvas.className = 'room-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', box.dataset.label ?? 'The treasure room');
  box.appendChild(canvas);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer }); } catch (err) { canvas.remove(); throw err; }
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, tier.pixelRatioMax));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const setBackground = () => { try { scene.background = new THREE.Color(stageColor()); } catch { scene.background = new THREE.Color('#0F1319'); } };
  setBackground();
  const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 100);

  // Light: a hemisphere, one shadowed sun, and a warm point light at each torch when the tier allows.
  const radius = roomRadius(room, L.wallD);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4a55, 2.2));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(3, 7, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
  Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: 20 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  if (tier.torchLights) {
    for (const t of L.torches) {
      const light = new THREE.PointLight(0xffa24a, 7, 0, 2);
      light.position.set(t.x, t.y + 0.45, t.z + 0.3);
      scene.add(light);
    }
  }

  // Instanced parts. One InstancedMesh per kit mesh per group of entries; the kit's geometry and materials are shared, so
  // they are not disposed here. Only what this mount creates (the blocks' box, the instanced meshes) is.
  const owned = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const addMesh = (parent, mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); owned.push(mesh); };
  const addParts = (parent, entries) => {
    const byPart = new Map();
    for (const e of entries) { if (!byPart.has(e.part)) byPart.set(e.part, []); byPart.get(e.part).push(e); }
    for (const [part, list] of byPart) {
      for (const { geometry, material, local } of kit.instancesOf(part)) {
        const mesh = new THREE.InstancedMesh(geometry, material, list.length);
        list.forEach((e, i) => {
          eul.set(e.rotX ?? 0, e.rotY ?? 0, 0, 'YXZ');
          q.setFromEuler(eul);
          m4.compose(pos.set(e.x, e.y, e.z), q, scl.setScalar(e.scale)).multiply(local);
          mesh.setMatrixAt(i, m4);
        });
        mesh.instanceMatrix.needsUpdate = true;
        addMesh(parent, mesh);
      }
    }
  };

  const world = new THREE.Group();
  scene.add(world);
  addParts(world, L.tiles);
  addParts(world, [L.chest, ...L.torches].filter(Boolean));

  // The chest's coin stack is drawn on its own so treasureScale (level 3: 0 hides it, 1 is full size) can resize it.
  const coinMeshes = L.coin ? kit.instancesOf(L.coin.part).map(({ geometry, material, local }) => {
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    addMesh(world, mesh);
    return { mesh, local };
  }) : [];
  const drawCoin = factor => {
    if (!L.coin) return;
    const s = Math.max(0, Math.min(1, factor ?? 1));
    for (const { mesh, local } of coinMeshes) {
      mesh.setMatrixAt(0, m4.compose(pos.set(L.coin.x, L.coin.y, L.coin.z), q.identity(), scl.setScalar(L.coin.scale * s)).multiply(local));
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  drawCoin(1);

  // Blocks (the '#' cells): one box, instanced.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshStandardMaterial({ color: BLOCK_COLOR, roughness: 0.9 });
  if (L.blocks.length) {
    const blocks = new THREE.InstancedMesh(boxGeo, boxMat, L.blocks.length);
    L.blocks.forEach((b, i) => {
      blocks.setMatrixAt(i, m4.compose(pos.set(b.x, b.y, b.z), q.identity(), scl.set(b.w, b.h, b.d)));
    });
    blocks.instanceMatrix.needsUpdate = true;
    addMesh(world, blocks);
  }

  // Walls and corners, one group per side, so the sides facing the camera can drop low.
  const sideGroups = {}, cornerGroups = {};
  for (const s of ['N', 'S', 'E', 'W']) { sideGroups[s] = new THREE.Group(); world.add(sideGroups[s]); addParts(sideGroups[s], L.walls.filter(w => w.side === s)); }
  for (const c of L.corners) { cornerGroups[c.side] = new THREE.Group(); world.add(cornerGroups[c.side]); addParts(cornerGroups[c.side], [c]); }
  const applyNear = azimuth => {
    const near = nearSides(azimuth);
    for (const s in sideGroups) sideGroups[s].scale.y = near.has(s) ? NEAR_WALL_SCALE : 1;
    for (const k in cornerGroups) cornerGroups[k].scale.y = [...k].some(ch => near.has(ch)) ? NEAR_WALL_SCALE : 1;
  };

  // The rogue: hidden until a draw gives it an agent cell.
  let ch;
  try { ch = character?.spawn(room, null) ?? null; }
  catch (err) {
    try { renderer.forceContextLoss(); } catch { /* the context may already be lost */ }
    renderer.dispose(); canvas.remove(); throw err;
  }
  let lastAgent = null;
  if (ch) { ch.object.visible = false; world.add(ch.object); }
  const drawAgent = opts => {
    if (!ch) return;
    const a = opts?.agent ?? null;
    if (!a) { ch.object.visible = false; lastAgent = null; return; }
    if (lastAgent && lastAgent.x === a.x && lastAgent.y === a.y) return;
    ch.object.visible = true;
    ch.moveTo(a, moveStyle({ from: lastAgent, to: a, ice: !!opts.ice, reduce: reduceMotion }));
    if (!reduceMotion && lastAgent && atTreasure(room, a)) ch.cheer();
    lastAgent = { x: a.x, y: a.y };
  };

  // Overlays: the layers for the names the level asked for, and the outlined tiles (marks), which belong to the base room.
  const marks = createMarks(THREE, { room, parent: world });
  const focusRing = createMarks(THREE, { room, parent: world }); // the keyboard focus on the hidden tile grid
  let layers = [], lastOpts = null, dirty = true; // dirty: something changed since the last frame
  const layerCtx = { THREE, room, parent: world, kit, tilt: Math.PI / 2 - VIEW.polar, labelScale: () => labelScale(box.clientWidth || 1280) };
  const drawOverlays = opts => {
    lastOpts = opts;
    dirty = true;
    marks.set(marksList(opts?.marks));
    drawCoin(opts?.treasureScale);
    if (opts) for (const l of layers) l.layer.update(OVERLAYS[l.name].list(room, opts));
  };

  // Camera: three-quarter view, distance fitted to the box; OrbitControls turn it within limits.
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, {
    enablePan: false,
    enableDamping: !reduceMotion,
    minAzimuthAngle: VIEW.azimuth - VIEW.azRange,
    maxAzimuthAngle: VIEW.azimuth + VIEW.azRange,
    minPolarAngle: VIEW.polarMin,
    maxPolarAngle: VIEW.polarMax,
  });
  controls.target.set(...TARGET);
  let fitted = false;
  const resize = () => {
    const w = box.clientWidth, h = box.clientHeight || w;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const d = fitDistance({ w, h, fov: VIEW.fov, radius });
    controls.minDistance = d * 0.6;
    controls.maxDistance = d * 1.4;
    if (!fitted) {
      camera.position.set(...cameraPose({ azimuth: VIEW.azimuth, polar: VIEW.polar, dist: d, target: TARGET }).position);
      fitted = true;
    } else {
      camera.position.sub(controls.target).setLength(d).add(controls.target);
    }
    controls.update();
    drawOverlays(lastOpts); // labels re-size with the view
  };
  let dragging = false;
  const onChange = () => { dirty = true; applyNear(controls.getAzimuthalAngle()); }; // also fires while damping settles
  const onStart = () => { dragging = true; };
  const onEnd = () => { dragging = false; };
  controls.addEventListener('change', onChange);
  controls.addEventListener('start', onStart);
  controls.addEventListener('end', onEnd);
  resize();
  applyNear(controls.getAzimuthalAngle());

  // Picking. A tap is a pointer that barely moved and was quick; a drag turns the camera and never picks a tile.
  let down = null;
  const onDown = e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  canvas.addEventListener('pointerdown', onDown);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const cellAt = e => {
    if (down && !isTap(down, { x: e.clientX, y: e.clientY, t: performance.now() })) return null;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld();
    ray.setFromCamera(ndc, camera);
    const { origin: o, direction: d } = ray.ray;
    return rayToCell(room, [o.x, o.y, o.z], [d.x, d.y, d.z]);
  };

  // Debug readout: ?debug=1 only.
  let pre = null, frames = 0, lastStat = performance.now(), firstMs = 0;
  if (debug) {
    pre = document.createElement('pre');
    pre.className = 'room-debug';
    box.appendChild(pre);
  }

  // The loop. Busy frames (a move, a drag, damping, a new draw) always render; idle ones at most every IDLE_MS.
  // It stops while the tab is hidden or the room is off screen, and draws one frame at once on resuming.
  const IDLE_MS = 33;
  let raf = 0, dead = false, visible = true, last = -Infinity;
  let prev = performance.now();
  const tick = now => {
    raf = requestAnimationFrame(tick);
    const active = dirty || dragging || !!ch?.busy();
    if (!frameGate({ now, last, idleMs: IDLE_MS, active })) return;
    last = now;
    dirty = false;
    if (ch && !reduceMotion) ch.update(Math.min(0.1, (now - prev) / 1000));
    prev = now;
    controls.update();
    renderer.render(scene, camera);
    if (!debug) return;
    if (!firstMs) firstMs = performance.now() - t0;
    frames++;
    if (now - lastStat >= 1000) {
      const i = renderer.info;
      pre.textContent = formatStats({
        fps: (frames * 1000) / (now - lastStat), calls: i.render.calls, triangles: i.render.triangles,
        geometries: i.memory.geometries, textures: i.memory.textures, kb: kit.bytes / 1024, firstMs,
      });
      frames = 0;
      lastStat = now;
    }
  };
  const syncLoop = () => {
    if (dead) return;
    if (document.hidden || !visible) { cancelAnimationFrame(raf); raf = 0; dragging = false; return; } // a cut-off drag must not hold the loop at full rate
    if (raf) return;
    prev = lastStat = performance.now(); frames = 0; // a pause is not a slow frame rate
    dirty = true; last = -Infinity;                    // one frame at once
    raf = requestAnimationFrame(tick);
  };
  document.addEventListener('visibilitychange', syncLoop);
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => { visible = entries[entries.length - 1].isIntersecting; syncLoop(); })
    : null;
  io?.observe(box);
  syncLoop();

  const onLost = e => { e.preventDefault(); onContextLost(); };
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    draw(opts) { setBackground(); drawAgent(opts); drawOverlays(opts); }, // a redraw (theme change) also re-reads the background
    cellAt,
    resize,
    setFocus(cell) { dirty = true; focusRing.set(cell ? [cell] : []); },
    setOverlays(names) {
      const wanted = overlayNames(names);
      for (const l of layers) l.layer.dispose();
      layers = wanted.map(name => ({ name, layer: MESH_LAYERS[name](layerCtx) }));
      drawOverlays(lastOpts);
    },
    destroy() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', syncLoop);
      io?.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('webglcontextlost', onLost);
      controls.removeEventListener('change', onChange);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      controls.dispose();
      for (const l of layers) l.layer.dispose();
      layers = [];
      marks.dispose();
      focusRing.dispose();
      ch?.destroy();
      for (const m of owned) m.dispose();
      boxGeo.dispose();
      boxMat.dispose();
      try { renderer.forceContextLoss(); } catch { /* the context may already be lost */ }
      renderer.dispose();
      canvas.remove();
      pre?.remove();
    },
  };
}
