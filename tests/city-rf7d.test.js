// RF7d: the type scale (F38) and the other audit leftovers of Reward City.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../games/city/city.css', import.meta.url), 'utf8');

describe('city.css type scale (F38)', () => {
  const tokens = [...css.matchAll(/(--fs-[a-z0-9]+):\s*(\d+)px/g)].map(m => m[1]);
  it('defines exactly six type-size tokens', () => {
    expect(new Set(tokens).size).toBe(6);
  });
  it('sets every font size from a token (the offence tag clamp is the one fluid size)', () => {
    const bad = [];
    for (const m of css.matchAll(/(?<![\w-])font(?:-size)?:\s*([^;}]*)/g)) {
      const v = m[1];
      if (/clamp\(/.test(v)) continue;
      const raw = v.replace(/var\(--fs-[a-z0-9]+\)/g, '');
      if (/(^|\s)[\d.]+(px|rem|em)(?=[\s/]|$)/.test(raw) || (m[0].startsWith('font-size') && !/^var\(--fs-/.test(v))) bad.push(m[0]);
    }
    expect(bad).toEqual([]);
  });
});

describe('design-check flags (RF7d)', () => {
  it('the note chips (the goal line) run at a 1.4 line height and grow when they wrap', () => {
    const chip = css.match(/\n\.chip \{([^}]*)\}/)[1];
    expect(chip).toMatch(/\/1\.4 /);
    expect(chip).toMatch(/height: auto; min-height: 38px/);
  });
});

describe('no-WebGL view (F25)', () => {
  it('hides the goal and no-WebGL notes on the end card, so they never show through or under it', () => {
    expect(css).toMatch(/\.play\[data-screen="done"\] \.notes[^{]*\{[^}]*display: none/);
  });
});

describe('landscape phone end card (844x390)', () => {
  const land = css.slice(css.indexOf('/* Landscape phone'));
  it('lays the end card out in three columns with the buttons in a row under them, so it needs no inner scroll', () => {
    expect(land).toMatch(/@media \(max-height: 500px\) and \(max-width: 950px\)/);
    expect(land).toMatch(/\.endcard:not\(\.racebanner\) \{[^}]*grid-template-columns: repeat\(3,/);
    expect(land).toMatch(/\.endcard \.end-honest \{[^}]*grid-column: 2/);
    expect(land).toMatch(/\.endcard \.receipt \{[^}]*grid-column: 3/);
    expect(land).toMatch(/\.endcard \.end-actions \{[^}]*grid-column: 1 \/ -1/);
  });
});
