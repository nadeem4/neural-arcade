import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, analyzeRoute } from '../games/city/sim.js';
import { buildReceipt } from '../games/city/receipt.js';
import { tripEvents, tagsFor, layoutTags, TAG_SLOT_PX, MAX_TAG_SLOTS, TAG_LIFE_MS, tagPlace } from '../games/city/events.js';
import { pruneTags } from '../games/city/record.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const world = loadWorld(read('chicago.json'));
const cards = read('story.json').cards; // real seeded routes: speed, walk, lights, legal, mile
const card = (id) => cards.find((c) => c.id === id);

describe('tripEvents', () => {
  for (const id of ['speed', 'walk', 'legal']) {
    it(`totals equal analyzeRoute and the receipt on the ${id} card`, () => {
      const { rewards, route } = card(id);
      const ev = tripEvents(world, rewards, route);
      const a = analyzeRoute(world, route, rewards);
      expect(ev.totals).toEqual(a);
      expect(ev.steps.reduce((s, st) => s + st.delta, 0)).toBeCloseTo(a.reward, 6);
      expect(Math.round(ev.totals.reward * 10) / 10).toBe(buildReceipt(rewards, a).total);
    });
  }

  it('flags a red-light run on the walk card', () => {
    const { rewards, route } = card('walk');
    const ev = tripEvents(world, rewards, route);
    const reds = ev.steps.filter((s) => s.red);
    expect(reds.length).toBe(ev.totals.redRuns);
    expect(reds.length).toBeGreaterThan(0);
    expect(reds[0].red).toBe(true);
  });

  it('marks the last step done and names the fare line', () => {
    const { rewards, route } = card('legal');
    const ev = tripEvents(world, rewards, route);
    const last = ev.steps[ev.steps.length - 1];
    expect(last.done).toBe(true);
    expect(last.lines).toContain('fare');
    expect(ev.steps.slice(0, -1).some((s) => s.done)).toBe(false);
  });

  it('a wait step has moved:false and keeps its cell', () => {
    const { rewards } = card('legal');
    const route = { cells: [world.start, world.start], actions: [4] };
    const ev = tripEvents(world, rewards, route);
    expect(ev.steps[0].moved).toBe(false);
    expect(ev.steps[0].cell).toBe(world.start);
    expect(ev.steps[0].lines).toEqual(['time']);
  });
});

describe('tagsFor', () => {
  const R = { fare: 100, time: 1, off: 20, red: 30, wrong: 30, perTile: 0 };
  const step = (o) => ({ i: 0, tick: 0, cell: 0, moved: true, off: false, park: false, red: false, wrong: false, done: false, delta: 0, lines: [], ...o });
  it('has no tags for a plain step', () => {
    expect(tagsFor(step({}), R)).toEqual([]);
  });
  it('names each fine with its amount and kind', () => {
    expect(tagsFor(step({ off: true, park: true }), R)).toEqual([{ text: '−20 footpath', kind: 'fine' }]);
    expect(tagsFor(step({ off: true }), R)).toEqual([{ text: '−20 footpath', kind: 'fine' }]);
    expect(tagsFor(step({ red: true }), R)).toEqual([{ text: '−30 red light', kind: 'fine' }]);
    expect(tagsFor(step({ wrong: true }), R)).toEqual([{ text: '−30 wrong way', kind: 'fine' }]);
  });
  it('shows a fare tag on arrival, and a zero-rate fine that says free', () => {
    expect(tagsFor(step({ done: true }), R)).toEqual([{ text: '+100 fare', kind: 'pay' }]);
    expect(tagsFor(step({ red: true }), { ...R, red: 0 })).toEqual([{ text: 'red light: free', kind: 'fine' }]);
  });
});

describe('layoutTags', () => {
  it('three tags on one step get three different slots, lowest first', () => {
    const out = layoutTags([{}, {}, {}]);
    expect(out.map((t) => t.slot)).toEqual([0, 1, 2]);
  });
  it('a tag that already has a slot keeps it, and a newcomer takes the lowest free slot', () => {
    const out = layoutTags([{ slot: 1 }, {}]);
    expect(out.map((t) => t.slot)).toEqual([1, 0]);
    expect(layoutTags([{ slot: 0 }, { slot: 1 }, {}])[2].slot).toBe(2);
  });
  it('a freed slot is used again, and no two live tags ever share one', () => {
    let live = layoutTags([{}, {}, {}]);
    live = live.filter((t) => t.slot !== 1);          // the middle tag has expired
    live = layoutTags([...live, {}]); // three slots in all: the freed one is the only one left
    const slots = live.map((t) => t.slot);
    expect(new Set(slots).size).toBe(slots.length);
    expect(slots).toContain(1);
  });
  it('slots are a whole tag-height apart on screen so tags never overlap', () => {
    expect(TAG_SLOT_PX).toBeGreaterThanOrEqual(40);
  });
});

describe('layoutTags with a ceiling', () => {
  it('uses at most three slots: a fourth tag takes the oldest one', () => {
    expect(MAX_TAG_SLOTS).toBe(3);
    const live = layoutTags([{}, {}, {}]);
    const out = layoutTags([...live, {}]);
    expect(out.map((t) => t.slot)).toEqual([0, 1, 2, 0]);
    expect(Math.max(...layoutTags([{}, {}, {}, {}, {}]).map((t) => t.slot))).toBe(2);
  });
  it('a second newcomer takes the next oldest', () => {
    const out = layoutTags([...layoutTags([{}, {}, {}]), {}, {}]);
    expect(out.slice(3).map((t) => t.slot)).toEqual([0, 1]);
  });
});

describe('the tag pop animation', () => {
  it('rises less than one slot, so a tag never passes through the one above', () => {
    const css = readFileSync(new URL('../games/city/city.css', import.meta.url), 'utf8');
    const frames = css.match(/@keyframes tag-pop \{([^\n]*)\}/)[1];
    const ys = [...frames.matchAll(/translate\(-50%, (-?\d+)%\)/g)].map((m) => Number(m[1]));
    const tagPx = 34; // a 22px label with 4px padding top and bottom
    const up = ys.map((y) => -y); // how far above the anchor, in % of the tag's height
    expect(((Math.max(...up) - Math.min(...up)) / 100) * tagPx).toBeLessThan(TAG_SLOT_PX);
  });
});

describe('offence tags you cannot miss', () => {
  const css = readFileSync(new URL('../games/city/city.css', import.meta.url), 'utf8');
  it('a 0 fine says free, for all four kinds', () => {
    const rw = { off: 0, red: 0, wrong: 0 };
    const text = (step) => tagsFor(step, rw).map((t) => t.text);
    expect(text({ off: true, park: true })).toEqual(['footpath: free']);
    expect(text({ off: true, park: false })).toEqual(['footpath: free']);
    expect(text({ red: true })).toEqual(['red light: free']);
    expect(text({ wrong: true })).toEqual(['wrong way: free']);
  });
  it('a fined offence keeps its wording', () => {
    expect(tagsFor({ red: true }, { red: 5 }).map((t) => t.text)).toEqual(['−5 red light']);
  });
  it('the tag text is 22px on a desktop and at least 20px down to a 360px phone', () => {
    const size = css.match(/#labels span\.tag \{[^}]*font: 700 clamp\((\d+)px, ([\d.]+)vw, (\d+)px\)/);
    expect(Number(size[3])).toBeGreaterThanOrEqual(22);
    expect(Math.min(Number(size[3]), Math.max(Number(size[1]), (Number(size[2]) * 360) / 100))).toBeGreaterThanOrEqual(20);
  });
  it('a tag lives at least 1.5 s: the constant, the animation and the record-mode prune', () => {
    expect(TAG_LIFE_MS).toBeGreaterThanOrEqual(1500);
    expect(pruneTags([{ born: 0 }], 1500)).toHaveLength(1);
    const dur = Number(css.match(/#labels span\.tag \{[^}]*animation: tag-pop ([\d.]+)s/)[1]) * 1000;
    expect(dur).toBeGreaterThanOrEqual(1500);
    const frames = css.match(/@keyframes tag-pop \{([^\n]*)\}/)[1];
    const hold = Number(frames.match(/(\d+)% \{ opacity: 1; transform: translate\(-50%, -\d+%\) scale\(1\)/)[1]);
    const rise = Number(frames.match(/(\d+)% \{ opacity: 1/)[1]);
    expect((dur * (hold - rise)) / 100).toBeGreaterThanOrEqual(1500); // fully opaque for at least 1.5 s
  });
  it('layoutTags never drops a live tag: three at once keep three distinct slots', () => {
    const out = layoutTags(layoutTags([{}, {}, {}]));
    expect(out.map((t) => t.slot)).toEqual([0, 1, 2]);
  });
  it('main.js uses TAG_LIFE_MS, not a literal', () => {
    const main = readFileSync(new URL('../games/city/main.js', import.meta.url), 'utf8');
    expect(main).toContain('TAG_LIFE_MS');
    expect(main).not.toContain('1400)');
  });
});

describe('tagPlace', () => {
  const box = { width: 390, tagW: 250, tagH: 34, meterBottom: 330 };
  it('on a desktop the tag rises from the taxi, one slot per tag', () => {
    expect(tagPlace({ x: 600, y: 400 }, 0, { ...box, width: 1280 })).toEqual({ left: 600, top: 400 });
    expect(tagPlace({ x: 600, y: 400 }, 2, { ...box, width: 1280 }).top).toBe(400 - 2 * TAG_SLOT_PX);
  });
  it('the tag stays inside the screen sideways', () => {
    expect(tagPlace({ x: 10, y: 400 }, 0, box).left).toBe(129);
    expect(tagPlace({ x: 400, y: 400 }, 0, box).left).toBe(261);
  });
  it('on a phone the tags sit below the meters, whole, and grow downward without touching them', () => {
    for (let slot = 0; slot < MAX_TAG_SLOTS; slot++) {
      const { top } = tagPlace({ x: 195, y: 300 }, slot, { ...box, phone: true });
      expect(top - 1.5 * box.tagH).toBeGreaterThanOrEqual(box.meterBottom); // the tag's visible top (it is drawn 1.5 heights above `top`)
    }
    expect(tagPlace({ x: 195, y: 300 }, 1, { ...box, phone: true }).top - tagPlace({ x: 195, y: 300 }, 0, { ...box, phone: true }).top).toBe(TAG_SLOT_PX);
  });
  it('with a screen height, a tag near the top edge goes below the taxi instead, and none leaves the screen', () => {
    const o = { ...box, width: 1280, height: 720 };
    for (let slot = 0; slot < MAX_TAG_SLOTS; slot++) {
      const { top } = tagPlace({ x: 600, y: 20 }, slot, o);
      expect(top - 1.5 * box.tagH).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThanOrEqual(720);
      const low = tagPlace({ x: 600, y: 715 }, slot, o).top;
      expect(low).toBeLessThanOrEqual(720);
    }
    expect(tagPlace({ x: 600, y: 400 }, 0, o).top).toBe(400); // plenty of room: unchanged
  });
  it('on a phone with the taxi near, the tag keeps 8 px clear of the roof: in the band under the meters when there is room, else below the taxi', () => {
    const o = { ...box, phone: true, height: 640 }; // visible tag box: top - 1.5 tagH to top - 0.5 tagH
    const vis = (t) => ({ top: t - 1.5 * box.tagH, bottom: t - 0.5 * box.tagH });
    const at = (roof) => ({ x: 195, y: roof - 90, top: roof, bottom: roof + 50 }); // the taxi's screen box, 50 px tall; the anchor y is far above it in a chase view
    for (const roof of [345, 380, 440, 520]) for (let slot = 0; slot < MAX_TAG_SLOTS; slot++) { // every slot is 8 px clear of the taxi's box, above or below it, and never over a meter
      const v = vis(tagPlace(at(roof), slot, o).top);
      expect(v.top).toBeGreaterThanOrEqual(box.meterBottom);
      expect(v.bottom <= roof - 8 || v.top >= roof + 50 + 8).toBe(true);
    }
    expect(tagPlace(at(440), 0, o).top).toBe(box.meterBottom + 8 + 1.5 * box.tagH); // band position unchanged when it clears
    for (let slot = 0; slot < MAX_TAG_SLOTS; slot++) { // the taxi right under the meters: the tag goes below it, whole, on screen
      const { top } = tagPlace(at(345), slot, o);
      expect(vis(top).top).toBeGreaterThanOrEqual(345 + 50 + 8);
      expect(top).toBeLessThanOrEqual(640);
    }
    expect(tagPlace({ x: 195, y: 300 }, 0, o).top).toBe(box.meterBottom + 8 + 1.5 * box.tagH); // no box (a stage with no taxi on screen): the band, as before
  });
  it('on a phone with a tall taxi low on the screen, a tag that does not fit below goes above the taxi, never over it', () => {
    const o = { ...box, phone: true, height: 640 };
    const at = { x: 195, y: 300, top: 360, bottom: 600 }; // the roof just under the meters, the wheels near the bottom bar
    const vis = (t) => ({ top: t - 1.5 * box.tagH, bottom: t - 0.5 * box.tagH });
    for (let slot = 0; slot < MAX_TAG_SLOTS; slot++) {
      const { top } = tagPlace(at, slot, o);
      const v = vis(top);
      expect(v.bottom <= at.top - 8 || v.top >= at.bottom + 8).toBe(true); // 8 px off the taxi, whichever side
      expect(top).toBeLessThanOrEqual(640 - 4);
    }
    const nearBottom = tagPlace({ x: 195, y: 300, top: 360, bottom: 560 }, 0, o).top; // there is room below this one (560 + 8 + 51 <= 636): below, as before
    expect(nearBottom).toBe(560 + 8 + 1.5 * box.tagH);
  });
  it('with a clearance the tag sits clear of the taxi: above it with a gap, or below when there is no room above', () => {
    const o = { ...box, width: 1280, height: 720, clear: 40 };
    expect(tagPlace({ x: 600, y: 400 }, 0, o).top).toBeLessThanOrEqual(400 - 40); // the tag's lower edge is above the taxi's top
    const lowTag = tagPlace({ x: 600, y: 30 }, 0, o).top - 1.5 * box.tagH; // too near the top: below, the tag's visible top under the taxi's bottom
    expect(lowTag).toBeGreaterThanOrEqual(30 + 40);
  });
});
