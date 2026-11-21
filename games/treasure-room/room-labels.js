// Number labels for the 3D room: one atlas texture and one merged mesh of `capacity` quads, so any number of labels is one draw call.
// Takes THREE as an argument so this file imports nothing itself. Loaded by room-overlay-meshes.js.

const SLOT_W = 128, SLOT_H = 64, COLS = 5;
const FONT = '700 44px "JetBrains Mono", ui-monospace, Consolas, monospace';
const INK = '#E9EDF2'; // --stage-ink: the room stays dark in both themes

// capacity: most labels at once. scale: world height of a quad (the width is twice that).
// onTop: draw over everything (no depth test), for tags that must never hide behind the character.
// tilt: radians the quads lean back from upright (the camera's polar angle puts them face on).
export function createLabelBoard(THREE, { capacity, scale = 0.24, tilt = 0, onTop = false }) {
  const rows = Math.ceil(capacity / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * SLOT_W;
  canvas.height = rows * SLOT_H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const pos = new Float32Array(capacity * 12), uv = new Float32Array(capacity * 8), index = new Uint16Array(capacity * 6);
  for (let i = 0; i < capacity; i++) {
    const u0 = (i % COLS) / COLS, u1 = u0 + 1 / COLS, v1 = 1 - Math.floor(i / COLS) / rows, v0 = v1 - 1 / rows;
    uv.set([u0, v0, u1, v0, u1, v1, u0, v1], i * 8);
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.setDrawRange(0, 0);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: !onTop, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  let shown = [], drawn = [], size = scale;
  const paintSlot = (i, text, color = INK) => {
    const x = (i % COLS) * SLOT_W, y = Math.floor(i / COLS) * SLOT_H;
    ctx.clearRect(x, y, SLOT_W, SLOT_H);
    if (!text) return;
    ctx.font = FONT;
    const fit = ctx.measureText(text).width;
    if (fit > SLOT_W - 12) ctx.font = FONT.replace('44px', `${Math.floor(44 * (SLOT_W - 12) / fit)}px`); // long words shrink to the slot
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(15, 19, 25, 0.85)';
    ctx.strokeText(text, x + SLOT_W / 2, y + SLOT_H / 2 + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x + SLOT_W / 2, y + SLOT_H / 2 + 2);
  };
  const place = () => {
    const c = Math.cos(tilt), s = Math.sin(tilt);
    shown.forEach((l, i) => {
      const w = l.size ?? size, h = w / 2;
      // corners of an upright quad, leaned back about x, then moved to the label's world position
      [[-w, -h], [w, -h], [w, h], [-w, h]].forEach(([px, py], k) => pos.set([l.x + px, l.y + py * c, l.z - py * s], i * 12 + k * 3));
    });
    geometry.attributes.position.needsUpdate = true;
    geometry.setDrawRange(0, shown.length * 6);
  };
  const paint = () => {
    shown.forEach((l, i) => { const key = l.text + '|' + (l.color ?? ''); if (drawn[i] !== key) { paintSlot(i, l.text, l.color); drawn[i] = key; } });
    texture.needsUpdate = true;
  };

  // The page font may arrive after the first draw: paint again once it is there. Without it the system mono is used.
  let dead = false;
  try {
    document.fonts?.load('700 34px "JetBrains Mono"').then(() => {
      if (dead) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawn = [];
      paint();
    }).catch(() => {});
  } catch { /* no font API */ }

  return {
    mesh,
    // labels: [{ x, y, z, text, color?, size? }] in world units (the centre of each label); colour is a CSS colour, default the stage ink. Extra labels past capacity are dropped.
    set(labels) {
      shown = labels.slice(0, capacity);
      place();
      paint();
    },
    setScale(s) { if (s !== size) { size = s; place(); } },
    dispose() {
      dead = true;
      geometry.dispose();
      material.dispose();
      texture.dispose();
      mesh.removeFromParent();
    },
  };
}
