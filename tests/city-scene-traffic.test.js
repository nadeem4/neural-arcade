import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { createTraffic, trafficTier, newPoses, taxiOf } from '../games/city/traffic.js';
import { createTrafficLayer, CAR_SCALE } from '../games/city/scene-traffic.js';
import { createFallbackStage } from '../games/city/stage.js';

const CITY = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8'));
const world = loadWorld(CITY);
const make = (phone, count) => {
  const tier = trafficTier({ phone });
  const layer = createTrafficLayer({ tier, cellM: CITY.cellM });
  const traffic = createTraffic(world, { seed: 3, count: count ?? tier.count, cellM: CITY.cellM });
  return { tier, layer, traffic };
};

describe('traffic layer: draw calls and instances', () => {
  it('desktop draws three instanced meshes (bodies, head lamps, tail lamps) for every car', () => {
    const { layer, traffic } = make(false);
    layer.begin(traffic);
    expect(layer.drawCalls).toBe(3);
    expect(layer.instances).toBe(40);
    expect(layer.group.children).toHaveLength(3);
    expect(layer.group.children.every((m) => m.isInstancedMesh && m.count === 40)).toBe(true);
    layer.dispose();
  });
  it('phone draws one instanced mesh, fewer cars and no lamps', () => {
    const { layer, traffic } = make(true);
    layer.begin(traffic);
    expect(layer.drawCalls).toBe(1);
    expect(layer.instances).toBe(16);
    expect(layer.group.children).toHaveLength(1);
    layer.dispose();
  });
  it('startTrip builds the cars from a trip\'s events, with the tier\'s car count', () => {
    const tier = trafficTier({ phone: false });
    const layer = createTrafficLayer({ tier });
    layer.startTrip(world, CITY.cellM, { steps: [{ red: false, wrong: false, from: 1000, cell: 1000 }] });
    expect(layer.instances).toBe(40);
    expect(layer.group.visible).toBe(true);
    layer.update(2.5);
    layer.dispose();
  });
  it('is hidden until a trip begins and after it stops', () => {
    const { layer, traffic } = make(false);
    expect(layer.group.visible).toBe(false);
    layer.begin(traffic); expect(layer.group.visible).toBe(true);
    layer.stop(); expect(layer.group.visible).toBe(false);
    layer.dispose();
  });
});

describe('traffic layer: per frame', () => {
  it('writes each car at its pose, scaled like the taxi, and gives the same frame twice', () => {
    const { layer, traffic } = make(false);
    layer.begin(traffic);
    layer.update(5.3);
    const body = layer.group.children[0], first = Array.from(body.instanceMatrix.array);
    const p = newPoses(traffic.count); traffic.posesAt(5.3, p);
    for (let i = 0; i < traffic.count; i++) {
      const m = first.slice(i * 16, i * 16 + 16);
      expect(m[12]).toBeCloseTo(p.x[i], 4); expect(m[14]).toBeCloseTo(p.z[i], 4);
      expect(Math.hypot(m[0], m[2])).toBeCloseTo(CAR_SCALE, 4);
      expect(m[13]).toBeGreaterThan(0);
    }
    layer.update(9.1); layer.update(5.3);
    expect(Array.from(body.instanceMatrix.array)).toEqual(first);
    layer.dispose();
  });
  it('brake lamps are brighter on a braking car than a moving one', () => {
    const { layer, traffic } = make(false);
    layer.begin(traffic);
    let lo = Infinity, hi = -Infinity;
    for (let f = 0; f < 30; f += 0.5) { layer.update(f); const tails = layer.group.children[2].instanceColor.array; for (let i = 0; i < traffic.count; i++) { lo = Math.min(lo, tails[i * 3]); hi = Math.max(hi, tails[i * 3]); } }
    expect(hi).toBeGreaterThan(lo);
    layer.dispose();
  });
  it('colours the cars from a seeded palette: the same seed, the same colours, and not all alike', () => {
    const a = make(false), b = make(false);
    a.layer.begin(a.traffic); b.layer.begin(b.traffic);
    const ca = Array.from(a.layer.group.children[0].instanceColor.array);
    expect(ca).toEqual(Array.from(b.layer.group.children[0].instanceColor.array));
    expect(new Set(ca.map((v) => v.toFixed(3))).size).toBeGreaterThan(3);
    a.layer.dispose(); b.layer.dispose();
  });
  it('honks at most once a frame, and drops honks more than a tick old', () => {
    const w = loadWorld({ cols: 12, rows: 1, cellM: 12, lightPeriod: 8, kind: ['r'.repeat(12)], oneway: ['.'.repeat(12)], signals: [], pickup: [0, 0], dropoff: [11, 0] });
    const mk = () => {
      const layer = createTrafficLayer({ tier: trafficTier({ phone: false }), cellM: 12 });
      layer.begin(createTraffic(w, { seed: 2, count: 8, cellM: 12, taxi: taxiOf({ steps: [{ red: false, wrong: true, from: 5, cell: 4 }, { red: false, wrong: true, from: 4, cell: 3 }] }) }));
      return layer;
    };
    const layer = mk();
    let total = 0;
    for (let f = 0; f < 6; f += 0.25) { let calls = 0; layer.update(f, () => { calls++; }); expect(calls).toBeLessThanOrEqual(1); total += calls; }
    expect(total).toBeGreaterThan(0);
    layer.dispose();
    const late = mk(); // a background tab: the clock jumps far past the honks
    late.update(0, () => {});
    let stale = 0; late.update(40, () => { stale++; });
    expect(stale).toBe(0);
    late.dispose();
  });
});

describe('the no-WebGL fallback is unchanged by traffic', () => {
  it('still plays a trip to its end with no traffic', () => {
    const stage = createFallbackStage(null, 'x');
    let done = 0; stage.playTrip({ onDone: () => done++ });
    expect(done).toBe(1);
    expect(stage.ready).toBe(false);
  });
});
