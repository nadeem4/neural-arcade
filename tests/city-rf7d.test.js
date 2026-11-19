// RF7d: the type scale (F38) and the other audit leftovers of Reward City.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../games/city/city.css', import.meta.url), 'utf8');
const design = readFileSync(new URL('../DESIGN.md', import.meta.url), 'utf8');

describe('city.css type scale (F38)', () => {
  const tokens = Object.fromEntries([...css.matchAll(/(--fs-[a-z]+):\s*(\d+)px/g)].map(m => [m[1], Number(m[2])]));
  it('defines exactly the six type-size tokens', () => {
    expect(tokens).toEqual({ '--fs-xs': 13, '--fs-sm': 14, '--fs-hd': 15, '--fs-md': 16, '--fs-lg': 18, '--fs-xl': 34 });
  });
  it('sets every font size from a token, in font-size and in the font shorthand', () => {
    const bad = [];
    for (const m of css.matchAll(/(?<![\w-])(font(?:-size)?):\s*([^;}]*)/g)) {
      const v = m[2].replace(/clamp\([^)]*\)/g, '');
      const raw = v.replace(/var\(--fs-[a-z]+\)/g, '');
      if (m[1] === 'font-size' ? !/^var\(--fs-[a-z]+\)$/.test(v.trim()) && !/clamp/.test(m[2]) : /(^|\s)[\d.]+(px|rem|em)(?=[\s/]|$)/.test(raw)) bad.push(m[0]);
    }
    expect(bad).toEqual([]);
  });
  it('has exactly one clamp(), the fluid offence tag', () => {
    expect(css.match(/clamp\(/g).length).toBe(1);
    expect(css).toMatch(/#labels span\.tag \{[^}]*clamp\(/);
  });
  it('keeps what DESIGN.md says: card headings 15, the main button 18, and DESIGN.md names the tokens', () => {
    for (const sel of ['.ratecard h2', '.end-head', '.drawer-head h2']) expect(css.match(new RegExp('\\n' + sel.replace('.', '\\.') + ' \\{[^}]*font: 700 var\\(--fs-hd\\)'))?.[0], sel).toBeTruthy();
    expect(css).toMatch(/\n\.go \{[^}]*font: 700 var\(--fs-lg\)/);
    expect(design).toMatch(/--fs-xs.*--fs-sm.*--fs-hd.*--fs-md.*--fs-lg.*--fs-xl/);
  });
});

describe('design-check flags (RF7d)', () => {
  it('the note chips (the goal line) run at a 1.4 line height, grow when they wrap and keep one line centred', () => {
    const chip = css.match(/\n\.chip \{([^}]*)\}/)[1];
    expect(chip).toMatch(/\/1\.4 /);
    expect(chip).toMatch(/height: auto; min-height: 38px/);
    expect(chip).toMatch(/display: flex; align-items: center; justify-content: center/);
  });
});

describe('no-WebGL view (F25)', () => {
  it('hides the goal and no-WebGL notes on the end card, so they never show through or under it', () => {
    expect(css).toMatch(/\.play\[data-screen="done"\] \.notes[^{]*\{[^}]*display: none/);
  });
});

describe('landscape end card', () => {
  const at = css.indexOf('@media (max-height: 500px) and (min-width: 721px)');
  const land = css.slice(at);
  it('only applies from 721 to 950 px wide, so phones up to 720 px keep the bottom sheet', () => {
    expect(at).toBeGreaterThan(0);
    expect(css).not.toMatch(/@media \(max-height: 500px\) and \(max-width: 950px\) \{[^@]*endcard/);
    expect(land).toMatch(/^@media \(max-height: 500px\) and \(min-width: 721px\) and \(max-width: 950px\)/);
  });
  it('lays the end card out in three columns with the buttons in a row under them, so it needs no inner scroll', () => {
    expect(land).toMatch(/\.endcard:not\(\.racebanner\) \{[^}]*grid-template-columns: repeat\(3,/);
    expect(land).toMatch(/\.endcard \.end-honest \{[^}]*grid-column: 2/);
    expect(land).toMatch(/\.endcard \.receipt \{[^}]*grid-column: 3/);
    expect(land).toMatch(/\.endcard \.end-actions \{[^}]*grid-column: 1 \/ -1/);
  });
});
