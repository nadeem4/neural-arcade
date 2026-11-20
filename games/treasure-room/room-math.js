// Treasure Room 3D maths: layout, camera, picking. Pure: no three.js and no DOM, so it runs in Node.
// World units: one grid cell is 1 unit. x runs right, z runs down the grid, y is up; the room is centred on the origin.

// Measured model sizes {w, h, d} after the kit re-origins each model (centred on x and z, base at y = 0,
// walls turned so the long side runs along x). room-kit.js measures them for real and passes them to layoutRoom.
export const DIMS = {
  floor_tile_large: { w: 4, h: 0.15, d: 4 },
  floor_tile_large_rocks: { w: 4, h: 0.64, d: 4 },
  floor_tile_big_spikes: { w: 4, h: 2.1, d: 4 },
  wall: { w: 4, h: 4, d: 1 },
  wall_corner: { w: 2.5, h: 4, d: 2.5 },
  chest_gold: { w: 1.7, h: 1.3, d: 1.446 },
  coin_stack_medium: { w: 1, h: 0.64, d: 1 },
  torch_lit: { w: 0.55, h: 1.126, d: 0.55 },
};

// width / height: the world size a part is scaled to. drop: the model height that sits below y = 0
// (a tile's slab; the pit sinks all of itself so the spike tips are level with the floor). Tuned in the browser.
export const PARTS = {
  floor_tile_large: { width: 1, drop: 0.15 },
  floor_tile_large_rocks: { width: 1, drop: 0.15 },
  floor_tile_big_spikes: { width: 1, drop: 2.1 },
  wall: { width: 1 },
  chest_gold: { width: 0.75, rotX: 0 },
  coin_stack_medium: { width: 0.28 },
  torch_lit: { height: 0.5 },
};

// Radians. azimuth is turned from +z towards +x; polar from straight up.
export const VIEW = { fov: 35, azimuth: 0.44, azRange: 0.7, polar: 0.81, polarMin: 0.5, polarMax: 1.1 };

const BLOCK = { w: 0.86, h: 0.42, d: 0.86 };

export const cellToWorld = (room, x, y) => ({ x: x - (room.w - 1) / 2, z: y - (room.h - 1) / 2 });

export function worldToCell(room, wx, wz) {
  const x = Math.floor(wx + room.w / 2), y = Math.floor(wz + room.h / 2);
  return x < 0 || y < 0 || x >= room.w || y >= room.h ? null : { x, y };
}

const sizeOf = (spec, dim) => (spec.width ? spec.width / dim.w : spec.height ? spec.height / dim.h : 1);

// Everything the scene draws, as plain entries { part, x, y, z, rotY, rotX?, scale }. Walls also carry side and outward;
// blocks are boxes { x, y (centre), z, w, h, d }.
export function layoutRoom(room, dims = DIMS) {
  const W = room.w, H = room.h;
  const sc = part => sizeOf(PARTS[part], dims[part]);

  const tiles = [], blocks = [];
  let chest = null, coin = null;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = room.cells[j][i], p = cellToWorld(room, i, j);
    const part = c === 'X' ? 'floor_tile_big_spikes' : (i + j * 3) % 7 === 0 ? 'floor_tile_large_rocks' : 'floor_tile_large';
    const scale = sc(part);
    tiles.push({ part, x: p.x, y: -PARTS[part].drop * scale, z: p.z, rotY: 0, scale });
    if (c === '#') blocks.push({ x: p.x, y: BLOCK.h / 2, z: p.z, ...BLOCK });
    if (c === 'T') {
      chest = { part: 'chest_gold', x: p.x - 0.1, y: 0, z: p.z - 0.05, rotY: Math.PI, rotX: PARTS.chest_gold.rotX, scale: sc('chest_gold') };
      coin = { part: 'coin_stack_medium', x: p.x + 0.3, y: 0, z: p.z + 0.28, rotY: 0, scale: sc('coin_stack_medium') };
    }
  }

  // Walls: pieces one cell wide in a ring just outside the floor. rotY puts the model's local -z face
  // outwards (as the spike did), and `outward` is where that face points.
  const ws = sc('wall'), wallD = dims.wall.d * ws, wallH = dims.wall.h * ws;
  const walls = [];
  for (let i = 0; i < W; i++) {
    const x = cellToWorld(room, i, 0).x;
    walls.push({ part: 'wall', side: 'N', x, y: 0, z: -(H / 2 + wallD / 2), rotY: 0, scale: ws, outward: [0, -1] });
    walls.push({ part: 'wall', side: 'S', x, y: 0, z: H / 2 + wallD / 2, rotY: Math.PI, scale: ws, outward: [0, 1] });
  }
  for (let j = 0; j < H; j++) {
    const z = cellToWorld(room, 0, j).z;
    walls.push({ part: 'wall', side: 'W', x: -(W / 2 + wallD / 2), y: 0, z, rotY: Math.PI / 2, scale: ws, outward: [-1, 0] });
    walls.push({ part: 'wall', side: 'E', x: W / 2 + wallD / 2, y: 0, z, rotY: -Math.PI / 2, scale: ws, outward: [1, 0] });
  }

  // The corner model is an L with arms along local -x and +z. The kit centres it on its bounding box, so its outer
  // vertex is cornerSize / 2 from the centre; place it so that vertex meets the ring's outer vertex.
  const cornerSize = dims.wall_corner.w * ws;
  const cx = W / 2 + wallD - cornerSize / 2, cz = H / 2 + wallD - cornerSize / 2;
  const corners = [
    { side: 'NW', x: -cx, z: -cz, rotY: Math.PI / 2 },
    { side: 'NE', x: cx, z: -cz, rotY: 0 },
    { side: 'SE', x: cx, z: cz, rotY: -Math.PI / 2 },
    { side: 'SW', x: -cx, z: cz, rotY: Math.PI },
  ].map(c => ({ part: 'wall_corner', y: 0, scale: ws, ...c }));

  // Two torches on the north wall, on its inner face.
  const ts = sc('torch_lit'), tx = Math.min(1.2, W / 2 - 0.5);
  const torches = [-tx, tx].map(x => ({ part: 'torch_lit', x, y: wallH * 0.42, z: -H / 2 + dims.torch_lit.d * ts / 2, rotY: 0, scale: ts }));

  return { tiles, blocks, chest, coin, walls, corners, torches, wallH, wallD, cornerSize, ringHalf: Math.max(W, H) / 2 + wallD };
}

// Which wall sides face the camera (and so are dropped low). N never does: the camera stays on the south side.
export function nearSides(azimuth) {
  const s = new Set(), eps = 0.05;
  if (Math.cos(azimuth) > eps) s.add('S'); else if (Math.cos(azimuth) < -eps) s.add('N');
  if (Math.sin(azimuth) > eps) s.add('E'); else if (Math.sin(azimuth) < -eps) s.add('W');
  return s;
}

export function cameraPose({ azimuth, polar, dist, target = [0, 0, 0] }) {
  return { position: [
    target[0] + dist * Math.sin(polar) * Math.sin(azimuth),
    target[1] + dist * Math.cos(polar),
    target[2] + dist * Math.sin(polar) * Math.cos(azimuth),
  ] };
}

// Camera distance that keeps a sphere of `radius` in frame at both the vertical and the horizontal field of view. fov in degrees.
export function fitDistance({ w, h, fov, radius }) {
  const half = fov * Math.PI / 360, aspect = w / h;
  return Math.max(radius / Math.sin(half), radius / Math.sin(Math.atan(Math.tan(half) * aspect)));
}

export const roomRadius = (room, wallD) => (Math.max(room.w, room.h) / 2 + wallD) * 1.2 + 0.2;

// The grid cell a ray meets on the floor plane y = 0.
export function rayToCell(room, origin, dir) {
  if (dir[1] >= -1e-9) return null;
  const t = -origin[1] / dir[1];
  if (t < 0) return null;
  return worldToCell(room, origin[0] + dir[0] * t, origin[2] + dir[2] * t);
}

// A tap is a pointer that barely moved and was quick. down and up are { x, y, t } (px, ms).
export const isTap = (down, up, { maxMove = 8, maxMs = 500 } = {}) =>
  Math.hypot(up.x - down.x, up.y - down.y) <= maxMove && up.t - down.t <= maxMs;

// World height of a label quad: bigger on a narrow view so numbers stay readable.
export const labelScale = viewW => 0.24 * Math.min(1.5, Math.max(1, 640 / viewW));

export const tierFor = viewW => (viewW <= 600
  ? { pixelRatioMax: 1.5, shadowMap: 512, torchLights: false }
  : { pixelRatioMax: 2, shadowMap: 1024, torchLights: true });

export const formatStats = ({ fps, calls, triangles, geometries, textures, kb, firstMs }) =>
  `${Math.round(fps)} fps | ${calls} calls | ${(triangles / 1000).toFixed(1)}k tris | ${geometries} geo | ${textures} tex | ${Math.round(kb)} KB | first ${Math.round(firstMs)} ms`;

// Heat tint as [r, g, b, a] (0..1 each): clear when cool, the signal orange at 55% when warm. h is clamped to 0..1, NaN is 0.
const SIGNAL = [1, 0.353, 0.122];
export function heatColor(h, palette = { cool: [...SIGNAL, 0], warm: [...SIGNAL, 0.55] }) {
  const k = h > 0 ? Math.min(1, h) : 0;
  return palette.cool.map((c, i) => c + (palette.warm[i] - c) * k);
}

// The character's moves. A hop between tiles; a slide on ice; a snap when motion is reduced, there is no earlier cell, or nothing moved.
export const MOVE_MS = 350;

export function moveStyle({ from, to, ice = false, reduce = false }) {
  if (reduce || !from || !to || (from.x === to.x && from.y === to.y)) return 'snap';
  return ice ? 'slide' : 'hop';
}

// k runs 0..1 over MOVE_MS; the eased k places the character along the step, lift is how high a hop is off the floor.
export const tweenAt = (style, k) => {
  const c = Math.min(1, Math.max(0, k));
  return { k: c * c * (3 - 2 * c), lift: style === 'hop' ? Math.sin(Math.PI * c) * 0.18 : 0 };
};

// Rotation about y that points the character along a step (south, +y on the grid, is 0).
export const facing = (from, to) => Math.atan2(to.x - from.x, to.y - from.y);

export const atTreasure = (room, pos) => !!pos && room.cells[pos.y]?.[pos.x] === 'T';
