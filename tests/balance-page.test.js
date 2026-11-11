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

describe('balance main.js', () => {
  const block = (start, end) => { const a = main.indexOf(start); const b = main.indexOf(end, a + start.length); return main.slice(a, b); };
  it('imports the pieces it drives', () => {
    for (const n of ['keyDir', 'pidAct', 'advance', 'pushTry', 'createTrainer']) expect(main, n).toMatch(new RegExp(String.raw`import \{[^}]*\b${n}\b[^}]*\} from`));
  });
  it('Wind only toggles itself: no restart, no new trainer, no rate change', () => {
    const b = block("$('wind')", '\n$(');
    expect(b.length).toBeGreaterThan(20);
    for (const w of ['startTry', 'createTrainer', 'freshBrain', 'rate', 'newTry']) expect(b, w).not.toContain(w);
  });
  it('a key still held when a try ends cannot start the next one', () => {
    expect(main).toMatch(/keyup[\s\S]*guard\.delete/);
    expect(main).toMatch(/keydown[\s\S]*guard\.has/);
  });
  it('ignores keys typed into form fields', () => {
    expect(main).toMatch(/INPUT\|SELECT\|TEXTAREA/);
  });
  it('sets data-mode on the stage wrapper', () => {
    expect(main).toMatch(/dataset\.mode\s*=/);
  });
  it('trains unseen within a time budget, in every mode', () => {
    const b = block('function runUnseen', '\n}\n');
    expect(b).toContain('performance.now');
    expect(main).not.toMatch(/if \(s\.mode === 'ai'\) runUnseen/);
  });
  it('draws the chart against the 20 s limit', () => {
    expect(main).toMatch(/max: LIMIT \/ 60/);
  });
  it('uses Math.random only for the trainer seed and never writes into the best genome', () => {
    expect(main.match(/Math\.random/g)).toHaveLength(1);
    expect(main).toMatch(/createTrainer\(\(Math\.random\(\) \* 2 \*\* 32\) >>> 0\)/);
    expect(main).not.toMatch(/bestGenome\s*(\[[^\]]*\])?\s*=[^=]/);
    expect(main).not.toMatch(/bestGenome\.(set|fill|sort|splice)\(/);
  });
});
