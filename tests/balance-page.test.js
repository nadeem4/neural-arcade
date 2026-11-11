import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAMES } from '../assets/games.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/balance/index.html');
const css = read('games/balance/balance.css').replace(/\/\*[\s\S]*?\*\//g, '');
const main = read('games/balance/main.js');
const entry = GAMES.find(g => g.id === 'balance');
const LESSON = 'Staying upright is constant correction: measure the error, push back. A tiny brain can find that rule on its own.';
const rules = sel => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');

describe('balance page markup', () => {
  it('has every id main.js will look up', () => {
    for (const id of ['stage', 'plate', 'push', 'wind', 'touchLeft', 'touchRight', 'captionText', 'log', 'upFor', 'bestUp', 'gens', 'modeOut', 'pidOut', 'speedOut', 'fresh', 'brain', 'chart', 'chartNote']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html).toMatch(/id="wind"[^>]*aria-pressed/);
    expect(html).toMatch(/id="log"[^>]*aria-live="polite"/);
  });
  it('has the mode and speed buttons', () => {
    for (const m of ['you', 'pid', 'ai']) expect(html).toContain(`data-mode="${m}"`);
    for (const r of ['0', '2', '10']) expect(html).toContain(`data-rate="${r}"`);
    expect(html).toMatch(/data-rate="2" aria-pressed="true"/);
  });
  it('has an (i) button on every control and readout', () => {
    for (const id of ['infoPush', 'infoWind', 'infoMode', 'infoSpeed', 'infoFresh', 'infoUpFor', 'infoBestUp', 'infoGens', 'infoBrain', 'infoChart']) {
      expect(html, id).toMatch(new RegExp(`class="info"[^>]*aria-controls="${id}"`));
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(main + html).toMatch(/class="info"/);
  });
  it('shows the lesson in the lead and the stated lesson in the moral band', () => {
    expect(html.match(/class="lead lesson">([^<]*)</)[1]).toBe(entry.lesson);
    expect(html.match(/class="moral"[\s\S]*?<\/div>/)[0]).toContain(LESSON);
    expect(html).toMatch(/class="moral"[\s\S]*href="#how"/);
  });
  it('has a touch bar with left and right', () => {
    expect(html).toMatch(/class="touch"/);
    expect(html).toContain('data-hold="left"');
    expect(html).toContain('data-hold="right"');
  });
  it('shares its shot.jpg banner', () => {
    expect(html).toContain('<meta property="og:image" content="https://arcade.codewithnk.com/games/balance/shot.jpg">');
    expect(html).toContain('<link rel="canonical" href="https://arcade.codewithnk.com/games/balance/">');
  });
});

describe('balance.css', () => {
  it('has the touch bar rules', () => {
    expect(css).toMatch(/@media \(pointer: coarse\)/);
    expect(css).toMatch(/\[data-mode="you"\] \.touch/);
    expect(rules('.touch')).toMatch(/touch-action:\s*none/);
    expect(rules('.touch')).not.toMatch(/position:\s*absolute/);
  });
  it('names no other game and has no side stripes', () => {
    expect(css).not.toMatch(/racer|runner/i);
    expect(css).not.toMatch(/border-(left|right):\s*\d+px solid/);
  });
  it('dims dials and colours Wind', () => {
    expect(css).toMatch(/\.dial\[data-off\]\s*\{\s*opacity:\s*\.55/);
    expect(css).toMatch(/#wind\[aria-pressed="true"\][^}]*var\(--amber\)/);
  });
});
