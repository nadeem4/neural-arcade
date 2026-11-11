import { describe, it, expect } from 'vitest';
import { createKeys, pressKey, releaseKey, endTryKeys, clearKeys, keyUp, owedAfter, toggleWind, dialHtml } from '../games/balance/state.js';
import { startTry } from '../games/balance/sim.js';
import { createTrainer } from '../games/balance/ai.js';

describe('keys', () => {
  it('press and release track the held directions', () => {
    const k = createKeys();
    expect(pressKey(k, 'left', 'ArrowLeft')).toBe(true);
    expect([...k.held]).toEqual(['left']);
    releaseKey(k, 'left', 'ArrowLeft');
    expect(k.held.size).toBe(0);
  });
  it('ending a try moves held keys into the guard and clears held', () => {
    const k = createKeys();
    pressKey(k, 'right', 'ArrowRight');
    endTryKeys(k);
    expect(k.held.size).toBe(0);
    expect(k.guard.has('ArrowRight')).toBe(true);
  });
  it('a guarded key does not press again until released, then works', () => {
    const k = createKeys();
    pressKey(k, 'right', 'ArrowRight');
    endTryKeys(k);
    expect(pressKey(k, 'right', 'ArrowRight')).toBe(false); // auto-repeat while still held
    expect(k.held.size).toBe(0);
    releaseKey(k, 'right', 'ArrowRight');
    expect(k.guard.size).toBe(0);
    expect(pressKey(k, 'right', 'ArrowRight')).toBe(true);
    expect(k.held.has('right')).toBe(true);
  });
  it('keys not held at the end are not guarded', () => {
    const k = createKeys();
    pressKey(k, 'left', 'KeyA'); releaseKey(k, 'left', 'KeyA');
    endTryKeys(k);
    expect(k.guard.size).toBe(0);
  });
});

describe('clearing keys', () => {
  it('clearKeys empties held, down and guard', () => {
    const k = createKeys();
    pressKey(k, 'left', 'KeyA'); endTryKeys(k); pressKey(k, 'right', 'KeyD');
    clearKeys(k);
    expect([k.held.size, k.down.size, k.guard.size]).toEqual([0, 0, 0]);
  });
  it('keyUp always forgets the code, even for a key that maps to no direction', () => {
    const k = createKeys();
    pressKey(k, 'left', 'KeyA');
    keyUp(k, undefined, 'KeyA');
    expect(k.down.has('KeyA')).toBe(false);
    expect(k.held.has('left')).toBe(true); // no direction given: held untouched
    keyUp(k, 'left', 'KeyA');
    expect(k.held.size).toBe(0);
  });
});

describe('owedAfter (training accounting)', () => {
  it('adds rate x steps / 60 generations', () => expect(owedAfter(0, 2, 30)).toBeCloseTo(1));
  it('is capped at 10', () => expect(owedAfter(9.5, 10, 600)).toBe(10));
  it('rate 0 owes nothing, even with a debt', () => expect(owedAfter(5, 0, 600)).toBe(0));
});

describe('toggleWind', () => {
  it('flips only wind and leaves run, trainer, rate and mode untouched', () => {
    const run = startTry(), trainer = createTrainer(3);
    const s = { wind: false, run, trainer, rate: 10, mode: 'ai', owed: 1.5 };
    const t = toggleWind(s);
    expect(t.wind).toBe(true);
    expect(t.run).toBe(run); expect(t.trainer).toBe(trainer);
    expect([t.rate, t.mode, t.owed]).toEqual([10, 'ai', 1.5]);
    expect(toggleWind(t).wind).toBe(false);
    expect(s.wind).toBe(false);
  });
});

describe('dialHtml', () => {
  const html = dialHtml('p', { min: 0, max: 60, step: 1, def: 25 }, 'Pushes against the lean.');
  it('is a div, not a label, so the (i) button does not toggle with the slider', () => {
    expect(html).toMatch(/^<div class="dial"/);
    expect(html).not.toContain('<label');
  });
  it('gives the range an accessible name', () => {
    expect(html).toMatch(/<input id="pid-p" type="range"[^>]*aria-label="[^"]+"/);
  });
  it('uses the shared (i) sprite', () => {
    expect(html).toContain('<use href="#i"/>');
    expect(html).toMatch(/class="info"[^>]*aria-controls="info-p"/);
  });
});
