// Builds the static 3D room from the kit. One cell = 1 world unit (the measured floor tile width).
import * as THREE from 'three';

export function buildRoom(kit, room) {
  const group = new THREE.Group(), front = new THREE.Group(); // front = south and east walls, switchable
  const W = room.w, H = room.h;
  const cell = (x, y) => new THREE.Vector3(x - (W - 1) / 2, 0, y - (H - 1) / 2);
  const put = (obj, pos, rotY = 0, parent = group) => { obj.position.copy(pos); obj.rotation.y = rotY; parent.add(obj); return obj; };

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = room.cells[y][x];
    const name = c === 'X' ? 'floor_tile_big_spikes' : (x + y * 3) % 7 === 0 ? 'floor_tile_large_rocks' : 'floor_tile_large';
    const tile = kit.make(name, { width: 1 });
    const p = cell(x, y); p.y = -tile.userData.dims.h; // tile top sits at y = 0
    put(tile, p);
    if (c === '#') put(kit.make('pillar', { width: 0.7 }), cell(x, y));
    if (c === 'T') {
      put(kit.make('chest_gold', { width: 0.75 }), cell(x, y).add(new THREE.Vector3(-0.1, 0, -0.05)), Math.PI);
      put(kit.make('coin_stack_medium', { width: 0.28 }), cell(x, y).add(new THREE.Vector3(0.3, 0, 0.28)));
    }
  }

  // Walls: pieces scaled to one cell wide, ring just outside the floor.
  const probe = kit.make('wall', { width: 1 }), wd = probe.userData.dims, off = 0.5 + wd.d / 2;
  const wall = () => kit.make('wall', { width: 1 });
  for (let i = 0; i < W; i++) {
    const x = i - (W - 1) / 2;
    put(wall(), new THREE.Vector3(x, 0, -H / 2 - wd.d / 2), 0);
    put(wall(), new THREE.Vector3(x, 0, H / 2 + wd.d / 2), Math.PI, front);
  }
  for (let j = 0; j < H; j++) {
    const z = j - (H - 1) / 2;
    put(wall(), new THREE.Vector3(-W / 2 - wd.d / 2, 0, z), Math.PI / 2);
    put(wall(), new THREE.Vector3(W / 2 + wd.d / 2, 0, z), -Math.PI / 2, front);
  }
  const cx = W / 2 + wd.d / 2, cz = H / 2 + wd.d / 2, cs = wd.w / kit.dims.wall.w; // corner scaled like the wall
  const corner = () => kit.make('wall_corner', { scale: wd.w / kit.dims.wall.w });
  put(corner(), new THREE.Vector3(-cx, 0, -cz), 0);
  put(corner(), new THREE.Vector3(cx, 0, -cz), -Math.PI / 2, front);
  put(corner(), new THREE.Vector3(cx, 0, cz), Math.PI, front);
  put(corner(), new THREE.Vector3(-cx, 0, cz), Math.PI / 2, front);
  group.add(front);

  // Two torches on the north wall, each with a warm point light just in front of the flame.
  const torches = [];
  for (const x of [-1.2, 1.2]) {
    const t = kit.make('torch_lit', { height: 0.5 }), td = t.userData.dims;
    put(t, new THREE.Vector3(x, wd.h * 0.42, -H / 2 + td.d / 2));
    const light = new THREE.PointLight(0xffa24a, 7, 0, 2);
    light.position.set(x, wd.h * 0.42 + td.h * 0.9, -H / 2 + 0.35);
    group.add(light); torches.push(light);
  }
  console.log(`[room] wall ${wd.w.toFixed(2)} x ${wd.h.toFixed(2)} x ${wd.d.toFixed(2)} world units, corner scale ${cs.toFixed(3)}`);
  return { group, front, torches, cell, wallH: wd.h, wallD: wd.d, half: Math.max(W, H) / 2 + wd.d };
}
