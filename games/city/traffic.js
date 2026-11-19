// Reward City traffic: other cars as scenery. Pure and deterministic, no DOM, no three.js.
// Cars drive the road cells of the same world the sim uses, one cell per tick, on the sim's own light function.
// They only REACT to the taxi (they brake and stop for it, and honk when it breaks a rule near them); nothing here
// feeds back into the sim, the reward, the Q-table, training or any number on the page.
// State is stepped one tick at a time from (seed, taxi route) with a seeded generator: no clock and no unseeded random numbers.
import { mulberry32 } from '../../engine/rng.js';
import { ACTIONS, lightRed } from './sim.js';

export const LANE_M = 3.4;      // metres to the right of the cell centre line (a 1.5x car is 2.85 m wide, so it clears a taxi on the centre line)
export const NEAR_CELLS = 2;    // a taxi rule-break within this many cells (either axis) is a near miss
export const HONK_GAP = 4;      // ticks before the same car honks again
const EVAC_TICKS = 8;           // a car standing where the taxi will be within this many ticks looks for any way out
const STUCK_TICKS = 8;          // a car that has not moved for this long picks a new way
const SPAWN_RADIUS = 14;        // cars start within this many cells of the taxi's route, so the drive shows them

// Cars per quality tier. Phones get fewer and no lamp meshes.
const TIERS = { desktop: { count: 90, lamps: true }, phone: { count: 16, lamps: false } };
export const trafficTier = ({ phone = false } = {}) => ({ ...(phone ? TIERS.phone : TIERS.desktop) });

// Body colours (sRGB hex), picked by a seeded hash of the car's number.
const PALETTE = [0xb9bcc0, 0x2c3b57, 0x8e3030, 0xe6e0cf, 0x3e5a47, 0x1f1f23, 0xc7a13a, 0x5e6e80, 0x7a4f35, 0xe9e9e9];
export const carColour = (seed, i) => PALETTE[Math.floor(mulberry32((seed * 7919 + i * 104729 + 1) >>> 0)() * PALETTE.length)];

// The taxi as traffic needs it: its cell at each tick and what rule it breaks on each tick ('red', 'wrong' or false).
export function taxiOf(events) {
  const steps = events.steps;
  const cells = steps.length ? [steps[0].from, ...steps.map((s) => s.cell)] : [];
  return { cells, alarm: (n) => (steps[n] ? (steps[n].red ? 'red' : steps[n].wrong ? 'wrong' : false) : false) };
}

const heading = (a) => Math.atan2(ACTIONS[a].dc, ACTIONS[a].dr); // forward = (sin h, cos h) in (x, z); north is -z
const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const smooth = (u) => u * u * (3 - 2 * u);

// One Float32Array per field, so the per-frame pose fill allocates nothing.
export const newPoses = (n) => ({ x: new Float32Array(n), z: new Float32Array(n), h: new Float32Array(n), braking: new Uint8Array(n), alarm: new Uint8Array(n) });

// The legal moves from each road cell: onto a road cell, never against a one-way (the sim's own wrong-way rule).
function exitMasks(world) {
  const { cols, rows, kind, oneway } = world;
  const mask = new Uint8Array(cols * rows);
  for (let c = 0; c < cols * rows; c++) {
    if (kind[c] !== 0) continue;
    for (let a = 0; a < 4; a++) {
      const r = Math.floor(c / cols) + ACTIONS[a].dr, col = (c % cols) + ACTIONS[a].dc;
      if (r < 0 || r >= rows || col < 0 || col >= cols) continue;
      const t = r * cols + col;
      if (kind[t] !== 0) continue;
      if ((oneway[c] >= 0 && (oneway[c] + 2) % 4 === a) || (oneway[t] >= 0 && (oneway[t] + 2) % 4 === a)) continue;
      mask[c] |= 1 << a;
    }
  }
  return mask;
}

// The biggest set of road cells that can reach one another, so no car starts on an island.
function mainRoads(world, mask) {
  const { cols } = world, n = mask.length, comp = new Int32Array(n).fill(-1), sizes = [];
  const adj = (c, a) => c + ACTIONS[a].dr * cols + ACTIONS[a].dc;
  for (let s = 0; s < n; s++) {
    if (!mask[s] || comp[s] >= 0) continue;
    const id = sizes.length; let size = 0; const stack = [s]; comp[s] = id;
    while (stack.length) {
      const c = stack.pop(); size++;
      for (let a = 0; a < 4; a++) {
        if (!(mask[c] >> a & 1)) continue;
        const t = adj(c, a);
        if (comp[t] < 0) { comp[t] = id; stack.push(t); }
      }
      for (let a = 0; a < 4; a++) { // and the cells that lead into c
        const t = adj(c, a);
        if (t >= 0 && t < n && comp[t] < 0 && mask[t] >> ((a + 2) % 4) & 1) { comp[t] = id; stack.push(t); }
      }
    }
    sizes.push(size);
  }
  const best = sizes.indexOf(Math.max(...sizes));
  return (c) => comp[c] === best;
}

export function createTraffic(world, { seed = 1, count = 40, cellM = 12, taxi = null } = {}) {
  const { cols, rows } = world, N = cols * rows;
  const mask = exitMasks(world), inMain = mainRoads(world, mask);
  const rng = mulberry32(seed);
  const taxiAt = (n) => (taxi && taxi.cells.length ? taxi.cells[Math.min(n, taxi.cells.length - 1)] : -1);
  const near = (a, b) => b >= 0 && Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) <= NEAR_CELLS && Math.abs((a % cols) - (b % cols)) <= NEAR_CELLS;
  const optionsOf = (c, from) => { const o = []; for (let a = 0; a < 4; a++) if (mask[c] >> a & 1) o.push(a); return from < 0 ? o : o.filter((a) => a !== (from + 2) % 4); };

  // Spawn: seeded shuffle of the main-road cells near the taxi's route (all of them if few), away from the taxi's first cells.
  const taxiCells = taxi ? taxi.cells : [];
  const keepOut = new Set([taxiAt(0), taxiAt(1), taxiAt(2)]);
  let cand = [];
  for (let c = 0; c < N; c++) if (mask[c] && inMain(c) && !keepOut.has(c)) cand.push(c);
  if (taxiCells.length) {
    const close = cand.filter((c) => taxiCells.some((t) => Math.abs(Math.floor(c / cols) - Math.floor(t / cols)) <= SPAWN_RADIUS && Math.abs((c % cols) - (t % cols)) <= SPAWN_RADIUS));
    if (close.length >= count * 3) cand = close;
  }
  const n = Math.min(count, cand.length);
  for (let i = 0; i < n; i++) { const j = i + Math.floor(rng() * (cand.length - i)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const cell = Int32Array.from(cand.slice(0, n)), dir = new Int8Array(n), intent = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) { const o = optionsOf(cell[i], -1); dir[i] = o[Math.floor(rng() * o.length)]; }
  const idle = new Uint8Array(n), lastHonk = new Int32Array(n).fill(-1000);
  const occ = new Int32Array(N).fill(-1);
  // Where a car stuck in the taxi's way is put: main-road cells more than 3 cells from every cell of the route, with no car beside them.
  const away = [];
  for (let c = 0; c < N; c++) if (mask[c] && inMain(c) && !taxiCells.some((t) => Math.abs(Math.floor(c / cols) - Math.floor(t / cols)) <= 3 && Math.abs((c % cols) - (t % cols)) <= 3)) away.push(c);
  const roomAround = (c) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const r = Math.floor(c / cols) + dr, q = (c % cols) + dc;
      if (r >= 0 && r < rows && q >= 0 && q < cols && occ[r * cols + q] >= 0) return false;
    }
    return true;
  };
  const snaps = [{ cell: cell.slice(), dir: dir.slice(), moved: new Uint8Array(n), alarm: new Uint8Array(n) }];
  const honks = [];

  const choose = (i) => {
    const o = optionsOf(cell[i], dir[i]);
    const list = o.length ? o : optionsOf(cell[i], -1);
    const weighted = [];
    for (const a of list) { weighted.push(a); if (a === dir[i]) weighted.push(a); } // straight on is twice as likely
    intent[i] = weighted[Math.floor(rng() * weighted.length)];
  };

  // Advances the cars from tick k to k + 1. Light tests use tick k, exactly as the sim does for a step at tick k.
  const step = (k) => {
    const t0 = taxiAt(k), t1 = taxiAt(k + 1), t2 = taxiAt(k + 2), t3 = taxiAt(k + 3);
    const ahead = []; for (let j = 1; j <= EVAC_TICKS; j++) ahead.push(taxiAt(k + j));
    const rule = taxi ? taxi.alarm(k) : false;
    const rec = snaps[k], moved = rec.moved, alarm = rec.alarm, done = new Uint8Array(n);
    occ.fill(-1);
    for (let i = 0; i < n; i++) occ[cell[i]] = i;
    for (let i = 0; i < n; i++) {
      if (intent[i] < 0) choose(i);
      if (rule && near(cell[i], t1)) { // the taxi is breaking a rule beside us: brake hard and honk
        alarm[i] = 1; done[i] = 1;
        if (k - lastHonk[i] >= HONK_GAP) { lastHonk[i] = k; honks.push({ tick: k, car: i, kind: rule }); }
      }
    }
    const canGo = (i, a) => {
      if (!(mask[cell[i]] >> a & 1)) return -1;
      const to = cell[i] + ACTIONS[a].dr * cols + ACTIONS[a].dc;
      if (to === t0 || to === t1 || to === t2 || to === t3) return -1; // never into the taxi's cell, or the one it is about to take
      if (world.signal[to] && lightRed(world, k, a)) return -1;
      return to;
    };
    const go = (i, a, to) => { cell[i] = to; dir[i] = a; moved[i] = 1; done[i] = 1; intent[i] = -1; };
    // A car only moves into a cell that was empty when the tick began: occ keeps every car's old cell until the tick ends,
    // so a follower never enters the cell its leader is leaving (their boxes would overlap). Head-on pairs may swap.
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      const evac = ahead.includes(cell[i]); // the taxi will pass here soon: any legal way out will do
      const tries = evac ? [intent[i], ...optionsOf(cell[i], -1).filter((a) => a !== intent[i])] : [intent[i]];
      for (const a of tries) {
        const to = canGo(i, a);
        if (to < 0) continue;
        const j = occ[to], from = cell[i];
        if (j < 0) { go(i, a, to); occ[to] = i; break; }
        if (!done[j] && dir[i] === a && dir[j] === intent[j] && intent[j] === (a + 2) % 4 && canGo(j, intent[j]) === from) { // head-on and both already straight: they pass in their own lanes
          const aj = intent[j];
          go(i, a, to); go(j, aj, from); occ[to] = i; occ[from] = j; break;
        }
      }
    }
    // A car still standing where the taxi is or will be next (queued at a red, boxed in) is put on a free cell away from the route.
    for (let i = 0; i < n; i++) {
      if (cell[i] !== t1 && cell[i] !== t2) continue;
      const start = Math.floor(rng() * (away.length || 1));
      for (let q = 0; q < away.length; q++) {
        const c = away[(start + q) % away.length];
        if (!roomAround(c)) continue;
        occ[cell[i]] = -1; cell[i] = c; occ[c] = i;
        const o = optionsOf(c, -1); dir[i] = o[Math.floor(rng() * o.length)];
        intent[i] = -1; idle[i] = 0; moved[i] = 0;
        break;
      }
    }
    for (let i = 0; i < n; i++) {
      idle[i] = moved[i] ? 0 : idle[i] + 1;
      if (idle[i] >= STUCK_TICKS) { intent[i] = -1; idle[i] = 0; } // stuck: pick another way
    }
    snaps.push({ cell: cell.slice(), dir: dir.slice(), moved: new Uint8Array(n), alarm: new Uint8Array(n) });
  };

  const bakeTo = (t) => { while (snaps.length <= t) step(snaps.length - 1); };
  const centre = (c) => [(c % cols + 0.5) * cellM, -(rows - 1 - Math.floor(c / cols) + 0.5) * cellM];

  return {
    count: n, seed,
    snap(t) { bakeTo(t); return snaps[t]; },
    bakeTo,
    // With no argument, the live list of every honk baked so far (no copy, so a per-frame call allocates nothing); do not change it.
    nearMisses(upTo = Infinity) { return upTo === Infinity ? honks : honks.filter((h) => h.tick < upTo); },
    // Fills `out` (newPoses) with every car at time `tf` ticks: eased between cells, right-hand lane, turning early.
    posesAt(tf, out) {
      const k = Math.max(0, Math.floor(tf)), u = Math.max(0, tf) - k;
      bakeTo(k + 2);
      const a = snaps[k], b = snaps[k + 1], prev = k > 0 ? snaps[k - 1] : null;
      for (let i = 0; i < n; i++) {
        const mv = a.moved[i];
        const [x0, z0] = centre(a.cell[i]);
        let x = x0, z = z0, h = heading(a.dir[i]);
        if (mv) {
          const [x1, z1] = centre(b.cell[i]);
          const f = (prev && prev.moved[i] && b.moved[i]) ? u : smooth(u);
          x += (x1 - x0) * f; z += (z1 - z0) * f;
          h += turn(h, heading(b.dir[i])) * smooth(Math.min(1, u * 2)); // eased in and out, done by the half way mark
        }
        out.x[i] = x - Math.cos(h) * LANE_M; out.z[i] = z + Math.sin(h) * LANE_M; out.h[i] = h;
        out.braking[i] = !mv || (!b.moved[i] && u > 0.5) ? 1 : 0;
        out.alarm[i] = a.alarm[i];
      }
    },
  };
}

export const nearMissCount = (traffic, upTo = Infinity) => traffic.nearMisses(upTo).length;

// How a car's lamps look at tick-time tf (a float, from the clock). A honking car flashes at 4 Hz: head lamps full then nearly dark, a halo of
// big lamp blocks on the front and a glow on the whole body, so the flash reads from the chase camera whichever way the car faces.
const FLASH_HZ = 4;
const CALM = Object.freeze({ head: 0.55, halo: 0, bodyMix: 0 }), FLASH_ON = Object.freeze({ head: 1, halo: 1, bodyMix: 0.6 }), FLASH_OFF = Object.freeze({ head: 0.02, halo: 0, bodyMix: 0 });
export function honkLook(alarm, tf) { // shared constants: no allocation per car per frame; do not change the result
  if (!alarm) return CALM;
  return Math.floor(Math.max(0, tf) * FLASH_HZ) % 2 === 0 ? FLASH_ON : FLASH_OFF;
}
