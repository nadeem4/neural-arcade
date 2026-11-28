import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import * as games from '../assets/games.js';
import { GAMES, videoOf, newest, heroOf, browse, gameById } from '../assets/games.js';
import { TRACKS } from '../assets/tracks/index.js';
import { validateTracks } from '../assets/tracks/model.js';
import { BUILT_LEVELS } from '../games/treasure-room/level-panel.js';

const FIELDS = ['id', 'title', 'lesson', 'learnsBy', 'goesWrongWhen', 'added', 'shot', 'path', 'writeup'];
const fake = (id, o = {}) => ({ id, title: id, lesson: '', added: '2026-01-01', ...o });

describe('games data', () => {
  it('the config holds games only: six exports, and no category, uses, where or levels on a game', () => {
    expect(Object.keys(games).sort()).toEqual(['GAMES', 'browse', 'gameById', 'heroOf', 'newest', 'videoOf']);
    for (const game of GAMES) for (const k of ['category', 'uses', 'where', 'levels']) expect(game, `${game.id}.${k}`).not.toHaveProperty(k);
  });
  it('every game has all required fields', () => {
    for (const g of GAMES) {
      for (const f of FIELDS) expect(typeof g[f], `${g.id}.${f}`).toBe('string');
      for (const f of FIELDS) expect(g[f].length, `${g.id}.${f}`).toBeGreaterThan(0);
      expect('youtube' in g).toBe(true);
    }
  });
  it('path folder and writeup page exist on disk', () => {
    for (const g of GAMES) {
      expect(existsSync(new URL('../' + g.path, import.meta.url)), g.path).toBe(true);
      expect(existsSync(new URL('../' + g.shot, import.meta.url)), g.shot).toBe(true);
      expect(existsSync(new URL('../' + g.writeup + 'index.html', import.meta.url)), g.writeup).toBe(true);
    }
  });
  it('youtube is null or a valid id', () => {
    for (const g of GAMES) if (g.youtube !== null) expect(g.youtube).toMatch(/^[\w-]{11}$/);
  });
  it('each game links its explainer video', () => {
    const ids = Object.fromEntries(GAMES.map(g => [g.id, g.youtube]));
    expect(ids).toMatchObject({ racer: 'tG00TxTB8ns', teach: 'qfzRiq3DoJo', runner: 'K1I7QxfrgIk', balance: 'ui3l3xSUZ4U', maze: '74Q8P1r7xeo' });
  });
  it('ids are unique and added parses as a date', () => {
    expect(new Set(GAMES.map(g => g.id)).size).toBe(GAMES.length);
    for (const g of GAMES) expect(Number.isNaN(Date.parse(g.added)), g.id).toBe(false);
  });
  it('gameById finds a game', () => {
    expect(gameById('runner').title).toBe('Coin Runner');
    expect(gameById('nope')).toBeUndefined();
  });
  it('the track configs are valid against the games and the Treasure Room levels', () => {
    expect(validateTracks(TRACKS, GAMES, { 'treasure-room': BUILT_LEVELS })).toEqual([]);
  });
});

describe('videoOf', () => {
  it('is null without a youtube id', () => expect(videoOf({ youtube: null })).toBeNull());
  it('builds the thumbnail url', () => {
    expect(videoOf({ youtube: 'abcdefg' })).toEqual({ id: 'abcdefg', thumb: 'https://i.ytimg.com/vi/abcdefg/hqdefault.jpg' });
  });
});

describe('newest', () => {
  it('picks the latest, ties by title', () => {
    expect(newest([fake('a', { added: '2026-01-01' }), fake('b', { added: '2026-02-01' })]).id).toBe('b');
    expect(newest([fake('z', { title: 'Zed' }), fake('y', { title: 'Alpha' })]).id).toBe('y');
  });
});

describe('browse', () => {
  it('filters by track, a game showing under every track that names it', () => {
    expect(browse(GAMES, TRACKS, { track: 'reinforcement-learning' }).items.map(g => g.id).sort())
      .toEqual(['city', 'maze', 'runner', 'treasure-room']);
    expect(browse(GAMES, TRACKS, { track: 'physical-ai' }).items.map(g => g.id)).toEqual(['balance']);
    expect(browse(GAMES, TRACKS, { track: 'neural-networks' }).items.map(g => g.id).sort()).toEqual(['racer', 'teach']);
  });
  it('searches title, lesson and track title, case-insensitively', () => {
    expect(browse(GAMES, TRACKS, { q: 'physical ai' }).items.map(g => g.id)).toEqual(['balance']);
    expect(browse(GAMES, TRACKS, { q: 'NEURAL RACER' }).items.map(g => g.id)).toEqual(['racer']);
    expect(browse(GAMES, TRACKS, { q: 'overfitting' }).items.map(g => g.id)).toContain('racer');
  });
  it('searches the titles of the lessons a game appears in', () => {
    expect(browse(GAMES, TRACKS, { q: 'return' }).items.map(g => g.id).sort()).toEqual(['city', 'maze', 'treasure-room']);
    expect(browse(GAMES, TRACKS, { q: 'physical ai' }).items.map(g => g.id)).toEqual(['balance']);
  });
  it('sorts newest or a to z', () => {
    const two = [fake('b', { title: 'Alpha', added: '2026-01-01' }), fake('a', { title: 'Zulu', added: '2026-03-01' })];
    expect(browse(two, TRACKS, {}).items.map(g => g.id)).toEqual(['a', 'b']);
    expect(browse(two, TRACKS, { sort: 'az' }).items.map(g => g.id)).toEqual(['b', 'a']);
  });
  it('pages 30 games into 2 pages of 24 and clamps the page', () => {
    const many = Array.from({ length: 30 }, (_, i) => fake('g' + i, { title: 'G' + String(i).padStart(2, '0') }));
    const r = browse(many, TRACKS, {});
    expect([r.total, r.pages, r.items.length, r.page]).toEqual([30, 2, 24, 1]);
    const r2 = browse(many, TRACKS, { page: 9 });
    expect([r2.page, r2.items.length]).toEqual([2, 6]);
    expect(browse(many, TRACKS, { page: -3 }).page).toBe(1);
  });
  it('returns total 0 for no match', () => {
    const r = browse(GAMES, TRACKS, { q: 'zzz' });
    expect([r.total, r.items.length, r.page, r.pages]).toEqual([0, 0, 1, 1]);
  });
});

describe('heroOf', () => {
  const demo = { net: 'n', learns: 'l', panel: 'p', alt: 'a' };
  it('is the newest game with a video and a demo; the real hero is Balance', () => {
    const g = [fake('a', { added: '2026-01-01' }), fake('f', { added: '2026-05-01', youtube: 'abcdefghijk', demo }), fake('g', { added: '2026-06-01', youtube: null, demo })];
    expect(heroOf(g).id).toBe('f');
    expect(heroOf(GAMES).id).toBe('balance');
  });
  it('a game with a video but no demo is never the hero', () => {
    const g = [fake('old', { added: '2026-01-01', youtube: 'abcdefghijk', demo }), fake('new', { added: '2026-05-01', youtube: 'abcdefghijk', demo: null })];
    expect(heroOf(g).id).toBe('old');
  });
  it('with no video game, the hero is the newest game that has a demo, else the newest game', () => {
    expect(heroOf([fake('withDemo', { added: '2026-01-01', demo }), fake('newer', { added: '2026-05-01', demo: null })]).id).toBe('withDemo');
    expect(heroOf([fake('a', { added: '2026-01-01' }), fake('b', { added: '2026-02-01' })]).id).toBe('b');
  });
});

describe('home demo config', () => {
  const DEMO = ['net', 'learns', 'panel', 'alt'];
  it('the hero has a demo block of words', () => {
    for (const f of DEMO) expect(heroOf(GAMES).demo[f].length, f).toBeGreaterThan(0);
  });
  it('every game with a demo has games/<id>/demo.js and all its words', () => {
    for (const g of GAMES.filter(g => g.demo)) {
      expect(existsSync(new URL(`../games/${g.id}/demo.js`, import.meta.url)), g.id).toBe(true);
      for (const f of DEMO) expect(g.demo[f], `${g.id}.${f}`).toMatch(/\S/);
    }
  });
  it('Coin Runner and Balance have demos; Racer and Teach do not yet', () => {
    expect(gameById('runner').demo.panel).toBe('Its four moves, right now');
    expect(gameById('balance').demo.net).toBe('4 inputs, 6 hidden, 1 push');
    expect(gameById('racer').demo).toBeNull();
    expect(gameById('teach').demo).toBeNull();
  });
});

describe('game entries', () => {
  it('Balance, Treasure Maze and Treasure Room keep their paths and lesson lines', () => {
    expect(gameById('balance')).toMatchObject({ title: 'Balance', youtube: 'ui3l3xSUZ4U', path: 'games/balance/', writeup: 'games/balance/how-it-works/', shot: 'games/balance/shot.jpg' });
    expect(gameById('balance').lesson).toMatch(/Teaches feedback control, PID, evolution and disturbances\.$/);
    expect(gameById('maze')).toMatchObject({ title: 'Treasure Maze', path: 'games/maze/', writeup: 'games/maze/how-it-works/', youtube: '74Q8P1r7xeo', demo: null });
    expect(gameById('maze').lesson).toMatch(/Teaches reward, value, the discount and exploring\.$/);
    expect(gameById('treasure-room')).toMatchObject({ title: 'Treasure Room', path: 'games/treasure-room/', writeup: 'games/treasure-room/how-it-works/', youtube: null, demo: null });
  });
});
