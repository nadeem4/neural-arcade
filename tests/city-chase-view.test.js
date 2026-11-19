import { describe, it, expect } from 'vitest';
import { treesToHide, clampDistance, domeRadius, cameraFar } from '../games/city/scene-math.js';
import { sunPlacement } from '../games/city/sky.js';
import { foldTag } from '../games/city/events.js';
import { meterText } from '../games/city/meter.js';

describe('treesToHide', () => {
  // xyz triples; only x and z matter
  const pos = new Float32Array([0, 0, 0, 100, 0, 100, 50, 0, 3, 10, 0, 10]);
  it('hides trees within 15 m of the camera', () => {
    expect(treesToHide(pos, [0, 5], [200, -200])).toContain(0);
    expect(treesToHide(pos, [0, 5], [200, -200])).not.toContain(1);
  });
  it('hides trees near the line from camera to taxi', () => {
    const hide = treesToHide(pos, [0, 0], [100, 0]);
    expect(hide).toContain(2); // 3 m off the line
    expect(hide).not.toContain(1); // far off the line
  });
  it('does not hide trees behind the taxi or behind the camera', () => {
    const hide = treesToHide(new Float32Array([150, 0, 0, -60, 0, 0]), [0, 0], [100, 0]);
    expect(hide).toEqual([]);
  });
});

describe('foldTag', () => {
  it('counts the same tag on consecutive steps', () => {
    const a = foldTag(null, { text: '-20 park tile', kind: 'fine' }, 3);
    const b = foldTag(a, { text: '-20 park tile', kind: 'fine' }, 4, true);
    expect(a.count).toBe(1);
    expect(b.count).toBe(2);
    expect(b.label).toBe('-20 park tile ×2');
    expect(a.label).toBe('-20 park tile');
  });
  it('starts again for a different tag, or when the earlier bubble is gone', () => {
    const a = foldTag(null, { text: 'x', kind: 'fine' }, 3);
    expect(foldTag(a, { text: 'y', kind: 'fine' }, 4, true).count).toBe(1);
    expect(foldTag(a, { text: 'x', kind: 'fine' }, 4, false).count).toBe(1);
  });
  it('folds into a live bubble of the same words however many steps later (alternating offences)', () => {
    let run = foldTag(null, { text: 'x', kind: 'fine' }, 3);
    run = foldTag(run, { text: 'x', kind: 'fine' }, 9, true);
    run = foldTag(run, { text: 'x', kind: 'fine' }, 20, true);
    expect(run.count).toBe(3);
    expect(run.label).toBe('x ×3');
  });
  it('the counts per label over a trip add up to the offences', async () => {
    const { readFileSync } = await import('node:fs');
    const { loadWorld } = await import('../games/city/sim.js');
    const { tripEvents, tagsFor } = await import('../games/city/events.js');
    const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
    const world = loadWorld(read('chicago.json')), c = read('story.json').cards.find((x) => x.id === 'speed');
    const events = tripEvents(world, c.rewards, c.route);
    const bubbles = {}, done = [];
    events.steps.forEach((s, i) => { for (const tg of tagsFor(s, c.rewards).filter((x) => x.kind === 'fine')) { const prev = bubbles[tg.text]; const run = foldTag(prev, tg, i, !!prev); if (run.count === 1 && prev) done.push(prev); bubbles[tg.text] = run; } });
    const total = {}; for (const r of [...done, ...Object.values(bubbles)]) total[r.text] = (total[r.text] ?? 0) + r.count;
    expect(total['footpath tile: free'] ?? total['-' + c.rewards.off + ' footpath tile']).toBe(c.analysis.offTiles - c.analysis.parkTiles);
  });
});

describe('meterText', () => {
  it('rounds to whole numbers with a real minus sign and a plus for gains', () => {
    expect(meterText(-23.9)).toBe('−24');
    expect(meterText(-20.6)).toBe('−21');
    expect(meterText(12.4)).toBe('+12');
    expect(meterText(0)).toBe('0');
    expect(meterText(-0.2)).toBe('0');
  });
});

describe('sunPlacement', () => {
  const base = { radius: 1000, cx: 500, cz: 500 };
  const map = sunPlacement({ ...base, chase: false }), chase = sunPlacement({ ...base, chase: true, x: 800, z: 300 });
  const dir = (p) => { const v = p.position.map((a, i) => a - p.target[i]); const l = Math.hypot(...v); return v.map((a) => a / l); };
  it('lights map and chase from the same direction', () => {
    dir(map).forEach((a, i) => expect(a).toBeCloseTo(dir(chase)[i], 6));
  });
  it('covers the city on the map and a patch around the taxi in the chase', () => {
    expect(map.half).toBe(1000);
    expect(chase.half).toBeLessThan(map.half);
    expect(chase.target).toEqual([800, 0, 300]);
    expect(map.target).toEqual([500, 0, 500]);
  });
});

describe('camera far plane', () => {
  it('covers the farthest orbit camera plus the sky dome radius', () => {
    const r = 1000;
    expect(cameraFar(r)).toBeGreaterThan(clampDistance(Infinity, r) + domeRadius(r));
  });
});
