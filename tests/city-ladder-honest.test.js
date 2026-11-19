import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { STEPS, cardFor, ladderModel } from '../games/city/ladder.js';
import { updateLadder } from '../games/city/ladder-view.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

describe('honest notes', () => {
  const arrivedPark = { arrived: true, parkTiles: 4, offTiles: 4, redRuns: 0, wrongWays: 0, tiles: 30, seconds: 40 };
  const honest = { tiles: 50, seconds: 60 };
  it('shows the fixed showed sentence only when the run kept the card promise', () => {
    const m = ladderModel(cardFor('speed'), ['speed'], { speed: { analysis: arrivedPark, honest } });
    expect(m.note.kind).toBe('showed');
    expect(m.note.text).toBe(STEPS[0].showed);
  });
  it('a run that breaks the promise gets no fixed text, only what it did', () => {
    const broke = { ...arrivedPark, arrived: false, tiles: 20 };
    const m = ladderModel(cardFor('speed'), ['speed'], { speed: { analysis: broke, honest } });
    expect(m.note.kind).toBe('ran');
    expect(m.note.text).not.toBe(STEPS[0].showed);
    expect(m.note.text).toBe('This run: never arrived, cut through the park.');
  });
  it('a step ticked from storage with no run this session keeps its lesson', () => {
    const m = ladderModel(cardFor('walk'), ['walk'], {});
    expect(m.note.kind).toBe('showed');
    expect(m.note.text).toBe(STEPS[1].showed);
  });
  it('all five steps ticked and step 5 loaded says the lesson is done', () => {
    const all = STEPS.map(s => s.id);
    const m = ladderModel(cardFor('legal'), all, {});
    expect(m.note.kind).toBe('done');
    expect(m.note.head).toBe('All five steps done');
    expect(m.note.text).toBe('You found every loophole and fixed it. Now write your own card, or race your taxis in the Garage.');
    expect(ladderModel(cardFor('walk'), all, {}).note.kind).toBe('showed');
    expect(ladderModel(cardFor('legal'), all.slice(1), {}).note.kind).toBe('showed');
  });
  it('watch text names what changed from the previous card, with numbers from the presets', () => {
    const words = { off: /park|footpath/i, red: /red light/i, wrong: /wrong way/i, perTile: /tile/i };
    for (let i = 1; i < STEPS.length; i++) {
      const prev = STEPS[i - 1].rewards, cur = STEPS[i].rewards;
      for (const k of Object.keys(words)) {
        if (prev[k] === cur[k]) continue;
        expect(STEPS[i].watch, STEPS[i].id + k).toMatch(words[k]);
        if (cur[k] > 0) expect(STEPS[i].watch, STEPS[i].id + k).toContain(String(cur[k]));
        else expect(STEPS[i].watch, STEPS[i].id + k).toMatch(/off|again/i);
      }
    }
  });
  it('the mile card says every fine is on, wrong way too, and tiles pay', () => {
    const w = STEPS[3].watch;
    expect(w).toMatch(/every fine/i);
    expect(w).toMatch(/wrong way/i);
    expect(w).toContain(String(STEPS[3].rewards.perTile));
  });
  it('an own card has no current step but keeps ticks', () => {
    const m = ladderModel({ ...cardFor('walk'), off: 25 }, ['walk']);
    expect(m.steps.some(s => s.current)).toBe(false);
    expect(m.steps[1].ticked).toBe(true);
  });
});

describe('the note is written only when it changes', () => {
  it('does not touch an unchanged live region', () => {
    const writes = [];
    const mk = () => { let v = ''; return { get textContent() { return v; }, set textContent(x) { writes.push(x); v = x; } }; };
    const els = { head: mk(), text: mk() };
    const b = () => ({ classList: { toggle() {} }, setAttribute() {}, removeAttribute() {}, disabled: false });
    const buttons = new Map(STEPS.map(s => [s.id, b()]));
    const model = ladderModel(cardFor('walk'), []);
    updateLadder(buttons, els, model, false);
    const n = writes.length;
    updateLadder(buttons, els, model, false);
    expect(writes.length).toBe(n);
  });
});

describe('phone ladder css', () => {
  const css = read('games/city/city.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const phone = css.slice(css.lastIndexOf('@media (max-width: 600px)'));
  it('keeps one row of 44 px steps and a note that wraps, never cut with an ellipsis', () => {
    expect(phone).toMatch(/\.step\s*\{[^}]*min-width: 44px/);
    expect(phone).not.toMatch(/\.ladder-note[^{]*\{[^}]*(white-space: nowrap|text-overflow)/);
  });
  it('gives Reset and (i) 44 px tap targets for (i) (RF6; Reset keeps 40)', () => {
    expect(phone).toMatch(/\.ratecard \.link\s*\{[^}]*min-height: 40px/);
    expect(phone).toMatch(/\.ratecard \.info, \.endcard \.info\s*\{[^}]*min-height: 44px/);
  });
  it('has no dead goal-line rule', () => {
    expect(css).not.toContain('.goal-line');
  });
});
