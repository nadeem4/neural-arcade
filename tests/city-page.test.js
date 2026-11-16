import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { LESSON, INFO } from '../games/city/words.js';
import { RANGES, DEFAULT_REWARDS } from '../games/city/presets.js';
import { FIELDS } from '../games/city/payslip.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/city/index.html');
const css = read('games/city/city.css').replace(/\/\*[\s\S]*?\*\//g, '');
const mainPath = 'games/city/main.js';
const rules = sel => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');
const tag = id => html.match(new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`))?.[0];

const IDS = ['stage', 'stageNote', 'cards', 'slip', 'train', 'progress', 'receipt', 'verdict', 'goal', 'share', 'copy', 'reset'];

describe('city page markup', () => {
  it('has every id main.js will look up', () => {
    const ids = [...IDS, ...FIELDS.flatMap(f => [f.key, f.key + 'Out'])];
    for (const id of ids) expect(html, id).toContain(`id="${id}"`);
    // main.js arrives in the next task; once it exists it must look each id up.
    if (existsSync(new URL('../' + mainPath, import.meta.url))) {
      const main = read(mainPath);
      for (const id of ids) expect(main, id).toContain(`$('${id}')`);
    }
  });
  it('announces the receipt and the verdict politely, and shows progress with a progress element', () => {
    expect(tag('verdict')).toContain('aria-live="polite"');
    expect(tag('receipt')).toContain('aria-live="polite"');
    expect(html).toMatch(/<progress [^>]*id="progress"/);
  });
  it('has one slider per pay slip line, with range and step from RANGES and the default value', () => {
    for (const f of FIELDS) {
      const t = tag(f.key);
      const r = RANGES[f.key];
      expect(t, f.key).toMatch(/^<input /);
      expect(t, f.key).toContain('type="range"');
      expect(t, f.key).toContain(`min="${r.min}" max="${r.max}" step="${r.step}"`);
      expect(t, f.key).toContain(`value="${DEFAULT_REWARDS[f.key]}"`);
      expect(tag(f.key + 'Out'), f.key).toMatch(/^<output /);
      expect(html, f.key).toContain(`>${f.label}</label>`);
    }
  });
  it('keeps the share line hidden until success', () => {
    expect(tag('share')).toMatch(/\bhidden\b/);
  });
  it('has no external script', () => {
    expect(html).not.toMatch(/cdnjs/);
    for (const m of html.matchAll(/<script[^>]*src="([^"]+)"/g)) expect(m[1], m[1]).not.toMatch(/^(https?:)?\/\//);
  });
  it('credits OpenStreetMap with the copyright link', () => {
    expect(html).toMatch(/<a href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>© OpenStreetMap contributors<\/a>/);
  });
  it('states the lesson verbatim, with one h1 and no GTA wording', () => {
    expect(html).toContain(LESSON);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).not.toMatch(/GTA|grand theft/i);
  });
  it('has the brief and the arcade chrome', () => {
    for (const t of ['The setup', 'The rule', 'Watch for']) expect(html).toContain(`<dt>${t}</dt>`);
    expect(html).toContain('<body data-game="city">');
    expect(html).toContain('<header data-site="games">');
    for (const c of ['../../assets/studio.css', '../../assets/game.css', 'city.css']) expect(html).toContain(`href="${c}"`);
  });
  it('has an (i) button on the pay slip, the cards, the goal and the map, each with its INFO sentence', () => {
    const buttons = [...html.matchAll(/<button class="info"[^>]*>/g)].map(m => m[0]);
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    for (const b of buttons) expect(b).toMatch(/aria-label="[^"]+"/);
    for (const id of [...html.matchAll(/class="info"[^>]*aria-controls="([\w-]+)"/g)].map(m => m[1])) {
      expect(html, id).toMatch(new RegExp(`class="info-text"[^>]*id="${id}"[^>]*hidden`));
    }
    const used = [...html.matchAll(/data-info="(\w+)"/g)].map(m => m[1]);
    for (const k of used) expect(INFO, k).toHaveProperty(k);
    for (const k of Object.keys(INFO)) expect(used, k).toContain(k);
  });
  it('carries the share tags for its own banner', () => {
    expect(html).toContain('<link rel="canonical" href="https://arcade.codewithnk.com/games/city/">');
    expect(html).toContain('<meta property="og:image" content="https://arcade.codewithnk.com/games/city/share.png">');
    expect(html).toContain('<meta name="twitter:image" content="https://arcade.codewithnk.com/games/city/share.png">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta property="og:image:width" content="1280">');
    expect(html).toContain('<meta property="og:image:height" content="720">');
    expect(html).toMatch(/<meta property="og:image:alt" content="[^"]+">/);
  });
});

describe('city.css', () => {
  it('shows keyboard focus on sliders and buttons', () => {
    expect(css).toMatch(/input\[type="range"\]:focus-visible/);
    expect(css).toMatch(/button:focus-visible/);
  });
  it('has a 360 px rule and keeps the stage inside a phone width', () => {
    expect(css).toMatch(/@media \(max-width: 360px\)/);
    expect(rules('#stage')).toMatch(/width:\s*100%/);
    expect(css).not.toMatch(/\bwidth:\s*\d{4,}px/);
  });
  it('has no side stripes and no animation without a reduced-motion guard', () => {
    expect(css).not.toMatch(/border-(left|right):\s*\d+px solid/);
    if (/animation:/.test(css)) expect(css).toMatch(/prefers-reduced-motion/);
  });
});
