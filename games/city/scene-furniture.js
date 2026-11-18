// Street furniture for the 3D stage: OSM street lamps, OSM trees and the L, all as InstancedMeshes (three.js glue only).
// Layout maths is pure and lives in street-furniture.js; the tier numbers come from quality.js furnitureTier.
// Draw calls added: lamps 2 (poles, heads) + trees 2 (trunks, crowns) + the L 1 (deck, girders, rails, columns and ground track beds as one box mesh).
// Instances (Chicago Loop export): 410 lamps, 4,128 trees (2,064 on phones), about 1,700 L boxes.
import * as THREE from './vendor/three.module.min.js';
import { treesToHide } from './scene-math.js';
import { treeSpecs, crownBlobs, lampSpecs, railParts, RAIL_COLOURS } from './street-furniture.js';

const LAMP_H = 9, TRUNK_Y = 0.5, GLOW = '#ffd9a0';

// A crown of low-poly blobs merged into one geometry (flat shaded, so the facets read as leaves at street scale).
function crownGeometry(n) {
  const pos = [];
  for (const b of crownBlobs(n)) {
    const g = new THREE.IcosahedronGeometry(b.r, 0).translate(b.x, b.y, b.z);
    pos.push(...g.attributes.position.array); g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildFurniture({ scene, city, furnitureTier: tier, leaf = '#4E9A48', envIntensity = 1 }) {
  const mats = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const place = (mesh, i, x, y, z, yaw, sx, sy, sz) => {
    q.setFromAxisAngle(up, yaw); mesh.setMatrixAt(i, m.compose(pos.set(x, y, z), q, scl.set(sx, sy, sz)));
  };
  const material = (m2) => { mats.push(m2); return m2; };

  // Lamps: a pole and a head at each OSM point. The head glows on desktop (untoned emissive, like the signal lamps).
  const lamps = lampSpecs(city.lamps ?? []);
  if (lamps.length) {
    const poleMat = material(new THREE.MeshStandardMaterial({ color: '#3b3f46', roughness: 0.7, envMapIntensity: envIntensity }));
    const headMat = material(tier.lampGlow
      ? new THREE.MeshStandardMaterial({ color: GLOW, emissive: GLOW, emissiveIntensity: 1.6, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: '#c9c2b0', roughness: 0.6, envMapIntensity: envIntensity }));
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.26, LAMP_H, 6).translate(0, LAMP_H / 2 + 0.8, 0), poleMat, lamps.length);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.75, 8, 6).scale(1, 0.6, 1).translate(0, LAMP_H + 1.1, 0), headMat, lamps.length);
    lamps.forEach((l, i) => { m.makeTranslation(l.x, 0, l.z); poles.setMatrixAt(i, m); heads.setMatrixAt(i, m); });
    scene.add(poles, heads);
  }

  // Trees: a trunk and a crown of blobs, sized, turned and tinted by a seeded hash of the tree's index.
  const specs = treeSpecs(city.trees ?? [], tier.treeStep);
  const flat = new Float32Array(specs.length * 3);
  let trunks = null, crowns = null, hidden = [];
  const trunkAt = (i, s) => place(trunks, i, s.x, TRUNK_Y, s.z, s.rot, s.crownR * 0.22, s.trunkH, s.crownR * 0.22);
  const crownAt = (i, s) => place(crowns, i, s.x, TRUNK_Y + s.trunkH + s.crownR * 0.6, s.z, s.rot, s.crownR * s.sx, s.crownR, s.crownR * s.sz);
  const nothing = (mesh, i) => place(mesh, i, 0, 0, 0, 0, 0, 0, 0);
  if (specs.length) {
    const trunkMat = material(new THREE.MeshStandardMaterial({ color: '#5a4332', roughness: 0.95, envMapIntensity: envIntensity }));
    const crownMat = material(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true, envMapIntensity: envIntensity }));
    trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0), trunkMat, specs.length);
    crowns = new THREE.InstancedMesh(crownGeometry(tier.crownBlobs), crownMat, specs.length);
    crowns.castShadow = tier.shadows;
    const c = new THREE.Color(), base = new THREE.Color(leaf);
    specs.forEach((s, i) => {
      flat[i * 3] = s.x; flat[i * 3 + 2] = s.z;
      trunkAt(i, s); crownAt(i, s);
      crowns.setColorAt(i, c.copy(base).offsetHSL(s.dh, 0, s.dl));
    });
    scene.add(trunks, crowns);
  }
  // In the chase, trees near the camera or on its line to the taxi are scaled to nothing so they never block the view.
  const clearTrees = (cam, taxiAt) => {
    if (!trunks) return;
    const next = cam ? treesToHide(flat, cam, taxiAt) : [];
    if (next.length === hidden.length && next.every((v, k) => v === hidden[k])) return;
    for (const i of hidden) { trunkAt(i, specs[i]); crownAt(i, specs[i]); }
    for (const i of next) { nothing(trunks, i); nothing(crowns, i); }
    hidden = next; trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
  };

  // The L: every box of every rail entry in one InstancedMesh, coloured per instance.
  const parts = (city.rail ?? []).flatMap((r) => railParts(r, city.roads ?? []));
  if (parts.length) {
    const steel = material(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.3, envMapIntensity: envIntensity }));
    const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), steel, parts.length);
    rail.castShadow = tier.shadows; rail.receiveShadow = true;
    const c = new THREE.Color();
    parts.forEach((p, i) => { place(rail, i, p.x, p.y, p.z, p.yaw, p.sx, p.sy, p.sz); rail.setColorAt(i, c.set(RAIL_COLOURS[p.colour])); });
    scene.add(rail);
  }

  return { clearTrees, dispose() { for (const x of mats) x.dispose(); } };
}
