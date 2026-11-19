import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/city/index.html');
const css = read('games/city/city.css').replace(/\/\*[\s\S]*?\*\//g, '');
const main = read('games/city/main.js');
const rules = sel => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');

describe('RF7b: nothing floats through the end card or race banner (F10, F31)', () => {
  it('hides the offence tags while the end card or the race result is up, and the map place labels once the map screen is left, outside footage mode', () => {
    expect(rules('body:not(.rc-record) .play[data-screen="done"] #labels .tag, body:not(.rc-record) .play[data-screen="raced"] #labels .tag')).toContain('display: none');
    expect(rules('body:not(.rc-record) .play:not([data-screen="map"]) #labels span:not(.tag):not(.race-tag)')).toContain('display: none');
  });
  it('finish() clears the tags still on screen, but never in footage mode (record.js prunes them by seek time)', () => {
    expect(main).toMatch(/function finish\(t, event\) \{[^}]*if \(!rec\) clearTags\(\)/);
    expect(main).toContain("function clearTags() {");
  });
});
