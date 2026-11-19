import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { createTraffic, taxiOf, trafficTier, newPoses, honkLook } from '../games/city/traffic.js';
import { tripEvents } from '../games/city/events.js';
import { createTrafficLayer } from '../games/city/scene-traffic.js';

const CITY = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8'));
const world = loadWorld(CITY);
const walk = JSON.parse(readFileSync(new URL('../games/city/story.json', import.meta.url), 'utf8')).cards.find((c) => c.id === 'walk');
const taxi = taxiOf(tripEvents(world, walk.rewards, walk.route));

describe('honk flash', () => {
  it('honkLook is a pure function of the tick: on, off, on at 4 Hz, and a calm car never flashes', () => {
    const on = honkLook(true, 0.1), off = honkLook(true, 0.3);
    expect(on).toEqual(honkLook(true, 0.1));
    expect(on.head).toBe(1); expect(on.halo).toBe(1); expect(on.bodyMix).toBeGreaterThan(0.3);
    expect(off.head).toBeLessThan(0.1); expect(off.halo).toBe(0); expect(off.bodyMix).toBe(0);
    expect(honkLook(true, 0.6).head).toBe(1);
    for (const tf of [0.1, 0.3, 7.7]) expect(honkLook(false, tf)).toEqual({ head: 0.55, halo: 0, bodyMix: 0 });
  });
  it('a honking car gets a halo and a body glow on the flash, and every other car stays plain', () => {
    const tier = trafficTier({ phone: false });
    const layer = createTrafficLayer({ tier });
    const traffic = createTraffic(world, { seed: 3, count: tier.count, cellM: CITY.cellM, taxi });
    traffic.bakeTo(taxi.cells.length);
    expect(traffic.nearMisses().length).toBeGreaterThan(0);
    layer.begin(traffic);
    const [body, , , halos] = layer.group.children;
    const base = Array.from(body.instanceColor.array);
    const p = newPoses(traffic.count);
    let sawHalo = false, sawGlow = false;
    for (let f = 0; f < taxi.cells.length; f += 0.25) {
      layer.update(f);
      traffic.posesAt(f, p);
      for (let i = 0; i < traffic.count; i++) {
        const m = halos.instanceMatrix.array[i * 16], c = body.instanceColor.array[i * 3];
        if (p.alarm[i]) { if (m !== 0) sawHalo = true; if (c > base[i * 3] + 0.05) sawGlow = true; }
        else { expect(m).toBe(0); expect(c).toBeCloseTo(base[i * 3], 5); }
      }
    }
    expect(sawHalo).toBe(true); expect(sawGlow).toBe(true);
    layer.dispose();
  });
});
