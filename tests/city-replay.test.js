import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, analyzeRoute } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { createGarage, keep, serialize, parse } from '../games/city/garage.js';
import { nameFor } from '../games/city/naming.js';

const read = f => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const world = loadWorld(read('chicago.json'));
const cards = read('story.json').cards; // real seeded routes

describe('replaying a kept taxi', () => {
  for (const id of ['speed', 'walk', 'legal']) {
    it(`the stored route on the ${id} card replays to its stored analysis, after a storage round trip`, () => {
      const { rewards, route } = cards.find(c => c.id === id);
      const analysis = analyzeRoute(world, route, rewards);
      const g = parse(serialize(keep(createGarage(), {
        id: 'x', name: nameFor(analysis), tries: 1, rewards, route, analysis,
        bestSeconds: analysis.seconds, note: '', keptAt: 1,
      })));
      const t = g.taxis[0];
      const ev = tripEvents(world, t.rewards, t.route);
      expect(ev.totals).toEqual(t.analysis);
    });
  }
});
