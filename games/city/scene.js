// The 3D city: browser glue between geometry.js and three.js. Renders on demand (after a drag, wheel or resize).
import * as THREE from './vendor/three.module.min.js';
import { buildBuildings, buildRoadStrips, buildLaneMarks, buildFlats, treePositions, cityBounds, cellCentre } from './geometry.js';
import { clampPitch, clampDistance, readColors } from './scene-math.js';
import { motionAllowed, routeFrames, frameAt, lightPhase, chaseCamera, heatColour, TICK_MS } from './playback.js';

export const isPhone = () => !!(globalThis.matchMedia && matchMedia('(pointer: coarse)').matches);

const TREE_SEED = 7;

function meshOf(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
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
  try { return build(el, city, renderer, !!opts.phone, opts.labels ?? null); } catch (e) {
    renderer.dispose(); renderer.domElement.remove();
    throw e;
  }
}

function build(el, city, renderer, phone, labelEl) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.shadowMap.enabled = false;
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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.sky);
  scene.fog = new THREE.Fog(colors.sky, radius * 2.5, radius * 6);
  scene.add(new THREE.HemisphereLight('#BFD4FF', '#20242C', 0.9));
  const sun = new THREE.DirectionalLight('#FFE8CC', 1.1);
  sun.position.set(cx + radius, radius * 1.5, cz + radius * 0.6);
  sun.target.position.set(cx, 0, cz);
  scene.add(sun, sun.target);

  scene.add(meshOf(new THREE.PlaneGeometry(radius * 12, radius * 12).rotateX(-Math.PI / 2).translate(cx, -0.5, cz), mats.ground));
  scene.add(meshOf(geoOf(buildFlats(city.water ?? [], 0.2)), mats.water));
  scene.add(meshOf(geoOf(buildFlats(city.parks ?? [], 0.4)), mats.park));
  scene.add(meshOf(geoOf(buildRoadStrips(city.paths ?? [], 0.6)), mats.walk));
  scene.add(meshOf(geoOf(buildRoadStrips(city.roads ?? [], 0.8)), mats.road));
  scene.add(meshOf(geoOf(buildLaneMarks(city.roads ?? [], 1.0)), mats.mark));
  scene.add(meshOf(geoOf(buildBuildings(city.buildings ?? [])), mats.building));

  // Instanced trees: one cone each, shared geometry.
  const pos = treePositions(city.parks ?? [], TREE_SEED);
  if (pos.length) {
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 8, 6).translate(0, 4, 0), mats.leaf, pos.length / 3);
    const m = new THREE.Matrix4();
    for (let i = 0; i < pos.length / 3; i++) trees.setMatrixAt(i, m.setPosition(pos[i * 3], 0.4, pos[i * 3 + 2]));
    scene.add(trees);
  }

  // Pickup and drop-off: a pin over a coloured pad, centred on the grid cell.
  const heads = [];
  for (const rc of [city.pickup, city.dropoff]) {
    if (!rc) continue;
    const [x, z] = cellCentre(rc[0], rc[1], city);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(city.cellM * 1.2, city.cellM * 1.2, 0.3, 24), mats.pad);
    pad.position.set(x, 1.4, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 30, 8), mats.pin);
    stem.position.set(x, 15, z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 10), mats.pin);
    head.position.set(x, 34, z);
    scene.add(pad, stem, head);
    heads.push(head);
  }

  // Traffic lights: a post with two lamps per signal cell (north-south and east-west), recoloured by phase.
  const signals = city.signals ?? [];
  const lightWorld = { period: city.lightPeriod ?? 8 };
  const GREEN = '#22C55E', RED = '#EF4444';
  mats.post = new THREE.MeshStandardMaterial({ color: '#8A93A3', roughness: 0.8 });
  mats.lampNS = new THREE.MeshBasicMaterial({ color: GREEN });
  mats.lampEW = new THREE.MeshBasicMaterial({ color: RED });
  if (signals.length) {
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.7, 12, 6).translate(0, 6, 0), mats.post, signals.length);
    const lampGeo = new THREE.SphereGeometry(1.4, 10, 8);
    const ns = new THREE.InstancedMesh(lampGeo, mats.lampNS, signals.length);
    const ew = new THREE.InstancedMesh(lampGeo, mats.lampEW, signals.length);
    const m = new THREE.Matrix4();
    signals.forEach(([c, r], i) => {
      const [x, z] = cellCentre(c, r, city);
      posts.setMatrixAt(i, m.setPosition(x, 0.8, z));
      ns.setMatrixAt(i, m.setPosition(x - 3, 14, z));
      ew.setMatrixAt(i, m.setPosition(x + 3, 14, z));
    });
    scene.add(posts, ns, ew);
  }
  let shownPhase = -1;
  // Phase 0: east-west red, north-south green; phase 1 the other way (same as sim.js lightRed). True if it changed.
  const setLights = (tick) => {
    const phase = lightPhase(lightWorld, tick);
    if (phase === shownPhase) return false;
    shownPhase = phase;
    mats.lampNS.color.set(phase === 1 ? RED : GREEN);
    mats.lampEW.color.set(phase === 0 ? RED : GREEN);
    return true;
  };
  setLights(0);

  // Heat: one vertex-coloured mesh over road, footpath and park cells, additive so unvisited cells stay invisible.
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
  mats.taxi = new THREE.MeshStandardMaterial({ color: '#FF5A1F', roughness: 0.6 });
  mats.cab = new THREE.MeshStandardMaterial({ color: '#FF8A57', roughness: 0.6 });
  mats.sign = new THREE.MeshBasicMaterial({ color: '#FACC15' });
  mats.trail = new THREE.LineBasicMaterial({ color: '#FF5A1F' });

  const camera = new THREE.PerspectiveCamera(38, 1.6, radius * 0.05, radius * 10);
  const view = { yaw: 0.6, pitch: 0.95, dist: radius * 1.25 };
  let queued = 0, dead = false;
  let chase = false, chaseFresh = true, taxi = null, trail = null, trailPts = null, curFrame = null;
  const chasePos = new THREE.Vector3(), want = new THREE.Vector3();

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

  const renderNow = () => {
    if (dead) return;
    if (chase && curFrame) {
      const { pos, target } = chaseCamera(curFrame, { back: 40, up: 26 });
      want.set(pos[0], pos[1], pos[2]);
      if (chaseFresh) { chasePos.copy(want); chaseFresh = false; } else chasePos.lerp(want, 0.2);
      camera.position.copy(chasePos);
      camera.lookAt(target[0], target[1], target[2]);
    } else {
      const cp = Math.cos(view.pitch);
      camera.position.set(cx + Math.sin(view.yaw) * cp * view.dist, Math.sin(view.pitch) * view.dist, cz + Math.cos(view.yaw) * cp * view.dist);
      camera.lookAt(cx, 0, cz);
    }
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
  const down = (e) => {
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
    scene.background.set(c.sky); scene.fog.color.set(c.sky); mats.pad.color.set(c.accent);
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
    let max = 0;
    for (const n of v) if (n > max) max = n;
    const k = 0.8; // linear, so only the busy corridors glow
    heatCells.forEach(([c, r], i) => {
      const col = heatColour((v[r * city.cols + c] || 0) * k, max);
      for (let k = 0; k < 4; k++) hCol.set(col, i * 12 + k * 3);
    });
    heatGeo.attributes.color.needsUpdate = true;
    draw();
  };

  // Playback: its own rAF loop, alive only while a route plays.
  let play = null, loopId = 0;
  const finish = () => { const p = play; play = null; if (p && p.onDone) p.onDone(); }; // exactly once per route
  const place = (f) => {
    curFrame = f;
    taxi.position.set(f.x, 1.5, f.z); taxi.rotation.y = f.heading;
    const here = play.frames[f.tick];
    trailPts.set([here.x, 2.5, here.z], f.tick * 3); // the point just left snaps back to its cell
    trailPts.set([f.x, 2.5, f.z], (f.tick + 1) * 3); // the trail's last point rides with the taxi
    trail.geometry.setDrawRange(0, f.tick + 2);
    trail.geometry.attributes.position.needsUpdate = true;
  };
  const tickLoop = (now) => {
    loopId = 0;
    if (dead || !play) return;
    const f = frameAt(play.frames, now - play.t0, TICK_MS);
    place(f); setLights(f.tick);
    if (motionAllowed()) heads.forEach((h, i) => { h.position.y = 34 + Math.sin(now / 300 + i) * 2; });
    renderNow();
    if (f.done) { chaseFresh = true; renderNow(); finish(); return; }
    loopId = requestAnimationFrame(tickLoop);
  };
  const stopRoute = () => {
    if (loopId) cancelAnimationFrame(loopId);
    loopId = 0;
    finish();
    if (taxi) { scene.remove(taxi); taxi.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); taxi = null; }
    if (trail) { scene.remove(trail); trail.geometry.dispose(); trail = null; }
    curFrame = null; chaseFresh = true;
  };

  // Idle: the lights follow a slow clock (not under reduced motion).
  const clock = setInterval(() => {
    if (play || dead || document.hidden || !motionAllowed()) return;
    if (setLights(Math.floor(performance.now() / 1500))) draw();
  }, 500);

  return {
    ready: true,
    setHeat(visits) {
      heatLatest = visits;
      const wait = 100 - (performance.now() - heatAt);
      if (wait <= 0) { if (heatTimer) clearTimeout(heatTimer); applyHeat(); } else if (!heatTimer) heatTimer = setTimeout(applyHeat, wait);
    },
    showRoute(route, analysis, { onDone } = {}) {
      stopRoute();
      const frames = routeFrames({ cols: city.cols, rows: city.rows }, city.cellM, route);
      taxi = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 7.5), mats.taxi); body.position.y = 1;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.5, 3.6), mats.cab); cab.position.set(0, 2.6, -0.4);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.8), mats.sign); sign.position.set(0, 3.6, -0.4);
      taxi.add(body, cab, sign); taxi.scale.setScalar(2.5);
      trailPts = new Float32Array((frames.length + 1) * 3);
      frames.forEach((f, i) => trailPts.set([f.x, 2.5, f.z], i * 3));
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(trailPts, 3));
      trail = new THREE.Line(tg, mats.trail); trail.frustumCulled = false;
      scene.add(taxi, trail);
      play = { frames, onDone };
      if (!motionAllowed()) { // no animation: the end state with the whole trail
        const last = frames[frames.length - 1];
        place({ ...last, tick: frames.length - 1 });
        tg.setDrawRange(0, frames.length);
        setLights(last.tick); draw();
        finish();
        return;
      }
      play.t0 = performance.now();
      loopId = requestAnimationFrame(tickLoop);
    },
    clearRoute() { stopRoute(); draw(); },
    setChase(on) {
      chase = !!on && motionAllowed(); chaseFresh = true;
      camera.near = chase ? 2 : radius * 0.05; camera.updateProjectionMatrix();
      draw();
    },
    destroy() {
      dead = true; if (queued) cancelAnimationFrame(queued);
      stopRoute(); clearInterval(clock); if (heatTimer) clearTimeout(heatTimer);
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
