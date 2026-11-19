// Street furniture for the 3D stage: OSM street lamps, OSM trees and the L, all as InstancedMeshes (three.js glue only).
// Layout maths is pure and lives in street-furniture.js; the tier numbers come from quality.js furnitureTier.
// In the chase the camera sits about deck height, so trees, lamps and the raised parts of the L near it or on its line to the taxi are scaled to nothing (hiders below).
// Draw calls added: lamps 2 (poles, heads) + trees 2 (trunks, crowns) + the L 1 (deck, girders, rails, columns and ground track beds as one box mesh).
// Instances (Chicago Loop export): 410 lamps, 4,128 trees (2,064 on phones), about 1,700 L boxes.
import * as THREE from './vendor/three.module.min.js';
import { treesToHide } from './scene-math.js';
import { headPlacement } from './signal-heads.js';
import { createGlow, LAMP_GLOW } from './glow.js';
import { pickLine, trainPath, trainsAt, TRAIN } from './trains.js';
import { treeSpecs, crownBlobs, lampSpecs, pairRails, railParts, RAIL_COLOURS, SURFACE } from './street-furniture.js';

const LAMP_H = 9, POLE_H = SURFACE.lampBase + LAMP_H - SURFACE.grass, TRUNK_Y = SURFACE.grass, GLOW = '#ffb866';
const ARM = 1.5, HEAD_R = 0.45; // a slim arm reaching out from the top of the pole, and a small warm head at its end
export const LAMP_HIDE = { near: 14, lineR: 5 }; // lamps this close to the chase camera, or to its line to the taxi, are hidden

// Several geometries joined into one (positions only; normals recomputed, so flat shaded).
function joined(geos) {
  const pos = [];
  for (const g of geos) { const n = g.index ? g.toNonIndexed() : g; pos.push(...n.attributes.position.array); if (n !== g) n.dispose(); g.dispose(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  return geo;
}

// A crown of low-poly blobs merged into one geometry (flat shaded, so the facets read as leaves at street scale).
function crownGeometry(n) {
  return joined(crownBlobs(n).map((b) => new THREE.IcosahedronGeometry(b.r, 0).translate(b.x, b.y, b.z)));
}

export function buildFurniture({ scene, city, furnitureTier: tier, glow = false, leaf = '#4E9A48', envIntensity = 1 }) {
  const mats = [], meshes = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const place = (mesh, i, x, y, z, yaw, sx, sy, sz) => {
    q.setFromAxisAngle(up, yaw); mesh.setMatrixAt(i, m.compose(pos.set(x, y, z), q, scl.set(sx, sy, sz)));
  };
  const material = (m2) => { mats.push(m2); return m2; };
  const mesh = (x) => { meshes.push(x); return x; };
  const nothing = (obj, i) => place(obj, i, 0, 0, 0, 0, 0, 0, 0);
  // Hides (scales to nothing) the items near the camera or on its line to the taxi; restores them when it moves. flat holds x, 0, z per item.
  const hider = (flat, show, hide, near, lineR) => {
    let hidden = [];
    return (cam, taxiAt) => {
      const next = cam ? treesToHide(flat, cam, taxiAt, near, lineR) : [];
      if (next.length === hidden.length && next.every((v, k) => v === hidden[k])) return false;
      for (const i of hidden) show(i);
      for (const i of next) hide(i);
      hidden = next; return true;
    };
  };

  // Lamps: a pole and a head at each OSM point. The head glows on desktop (untoned emissive, like the signal lamps).
  const poles = (city.signalHeads ?? []).map((h) => { const p = headPlacement(h, city.roads ?? []); return { x: p.x, z: -p.y }; });
  const lamps = lampSpecs(city.lamps ?? [], city.roads ?? [], poles);
  let clearLamps = () => {}, glowOff = null;
  if (lamps.length) {
    const poleMat = material(new THREE.MeshStandardMaterial({ color: '#3b3f46', roughness: 0.7, envMapIntensity: envIntensity }));
    const headMat = material(tier.lampGlow
      ? new THREE.MeshStandardMaterial({ color: GLOW, emissive: GLOW, emissiveIntensity: 1.6, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: '#d9b98a', roughness: 0.6, envMapIntensity: envIntensity }));
    const poles = mesh(new THREE.InstancedMesh(joined([
      new THREE.CylinderGeometry(0.16, 0.26, POLE_H, 6).translate(0, SURFACE.grass + POLE_H / 2, 0),
      new THREE.BoxGeometry(ARM, 0.12, 0.12).translate(ARM / 2, SURFACE.lampBase + LAMP_H, 0),
    ]), poleMat, lamps.length));
    const heads = mesh(new THREE.InstancedMesh(new THREE.SphereGeometry(HEAD_R, 8, 6).scale(1.3, 0.5, 1).translate(ARM, SURFACE.lampBase + LAMP_H - 0.05, 0), headMat, lamps.length));
    // Bloom (high tier): a soft dot over each lit head, off while the head is hidden near the chase camera.
    const lampGlow = glow && tier.lampGlow ? createGlow(lamps.map((l) => ({ x: l.x + ARM, y: SURFACE.lampBase + LAMP_H - 0.05, z: l.z, r: LAMP_GLOW, g: LAMP_GLOW * 0.7, b: LAMP_GLOW * 0.35 })), { size: 5 }) : null;
    if (lampGlow) { scene.add(lampGlow.points); glowOff = lampGlow; }
    const lampAt = (i) => { m.makeTranslation(lamps[i].x, 0, lamps[i].z); poles.setMatrixAt(i, m); heads.setMatrixAt(i, m); lampGlow?.setColour(i, LAMP_GLOW, LAMP_GLOW * 0.7, LAMP_GLOW * 0.35); };
    lamps.forEach((l, i) => lampAt(i));
    scene.add(poles, heads);
    const flatLamps = new Float32Array(lamps.length * 3);
    lamps.forEach((l, i) => { flatLamps[i * 3] = l.x; flatLamps[i * 3 + 2] = l.z; });
    const run = hider(flatLamps, lampAt, (i) => { nothing(poles, i); nothing(heads, i); lampGlow?.setColour(i, 0, 0, 0); }, LAMP_HIDE.near, LAMP_HIDE.lineR);
    clearLamps = (cam, taxiAt) => { if (run(cam, taxiAt)) { poles.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; } };
  }

  // Trees: a trunk and a crown of blobs, sized, turned and tinted by a seeded hash of the tree's index.
  const specs = treeSpecs(city.trees ?? [], tier.treeStep);
  const flat = new Float32Array(specs.length * 3);
  let trunks = null, crowns = null, clearTrees = () => {};
  const trunkAt = (i) => { const s = specs[i]; place(trunks, i, s.x, TRUNK_Y, s.z, s.rot, s.crownR * 0.22, s.trunkH, s.crownR * 0.22); };
  const crownAt = (i) => { const s = specs[i]; place(crowns, i, s.x, TRUNK_Y + s.trunkH + s.crownR * 0.6, s.z, s.rot, s.crownR * s.sx, s.crownR, s.crownR * s.sz); };
  if (specs.length) {
    const trunkMat = material(new THREE.MeshStandardMaterial({ color: '#5a4332', roughness: 0.95, envMapIntensity: envIntensity }));
    const crownMat = material(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true, envMapIntensity: envIntensity }));
    trunks = mesh(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0), trunkMat, specs.length));
    crowns = mesh(new THREE.InstancedMesh(crownGeometry(tier.crownBlobs), crownMat, specs.length));
    crowns.castShadow = tier.shadows;
    const c = new THREE.Color(), base = new THREE.Color(leaf);
    specs.forEach((s, i) => {
      flat[i * 3] = s.x; flat[i * 3 + 2] = s.z;
      trunkAt(i); crownAt(i);
      crowns.setColorAt(i, c.copy(base).offsetHSL(s.dh, 0, s.dl));
    });
    scene.add(trunks, crowns);
    const run = hider(flat, (i) => { trunkAt(i); crownAt(i); }, (i) => { nothing(trunks, i); nothing(crowns, i); }, 15, 6);
    clearTrees = (cam, taxiAt) => { if (run(cam, taxiAt)) { trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true; } };
  }

  // The L: every box of every rail entry (two-track lines paired into one) in one InstancedMesh, coloured per instance.
  const parts = pairRails(city.rail ?? []).flatMap((r) => railParts(r, city.roads ?? []));
  let clearRail = () => {};
  if (parts.length) {
    const steel = material(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.3, envMapIntensity: envIntensity }));
    const rail = mesh(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), steel, parts.length));
    rail.castShadow = tier.shadows; rail.receiveShadow = true;
    const c = new THREE.Color();
    const partAt = (i) => { const p = parts[i]; place(rail, i, p.x, p.y, p.z, p.yaw, p.sx, p.sy, p.sz); };
    parts.forEach((p, i) => { partAt(i); rail.setColorAt(i, c.set(RAIL_COLOURS[p.colour])); });
    scene.add(rail);
    // Only the raised parts can block the chase view; the ground track beds stay.
    const high = parts.map((p, i) => i).filter((i) => parts[i].y > 1);
    const flatHigh = new Float32Array(high.length * 3);
    high.forEach((i, k) => { flatHigh[k * 3] = parts[i].x; flatHigh[k * 3 + 2] = parts[i].z; });
    const run = hider(flatHigh, (k) => partAt(high[k]), (k) => nothing(rail, high[k]), 12, 4);
    clearRail = (cam, taxiAt) => { if (run(cam, taxiAt)) { rail.instanceMatrix.needsUpdate = true; } };
  }

  // Trains: two boxes shuttling on one two-track line (trains.js); where they are is a function of the trip's ms, and at rest they stand where ms is 0.
  const line = pickLine(pairRails(city.rail ?? [])), path = line ? trainPath(line.pts) : null;
  let trains = null;
  const setTrains = (ms) => {
    if (!trains) return;
    trainsAt(line, path, ms).forEach((t, i) => place(trains, i, t.x, t.y, t.z, t.yaw, 1, 1, 1));
    trains.instanceMatrix.needsUpdate = true;
  };
  if (line) {
    trains = mesh(new THREE.InstancedMesh(new THREE.BoxGeometry(TRAIN.l, TRAIN.h, TRAIN.w), material(new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.5, metalness: 0.3, envMapIntensity: envIntensity })), 2));
    trains.frustumCulled = false; scene.add(trains); setTrains(0);
  }

  return {
    setTrains,
    // In the chase (cam is the camera's [x, z], taxiAt the taxi's), hide what would block the view; null cam brings everything back.
    clearTrees(cam, taxiAt) { clearTrees(cam, taxiAt); clearLamps(cam, taxiAt); clearRail(cam, taxiAt); },
    dispose() { glowOff?.dispose(); for (const x of mats) x.dispose(); for (const m of meshes) m.dispose(); },
  };
}
