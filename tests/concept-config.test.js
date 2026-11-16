import { describe, it, expect } from 'vitest';
import { GAMES, CONCEPTS, conceptById, conceptHref } from '../assets/games.js';

const RELATED = {
  agent: ['state-action-reward', 'policy'],
  'state-action-reward': ['agent', 'return'],
  return: ['state-action-reward', 'value'],
  policy: ['agent', 'value', 'pid'],
  value: ['return', 'policy', 'mdp'],
  mdp: ['value', 'state-action-reward'],
  pid: ['policy'],
};
const game = id => GAMES.find(g => g.id === id);

describe('concept config', () => {
  it('every concept has a related list of existing ids, not itself', () => {
    for (const c of CONCEPTS) {
      expect(c.related.length, c.id).toBeGreaterThan(0);
      for (const r of c.related) {
        expect(conceptById(r), `${c.id} -> ${r}`).toBeTruthy();
        expect(r).not.toBe(c.id);
      }
    }
  });
  it('related is the RL series order, and pid relates to policy', () => {
    expect(Object.fromEntries(CONCEPTS.map(c => [c.id, c.related]))).toEqual(RELATED);
  });
  it('every where key is in that game\'s uses', () => {
    for (const g of GAMES) for (const k of Object.keys(g.where ?? {})) expect(g.uses, `${g.id}.${k}`).toContain(k);
  });
  it('balance uses pid with its where sentence', () => {
    expect(game('balance').uses).toEqual(['pid']);
    expect(game('balance').where.pid).toBe('Its "A PID with three dials" mode: tune P, I and D yourself, then let evolution tune them.');
  });
  it('maze and runner have a where sentence per use', () => {
    for (const id of ['maze', 'runner']) {
      const g = game(id);
      for (const u of g.uses) expect(g.where[u]?.length, `${id}.${u}`).toBeGreaterThan(0);
    }
    expect(game('maze').uses).toHaveLength(5);
    expect(game('runner').uses).toHaveLength(3);
  });
  it('pid has the video and the concept pages are pid, agent, state-action-reward, return and policy', () => {
    expect(conceptById('pid').youtube).toBe('drtqgVse4jo');
    expect(conceptById('pid').page).toBe(true);
    expect(CONCEPTS.filter(c => c.page).map(c => c.id)).toEqual(['agent', 'state-action-reward', 'return', 'policy', 'pid']);
  });
  it('conceptHref goes to the page when there is one, else the anchor', () => {
    expect(conceptHref(conceptById('pid'), '../../')).toBe('../../concepts/pid/');
    expect(conceptHref(conceptById('value'), '../../')).toBe('../../concepts/#value');
  });
});
