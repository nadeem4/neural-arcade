import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { recordStory } from '../games/city/story-data.js';
import { figureModel } from '../games/city/story-model.js';
import { loadWorld } from '../games/city/sim.js';
import { PRESETS, EPISODES, checkPromise } from '../games/city/presets.js';

const url = new URL('../games/city/story.json', import.meta.url);
const saved = JSON.parse(readFileSync(url, 'utf8'));

describe('the recorded run behind the Reward City write-up', () => {
  let fresh;
  beforeAll(() => { fresh = recordStory(); }, 60000);

  it('recordStory is deterministic', () => {
    expect(recordStory(1)).toEqual(fresh);
  }, 60000);

  it('committed story.json matches a fresh recording (re-run node games/city/story-data.js if the sim changed)', () => {
    expect(saved).toEqual(fresh);
  });

  it('records all five cards, each satisfying its promise', () => {
    expect(saved.cards.map(c => c.id)).toEqual(PRESETS.map(p => p.id));
    const legal = saved.cards.find(c => c.id === 'legal').analysis.tiles;
    for (const c of saved.cards) expect(checkPromise(c.id, c.analysis, legal), c.id).toBe(true);
  });

  it('records what the city wanted for each card: legal scores highest, the pay winner never arrives', () => {
    const by = Object.fromEntries(saved.cards.map(c => [c.id, c.city]));
    for (const c of saved.cards) expect(c.city.score, c.id).toBeGreaterThanOrEqual(0);
    expect(by.legal.score).toBe(100);
    expect(by.legal.onTime).toBe(true);
    expect(by.mile.arrived).toBe(false);
    expect(by.mile.score).toBe(0);
    for (const id of ['speed', 'walk', 'lights']) expect(by[id].score, id).toBeLessThan(by.legal.score);
    expect(by.speed.scared).toBeGreaterThanOrEqual(0);
  });

  it('records card 1 heat at four snapshots, one digit per cell', () => {
    expect(saved.learning.episodes).toEqual([1, 10, 100, EPISODES]);
    expect(saved.learning.heat.length).toBe(4);
    for (const h of saved.learning.heat) expect(h).toMatch(new RegExp(`^[0-9]{${saved.map.cols * saved.map.rows}}$`));
  });

  it('records the map like chicago.json', () => {
    expect(saved.map.kind.length).toBe(saved.map.rows);
    expect(saved.map.kind[0].length).toBe(saved.map.cols);
    expect(saved.map.pickup.length).toBe(2);
  });

  it('story.json is under 120 KB', () => {
    expect(statSync(url).size).toBeLessThan(120 * 1024);
  });
});

describe('figureModel', () => {
  const f = figureModel(saved);
  it('returns five figures with non-empty draw lists', () => {
    expect(Object.keys(f)).toEqual(['fig1', 'fig2', 'fig3', 'fig4', 'fig5']);
    expect(f.fig5.map(r => r.id)).toEqual(PRESETS.map(p => p.id));
    expect(f.fig5.map(r => r.score)).toEqual(saved.cards.map(c => c.city.score));
    expect(f.fig1.tiles.length).toBeGreaterThan(0);
    expect(f.fig1.signals.length).toBeGreaterThan(0);
    expect(f.fig2.snapshots.length).toBe(4);
    expect(f.fig3.length).toBe(3);
    expect(f.fig1.oneway.length).toBeGreaterThan(0);
    for (const sn of f.fig2.snapshots) expect(sn.digits.length).toBe(f.fig2.rows);
    expect(f.fig4.loop.polyline.length).toBeGreaterThan(0);
    expect(f.fig4.legal.polyline.length).toBeGreaterThan(0);
  });
  it('fig3 routes are the routes of cards 1 to 3', () => {
    const world = loadWorld(saved.map);
    f.fig3.forEach((fig, i) => {
      const cells = saved.cards[i].route.cells.map(n => [n % world.cols, Math.floor(n / world.cols)]);
      expect(fig.id).toBe(saved.cards[i].id);
      expect(fig.polyline).toEqual(cells);
      expect(fig.receipt).toEqual(saved.cards[i].receipt);
    });
  });
  it('fig4 pairs card 5 loop with card 4 legal route', () => {
    expect(f.fig4.loop.id).toBe('mile');
    expect(f.fig4.legal.id).toBe('legal');
    expect(f.fig4.loop.receipt).toEqual(saved.cards[4].receipt);
    expect(f.fig4.legal.receipt).toEqual(saved.cards[3].receipt);
  });
});
