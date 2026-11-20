import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mulberry32 } from '../engine/rng.js';
import { MDP, oddsFrom, stepMdp, walk, stationary } from '../concepts/mdp/sim.js';
import { presets } from '../concepts/mdp/play.js';
import { figureHtml } from '../concepts/mdp/figures.js';
import { GAMES } from '../assets/games.js';
import { lessonById, chipsForGame } from '../assets/tracks/model.js';

const HEX_COLOUR = /["'(:]#[0-9a-f]{3,8}\b/i;

describe('MDP', () => {
  it('every row sums to 1 and every target is a state', () => {
    for (const s of MDP.states) {
      const rows = MDP.moves[s];
      expect(rows.reduce((a, r) => a + r.p, 0)).toBeCloseTo(1, 9);
      for (const r of rows) expect(MDP.states).toContain(r.to);
    }
  });
  it('has the three weather states', () => expect(MDP.states).toEqual(['Sunny', 'Cloudy', 'Rainy']));
});

describe('stepMdp', () => {
  it('takes no history: only the mdp, the state and the rng', () => expect(stepMdp.length).toBe(3));
  it('is deterministic for a seeded rng', () => {
    const a = stepMdp(MDP, 'Sunny', mulberry32(5)), b = stepMdp(MDP, 'Sunny', mulberry32(5));
    expect(a).toEqual(b);
    expect(MDP.states).toContain(a.to);
    expect(typeof a.reward).toBe('number');
  });
  it('matches the odds over 5,000 seeded draws', () => {
    for (const s of MDP.states) {
      const rng = mulberry32(11), n = 5000, got = {};
      for (let i = 0; i < n; i++) { const { to } = stepMdp(MDP, s, rng); got[to] = (got[to] || 0) + 1; }
      for (const r of MDP.moves[s]) expect(Math.abs((got[r.to] || 0) / n - r.p)).toBeLessThan(0.03);
    }
  });
});

describe('walk and stationary', () => {
  it('walk starts where told, has steps + 1 states, and is seeded', () => {
    const w = walk(MDP, 'Cloudy', 20, mulberry32(3));
    expect(w).toHaveLength(21);
    expect(w[0]).toBe('Cloudy');
    expect(walk(MDP, 'Cloudy', 20, mulberry32(3))).toEqual(w);
  });
  it('stationary counts add up to the steps', () => {
    const c = stationary(MDP, 1000, mulberry32(3));
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(1000);
    expect(Object.keys(c)).toEqual(MDP.states);
  });
  it('over a long run sunny is the most common day, as the run preset says', () => {
    const c = stationary(MDP, 5000, mulberry32(3));
    expect(c.Sunny).toBeGreaterThan(c.Cloudy);
    expect(c.Sunny).toBeGreaterThan(c.Rainy);
  });
});

describe('presets', () => {
  it('are start sunny, same state different past, run 20 steps', () => {
    expect(presets.map(p => p.label)).toEqual(['Start sunny', 'Same state, different past', 'Run 20 steps']);
  });
  it('every state is valid', () => {
    for (const p of presets) {
      expect(MDP.states).toContain(p.state.at);
      expect(p.text.length).toBeGreaterThan(10);
      for (const h of p.state.history ?? []) expect(MDP.states).toContain(h);
    }
  });
  it('same state, different past: both pasts really lead there and the odds are identical', () => {
    const { at, history } = presets[1].state;
    expect(history).toHaveLength(2);
    const reaches = (a, b) => MDP.moves[a].some(r => r.to === b && r.p > 0);
    const path = [...history, at];
    for (let i = 0; i < path.length - 1; i++) expect(reaches(path[i], path[i + 1])).toBe(true);
    const other = MDP.states.filter(s => s !== history[1] && reaches(s, at));
    expect(other.length).toBeGreaterThan(0);
    expect(oddsFrom(MDP, at)).toEqual(MDP.moves[at]);
  });
  it('run 20 steps asks for 20', () => expect(presets[2].state.run).toBe(20));
});

describe('figureHtml', () => {
  it('is deterministic and shows 20 steps and the odds', () => {
    expect(figureHtml(3)).toBe(figureHtml(3));
    const h = figureHtml(3);
    expect((h.match(/class="day"/g) || []).length).toBe(21);
    expect(h).toContain('60%');
    for (const s of MDP.states) expect(h).toContain(s);
  });
  it('uses theme tokens only, never hex or the page ink', () => {
    const h = figureHtml(3);
    expect(h).not.toMatch(HEX_COLOUR);
    expect(h).toContain('var(--stage-ink)');
    expect(h).not.toContain('var(--ink)');
  });
});

describe('mdp page file', () => {
  const html = readFileSync(new URL('../concepts/mdp/index.html', import.meta.url), 'utf8');
  it('has the shared header, footer and styles', () => {
    for (const s of ['<header data-site', '<footer data-site', '../../assets/studio.css', '../../assets/concept.css']) expect(html).toContain(s);
  });
  it('is generated: the lesson sections and runtime, with the write-up and page script beside it', () => {
    for (const id of ['playground', 'tries', 'writeup', 'play', 'watch', 'read']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('assets/lesson-page.js');
    expect(readFileSync(new URL('../concepts/mdp/writeup.html', import.meta.url), 'utf8')).toContain('id="figure"');
    expect(readFileSync(new URL('../concepts/mdp/page.js', import.meta.url), 'utf8')).toContain('mountPlayground');
  });
  it('leads with the lesson line from the track config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(lessonById('mdp').says);
  });
  it('only Treasure Room uses mdp', () => {
    expect(chipsForGame('treasure-room').map(c => c.id)).toContain('mdp');
    for (const g of GAMES.filter(g => g.id !== 'treasure-room')) expect(chipsForGame(g.id).map(c => c.id), g.id).not.toContain('mdp');
  });
});
