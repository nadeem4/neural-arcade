import { describe, it, expect } from 'vitest';
import { TRACKS, trackById } from '../assets/tracks/index.js';
import {
  flatLessons, lessonById, lessonLabel, lessonHref, trackHref, neighbours, trackCounts,
  chipsForGame, tracksOfGame, moreGames, lessonOfLevel, lessonVideo, validateTracks,
} from '../assets/tracks/model.js';
import { GAMES, gameById } from '../assets/games.js';

const built = { 'treasure-room': ['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp'] };
const bad = edit => { const t = structuredClone(TRACKS); edit(t); return validateTracks(t, GAMES, built); };

describe('lesson model', () => {
  it('numbers lessons within their track and resolves the game', () => {
    const all = flatLessons();
    expect(all).toHaveLength(2 + 19 + 1);
    const ret = lessonById('return');
    expect(ret).toMatchObject({ trackId: 'reinforcement-learning', partTitle: 'The problem', partIndex: 0, n: 3, total: 19, game: 'treasure-room', whole: false });
    expect(lessonById('reward-design')).toMatchObject({ n: 19, game: 'city', whole: true });
    expect(lessonById('pid')).toMatchObject({ n: 1, total: 1, game: 'balance' });
    expect(lessonById('nope')).toBeUndefined();
  });
  it('formats labels and links', () => {
    expect(lessonLabel(lessonById('return'))).toBe('Lesson 3: Return');
    expect(lessonLabel(lessonById('return'), ', ')).toBe('Lesson 3, Return');
    expect(lessonHref(lessonById('return'), '../../')).toBe('../../concepts/return/');
    expect(trackHref('physical-ai', '../')).toBe('../physical-ai/');
  });
  it('finds live neighbours in the same track', () => {
    expect(neighbours('mdp').next.id).toBe('reward-design'); // lessons 7 to 18 are soon
    expect(neighbours('reward-design').next).toBeNull();
    expect(neighbours('mdp').prev.id).toBe('value');
    expect(neighbours('agent').prev).toBeNull();
    expect(neighbours('learning-from-examples').next.id).toBe('learning-by-selection');
    expect(neighbours('learning-by-selection').next).toBeNull();
  });
  it('counts lessons', () => {
    expect(trackCounts(trackById('reinforcement-learning'))).toEqual({ total: 19, live: 7, soon: 12 });
  });
  it('builds chips from live lessons only', () => {
    expect(chipsForGame('maze').map(c => c.id)).toEqual(['agent', 'state-action-reward', 'return', 'policy', 'value']);
    expect(chipsForGame('city').map(c => c.id)).toContain('reward-design');
    expect(chipsForGame('runner').map(c => c.id)).toEqual(['agent', 'state-action-reward', 'policy', 'reward-design']);
    expect(chipsForGame('treasure-room').map(c => c.id)).toEqual(['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp']);
    expect(chipsForGame('maze')[2]).toEqual({
      id: 'return', label: 'Lesson 3: Return', href: 'concepts/return/',
      says: 'The Discount slider sets how much far-off reward counts, which decides whether it walks to the small or the big treasure.',
    });
    expect(chipsForGame('teach')).toEqual([{ id: 'learning-from-examples', label: 'Lesson 1: Learning from examples', href: 'concepts/learning-from-examples/', says: null }]);
    expect(chipsForGame('nothing')).toEqual([]);
  });
  it('finds tracks and lessons of a game', () => {
    expect(tracksOfGame('treasure-room').map(t => t.id)).toEqual(['reinforcement-learning']);
    expect(tracksOfGame('maze').map(t => t.id)).toEqual(['reinforcement-learning']);
    expect(tracksOfGame('racer').map(t => t.id)).toEqual(['neural-networks']);
    expect(lessonOfLevel('treasure-room', 'value').id).toBe('value');
    expect(lessonOfLevel('treasure-room', 'nope')).toBeUndefined();
  });
  it('takes a lesson video, else the game video for a whole-game lesson', () => {
    expect(lessonVideo(lessonById('learning-from-examples'))).toBe('qfzRiq3DoJo');
    expect(lessonVideo(lessonById('pid'))).toBe('drtqgVse4jo');
    expect(lessonVideo(lessonById('return'))).toBeNull();
    expect(lessonVideo(lessonById('reward-design'))).toBeNull(); // city has no video yet
  });
});

describe('validateTracks', () => {
  it('accepts the real config', () => {
    expect(validateTracks(TRACKS, GAMES, built)).toEqual([]);
  });
  const rl = t => t[1].parts[0].lessons;
  it('rejects a duplicate lesson id', () => {
    expect(bad(t => { rl(t)[1].id = 'agent'; }).join()).toMatch(/duplicate lesson id agent/);
  });
  it('rejects a duplicate track id', () => {
    expect(bad(t => { t[2].id = 'neural-networks'; }).join()).toMatch(/duplicate track id neural-networks/);
  });
  it('rejects a bad status', () => {
    expect(bad(t => { rl(t)[0].status = 'later'; }).join()).toMatch(/status/);
  });
  it('rejects a lesson with neither level nor game', () => {
    expect(bad(t => { t[0].parts[0].lessons[0].game = undefined; }).join()).toMatch(/learning-from-examples.*level or a game/);
  });
  it('rejects an unknown game', () => {
    expect(bad(t => { rl(t)[0].wild[0].game = 'ghost'; }).join()).toMatch(/unknown game ghost/);
    expect(bad(t => { t[0].parts[0].lessons[0].game = 'ghost'; }).join()).toMatch(/unknown game ghost/);
    expect(bad(t => { t[2].game = 'ghost'; }).join()).toMatch(/unknown game ghost/);
  });
  it('rejects a live level that is not built, or a game with no built levels', () => {
    expect(bad(t => { rl(t)[0].level = 'bandit'; }).join()).toMatch(/level bandit is not a built level/);
    expect(validateTracks(TRACKS, GAMES, {}).join()).toMatch(/no built levels/);
  });
  it('rejects a wild entry without says or a boolean show', () => {
    expect(bad(t => { rl(t)[0].wild[0].says = ''; }).join()).toMatch(/says/);
    expect(bad(t => { rl(t)[0].wild[0].show = 'yes'; }).join()).toMatch(/show/);
  });
  it('rejects needs pointing nowhere', () => {
    expect(bad(t => { t[1].needs[0].track = 'ghost'; }).join()).toMatch(/needs.*track ghost/);
    expect(bad(t => { t[1].needs[0].before = 'ghost'; }).join()).toMatch(/needs.*lesson ghost/);
  });
  it('rejects a video that is not null or an 11-character id', () => {
    expect(bad(t => { rl(t)[0].video = 'short'; }).join()).toMatch(/video/);
    expect(bad(t => { rl(t)[0].video = 'abcdefghijk'; })).toEqual([]);
  });
});

describe('moreGames', () => {
  const ids = (g, max) => moreGames(gameById(g), GAMES, TRACKS, max).map(x => x.id);
  it('lists other games that share a track, newest first, at most 3', () => {
    expect(ids('city')).toEqual(['treasure-room', 'maze', 'runner']);
    expect(ids('city')).not.toContain('city');
    expect(ids('city', 2)).toHaveLength(2);
  });
  it('tops up with the newest other games, no duplicates, never itself', () => {
    const r = ids('racer');
    expect(r).toHaveLength(3);
    expect(r[0]).toBe('teach');
    expect(r).not.toContain('racer');
    expect(new Set(r).size).toBe(3);
  });
  it('falls back to the newest other games when none share a track', () => {
    expect(ids('balance')).toEqual(['treasure-room', 'city', 'maze']);
  });
});
