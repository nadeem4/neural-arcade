// The thin mesh layer for the 3D room's overlays: one builder per overlay, each turning a draw list (room-overlays.js) into meshes.
// Loaded by room-scene.js. THREE comes in through the context, so this file imports only pure code.
import { cellToWorld, heatColor, tagStyle, tagSize, tagInside, tagHalfWidth, TAG_CAPACITY } from './room-math.js';
import { createLabelBoard } from './room-labels.js';

const LABEL_Y = 0.2;  // label centres float above the floor, clear of the rock tiles
const TINT_Y = 0.03;  // the heat tint lies just above the tile tops
const TINT_HALF = 0.46;
const ROCK_TOP = 0.17; // flat arrows and coins sit above the rock tiles' tops
const TRAIL_CAPACITY = 12;
const TAG_Y = 1.2;    // a tag floats this far above the floor (a cell is 1 wide): clear of the rogue's head, which is about 0.9 tall with the hood
const TAG_SCALE = 1.8; // reward tags read bigger than the value numbers: they are the point of the level
const ICE_Y = 0.02;   // the ice lies just above the floor
const GOOD = '#2a9d4b'; // the dark green assets/grid.js uses for the treasure; no green token exists

const token = (name, fallback) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; }
  catch { return fallback; }
};

// ctx: { THREE, room, parent, kit, labelScale(): world height of a label, tilt }. Each builder returns { update(list), dispose() }.
// A trail coin at its biggest (the first step) is about half a tile wide; later steps shrink to at least a quarter of that.
export const TRAIL_COIN = 0.5;

export const MESH_LAYERS = {
  values(ctx) {
    const { THREE, room, parent } = ctx;
    const capacity = room.w * room.h;

    // Heat tint: one merged mesh of flat quads, one per floor tile, with the heat as vertex colour and alpha.
    const pos = new Float32Array(capacity * 12), col = new Float32Array(capacity * 16), idx = new Uint16Array(capacity * 6);
    for (let i = 0; i < capacity; i++) idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6); // wound to face up
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geometry.setIndex(new THREE.BufferAttribute(idx, 1));
    geometry.setDrawRange(0, 0);
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });
    const tint = new THREE.Mesh(geometry, material);
    tint.frustumCulled = false;
    tint.renderOrder = 1;
    parent.add(tint);

    const board = createLabelBoard(THREE, { capacity, scale: ctx.labelScale(), tilt: ctx.tilt });
    parent.add(board.mesh);

    return {
      update(list) {
        list.tiles.forEach((t, i) => {
          const { x, z } = cellToWorld(room, t.x, t.y);
          pos.set([x - TINT_HALF, TINT_Y, z - TINT_HALF, x + TINT_HALF, TINT_Y, z - TINT_HALF, x + TINT_HALF, TINT_Y, z + TINT_HALF, x - TINT_HALF, TINT_Y, z + TINT_HALF], i * 12);
          const c = heatColor(t.h);
          for (let k = 0; k < 4; k++) col.set(c, i * 16 + k * 4);
        });
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        geometry.setDrawRange(0, list.tiles.length * 6);
        board.setScale(ctx.labelScale());
        board.set(list.labels.map(l => { const w = cellToWorld(room, l.x, l.y); return { x: w.x, y: LABEL_Y, z: w.z, text: l.text }; }));
      },
      dispose() {
        board.dispose();
        geometry.dispose();
        material.dispose();
        tint.removeFromParent();
      },
    };
  },

  // One InstancedMesh of a flat arrow, one instance per tile with a policy action, in the --signal colour.
  arrows(ctx) {
    const { THREE, room, parent } = ctx;
    const capacity = room.w * room.h;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.34); shape.lineTo(0.24, 0.02); shape.lineTo(0.09, 0.02); shape.lineTo(0.09, -0.3);
    shape.lineTo(-0.09, -0.3); shape.lineTo(-0.09, 0.02); shape.lineTo(-0.24, 0.02); shape.closePath();
    // Extruded along z, then laid flat: the tip points north (-z), the 0.02 depth ends up as height.
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: token('--signal', '#ff5a1f'), toneMapped: false });
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    parent.add(mesh);
    const m4 = new THREE.Matrix4(), rot = new THREE.Matrix4();
    return {
      update(list) {
        list.forEach((a, i) => {
          const w = cellToWorld(room, a.x, a.y);
          mesh.setMatrixAt(i, m4.makeTranslation(w.x, ROCK_TOP + 0.02, w.z).multiply(rot.makeRotationY(a.rotY)));
        });
        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
        material.color.set(token('--signal', '#ff5a1f')); // a theme change redraws
      },
      dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); mesh.removeFromParent(); },
    };
  },

  // Reward tags: a second label board, up to TAG_CAPACITY labels floating above their tiles. The room is dark, so ink and step are light.
  tags(ctx) {
    const { THREE, room, parent } = ctx;
    const board = createLabelBoard(THREE, { capacity: TAG_CAPACITY, scale: ctx.labelScale() * TAG_SCALE, tilt: ctx.tilt, onTop: true });
    parent.add(board.mesh);
    const colour = ({ fill }) => fill === 'good' ? GOOD : fill === 'bad' ? token('--red', '#e5533f') : fill === 'step' ? '#aab2bd' : undefined; // ink: the board default
    return {
      update(list) {
        board.setScale(ctx.labelScale() * TAG_SCALE);
        board.set(list.map(t => {
          const w = cellToWorld(room, t.x, t.y), size = tagSize(t.text.length, ctx.labelScale() * TAG_SCALE);
          return { x: tagInside(w.x, tagHalfWidth(t.text.length, size), room.w), y: TAG_Y, z: w.z, text: t.text, size, color: colour(tagStyle(t.tone, t.onEnd)) };
        }));
      },
      dispose() { board.dispose(); },
    };
  },

  // The icy floor (level 6): one InstancedMesh of flat pale slabs, one per floor tile, see-through so the floor shows.
  ice(ctx) {
    const { THREE, room, parent } = ctx;
    const geometry = new THREE.BoxGeometry(0.96, 0.02, 0.96);
    const material = new THREE.MeshBasicMaterial({ color: 0xbfd3e6, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geometry, material, room.w * room.h);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    parent.add(mesh);
    const m4 = new THREE.Matrix4();
    return {
      update(list) {
        list.forEach((c, i) => { const w = cellToWorld(room, c.x, c.y); mesh.setMatrixAt(i, m4.makeTranslation(w.x, ICE_Y, w.z)); });
        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
      },
      dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); mesh.removeFromParent(); },
    };
  },

  // The route as coin stacks: one InstancedMesh per kit mesh per route (the second route is dimmed), capacity 12 per route.
  trail(ctx) { // size: TRAIL_COIN times the entry scale only; the chest's treasureScale never reaches here
    const { THREE, room, parent, kit } = ctx;
    const parts = kit.instancesOf('coin_stack_medium');
    const meshes = [];
    for (let r = 0; r < 2; r++) {
      for (const { geometry, material, local } of parts) {
        const mesh = new THREE.InstancedMesh(geometry, material, TRAIL_CAPACITY);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        parent.add(mesh);
        meshes.push({ mesh, route: r, local });
      }
    }
    const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), scl = new THREE.Vector3(), dim = new THREE.Color(0.35, 0.35, 0.35), full = new THREE.Color(1, 1, 1);
    return {
      update(list) {
        for (const { mesh, route, local } of meshes) {
          const cells = list.routes[route] ?? [];
          cells.slice(0, TRAIL_CAPACITY).forEach((c, i) => {
            const w = cellToWorld(room, c.x, c.y);
            mesh.setMatrixAt(i, m4.compose(pos.set(w.x, ROCK_TOP, w.z), q.identity(), scl.setScalar(TRAIL_COIN * c.scale)).multiply(local));
            mesh.setColorAt(i, list.faint[route] ? dim : full);
          });
          mesh.count = Math.min(cells.length, TRAIL_CAPACITY);
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      },
      dispose() { for (const { mesh } of meshes) { mesh.dispose(); mesh.removeFromParent(); } }, // the kit's geometry and materials are shared
    };
  },
};

// The outlined tiles (the `marks` option): thin signal-orange rings, one InstancedMesh. Part of the base room, not an overlay.
export function createMarks(THREE, { room, parent, color = 0xff5a1f }) {
  const geometry = new THREE.RingGeometry(0.4, 0.46, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geometry, material, room.w * room.h);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  parent.add(mesh);
  const m4 = new THREE.Matrix4();
  return {
    set(cells) {
      cells.forEach((c, i) => { const w = cellToWorld(room, c.x, c.y); mesh.setMatrixAt(i, m4.makeTranslation(w.x, 0.02, w.z)); });
      mesh.count = cells.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); mesh.removeFromParent(); },
  };
}
