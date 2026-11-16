import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { CATEGORIES, GAMES, gameById, homeModel, categoryModel } from '../assets/games.js';

const file = p => new URL('../' + p, import.meta.url);

describe('Reward City listing', () => {
  const g = gameById('city');
  it('city entry matches its fields and sits in the reinforcement-learning category', () => {
    expect(g).toMatchObject({
      title: 'Reward City', category: 'reinforcement-learning', learnsBy: 'Reward design, reward hacking',
      goesWrongWhen: 'The pay slip has a loophole', added: '2026-11-16',
      path: 'games/city/', writeup: 'games/city/how-it-works/', shot: 'games/city/shot.jpg', youtube: null, demo: null,
    });
    expect(g.lesson).toMatch(/Teaches reward design, and why an agent does what you pay it for, not what you meant\.$/);
    expect(g.uses).toEqual(['agent', 'state-action-reward', 'return', 'policy', 'value', 'reward-design']);
    expect(g.where['reward-design']).toBe('The pay slip is the reward design: every fine you add closes one loophole and the taxi finds the next.');
  });
  it('its where keys equal its uses, each a real sentence', () => {
    expect(Object.keys(g.where).sort()).toEqual([...g.uses].sort());
    for (const s of Object.values(g.where)) expect(s.length).toBeGreaterThan(20);
  });
  it('is listed after the maze in the reinforcement-learning category', () => {
    const ids = GAMES.filter(x => x.category === 'reinforcement-learning').map(x => x.id);
    expect(ids).toEqual(['runner', 'maze', 'city']);
    expect(categoryModel(CATEGORIES, GAMES, 'reinforcement-learning').games.map(x => x.id)).toContain('city');
  });
  it('share.png is 1280x720', () => {
    const b = readFileSync(file('games/city/share.png'));
    expect(b.toString('ascii', 12, 16)).toBe('IHDR');
    expect(b.readUInt32BE(16)).toBe(1280);
    expect(b.readUInt32BE(20)).toBe(720);
  });
  it('shot.jpg exists', () => expect(existsSync(file('games/city/shot.jpg'))).toBe(true));
  it('the home hero is unchanged', () => expect(homeModel(CATEGORIES, GAMES).hero.id).toBe('balance'));
});
