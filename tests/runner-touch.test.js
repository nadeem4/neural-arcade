import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const css = read('games/runner/runner.css');
const main = read('games/runner/main.js');
const rules = sel => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');

describe('the touch pad (Play it yourself)', () => {
  it('main.js mirrors the play phase onto the level as data-phase', () => {
    expect(main).toMatch(/levelEl\.dataset\.phase\s*=/);
    expect(main).toMatch(/delete levelEl\.dataset\.phase/);
  });
  it('updates data-phase (through show) when a try starts and when it ends', () => {
    expect(main).toMatch(/s\.phase = 'play'; show\(/);
    expect(main).toMatch(/s\.phase = 'end';[^}]*?\n\s*show\('cardEnd'\)/);
  });
  it('keeps its space on touch screens in play mode, but shows only while a try is running', () => {
    expect(css).toMatch(/@media \(pointer: coarse\) \{[^}]*\.level\[data-mode="human"\] \.touch \{ display: flex; visibility: hidden; \}/);
    expect(css).toMatch(/\.level\[data-mode="human"\]\[data-phase="play"\] \.touch \{ visibility: visible; \}/);
    expect(rules('.touch')).toMatch(/display:\s*none/);
  });
  it('sits in its own bar under the canvas, not over it, in the normal layout', () => {
    const t = rules('.touch');
    expect(t).not.toMatch(/position:\s*absolute/);
    expect(t).toMatch(/background:\s*var\(--stage\)/);
    expect(t).toMatch(/touch-action:\s*none/);
  });
  it('has outlined buttons, a larger Jump on the right and a subtle pressed fill', () => {
    const b = rules('.touch button');
    expect(b).toMatch(/border:\s*2px solid var\(--stage-ink\)/);
    expect(b).toMatch(/background:\s*transparent/);
    expect(b).toMatch(/color:\s*var\(--stage-ink\)/);
    expect(b).toMatch(/min-width:\s*64px/);
    expect(b).toMatch(/user-select:\s*none/);
    expect(rules('.touch [data-hold="jump"]')).toMatch(/min-width:\s*84px/);
    expect(rules('.touch button:active')).toMatch(/background:/);
  });
  it('overlays the bottom corners in full screen, clear of the safe areas, and still shows a press', () => {
    const f = rules('.level:fullscreen .touch');
    expect(f).toMatch(/position:\s*absolute/);
    expect(f).toMatch(/bottom:\s*calc\(12px \+ env\(safe-area-inset-bottom, 0px\)\)/);
    expect(f).toMatch(/env\(safe-area-inset-left, 0px\)/);
    expect(f).toMatch(/env\(safe-area-inset-right, 0px\)/);
    expect(f).toMatch(/background:\s*transparent/);
    expect(rules('.level:fullscreen .touch button')).toMatch(/min-width:\s*56px/);
    expect(rules('.level:fullscreen .touch [data-hold="jump"]')).toMatch(/min-width:\s*68px/);
    expect(rules('.level:fullscreen .touch button:active')).toMatch(/background:/);
  });
});
