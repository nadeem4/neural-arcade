import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { GAMES, gameById, heroOf } from '../assets/games.js';
import { chipsForGame, tracksOfGame } from '../assets/tracks/model.js';

const file = p => new URL('../' + p, import.meta.url);

describe('Reward City listing', () => {
  const g = gameById('city');
  it('city entry matches its fields and sits in the reinforcement-learning track', () => {
    expect(g).toMatchObject({
      title: 'Reward City', learnsBy: 'Reward design, reward hacking',
      goesWrongWhen: 'The reward has a loophole', added: '2026-11-16',
      path: 'games/city/', writeup: 'games/city/how-it-works/', shot: 'games/city/shot.jpg', youtube: null, demo: null,
    });
    expect(g.lesson).toMatch(/Teaches reward design, and why an agent does what you pay it for, not what you meant\.$/);
    expect(tracksOfGame('city').map(t => t.id)).toEqual(['reinforcement-learning']);
    expect(chipsForGame('city').map(c => c.id)).toEqual(['loop', 'state', 'return', 'policy', 'value', 'reward-design']);
    expect(chipsForGame('city').at(-1).says).toBe('The rate card is the reward design: every fine you add closes one loophole and the taxi finds the next.');
  });
  it('share.png is 1280x720', () => {
    const b = readFileSync(file('games/city/share.png'));
    expect(b.toString('ascii', 12, 16)).toBe('IHDR');
    expect(b.readUInt32BE(16)).toBe(1280);
    expect(b.readUInt32BE(20)).toBe(720);
  });
  it('shot.jpg exists', () => expect(existsSync(file('games/city/shot.jpg'))).toBe(true));
  it('the home hero is unchanged', () => expect(heroOf(GAMES).id).toBe('balance'));
});
