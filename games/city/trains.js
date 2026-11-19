// Trains on the L: two simple box trains that shuttle along one two-track elevated line, one per track. Pure: a train's place is a function of ms alone.
// They run on different tracks (the line's own two rails, `sep` apart), so they never overlap. No sound, no effect on the game.
import { Y_ROAD } from './street-model.js';

export const TRAIN = { l: 16, w: 2.8, h: 3, speed: 14 }; // metres, metres per second
const RAIL_TOP = 0.25; // street-furniture.js RAIL_H: the train sits on the rails

// The longest elevated line with two tracks (a pairRails item with a gap between them), or null.
export function pickLine(rails) {
  let best = null, bestLen = 0;
  for (const r of rails) {
    if (!r.elevated || !(r.sep > 0)) continue;
    const len = trainPath(r.pts).len;
    if (len > bestLen) { best = r; bestLen = len; }
  }
  return best;
}

// The line's points in world coordinates (x, z = -y) with the distance along it at each.
export function trainPath(pts) {
  const p = pts.map(([x, y]) => [x, -y]), cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return { pts: p, cum, len: cum[cum.length - 1] };
}

// The point `s` metres along the path, and its unit heading.
function along(path, s) {
  const { pts, cum } = path;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const [ax, az] = pts[i - 1], [bx, bz] = pts[i], l = Math.max(1e-6, cum[i] - cum[i - 1]), t = Math.min(1, Math.max(0, (s - cum[i - 1]) / l));
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, ux: (bx - ax) / l, uz: (bz - az) / l };
}

// Both trains at `ms`: [{ x, y, z, yaw }] (yaw as street-furniture.js railSegments: a box's length runs along x after turning by yaw).
// One goes out while the other comes back, each on its own track, turning round at the ends.
export function trainsAt(line, path, ms) {
  const L = path.len, u = (Math.max(0, ms) * TRAIN.speed) / 1000;
  const y = Y_ROAD + line.h + (line.lift ?? 0) + RAIL_TOP + TRAIN.h / 2;
  return [0, 1].map((k) => {
    const v = (u + k * L) % (2 * L), back = v >= L, s = back ? 2 * L - v : v;
    const p = along(path, s), d = back ? -1 : 1, lat = (k === 0 ? -1 : 1) * line.sep / 2; // the track is fixed to the line, not the direction
    return { x: p.x - p.uz * lat, z: p.z + p.ux * lat, y, yaw: Math.atan2(-p.uz * d, p.ux * d) };
  });
}
