// The thin mesh layer for the 3D room's overlays: one builder per overlay, each turning a draw list (room-overlays.js) into meshes.
// Loaded by room-scene.js. THREE comes in through the context, so this file imports only pure code.
import { cellToWorld, heatColor } from './room-math.js';
import { createLabelBoard } from './room-labels.js';

const LABEL_Y = 0.1;  // label centres sit just above the floor
const TINT_Y = 0.012; // the heat tint lies on the tile tops
const TINT_HALF = 0.46;

// ctx: { THREE, room, parent, labelScale(): world height of a label, tilt }. Each builder returns { update(list), dispose() }.
export const MESH_LAYERS = {
  values(ctx) {
    const { THREE, room, parent } = ctx;
    const capacity = room.w * room.h;

    // Heat tint: one merged mesh of flat quads, one per floor tile, with the heat as vertex colour and alpha.
    const pos = new Float32Array(capacity * 12), col = new Float32Array(capacity * 16), idx = new Uint16Array(capacity * 6);
    for (let i = 0; i < capacity; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
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
