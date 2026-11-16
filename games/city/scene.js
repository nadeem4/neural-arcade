// The 3D city: browser glue between geometry.js and three.js. Renders on demand (after a drag, wheel or resize).
import * as THREE from './vendor/three.module.min.js';
import { buildBuildings, buildRoadStrips, buildLaneMarks, buildFlats, treePositions, cityBounds, cellCentre } from './geometry.js';
import { clampPitch, clampDistance, readColors } from './scene-math.js';

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
  try { return build(el, city, renderer, !!opts.phone); } catch (e) {
    renderer.dispose(); renderer.domElement.remove();
    throw e;
  }
}

function build(el, city, renderer, phone) {
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
  }

  const camera = new THREE.PerspectiveCamera(38, 1.6, radius * 0.05, radius * 10);
  const view = { yaw: 0.6, pitch: 0.95, dist: radius * 1.25 };
  let queued = 0, dead = false;
  const render = () => {
    queued = 0;
    if (dead) return;
    const cp = Math.cos(view.pitch);
    camera.position.set(cx + Math.sin(view.yaw) * cp * view.dist, Math.sin(view.pitch) * view.dist, cz + Math.cos(view.yaw) * cp * view.dist);
    camera.lookAt(cx, 0, cz);
    renderer.render(scene, camera);
  };
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

  return {
    ready: true,
    setHeat() {},
    showRoute(route, analysis, { onDone } = {}) { if (onDone) onDone(); },
    clearRoute() {},
    setChase() {},
    destroy() {
      dead = true; if (queued) cancelAnimationFrame(queued);
      ro.disconnect(); mo.disconnect(); scheme.removeEventListener('change', onScheme);
      window.removeEventListener('blur', disengage);
      for (const [type, fn] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['wheel', wheel], ['pointerleave', disengage]]) canvas.removeEventListener(type, fn);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of Object.values(mats)) m.dispose();
      renderer.dispose(); canvas.remove();
    },
  };
}
