import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRESETS, DEFAULT_REWARDS } from '../games/city/presets.js';
import { STEPS, LADDER_KEY, cardFor, matchStep, parseRan, markRan, ladderModel } from '../games/city/ladder.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const BANNED = /\bwants?\b|knows the rules|tries to cheat|—|–/i;

describe('the five steps', () => {
  it('walk the five preset cards, each result motivating the next', () => {
    expect(STEPS.map(s => s.id)).toEqual(['speed', 'walk', 'lights', 'mile', 'legal']);
    expect(STEPS.map(s => s.n)).toEqual([1, 2, 3, 4, 5]);
  });
  it('every step has a title, a watch sentence and a showed sentence, in plain words', () => {
    for (const s of STEPS) {
      for (const k of ['title', 'watch', 'showed']) {
        expect(s[k].length, s.id + k).toBeGreaterThan(10);
        expect(s[k], s.id + k).not.toMatch(BANNED);
      }
      expect(s.watch.match(/\./g).length, s.id).toBeLessThanOrEqual(2);
    }
  });
  it('carry the preset card and its name, never their own numbers', () => {
    for (const s of STEPS) {
      const p = PRESETS.find(x => x.id === s.id);
      expect(s.rewards).toEqual(p.rewards);
      expect(s.card).toBe(p.name);
    }
  });
  it('cover the teaching scope in order', () => {
    expect(STEPS[0].title).toMatch(/only the pay/i);
    expect(STEPS[1].title).toMatch(/gap/i);
    expect(STEPS[2].title).toMatch(/cheat moves/i);
    expect(STEPS[3].title).toMatch(/stand-in/i);
    expect(STEPS[4].title).toMatch(/outcome/i);
    expect(STEPS[4].title).toMatch(/side effects/i);
    expect(STEPS[4].showed).toMatch(/drive/i);
  });
  it('say what the recorded speed run really drove over: footpaths, not park grass', () => {
    const speed = JSON.parse(read('games/city/story.json')).cards.find(c => c.id === 'speed').analysis;
    expect(speed.offTiles).toBeGreaterThan(0);
    expect(speed.parkTiles).toBe(0);
    expect(STEPS[0].showed).toMatch(/footpath/i);
    expect(STEPS[0].showed).not.toMatch(/across the park/i);
    expect(STEPS[1].showed).toMatch(/footpath/i);
  });
});

describe('cardFor and matchStep', () => {
  it('cardFor gives a fresh copy of the card', () => {
    const a = cardFor('walk');
    expect(a).toEqual(PRESETS.find(p => p.id === 'walk').rewards);
    a.off = 99;
    expect(cardFor('walk').off).not.toBe(99);
  });
  it('each card matches its own step, and the starting card is step one', () => {
    for (const s of STEPS) expect(matchStep(cardFor(s.id))).toBe(s.id);
    expect(matchStep({ ...DEFAULT_REWARDS })).toBe('speed');
  });
  it('an edited card matches no step', () => {
    expect(matchStep({ ...cardFor('walk'), off: 25 })).toBe(null);
    expect(matchStep({ ...cardFor('legal'), fare: 110 })).toBe(null);
  });
});

describe('remembering runs', () => {
  it('reads a stored list and drops anything unknown or repeated', () => {
    expect(parseRan('["speed","walk","speed","nope",3]')).toEqual(['speed', 'walk']);
  });
  it('survives no storage and bad text', () => {
    expect(parseRan(null)).toEqual([]);
    expect(parseRan('{oops')).toEqual([]);
    expect(parseRan('{"a":1}')).toEqual([]);
  });
  it('markRan adds a known id once and never changes the old list', () => {
    const a = ['speed'];
    expect(markRan(a, 'walk')).toEqual(['speed', 'walk']);
    expect(a).toEqual(['speed']);
    expect(markRan(['speed'], 'speed')).toEqual(['speed']);
    expect(markRan(['speed'], 'nope')).toEqual(['speed']);
  });
  it('uses one storage key', () => {
    expect(LADDER_KEY).toBe('rc-ladder-v1');
  });
});

describe('ladderModel', () => {
  it('marks the loaded step and the ticked ones', () => {
    const m = ladderModel(cardFor('lights'), ['speed', 'walk']);
    expect(m.current).toBe('lights');
    expect(m.steps.map(s => s.ticked)).toEqual([true, true, false, false, false]);
    expect(m.steps.map(s => s.current)).toEqual([false, false, true, false, false]);
  });
  it('a step not yet run shows what to watch for', () => {
    const m = ladderModel(cardFor('walk'), []);
    expect(m.note.kind).toBe('watch');
    expect(m.note.head).toBe(`2. ${STEPS[1].title}`);
    expect(m.note.text).toBe(STEPS[1].watch);
  });
  it('an edited card is your own card, with nothing current', () => {
    const m = ladderModel({ ...cardFor('walk'), off: 25 }, ['walk']);
    expect(m.current).toBe(null);
    expect(m.note.kind).toBe('own');
    expect(m.note.head).toBe('Your own card');
    expect(m.steps.every(s => !s.current)).toBe(true);
    expect(m.steps[1].ticked).toBe(true);
  });
  it('labels each step for a screen reader with its card and whether it is done', () => {
    const m = ladderModel(cardFor('speed'), ['mile']);
    expect(m.steps[3].label).toBe(`Step 4: ${STEPS[3].title}. Card: ${STEPS[3].card}. Done.`);
    expect(m.steps[0].label).not.toMatch(/Done/);
  });
});

describe('the ladder on the page', () => {
  const html = read('games/city/index.html');
  const card = html.slice(html.indexOf('<aside class="ratecard"'), html.indexOf('</aside>'));
  const css = read('games/city/city.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const main = read('games/city/main.js');
  it('sits inside the rate card with an (i) button and its info text', () => {
    expect(card).toContain('id="ladderSteps"');
    expect(card).toContain('aria-controls="info-ladder"');
    expect(card).toContain('data-info="ladder"');
    expect(card).toContain('id="ladderNote"');
    expect(card.indexOf('id="ladderSteps"')).toBeLessThan(card.indexOf('class="rates"'));
  });
  it('is hidden in record mode because the rate card is', () => {
    expect(css).toMatch(/body\.rc-record \.ratecard[^{]*\{[^}]*display: none !important/);
  });
  it('is wired in main.js with storage behind try and catch', () => {
    expect(main).toContain("from './ladder.js'");
    expect(main).toContain('LADDER_KEY');
    expect(main).toMatch(/try \{[^}]*LADDER_KEY[^}]*\} catch/);
  });
  it('has big enough buttons, a visible focus ring, and readable line height', () => {
    expect(css).toMatch(/\.step\s*\{[^}]*height: 40px/);
    expect(css).toMatch(/\.ladder-note[^{]*\{[^}]*line-height: 1\.[3-9]/);
    expect(css).toMatch(/\.step:focus-visible|\.ratecard button:focus-visible/);
    expect(css).toMatch(/\.step\[aria-current="step"\]/);
  });
});
