// The 3D city: browser glue between geometry.js and three.js. Renders on demand (after a drag, wheel or resize).
import * as THREE from './vendor/three.module.min.js';
import { buildBuildings, buildRoadStrips, buildFlats, cityBounds, cellCentre } from './geometry.js';
import { clampPitch, clampDistance, cameraFar, readColors, clipEased, roofAt, wallPush, cellHeights, pinFade, insetOffset, fitDistance, heatQuad, treesToHide, chaseForAspect, ROAD_Y } from './scene-math.js';
import { motionAllowed, chaseCamera, heatColour } from './playback.js';
import { stateAt } from './drive.js';
import { shotAt, timeline, raceShot, overheadShot, SWOOP_MS, PULLBACK_MS } from './director.js';
import { cutAt } from './cuts.js';
import { offencesWithin } from './record.js';
import { raceStateAt, TINTS } from './race.js';
import { loadWorld } from './sim.js';
import { headState } from './signals.js';
import { buildAsphalt, buildRoadMarks, buildCrosswalks, buildRaisedWalks, buildStopLines, clipWalks } from './street-model.js';
import { buildSignalHeads, paintLamps, hideHeads } from './signal-heads.js';
import { createGlow, lampCentres, signalGlow } from './glow.js';
import { skyColours, fogFor, heatOpacity, sunPlacement } from './sky.js';
import { createSky, lightRig, EXPOSURE, ENV_INTENSITY, ENV_GROUND, WINDOW_GLOW } from './scene-look.js';
import { tierFor, furnitureTier, narrowScreen } from './quality.js';
import { buildFurniture } from './scene-furniture.js';
import { applyFacade, buildingGeometry } from './facade.js';
import { createTaxiMaker, TAXI_SCALE, TAXI_Y } from './scene-taxi.js';
import { createTrafficLayer } from './scene-traffic.js';
import { trafficTier } from './traffic.js';
import { createPeopleLayer } from './scene-people.js';
import { createHighlights } from './scene-highlights.js';
import { highlightsAt } from './highlights.js';

export const isPhone = () => !!(globalThis.matchMedia && matchMedia('(pointer: coarse)').matches);

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
  try { return build(el, city, renderer, !!opts.phone, opts.labels ?? null, opts.onChaseOff, !!opts.manualClock); } catch (e) {
    renderer.dispose(); renderer.domElement.remove();
    throw e;
  }
}

function build(el, city, renderer, phone, labelEl, onChaseOff, manualClock) {
  const tier = tierFor({ phone, reducedMotion: !motionAllowed() });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier.pixelRatio));
  renderer.shadowMap.enabled = true; // both tiers have shadows; phones a smaller map with the cheaper filter
  renderer.shadowMap.type = tier.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = EXPOSURE;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  el.replaceChildren(canvas);

  const { cx, cz, radius } = cityBounds(city);
  const colors = readColors(getComputedStyle(document.documentElement));
  const mats = {};
  for (const key of ['road', 'walk', 'park', 'water', 'building', 'ground', 'farGround']) {
    mats[key] = new THREE.MeshStandardMaterial({ color: colors[key], roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: ['road', 'walk', 'park', 'ground', 'farGround'].includes(key) ? ENV_GROUND : ENV_INTENSITY });
  }
  mats.building.side = THREE.FrontSide; // so the chase cam sees through a wall it passes
  mats.mark = new THREE.MeshBasicMaterial({ color: colors.mark, side: THREE.DoubleSide });
  mats.centre = new THREE.MeshBasicMaterial({ color: colors.centre, side: THREE.DoubleSide });
  mats.pin = new THREE.MeshStandardMaterial({ color: colors.pin, emissive: colors.pin, emissiveIntensity: 0.5, envMapIntensity: ENV_INTENSITY });
  mats.pad = new THREE.MeshBasicMaterial({ color: colors.accent });

  const sky = createSky({ radius, cx, cz, cloudCount: tier.cloudCount });
  const scene = new THREE.Scene();
  scene.add(sky.group);
  const envTarget = sky.environment(renderer);
  scene.environment = envTarget.texture;
  scene.fog = new THREE.Fog(skyColours().haze);
  const sun = lightRig(scene, tier);
  // One directional light: the same direction on the map and in the chase; its shadow box covers the city on the map and a patch around the taxi in the chase.
  let shadowFocus = null;
  const focusShadow = (chaseOn, x = cx, z = cz) => {
    const p = sunPlacement({ chase: chaseOn, radius, cx, cz, x, z }), cam = sun.shadow.camera;
    sun.target.position.set(...p.target);
    sun.position.set(...p.position);
    if (shadowFocus !== chaseOn) {
      Object.assign(cam, { left: -p.half, right: p.half, top: p.half, bottom: -p.half, near: 1, far: p.far });
      cam.updateProjectionMatrix();
      shadowFocus = chaseOn;
    }
  };
  focusShadow(false);

  scene.add(meshOf(new THREE.PlaneGeometry(radius * 12, radius * 12).rotateX(-Math.PI / 2).translate(cx, -3, cz), mats.farGround, { receive: true }));
  // The city's own footing (the grid's extent) is pale concrete; the land beyond it is darker, so the city has an edge and a horizon.
  scene.add(meshOf(new THREE.PlaneGeometry(city.cols * city.cellM, city.rows * city.cellM).rotateX(-Math.PI / 2).translate(city.cols * city.cellM / 2, -0.45, -city.rows * city.cellM / 2), mats.ground, { receive: true }));
  scene.add(meshOf(geoOf(buildFlats(city.water ?? [], 0.2)), mats.water));
  scene.add(meshOf(geoOf(buildFlats(city.parks ?? [], 0.4)), mats.park, { receive: true }));
  scene.add(meshOf(geoOf(buildRoadStrips(city.paths ?? [], 0.6)), mats.walk, { receive: true }));
  // The street, in few merged meshes: asphalt (the OSM roads at their real widths, plus a one-lane strip for any road cell they miss, so the taxi is never on bare ground),
  // raised sidewalks with kerbs, white marks (lane dashes, one-way arrows, zebra crossings, stop lines) and yellow centre lines.
  const marks = buildRoadMarks(city.roads ?? [], { dashes: tier.laneDashes, arrows: tier.arrows });
  const cross = buildCrosswalks(city.crossings ?? []), stops = buildStopLines(city.signalHeads ?? [], city.roads ?? []);
  const white = { positions: new Float32Array([...marks.white.positions, ...cross.positions, ...stops.positions]), indices: new Uint32Array([...marks.white.indices, ...Array.from(cross.indices, (i) => i + marks.white.positions.length / 3), ...Array.from(stops.indices, (i) => i + (marks.white.positions.length + cross.positions.length) / 3)]) };
  scene.add(meshOf(geoOf(buildAsphalt(city)), mats.road, { receive: true }));
  scene.add(meshOf(geoOf(buildRaisedWalks(clipWalks(city.sidewalks ?? [], city))), mats.walk, { receive: true }));
  scene.add(meshOf(geoOf(white), mats.mark));
  scene.add(meshOf(geoOf(marks.yellow), mats.centre));
  scene.add(meshOf(buildingGeometry(buildBuildings(city.buildings ?? [], { roofBoxes: tier.roofBoxes })), mats.building, { cast: true, receive: true }));
  applyFacade(mats.building, { detail: tier.facadeDetail, glow: WINDOW_GLOW });

  // Street lamps, OSM trees and the L (scene-furniture.js); in the chase it also clears trees off the camera's view.
  const furniture = buildFurniture({ scene, city, furnitureTier: furnitureTier({ phone }), glow: tier.bloom, leaf: colors.leaf, envIntensity: ENV_INTENSITY });
  const clearTrees = furniture.clearTrees;

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

  // Traffic signals: a real head (pole, arm, housing, three lamps on both faces) at each mapped signal. A head's lamps show the sim's own light for the road it
  // stands beside (headState), so a car that runs a red runs a red you can see. All the lamps are one mesh whose vertex colours are repainted when the lights change.
  const world = loadWorld(city);
  const trafficLayer = createTrafficLayer({ tier: trafficTier({ phone }) }); // other cars: scenery that reacts to the taxi, shown only while a trip plays
  scene.add(trafficLayer.group);
  world.height = cellHeights(city); // real building heights, for the camera clip
  const sig = buildSignalHeads(city.signalHeads ?? [], city.roads ?? []);
  mats.post = new THREE.MeshStandardMaterial({ color: '#7D838C', roughness: 0.7, metalness: 0.2, envMapIntensity: ENV_INTENSITY });
  mats.lamp = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  let lampGeo = null, bodyGeo = null;
  const sigFlat = new Float32Array(sig.heads.length * 3);
  sig.heads.forEach((h, i) => { sigFlat[i * 3] = h.x; sigFlat[i * 3 + 2] = h.z; });
  if (sig.lamps.list.length) {
    bodyGeo = geoOf(sig.body);
    scene.add(meshOf(bodyGeo, mats.post, { cast: true }));
    lampGeo = geoOf(sig.lamps);
    lampGeo.setAttribute('color', new THREE.BufferAttribute(sig.lamps.colors, 3));
    scene.add(meshOf(lampGeo, mats.lamp));
  }
  // Bloom (high tier): a soft dot over each lit signal lamp, following the same lights and the same hidden heads.
  const sigGlow = tier.bloom && sig.lamps.list.length ? createGlow(lampCentres(sig.lamps).map((c) => ({ ...c, r: 0, g: 0, b: 0 })), { size: 3 }) : null;
  let hiddenLamps = new Set();
  const paintGlow = () => { if (sigGlow) { signalGlow(sig.lamps, sigGlow.colours, hiddenLamps); sigGlow.refresh(); } };
  if (sigGlow) scene.add(sigGlow.points);
  let shownLamp = '';
  // The lamp colours follow the sim's light at this tick (all signals share one phase). True if they changed.
  const setLights = (tick) => {
    const states = { 0: headState(world, tick, 0), 1: headState(world, tick, 90) };
    const key = states[0] + states[1];
    if (key === shownLamp) return false;
    shownLamp = key;
    paintLamps(sig.lamps, states);
    paintGlow();
    if (lampGeo) lampGeo.attributes.color.needsUpdate = true;
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
    hPos.set(heatQuad(x, z, half), i * 12); // inset, so neighbours share no edge
    hIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  const heatGeo = new THREE.BufferGeometry();
  heatGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
  heatGeo.setAttribute('color', new THREE.BufferAttribute(hCol, 3));
  heatGeo.setIndex(new THREE.BufferAttribute(hIdx, 1));
  mats.heat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); // not tone mapped, so the heat stays as readable as its colours
  const heatMesh = new THREE.Mesh(heatGeo, mats.heat);
  heatMesh.frustumCulled = false; heatMesh.renderOrder = 1;
  scene.add(heatMesh);

  // Taxi and trail materials (their geometry is made per route and disposed in clearRoute).
  const taxiMaker = createTaxiMaker(null, { glow: tier.bloom });
  mats.trail = new THREE.LineBasicMaterial({ color: TINTS[0].route, toneMapped: false });
  mats.trailB = new THREE.LineBasicMaterial({ color: TINTS[1].route, toneMapped: false });
  const taxiMakerB = createTaxiMaker(TINTS[1], { glow: tier.bloom }); // the second car of a race, tinted pink

  const camera = new THREE.PerspectiveCamera(38, 1.6, radius * 0.05, cameraFar(radius));
  const view = { yaw: 0.6, pitch: 0.95, dist: radius * 1.25 };
  let queued = 0, dead = false;
  let cuts = []; // footage cam=auto: the overhead cuts (cuts.js), on the seek clock
  let chase = false, taxi = null, trail = null, trailPts = null, play = null, mapView = false;
  let taxiB = null, trailB = null, trailPtsB = null; // the second car of a race
  let peopleLayer = null; // the pedestrians of the trip on screen (scene-people.js)
  const highlights = createHighlights(scene, city.cellM); // the flash, ring and arrow at each recent offence, made once
  let raceTags = []; // two name tags over the cars (DOM, in the label layer), alive for a race
  const CUT_TAXI_SCALE = 2.5;
  const RACE_SCALE = 2.5; // both cars are drawn bigger in a race so they read from the high camera
  const clearRaceTags = () => { raceTags.forEach(s => s.remove()); raceTags = []; };

  // Landmark labels: DOM text projected each render, hidden when behind the camera or off the stage.
  const labels = (city.landmarks ?? []).map((l) => {
    const span = document.createElement('span'); span.textContent = l.name;
    if (labelEl) labelEl.append(span);
    return { span, v: new THREE.Vector3(l.x, 45, -l.y) };
  });
  const tmp = new THREE.Vector3(), corner = new THREE.Vector3(), taxiBox = new THREE.Box3();
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
  // The chase camera at drive time t (state: the state already worked out for that time, if any).
  const chaseAt = (t, state) => play.race
    ? (() => { const s = state ?? raceStateAt(play.race, t); return raceShot(s.cars[0].state, s.cars[1].state); })()
    : { ...chaseCamera(state ?? stateAt(play.track, t), chaseForAspect(camera.aspect)), fov: 55 };
  const renderNow = () => {
    if (dead) return;
    const mapShot = orbitShot();
    let shot = play && play.phase !== 'map' && !mapView
      ? shotAt(play.phase, play.t, mapShot, chaseAt(play.t, play.state), { reduced: !motionAllowed() })
      : mapShot;
    const phase = play ? play.phase : 'map';
    const cut = play && phase === 'chase' && !mapView ? cutAt(cuts, play.clock) : null;
    if (cut) { // an overhead cut: centred on the taxi at the cut's one height, nothing to clip
      shot = overheadShot([play.state.x, play.state.z], { aspect: camera.aspect, spread: cut.spread }); // one height for the whole cut
    }
    if (play && phase !== 'map' && !mapView && !cut) { // keep the camera out of buildings and above the road
      const clip = { margin: 2, minY: ROAD_Y + 2.7 };
      const line = (t) => { const s = chaseAt(t); return { pos: s.pos, target: [s.target[0], ROAD_Y, s.target[2]] }; }; // the chase camera and the taxi it looks at
      if (phase === 'chase') shot = { ...shot, pos: clipEased(line, play.t, world, city.cellM, clip).pos }; // the pull-in eased over +-0.5 s of the trip (a pure function of the trip time)
      else { // the swoop and pullback: the director's crane between the clipped chase pose at the chase boundary and the map shot, held over the roofs (never pulled toward the taxi)
        const bt = phase === 'swoop' ? 0 : play.driveMs, from = { ...chaseAt(bt), pos: clipEased(line, bt, world, city.cellM, clip).pos };
        shot = shotAt(phase, play.t, mapShot, from, { reduced: !motionAllowed(), roof: (x, z) => roofAt(world, city.cellM, x, z), ...(phase === 'pullback' && play.driveMs < play.track.total ? { push: (x, z, y) => wallPush(world, city.cellM, x, z, y) } : {}) }); // the sideways drift is only for a pull-back from a drive cut short (maxms)
      }
    }
    const near = phase !== 'map' ? 2 : radius * 0.05;
    const look = mapView || cut ? 'map' : phase; // the Map view toggle looks like the map: its fog and heat, not the chase's
    Object.assign(scene.fog, fogFor(1 - heatOpacity(look, play ? play.t : 0), radius, phone)); // the same 0..1 curve as the heat fade
    mats.heat.opacity = play ? heatOpacity(look, play.t) : 1; // the heat is for the map; it fades out in the chase
    if (play && taxi) focusShadow(phase !== 'map', taxi.position.x, taxi.position.z);
    else focusShadow(false);
    if (camera.fov !== shot.fov || camera.near !== near) { camera.fov = shot.fov; camera.near = near; camera.updateProjectionMatrix(); }
    for (const p of pins) { // street-sized in the chase, and faded out when the camera is right beside the pin so it never fills the lens
      const base = phase === 'chase' ? 0.15 : phase === 'map' ? 1 : phase === 'swoop' ? 1 - 0.85 * Math.min(1, play.t / SWOOP_MS) : 0.15 + 0.85 * Math.min(1, play.t / PULLBACK_MS);
      const fade = phase === 'map' ? 1 : pinFade(shot.pos, [p.position.x, ROAD_Y, p.position.z]);
      p.visible = fade > 0.01; p.scale.setScalar(base * Math.max(fade, 0.01));
    }
    const chaseCam = play && phase !== 'map' ? [shot.pos[0], shot.pos[2]] : null, taxiXZ = play && taxi ? [taxi.position.x, taxi.position.z] : null;
    clearTrees(chaseCam, taxiXZ);
    const hiddenHeads = chaseCam && taxiXZ ? treesToHide(sigFlat, chaseCam, taxiXZ, 12, 4) : [];
  if (bodyGeo && hideHeads(sig, hiddenHeads)) { bodyGeo.index.needsUpdate = true; lampGeo.index.needsUpdate = true; hiddenLamps = new Set(hiddenHeads.flatMap((i) => { const [a, b] = sig.heads[i].lamps; return Array.from({ length: (b - a) / 6 }, (_, k) => a / 6 + k); })); paintGlow(); } // signal poles between the camera and the taxi
    furniture.setOverhead(!!cut); // from straight above the L deck, its trains and the tree crowns would hide the taxi
    if (play) play.overhead = cut ? { clear: 2.1 * TAXI_SCALE * CUT_TAXI_SCALE * (canvas.clientHeight / (2 * shot.pos[1] * Math.tan((shot.fov * Math.PI) / 360))) + 6 } : null; // the drawn taxi's half length in pixels: tags stay clear of it
    if (taxi && !play?.race) taxi.scale.setScalar(TAXI_SCALE * (cut ? CUT_TAXI_SCALE : 1)); // the taxi is drawn bigger in an overhead cut so it reads from that height
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
    applyInset();
    draw();
  };
  // A phone bottom sheet covers the lower part of the stage: slide the picture up so the map centre stays visible above it.
  let inset = 0, insetTop = 0;
  const applyInset = () => {
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    if (inset > 0) camera.setViewOffset(w, h, 0, insetOffset(h, inset, insetTop), w, h); else camera.clearViewOffset();
    if (inset > 0 && !fitted && !engaged) fitPins(w, h);
  };
  // The first time a phone sheet is up, zoom the map out until both pins sit between the top buttons and the sheet (the player's own zoom wins after that).
  let fitted = false;
  const fitPins = (w, h) => {
    fitted = true;
    const bottom = h - Math.min(inset, h * 0.4), v = new THREE.Vector3();
    const inFree = () => pins.every((p) => [1.4, 40].every((y) => {
      v.set(p.position.x, y, p.position.z).project(camera);
      const sx = ((v.x + 1) / 2) * w, sy = ((1 - v.y) / 2) * h;
      return sx > 24 && sx < w - 24 && sy > insetTop + 8 && sy < bottom - 8;
    }));
    view.dist = fitDistance(view.dist, clampDistance(Infinity, radius), (d) => {
      view.dist = d;
      const s = orbitShot();
      camera.position.set(...s.pos); camera.lookAt(...s.target); camera.updateMatrixWorld();
      return inFree();
    });
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

  // The light/dark lamp changes data-theme: only the pad follows it (cheap); the sky and light stay late afternoon.
  const recolour = () => {
    const c = readColors(getComputedStyle(document.documentElement));
    mats.pad.color.set(c.accent);
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
  const finish = () => {
    const p = play; play = null; highlights.clear();
    if (p && p.race) { clearRaceTags(); for (const t of [taxi, taxiB]) t?.scale.setScalar(TAXI_SCALE); } // back to normal size
    if (p && p.onDone) p.onDone();
  }; // exactly once per trip
  const placeCar = (tx, tr, pts, maker, frames, st) => {
    const k = Math.min(st.stepIndex, frames.length - 1);
    tx.position.set(st.x, TAXI_Y, st.z); tx.rotation.y = st.heading;
    maker.setBraking(st.braking); maker.setPose(st.dist, st.curvature);
    pts.set([frames[k].x, 1.4, frames[k].z], k * 3); // the point just left snaps back to its cell
    pts.set([st.x, 1.4, st.z], (k + 1) * 3); // the trail's last point rides with the taxi
    tr.geometry.setDrawRange(0, k + 2);
    tr.geometry.attributes.position.needsUpdate = true;
  };
  const place = (st) => {
    placeCar(taxi, trail, trailPts, taxiMaker, play.track.frames, st);
    play.state = st;
    peopleLayer?.update(st.progress);
    setLights(st.tick);
  };
  // A race: both cars on one clock (and so one set of lights).
  const placeRace = (rs) => {
    const [a, b] = play.race.cars;
    placeCar(taxi, trail, trailPts, taxiMaker, a.track.frames, rs.cars[0].state);
    placeCar(taxiB, trailB, trailPtsB, taxiMakerB, b.track.frames, rs.cars[1].state);
    raceTags.forEach((span, i) => { // each name tag sits above its car, in its car's colour
      const t = i ? taxiB : taxi;
      tmp.set(t.position.x, 14, t.position.z).project(camera);
      const cr = canvas.getBoundingClientRect(), br = labelEl.getBoundingClientRect();
      span.style.display = tmp.z > 1 ? 'none' : '';
      span.style.transform = `translate(${cr.left - br.left + (tmp.x * 0.5 + 0.5) * cr.width}px, ${cr.top - br.top + (0.5 - tmp.y * 0.5) * cr.height}px) translate(-50%, -100%)`;
    });
    play.state = rs;
    setLights(rs.tick);
  };
  // Where the taxi is on screen, in the label layer's pixels, so the tags can pop up beside it.
  const taxiScreen = () => {
    if (!labelEl || !taxi) return null;
    tmp.set(taxi.position.x, 6, taxi.position.z).project(camera);
    if (tmp.z > 1) return null;
    const cr = canvas.getBoundingClientRect(), br = labelEl.getBoundingClientRect();
    const sy = (v) => cr.top - br.top + (0.5 - v.y * 0.5) * cr.height;
    let top = Infinity, bottom = -Infinity; // the drawn taxi's box on screen (its bounding box's corners), so a phone tag can stay off its roof; only a phone-width layout uses it
    if (narrowScreen()) {
      taxiBox.makeEmpty(); for (const part of taxi.children) if (!part.userData.flat) taxiBox.expandByObject(part); // not the flat contact shadow
      const b = taxiBox;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const p = corner.set(x, y, z).project(camera); if (p.z <= 1) { top = Math.min(top, sy(p)); bottom = Math.max(bottom, sy(p)); } }
    }
    return { x: cr.left - br.left + (tmp.x * 0.5 + 0.5) * cr.width, y: sy(tmp), ...(top < bottom ? { top, bottom } : {}) };
  };
  // One frame at time `now`. Every time-dependent value here (elapsed, taxi, camera, lights tick, head bob) derives from `now`, so a manual clock gives pure frames.
  const frame = (now) => {
    if (dead || !play) return 'map';
    const intro = play.swoop ? SWOOP_MS : 0;
    const elapsed = now - play.t0;
    const { phase, t } = timeline(play.driveMs, elapsed, { swoop: play.swoop });
    const ms = Math.min(Math.max(0, elapsed - intro), play.driveMs); // the taxi freezes at a cut drive
    const st = play.race ? raceStateAt(play.race, ms) : stateAt(play.track, ms);
    if (play.race) placeRace(st); else place(st);
    furniture.setTrains(ms); // trains on the L: a pure function of the trip's ms
    trafficLayer.update(ms / play.track.tickMs, play.onHonk); // a no-op unless a single trip started traffic
    play.phase = phase; play.t = t;
    play.clock = elapsed + (SWOOP_MS - intro); // offence and cut times are on the clock that starts with the swoop
    highlights.update(highlightsAt(play.offences, play.clock, { reduced: !motionAllowed() }), phase === 'chase' && !mapView && !!cutAt(cuts, play.clock)); // bigger and brighter from overhead
    if (motionAllowed()) heads.forEach((h, i) => { h.position.y = 32.6 + Math.sin(now / 300 + i) * 2; });
    renderNow();
    play.onFrame?.(st, play.race ? null : taxiScreen(), play.overhead); // the last frame (already 'map' when there is no pullback) still carries the fare tag
    if (phase === 'map') finish();
    return phase;
  };
  const tickLoop = (now) => {
    loopId = 0;
    if (frame(now) !== 'map' && play) loopId = requestAnimationFrame(tickLoop);
  };
  const stopRoute = () => {
    if (loopId) cancelAnimationFrame(loopId);
    loopId = 0;
    finish();
    if (taxi) { scene.remove(taxi); taxi.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); taxi = null; }
    trafficLayer.stop();
    if (trail) { scene.remove(trail); trail.geometry.dispose(); trail = null; }
    if (taxiB) { scene.remove(taxiB); taxiB.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); taxiB = null; }
    if (trailB) { scene.remove(trailB); trailB.geometry.dispose(); trailB = null; }
    if (peopleLayer) { peopleLayer.dispose(); peopleLayer = null; }
  };

  // Idle: the lights follow a slow clock (not under reduced motion).
  const clock = manualClock ? 0 : setInterval(() => { // a manual clock never reads wall-clock time
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
      if (manualClock) { applyHeat(); return; } // record mode: apply at once, no throttle
      const wait = 100 - (performance.now() - heatAt);
      if (wait <= 0) { if (heatTimer) clearTimeout(heatTimer); applyHeat(); } else if (!heatTimer) heatTimer = setTimeout(applyHeat, wait);
    },
    // track: drive.js driveTrack; events: events.js tripEvents (the page reads those; the stage only needs the track).
    playTrip({ track, events, people, offences, driveMs, onFrame, onDone, onHonk } = {}) { // driveMs: footage maxms, cut the drive here (the pullback still plays)
      stopRoute();
      const frames = track.frames;
      taxi = taxiMaker.make();
      taxi.traverse((o) => { o.castShadow = !o.userData.flat; });
      trailPts = new Float32Array((frames.length + 1) * 3);
      frames.forEach((f, i) => trailPts.set([f.x, 1.4, f.z], i * 3));
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(trailPts, 3));
      trail = new THREE.Line(tg, mats.trail); trail.frustumCulled = false;
      scene.add(taxi, trail);
      if (people) peopleLayer = createPeopleLayer(scene, people, { drawn: tier.peopleDrawn, shadows: !phone, seed: people.seed });
      const cutMs = Math.min(driveMs ?? track.total, track.total);
      play = { track, driveMs: cutMs, offences: offences && offencesWithin(offences, cutMs), onFrame, onDone, onHonk, state: stateAt(track, 0), phase: 'map', t: 0, swoop: !chase };
      if (!motionAllowed() && !manualClock) { // no animation: the end state with the whole trail and the final numbers (record mode steps frames itself)
        const end = stateAt(track, track.total);
        place({ ...end, stepIndex: frames.length - 2 }); // place() draws the trail to stepIndex + 1, the last point, and the taxi at its end position
        tg.setDrawRange(0, frames.length);
        draw();
        onFrame?.(end, null);
        finish();
        return;
      }
      if (events) trafficLayer.startTrip(world, city.cellM, events);
      if (manualClock) { play.t0 = 0; return; } // renderAt(ms) drives the frames
      play.t0 = performance.now();
      loopId = requestAnimationFrame(tickLoop);
    },
    // race: race.js raceTracks. Two taxis from the same pickup on one clock; onFrame gets the raceStateAt result.
    playRace({ race, onFrame, onDone } = {}) {
      stopRoute();
      const make = (maker, mat, frames) => {
        const tx = maker.make(), pts = new Float32Array((frames.length + 1) * 3);
        tx.traverse((o) => { o.castShadow = !o.userData.flat; });
        frames.forEach((f, i) => pts.set([f.x, 1.4, f.z], i * 3));
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        const tr = new THREE.Line(g, mat); tr.frustumCulled = false;
        scene.add(tx, tr);
        return [tx, tr, pts];
      };
      [taxi, trail, trailPts] = make(taxiMaker, mats.trail, race.cars[0].track.frames);
      [taxiB, trailB, trailPtsB] = make(taxiMakerB, mats.trailB, race.cars[1].track.frames);
      taxi.scale.setScalar(TAXI_SCALE * RACE_SCALE); taxiB.scale.setScalar(TAXI_SCALE * RACE_SCALE);
      raceTags = labelEl ? race.cars.map((c, i) => {
        const span = document.createElement('span');
        span.className = 'race-tag'; span.textContent = c.entry.name; span.style.color = TINTS[i].css;
        labelEl.append(span); return span;
      }) : [];
      play = { race, driveMs: race.total, track: { total: race.total }, onFrame, onDone, state: raceStateAt(race, 0), phase: 'map', t: 0, swoop: true };
      if (!motionAllowed()) { // no animation: both cars at their finish with the whole trails and final numbers
        const end = raceStateAt(race, race.total);
        placeRace(end);
        draw();
        onFrame?.(end, null);
        finish();
        return;
      }
      if (manualClock) { play.t0 = 0; return; }
      play.t0 = performance.now();
      loopId = requestAnimationFrame(tickLoop);
    },
    // Render the playing trip at ms (manualClock only). done is true once the trip has ended.
    renderAt(ms) {
      const phase = frame(ms);
      return { phase, done: phase === 'map' };
    },
    // Skip to the end of the drive: the taxi jumps to its last tile and the camera pulls back.
    skipTrip() { if (play && !manualClock) { play.swoop = true; play.t0 = performance.now() - SWOOP_MS - play.track.total; } }, // always into the pullback, so the camera eases out to the map under the end card (the chase view has no pullback of its own)
    // The Map view toggle: the high map camera while the taxi drives, instead of the chase.
    setMapView(on) { mapView = !!on; if (!play) draw(); },
    setCuts(list) { cuts = list ?? []; }, // footage cam=auto: overheadCuts result
    setInset(px, topPx = 0) { inset = Math.max(0, px || 0); insetTop = inset > 0 ? Math.max(0, topPx || 0) : 0; applyInset(); draw(); },
    clearRoute() { stopRoute(); draw(); },
    setChase(on) { chase = !!on && motionAllowed(); }, // on: a trip starts in the chase view, with no swoop in or out
    setShot(name) { chase = name === 'chase' && motionAllowed(); },
    destroy() {
      dead = true; if (queued) cancelAnimationFrame(queued);
      stopRoute(); highlights.dispose(); trafficLayer.dispose(); taxiMaker.dispose(); taxiMakerB.dispose(); sky.dispose(); envTarget.dispose(); clearInterval(clock); motionMq.removeEventListener('change', onMotion); if (heatTimer) clearTimeout(heatTimer);
      for (const { span } of labels) span.remove();
      ro.disconnect(); mo.disconnect(); scheme.removeEventListener('change', onScheme);
      window.removeEventListener('blur', disengage);
      for (const [type, fn] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['wheel', wheel], ['pointerleave', disengage]]) canvas.removeEventListener(type, fn);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of Object.values(mats)) m.dispose();
      furniture.dispose(); sigGlow?.dispose();
      renderer.dispose(); canvas.remove();
    },
  };
}
