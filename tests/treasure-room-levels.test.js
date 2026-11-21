import { describe, it, expect } from 'vitest';
import { lessonById, lessonLabel, lessonHref } from '../assets/tracks/model.js';
import { TRACKS } from '../assets/tracks/index.js';
import { LEVELS, levelFromUrl, levelByN, navModel, assumesHtml } from '../games/treasure-room/levels.js';

const LESSONS = [
  'The AI only knows what the room tells it.',
  'The game is a list of these: state, action, reward.',
  'Shorter paths win, and a low discount makes the AI greedy for now.',
  'A policy is: on this tile, do this.',
  'Value is how good it is to stand here.',
  'The best plan changes once moves are uncertain.',
];

describe('treasure room levels', () => {
  it('has six levels in order, mapped to concept pages', () => {
    expect(LEVELS.map(l => l.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(LEVELS.map(l => l.concept)).toEqual(['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp']);
    for (const l of LEVELS) expect(lessonById(l.concept), l.concept).toBeTruthy();
  });
  it('slugs are unique and every level is filled in', () => {
    expect(LEVELS.map(l => l.slug)).toEqual(['agent', 'triples', 'return', 'policy', 'value', 'mdp']);
    LEVELS.forEach((l, i) => {
      expect(l, `${l.n}`).not.toHaveProperty('title');
      for (const k of ['brief', 'info', 'lesson']) expect(l[k].length, `${l.n}.${k}`).toBeGreaterThan(0);
      expect(l.lesson).toBe(LESSONS[i]);
      expect(levelByN(l.n)).toBe(l);
    });
  });
});

describe('navModel', () => {
  it('takes each title from the caller', () => {
    const nav = navModel([1, 2, 3], 3, n => `T${n}`);
    expect(nav.map(x => x.title)).toEqual(['T1', 'T2', 'T3']);
    expect(nav.find(x => x.current).title).toBe('T3');
  });
  it('slugs and concept ids still route', () => {
    expect(levelFromUrl('?level=return')).toBe(3);
    expect(levelFromUrl('?level=mdp')).toBe(6);
  });
});

describe('levelFromUrl', () => {
  it('reads a number or a slug from the query or the hash', () => {
    expect(levelFromUrl('?level=3', '')).toBe(3);
    expect(levelFromUrl('?level=value', '')).toBe(5);
    expect(levelFromUrl('', '#policy')).toBe(4);
    expect(levelFromUrl('', '#state-action-reward')).toBe(2);
    expect(levelFromUrl('?level=triples', '')).toBe(2);
  });
  it('the query beats the hash', () => {
    expect(levelFromUrl('?level=2', '#mdp')).toBe(2);
  });
  it('anything invalid lands on level 1', () => {
    for (const [s, h] of [['?level=0', ''], ['?level=7', ''], ['?level=abc', ''], ['', '#nonsense'], ['', ''], ['?level=', ''], ['?level=2.5', '']]) {
      expect(levelFromUrl(s, h), `${s}${h}`).toBe(1);
    }
  });
  it('an invalid query falls back to a valid hash', () => {
    expect(levelFromUrl('?level=abc', '#mdp')).toBe(6);
  });
});

describe('assumesHtml', () => {
  it('is empty with no assumes or no live lesson', () => {
    expect(assumesHtml({ assumes: [] }, TRACKS)).toBe('');
    expect(assumesHtml({}, TRACKS)).toBe('');
    expect(assumesHtml({ assumes: ['nope'] }, TRACKS)).toBe('');
  });
  it('links each lesson a level builds on, with its number', () => {
    const l = lessonById('state-action-reward');
    const h = assumesHtml(levelByN(3), TRACKS);
    expect(h).toContain('<p class="assumes">Builds on ');
    expect(h).toContain(lessonLabel(l));
    expect(h).toContain(`href="${lessonHref(l, '../../')}"`);
  });
  it('skips ids that are not live and keeps the rest', () => {
    const h = assumesHtml({ assumes: ['nope', 'agent'] }, TRACKS);
    expect(h).toContain(lessonLabel(lessonById('agent')));
    expect(h).not.toContain('nope');
  });
  it('level 1 has none; 2 to 6 build on the lesson before', () => {
    expect(LEVELS[0].assumes ?? []).toEqual([]);
    expect(LEVELS.slice(1).map(l => l.assumes)).toEqual([['agent'], ['state-action-reward'], ['return'], ['policy'], ['value']]);
    for (const lv of LEVELS) for (const id of lv.assumes ?? []) expect(lessonById(id), id).toBeTruthy();
  });
});
