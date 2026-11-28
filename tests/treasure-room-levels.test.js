import { describe, it, expect } from 'vitest';
import { lessonById, lessonLabel, lessonHref } from '../assets/tracks/model.js';
import { TRACKS } from '../assets/tracks/index.js';
import { LEVELS, levelFromUrl, levelById, navModel, assumesHtml } from '../games/treasure-room/levels.js';

const LESSONS = [
  'The AI only knows what the room tells it.',
  'The game is a list of these: state, action, reward.',
  'A low discount makes the robot near-sighted: it grabs what is close.',
  'A policy is: on this tile, do this.',
  'Value is how good it is to stand here.',
  'The best plan changes once moves are uncertain.',
];

describe('treasure room levels', () => {
  it('has six levels in order, each keyed by the id of its lesson', () => {
    expect(LEVELS.map(l => l.id)).toEqual(['loop', 'state', 'return', 'policy', 'value', 'mdp']);
    for (const l of LEVELS) expect(lessonById(l.id), l.id).toBeTruthy();
  });
  it('every level is filled in and found by id', () => {
    LEVELS.forEach((l, i) => {
      expect(l, l.id).not.toHaveProperty('title');
      for (const k of ['brief', 'info', 'lesson']) expect(l[k].length, `${l.id}.${k}`).toBeGreaterThan(0);
      expect(l.lesson).toBe(LESSONS[i]);
      expect(levelById(l.id)).toBe(l);
    });
  });
});

const BUILT = LEVELS.map(l => l.id);

describe('navModel', () => {
  it('takes each title from the caller and numbers the levels in the given order', () => {
    const nav = navModel(['loop', 'return', 'mdp'], 'mdp', id => `T-${id}`);
    expect(nav.map(x => x.title)).toEqual(['T-loop', 'T-return', 'T-mdp']);
    expect(nav.map(x => x.n)).toEqual([1, 2, 3]);
    expect(nav.map(x => x.href)).toEqual(['?level=loop', '?level=return', '?level=mdp']);
    expect(nav.find(x => x.current).id).toBe('mdp');
  });
});

describe('levelFromUrl', () => {
  it('reads a lesson id from the query or the hash', () => {
    expect(levelFromUrl('?level=mdp', '', BUILT)).toBe('mdp');
    expect(levelFromUrl('?level=value', '', BUILT)).toBe('value');
    expect(levelFromUrl('', '#policy', BUILT)).toBe('policy');
  });
  it('the query beats the hash', () => {
    expect(levelFromUrl('?level=return', '#mdp', BUILT)).toBe('return');
  });
  it('numbers, the old triples slug and anything unknown land on the first built level', () => {
    for (const [s, h] of [['?level=3', ''], ['?level=triples', ''], ['?level=abc', ''], ['', '#nonsense'], ['', ''], ['?level=', '']]) {
      expect(levelFromUrl(s, h, BUILT), `${s}${h}`).toBe('loop');
    }
  });
  it('an invalid query falls back to a valid hash', () => {
    expect(levelFromUrl('?level=abc', '#mdp', BUILT)).toBe('mdp');
  });
  it('a lesson id with no built level is not a level', () => {
    expect(levelFromUrl('?level=bandit', '', ['return', 'mdp'])).toBe('return');
  });
});

describe('assumesHtml', () => {
  it('is empty with no assumes or no live lesson', () => {
    expect(assumesHtml({ assumes: [] }, TRACKS)).toBe('');
    expect(assumesHtml({}, TRACKS)).toBe('');
    expect(assumesHtml({ assumes: ['nope'] }, TRACKS)).toBe('');
  });
  it('links each lesson a level builds on, with its number', () => {
    const l = lessonById('state');
    const h = assumesHtml(levelById('return'), TRACKS);
    expect(h).toContain('<p class="assumes">Builds on ');
    expect(h).toContain(lessonLabel(l));
    expect(h).toContain(`href="${lessonHref(l, '../../')}"`);
  });
  it('skips ids that are not live and keeps the rest', () => {
    const h = assumesHtml({ assumes: ['nope', 'loop'] }, TRACKS);
    expect(h).toContain(lessonLabel(lessonById('loop')));
    expect(h).not.toContain('nope');
  });
  it('level 1 has none; 2 to 6 build on the lesson before', () => {
    expect(LEVELS[0].assumes ?? []).toEqual([]);
    expect(LEVELS.slice(1).map(l => l.assumes)).toEqual([['loop'], ['state'], ['return'], ['policy'], ['value']]);
    for (const lv of LEVELS) for (const id of lv.assumes ?? []) expect(lessonById(id), id).toBeTruthy();
  });
});
