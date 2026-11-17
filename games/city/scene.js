// The 3D city: browser glue between geometry.js and three.js. Renders on demand (after a drag, wheel or resize).
import * as THREE from './vendor/three.module.min.js';
import { buildBuildings, buildRoadStrips, buildLaneMarks, buildFlats, treePositions, cityBounds, cellCentre } from './geometry.js';
import { clampPitch, clampDistance, readColors, treesToHide } from './scene-math.js';
import { motionAllowed, chaseCamera, heatColour } from './playback.js';
import { stateAt } from './drive.js';
import { shotAt, timeline, SWOOP_MS, PULLBACK_MS } from './director.js';
import { loadWorld } from './sim.js';
import { signalState, signalCorners } from './signals.js';
import { skyColours, fogFor, heatOpacity } from './sky.js';
import { createSky, addWindows } from './scene-look.js';
import { createTaxiMaker } from './scene-taxi.js';

const CHASE = { back: 18, up: 8, ahead: 14 }; // behind and above the taxi, looking down the street ahead of it
export const isPhone = () => !!(globalThis.matchMedia && matchMedia('(pointer: coarse)').matches);

const TREE_SEED = 7;

function meshOf(geo, mat, { cast = false, receive = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  m.matrixAutoUpdate = false; m.updateMatrix();
  return m;
}
function geoOf({ positions, normals, indices }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (normals) g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  if (!normals) g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function createScene(el, city, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: !opts.phone, powerPreference: 'high-performance' });
  try { return build(el, city, renderer, !!opts.phone, opts.labels ?? null, opts.onChaseOff); } catch (e) {
    renderer.dispose(); renderer.domElement.remove();
    throw e;
  }
}

function build(el, city, renderer, phone, labelEl, onChaseOff) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.shadowMap.enabled = !phone; // shadows are a desktop-only extra
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  el.replaceChildren(canvas);

  const { cx, cz, radius } = cityBounds(city);
  const colors = readColors(getComputedStyle(document.documentElement));
  const mats = {};
  for (const key of ['road', 'walk', 'park', 'water', 'building', 'ground', 'leaf']) {
    mats[key] = new THREE.MeshStandardMaterial({ color: colors[key], roughness: 0.85, side: THREE.DoubleSide });
  }
  mats.building.side = THREE.FrontSide; // so the chase cam sees through a wall it passes
  mats.mark = new THREE.MeshBasicMaterial({ color: colors.mark, side: THREE.DoubleSide });
  mats.pin = new THREE.MeshStandardMaterial({ color: colors.pin, emissive: colors.pin, emissiveIntensity: 0.5 });
  mats.pad = new THREE.MeshBasicMaterial({ color: colors.accent });

  const dark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  const sky = createSky(skyColours(dark()));
  const scene = new THREE.Scene();
  scene.background = sky.texture;
  scene.fog = new THREE.Fog(skyColours(dark()).bottom, radius * 1.4, radius * 6);
  scene.add(new THREE.HemisphereLight('#BFD4FF', '#20242C', 0.9));
  const sun = new THREE.DirectionalLight('#FFE8CC', 1.1);
  sun.position.set(cx + radius, radius * 1.5, cz + radius * 0.6);
  sun.target.position.set(cx, 0, cz);
  scene.add(sun, sun.target);
  // Desktop shadows: one directional light whose shadow box covers the city on the map and a patch around the taxi in the chase.
  const SUN_OFFSET = [radius, radius * 1.5, radius * 0.6];
  let shadowFocus = null;
  const focusShadow = (chaseOn, x = cx, z = cz) => {
    if (phone) return;
    const cam = sun.shadow.camera, half = chaseOn ? 160 : radius, k = chaseOn ? 300 / Math.hypot(...SUN_OFFSET) : 1;
    sun.target.position.set(x, 0, z);
    sun.position.set(x + SUN_OFFSET[0] * k, SUN_OFFSET[1] * k, z + SUN_OFFSET[2] * k);
    if (shadowFocus !== chaseOn) {
      Object.assign(cam, { left: -half, right: half, top: half, bottom: -half, near: 1, far: chaseOn ? 700 : radius * 4 });
      cam.updateProjectionMatrix();
      shadowFocus = chaseOn;
    }
  };
  if (!phone) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6;
    focusShadow(false);
  }

  scene.add(meshOf(new THREE.PlaneGeometry(radius * 12, radius * 12).rotateX(-Math.PI / 2).translate(cx, -0.5, cz), mats.ground, { receive: true }));
  scene.add(meshOf(geoOf(buildFlats(city.water ?? [], 0.2)), mats.water));
  scene.add(meshOf(geoOf(buildFlats(city.parks ?? [], 0.4)), mats.park));
  scene.add(meshOf(geoOf(buildRoadStrips(city.paths ?? [], 0.6)), mats.walk));
  scene.add(meshOf(geoOf(buildRoadStrips(city.roads ?? [], 0.8)), mats.road, { receive: true }));
  scene.add(meshOf(geoOf(buildLaneMarks(city.roads ?? [], 1.0)), mats.mark));
  scene.add(meshOf(geoOf(buildBuildings(city.buildings ?? [])), mats.building, { cast: true, receive: true }));
  const windows = addWindows(mats.building, { phone, glow: dark() ? 1 : 0.35 });

  // Instanced trees: one cone each, shared geometry.
  const pos = treePositions(city.parks ?? [], TREE_SEED);
  let trees = null, hiddenTrees = [];
  const treeMat = new THREE.Matrix4(), treeOff = new THREE.Matrix4().makeScale(0, 0, 0);
  const placeTree = (i, on) => trees.setMatrixAt(i, on ? treeMat.setPosition(pos[i * 3], 0.4, pos[i * 3 + 2]) : treeOff);
  // In the chase, trees near the camera or on its line to the taxi are scaled to nothing so they never block the view.
  const clearTrees = (cam, taxiAt) => {
    if (!trees) return;
    const next = cam ? treesToHide(pos, cam, taxiAt) : [];
    if (next.length === hiddenTrees.length && next.every((v, k) => v === hiddenTrees[k])) return;
    for (const i of hiddenTrees) placeTree(i, true);
    for (const i of next) placeTree(i, false);
    hiddenTrees = next; trees.instanceMatrix.needsUpdate = true;
  };
  if (pos.length) {
    trees = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 8, 6).translate(0, 4, 0), mats.leaf, pos.length / 3);
    for (let i = 0; i < pos.length / 3; i++) placeTree(i, true);
    scene.add(trees);
  }

  // Pickup and drop-off: a pin over a coloured pad, centred on the grid cell.
  const heads = [], pins = [];
  for (const rc of [city.pickup, city.dropoff]) {
    if (!rc) continue;
    const [x, z] = cellCentre(rc[0], rc[1], city);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(city.cellM * 1.2, city.cellM * 1.2, 0.3, 24), mats.pad);
    pad.position.set(0, 0, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 30, 8), mats.pin);
    stem.position.set(0, 13.6, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 10), mats.pin);
    head.position.set(0, 32.6, 0);
    const pin = new THREE.Group(); // scaled down in the chase so it is street-sized, not tower-sized
    pin.position.set(x, 1.4, z); pin.add(pad, stem, head);
    scene.add(pin); pins.push(pin);
    heads.push(head);
  }

  // Traffic lights: a post and one lamp at the corner of each signal cell, showing only the taxi's own direction of travel.
  const signals = city.signals ?? [];
  const world = loadWorld(city);
  const GREEN = '#22C55E', RED = '#EF4444';
  mats.post = new THREE.MeshStandardMaterial({ color: '#8A93A3', roughness: 0.8 });
  mats.lamp = new THREE.MeshBasicMaterial({ color: GREEN });
  if (signals.length) {
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.7, 12, 6).translate(0, 6, 0), mats.post, signals.length);
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(1.8, 10, 8), mats.lamp, signals.length);
    const m = new THREE.Matrix4();
    signals.forEach(([c, r], i) => {
      const { x, z } = signalCorners(world, r * city.cols + c, city.cellM);
      posts.setMatrixAt(i, m.setPosition(x, 0.8, z));
      lamps.setMatrixAt(i, m.setPosition(x, 13, z));
    });
    scene.add(posts, lamps);
  }
  const lampCell = signals.length ? signals[0][1] * city.cols + signals[0][0] : -1;
  let shownLamp = '';
  // The lamp colour is signalState for the taxi's heading (all signals share one phase). True if it changed.
  const setLights = (tick, heading = Math.PI) => {
    const state = lampCell < 0 ? 'go' : signalState(world, lampCell, heading, tick);
    if (state === shownLamp) return false;
    shownLamp = state;
    mats.lamp.color.set(state === 'stop' ? RED : GREEN);
    return true;
  };
  setLights(0);

  // Heat: one vertex-coloured mesh over road, footpath and park cells, additive so unvisited cells stay invisible.
  const startCell = city.pickup[1] * city.cols + city.pickup[0];
  const heatCells = [];
  for (let r = 0; r < city.rows; r++) for (let c = 0; c < city.cols; c++) if ('rfp'.includes(city.kind[r][c])) heatCells.push([c, r]);
  const hPos = new Float32Array(heatCells.length * 12), hCol = new Float32Array(heatCells.length * 12), hIdx = new Uint32Array(heatCells.length * 6);
  const half = city.cellM / 2;
  heatCells.forEach(([c, r], i) => {
    const [x, z] = cellCentre(c, r, city);
    hPos.set([x - half, 1.2, z - half, x + half, 1.2, z - half, x + half, 1.2, z + half, x - half, 1.2, z + half], i * 12);
    hIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  const heatGeo = new THREE.BufferGeometry();
  heatGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
  heatGeo.setAttribute('color', new THREE.BufferAttribute(hCol, 3));
  heatGeo.setIndex(new THREE.BufferAttribute(hIdx, 1));
  mats.heat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const heatMesh = new THREE.Mesh(heatGeo, mats.heat);
  heatMesh.frustumCulled = false; heatMesh.renderOrder = 1;
  scene.add(heatMesh);

  // Taxi and trail materials (their geometry is made per route and disposed in clearRoute).
  const taxiMaker = createTaxiMaker();
  mats.trail = new THREE.LineBasicMaterial({ color: '#5BC0EB' });

  const camera = new THREE.PerspectiveCamera(38, 1.6, radius * 0.05, radius * 10);
  const view = { yaw: 0.6, pitch: 0.95, dist: radius * 1.25 };
  let queued = 0, dead = false;
  let chase = false, taxi = null, trail = null, trailPts = null, play = null, mapView = false;

  // Landmark labels: DOM text projected each render, hidden when behind the camera or off the stage.
  const labels = (city.landmarks ?? []).map((l) => {
    const span = document.createElement('span'); span.textContent = l.name;
    if (labelEl) labelEl.append(span);
    return { span, v: new THREE.Vector3(l.x, 45, -l.y) };
  });
  const tmp = new THREE.Vector3();
  const placeLabels = () => {
    if (!labelEl || !labels.length) return;
    const cr = canvas.getBoundingClientRect(), br = labelEl.getBoundingClientRect();
    for (const { span, v } of labels) {
      tmp.copy(v).project(camera);
      const hide = tmp.z > 1 || Math.abs(tmp.x) > 1 || Math.abs(tmp.y) > 1;
      span.style.display = hide ? 'none' : '';
      if (hide) continue;
      const x = cr.left - br.left + (tmp.x * 0.5 + 0.5) * cr.width, y = cr.top - br.top + (0.5 - tmp.y * 0.5) * cr.height;
      span.style.transform = `translate(${x}px, ${y}px) translate(-50%, -120%)`;
    }
  };

  // The camera: the orbit view you drag, or the director's shot while a trip plays (map, swoop, chase, pullback).
  const orbitShot = () => {
    const cp = Math.cos(view.pitch);
    return { pos: [cx + Math.sin(view.yaw) * cp * view.dist, Math.sin(view.pitch) * view.dist, cz + Math.cos(view.yaw) * cp * view.dist], target: [cx, 0, cz], fov: 38 };
  };
  const renderNow = () => {
    if (dead) return;
    const mapShot = orbitShot();
    const shot = play && play.phase !== 'map' && !mapView
      ? shotAt(play.phase, play.t, mapShot, { ...chaseCamera(play.state, CHASE), fov: 55 })
      : mapShot;
    const phase = play ? play.phase : 'map';
    const near = phase !== 'map' ? 2 : radius * 0.05;
    Object.assign(scene.fog, fogFor(1 - heatOpacity(phase, play ? play.t : 0), radius, phone)); // the same 0..1 curve as the heat fade
    mats.heat.opacity = play ? heatOpacity(phase, play.t) : 1; // the heat is for the map; it fades out in the chase
    if (play && taxi) focusShadow(phase !== 'map', taxi.position.x, taxi.position.z);
    else focusShadow(false);
    if (camera.fov !== shot.fov || camera.near !== near) { camera.fov = shot.fov; camera.near = near; camera.updateProjectionMatrix(); }
    for (const p of pins) p.scale.setScalar(phase === 'chase' ? 0.15 : phase === 'map' ? 1 : phase === 'swoop' ? 1 - 0.85 * Math.min(1, play.t / SWOOP_MS) : 0.15 + 0.85 * Math.min(1, play.t / PULLBACK_MS));
    clearTrees(play && phase !== 'map' ? [shot.pos[0], shot.pos[2]] : null, play && taxi ? [taxi.position.x, taxi.position.z] : null);
    camera.position.set(...shot.pos);
    camera.lookAt(...shot.target);
    renderer.render(scene, camera);
    placeLabels();
  };
  const render = () => { queued = 0; renderNow(); };
  const draw = () => { if (!queued && !dead) queued = requestAnimationFrame(render); };

  const resize = () => {
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    draw();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  // Drag to turn (one pointer), pinch and wheel to zoom.
  const pointers = new Map();
  let pinch = 0, engaged = false;
  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const zoom = (f) => { view.dist = clampDistance(view.dist * f, radius); draw(); };
  const chaseOff = () => { if (!chase) return; chase = false; onChaseOff?.(); };
  const down = (e) => {
    chaseOff();
    engaged = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 2) pinch = spread();
  };
  const move = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      view.yaw -= dx * 0.008;
      if (e.pointerType !== 'touch') view.pitch = clampPitch(view.pitch + dy * 0.005); // touch keeps vertical drags for page scroll
      draw();
    } else if (pointers.size === 2) {
      const s = spread();
      if (pinch > 0 && s > 0) zoom(pinch / s);
      pinch = s;
    }
  };
  const up = (e) => { pointers.delete(e.pointerId); pinch = 0; };
  // The wheel zooms only for a trackpad pinch (ctrl) or once the stage is engaged; otherwise the page scrolls.
  const wheel = (e) => { if (!e.ctrlKey && !engaged) return; e.preventDefault(); zoom(Math.exp(e.deltaY * 0.001)); };
  const disengage = () => { engaged = false; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('pointerleave', disengage);
  window.addEventListener('blur', disengage);

  // The light/dark lamp changes data-theme: recolour the sky and pads (cheap) and draw once.
  const recolour = () => {
    const c = readColors(getComputedStyle(document.documentElement));
    const sc = skyColours(dark());
    sky.repaint(sc); scene.fog.color.set(sc.bottom); windows.setGlow(dark() ? 1 : 0.35); mats.pad.color.set(c.accent);
    draw();
  };
  const mo = new MutationObserver(recolour);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => { if (!document.documentElement.dataset.theme) recolour(); };
  scheme.addEventListener('change', onScheme);

  resize();

  // Heat: applied at most every 100 ms; the newest visits wait for the next slot.
  let heatAt = 0, heatTimer = 0, heatLatest = null;
  const applyHeat = () => {
    heatTimer = 0; heatAt = performance.now();
    const v = heatLatest; heatLatest = null;
    if (!v || dead) return;
    let max = 0; // the pickup cell is every episode's start, so it is left out of the scale
    v.forEach((n, i) => { if (i !== startCell && n > max) max = n; });
    heatCells.forEach(([c, r], i) => {
      const col = heatColour(v[r * city.cols + c] || 0, max);
      for (let k = 0; k < 4; k++) hCol.set(col, i * 12 + k * 3);
    });
    heatGeo.attributes.color.needsUpdate = true;
    draw();
  };

  // Playback: its own rAF loop, alive only while a trip plays. Each frame asks drive.js for the taxi and director.js for the camera.
  let loopId = 0;
  const finish = () => { const p = play; play = null; if (p && p.onDone) p.onDone(); }; // exactly once per trip
  const place = (st) => {
    const frames = play.track.frames, k = Math.min(st.stepIndex, frames.length - 1);
    taxi.position.set(st.x, 1, st.z); taxi.rotation.y = st.heading;
    taxiMaker.setBraking(st.braking);
    trailPts.set([frames[k].x, 1.4, frames[k].z], k * 3); // the point just left snaps back to its cell
    trailPts.set([st.x, 1.4, st.z], (k + 1) * 3); // the trail's last point rides with the taxi
    trail.geometry.setDrawRange(0, k + 2);
    trail.geometry.attributes.position.needsUpdate = true;
    play.state = st;
    setLights(st.tick, st.facing); // the lamp follows the move being made, not the eased heading
  };
  // Where the taxi is on screen, in the label layer's pixels, so the tags can pop up beside it.
  const taxiScreen = () => {
    if (!labelEl || !taxi) return null;
    tmp.set(taxi.position.x, 6, taxi.position.z).project(camera);
    if (tmp.z > 1) return null;
    const cr = canvas.getBoundingClientRect(), br = labelEl.getBoundingClientRect();
    return { x: cr.left - br.left + (tmp.x * 0.5 + 0.5) * cr.width, y: cr.top - br.top + (0.5 - tmp.y * 0.5) * cr.height };
  };
  const tickLoop = (now) => {
    loopId = 0;
    if (dead || !play) return;
    const intro = play.swoop ? SWOOP_MS : 0;
    const elapsed = now - play.t0;
    const { phase, t } = timeline(play.track.total, elapsed, { swoop: play.swoop });
    const st = stateAt(play.track, Math.max(0, elapsed - intro));
    place(st); play.phase = phase; play.t = t;
    if (motionAllowed()) heads.forEach((h, i) => { h.position.y = 32.6 + Math.sin(now / 300 + i) * 2; });
    renderNow();
    play.onFrame?.(st, taxiScreen()); // the last frame (already 'map' when there is no pullback) still carries the fare tag
    if (phase === 'map') { finish(); return; }
    loopId = requestAnimationFrame(tickLoop);
  };
  const stopRoute = () => {
    if (loopId) cancelAnimationFrame(loopId);
    loopId = 0;
    finish();
    if (taxi) { scene.remove(taxi); taxi.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); taxi = null; }
    if (trail) { scene.remove(trail); trail.geometry.dispose(); trail = null; }
  };

  // Idle: the lights follow a slow clock (not under reduced motion).
  const clock = setInterval(() => {
    if (play || dead || document.hidden || !motionAllowed()) return;
    if (setLights(Math.floor(performance.now() / 1500))) draw();
  }, 500);

  const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = () => { if (!motionAllowed()) chaseOff(); };
  motionMq.addEventListener('change', onMotion);

  return {
    ready: true,
    setHeat(visits) {
      heatLatest = visits;
      const wait = 100 - (performance.now() - heatAt);
      if (wait <= 0) { if (heatTimer) clearTimeout(heatTimer); applyHeat(); } else if (!heatTimer) heatTimer = setTimeout(applyHeat, wait);
    },
    // track: drive.js driveTrack; events: events.js tripEvents (the page reads those; the stage only needs the track).
    playTrip({ track, onFrame, onDone } = {}) {
      stopRoute();
      const frames = track.frames;
      taxi = taxiMaker.make();
      taxi.traverse((o) => { o.castShadow = true; });
      trailPts = new Float32Array((frames.length + 1) * 3);
      frames.forEach((f, i) => trailPts.set([f.x, 1.4, f.z], i * 3));
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(trailPts, 3));
      trail = new THREE.Line(tg, mats.trail); trail.frustumCulled = false;
      scene.add(taxi, trail);
      play = { track, onFrame, onDone, state: stateAt(track, 0), phase: 'map', t: 0, swoop: !chase };
      if (!motionAllowed()) { // no animation: the end state with the whole trail and the final numbers
        const end = stateAt(track, track.total);
        place({ ...end, stepIndex: frames.length - 2 }); // place() draws the trail to stepIndex + 1, the last point, and the taxi at its end position
        tg.setDrawRange(0, frames.length);
        draw();
        onFrame?.(end, null);
        finish();
        return;
      }
      play.t0 = performance.now();
      loopId = requestAnimationFrame(tickLoop);
    },
    // Skip to the end of the drive: the taxi jumps to its last tile and the camera pulls back.
    skipTrip() { if (play) play.t0 = performance.now() - (play.swoop ? SWOOP_MS : 0) - play.track.total; },
    // The Map view toggle: the high map camera while the taxi drives, instead of the chase.
    setMapView(on) { mapView = !!on; if (!play) draw(); },
    clearRoute() { stopRoute(); draw(); },
    setChase(on) { chase = !!on && motionAllowed(); }, // on: a trip starts in the chase view, with no swoop in or out
    setShot(name) { chase = name === 'chase' && motionAllowed(); },
    destroy() {
      dead = true; if (queued) cancelAnimationFrame(queued);
      stopRoute(); taxiMaker.dispose(); windows.dispose(); sky.texture.dispose(); clearInterval(clock); motionMq.removeEventListener('change', onMotion); if (heatTimer) clearTimeout(heatTimer);
      for (const { span } of labels) span.remove();
      ro.disconnect(); mo.disconnect(); scheme.removeEventListener('change', onScheme);
      window.removeEventListener('blur', disengage);
      for (const [type, fn] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['wheel', wheel], ['pointerleave', disengage]]) canvas.removeEventListener(type, fn);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of Object.values(mats)) m.dispose();
      renderer.dispose(); canvas.remove();
    },
  };
}
