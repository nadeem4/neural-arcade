// Traffic-signal heads, pure (no DOM, no three.js): a pole at each mapped signal, an arm reaching over the road and a housing with a red, an amber and a green lamp
// on both faces. The lamp colours come from signals.js headState, so a head shows what the sim does. Map metres in, world (y up, north is -z) out.
import { linearRgb } from './buildings-model.js';
import { Y_ROAD, roadWidth } from './street-model.js';
import { headAxis } from './signals.js';

const POLE_H = 9, POLE_W = 0.5, ARM_W = 0.3, ARM_MAX = 7, KERB_GAP = 0.6, BOX_ALONG = 1.1, BOX_ACROSS = 1.3, BOX_H = 3.4, LAMP = 0.8, LAMP_OUT = 0.04;
const COLOURS = {
  red: { on: linearRgb('#FF3B30'), off: linearRgb('#4A1512') },
  amber: { on: linearRgb('#FFB020'), off: linearRgb('#4A3A10') },
  green: { on: linearRgb('#2BE36B'), off: linearRgb('#0F4A24') },
};
const ROLES = ['red', 'amber', 'green']; // top to bottom

const segNearest = (px, py, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return [a[0] + dx * t, a[1] + dy * t];
};

// Where the parts go: the pole, the arm toward the road (unit a, length armLen) and the housing at the arm's end facing along the road (unit u, bearing dir).
// Most mapped heads sit on the carriageway centre line: their pole is moved sideways to just beyond the kerb and the arm reaches back over the road.
export function headPlacement({ x, y, dir }, roads) {
  const th = (dir * Math.PI) / 180, ux = Math.sin(th), uy = Math.cos(th);
  let best = null, bd = Infinity, road = null;
  for (const r of roads) for (let k = 0; k < r.pts.length - 1; k++) {
    const q = segNearest(x, y, r.pts[k], r.pts[k + 1]), d = Math.hypot(q[0] - x, q[1] - y);
    if (d < bd) { bd = d; best = q; road = r; }
  }
  if (best && road && bd < roadWidth(road) / 2) {
    const nx = -uy, ny = ux, side = (x - best[0]) * nx + (y - best[1]) * ny < 0 ? -1 : 1, off = roadWidth(road) / 2 + KERB_GAP;
    return { x: best[0] + nx * side * off, y: best[1] + ny * side * off, ux, uy, ax: -nx * side, ay: -ny * side, armLen: Math.min(off, ARM_MAX) };
  }
  let ax = -uy, ay = ux, armLen = 0;
  if (best && bd > 0.5) { ax = (best[0] - x) / bd; ay = (best[1] - y) / bd; armLen = Math.min(bd, ARM_MAX); }
  return { x, y, ux, uy, ax, ay, armLen };
}

// A box from min to max corners in a local frame (origin o, axes u, a in map metres, up in y), with per-face normals.
function box(P, N, I, o, u, a, [u0, u1], [a0, a1], [y0, y1]) {
  const pt = (uu, aa, yy) => [o[0] + u[0] * uu + a[0] * aa, yy, -(o[1] + u[1] * uu + a[1] * aa)];
  const nrm = (uu, aa, yy) => [u[0] * uu + a[0] * aa, yy, -(u[1] * uu + a[1] * aa)];
  const faces = [
    [[1, 0, 0], [[u1, a0, y0], [u1, a1, y0], [u1, a1, y1], [u1, a0, y1]]],
    [[-1, 0, 0], [[u0, a1, y0], [u0, a0, y0], [u0, a0, y1], [u0, a1, y1]]],
    [[0, 1, 0], [[u1, a1, y0], [u0, a1, y0], [u0, a1, y1], [u1, a1, y1]]],
    [[0, -1, 0], [[u0, a0, y0], [u1, a0, y0], [u1, a0, y1], [u0, a0, y1]]],
    [[0, 0, 1], [[u0, a0, y1], [u1, a0, y1], [u1, a1, y1], [u0, a1, y1]]],
  ];
  for (const [n, corners] of faces) {
    const base = P.length / 3, nn = nrm(...n);
    for (const c of corners) { P.push(...pt(...c)); N.push(...nn); }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

// All the heads as two meshes: `body` (poles, arms, housings; positions, normals, indices) and `lamps` (positions, indices, a colour per vertex,
// and `list`, one {axis, role, first} per lamp quad, `first` being its first vertex, so paintLamps can recolour them).
export function buildSignalHeads(heads, roads) {
  const bp = [], bn = [], bi = [], lp = [], li = [], list = [];
  for (const head of heads) {
    const p = headPlacement(head, roads), o = [p.x, p.y], u = [p.ux, p.uy], a = [p.ax, p.ay];
    const axis = headAxis(head.dir); // 0 is the north-south phase, 1 the east-west; scene.js repaints the lamps by axis
    const top = Y_ROAD + POLE_H;
    box(bp, bn, bi, o, u, a, [-POLE_W / 2, POLE_W / 2], [-POLE_W / 2, POLE_W / 2], [Y_ROAD, top]);
    if (p.armLen > 0) box(bp, bn, bi, o, u, a, [-ARM_W / 2, ARM_W / 2], [0, p.armLen], [top - 0.7, top - 0.7 + ARM_W]);
    const c = [p.x + p.ax * p.armLen, p.y + p.ay * p.armLen], y1 = top - 0.5, y0 = y1 - BOX_H;
    box(bp, bn, bi, c, u, a, [-BOX_ALONG / 2, BOX_ALONG / 2], [-BOX_ACROSS / 2, BOX_ACROSS / 2], [y0, y1]);
    for (const face of [1, -1]) {
      ROLES.forEach((role, k) => {
        const yc = y1 - BOX_H / 2 + (1 - k) * 1.05, off = face * (BOX_ALONG / 2 + LAMP_OUT), base = lp.length / 3;
        for (const [da, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          lp.push(c[0] + u[0] * off + a[0] * da * LAMP / 2, yc + dy * LAMP / 2, -(c[1] + u[1] * off + a[1] * da * LAMP / 2));
        }
        li.push(base, base + 1, base + 2, base, base + 2, base + 3);
        list.push({ axis, role, first: base });
      });
    }
  }
  return {
    body: { positions: new Float32Array(bp), normals: new Float32Array(bn), indices: new Uint32Array(bi) },
    lamps: { positions: new Float32Array(lp), indices: new Uint32Array(li), colors: new Float32Array(lp.length), list },
  };
}

// Colour every lamp for the states { 0: 'stop' | 'go', 1: ... } by axis: red lit on stop, green lit on go, amber always dim.
export function paintLamps(lamps, states) {
  for (const { axis, role, first } of lamps.list) {
    const lit = (role === 'red' && states[axis] === 'stop') || (role === 'green' && states[axis] === 'go');
    const c = COLOURS[role][lit ? 'on' : 'off'];
    for (let v = 0; v < 4; v++) lamps.colors.set(c, (first + v) * 3);
  }
  return lamps.colors;
}
