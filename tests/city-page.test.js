import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { LESSON, INFO } from '../games/city/words.js';
import { RANGES, DEFAULT_REWARDS } from '../games/city/presets.js';
import { FIELDS } from '../games/city/reward.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/city/index.html');
const css = read('games/city/city.css').replace(/\/\*[\s\S]*?\*\//g, '');
const mainPath = 'games/city/main.js';
const rules = sel => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');
const tag = id => html.match(new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`))?.[0];

const IDS = ['play', 'about', 'panel', 'panelToggle', 'panelTab', 'driving', 'verdictFloat', 'stage', 'stageNote', 'status', 'train', 'progress', 'receipt', 'verdict', 'goal', 'share', 'copy', 'reset', 'chase', 'labels'];

describe('city page markup', () => {
  it('has every id main.js will look up', () => {
    const ids = [...IDS, ...FIELDS.flatMap(f => [f.key, f.key + 'Out'])];
    for (const id of ids) expect(html, id).toContain(`id="${id}"`);
    const main = read(mainPath); // 'about' and 'panel' are anchors and aria targets; #stageNote belongs to the stage, main.js never touches it
    for (const id of IDS.filter(i => !['about', 'panel', 'stageNote'].includes(i))) expect(main, id).toContain(`$('${id}')`);
    expect(main).toContain('$(f.key)'); // the sliders are looked up through FIELDS
    expect(main).toContain("$(f.key + 'Out')");
  });
  it('announces only the verdict, so the receipt is aria-live off to avoid a double announcement, and shows progress with a progress element', () => {
    expect(tag('verdict')).toContain('aria-live="polite"');
    expect(tag('receipt')).toContain('aria-live="off"');
    expect(html).toMatch(/<progress [^>]*id="progress"/);
  });
  it('has a chase cam toggle (aria-pressed off) and a landmark label layer hidden from screen readers', () => {
    expect(tag('chase')).toMatch(/^<button /);
    expect(tag('chase')).toContain('aria-pressed="false"');
    expect(tag('labels')).toContain('aria-hidden="true"');
  });
  it('has one slider per reward line, with range and step from RANGES and the default value', () => {
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
  it('links the write-up now it is listed, mounts the shared game page, and keeps the goal and status announced', () => {
    for (const id of ['howTab', 'whyLink', 'how']) expect(tag(id), id).not.toMatch(/\shidden[\s>]/);
    expect(html).toContain('src="../../assets/game-page.js"');
    expect(tag('moreFrom')).toMatch(/\shidden[\s>]/);
    expect(tag('goal')).toContain('aria-live="polite"');
    expect(tag('status')).toContain('aria-live="polite"');
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
    expect(html).toContain('<header class="citybar">');
    expect(html).toContain('<footer data-site>');
    for (const c of ['../../assets/studio.css', '../../assets/game.css', 'city.css']) expect(html).toContain(`href="${c}"`);
  });
  it('has an (i) button on the reward, the goal and the map, each with its INFO sentence', () => {
    const buttons = [...html.matchAll(/<button class="info"[^>]*>/g)].map(m => m[0]);
    expect(buttons.length).toBeGreaterThanOrEqual(3);
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

describe('city page layout', () => {
  it('has no Try cards: no #cards, no card code, no card styles', () => {
    expect(html).not.toContain('id="cards"');
    expect(read(mainPath)).not.toMatch(/PRESETS|cardMatching|card-btn|pick\(/);
    expect(read('games/city/city.css')).not.toMatch(/card-btn|\.cards/);
  });
  it('has a panel that collapses: toggle and tab carry aria-expanded and aria-controls', () => {
    expect(tag('panel')).toMatch(/^<aside /);
    expect(tag('panelToggle')).toMatch(/^<button /);
    expect(tag('panelToggle')).toContain('aria-expanded="true"');
    expect(tag('panelToggle')).toContain('aria-controls="panel"');
    expect(tag('panelTab')).toContain('aria-expanded="false"');
    expect(tag('panelTab')).toContain('aria-controls="panel"');
    expect(html).toMatch(/id="panelTab"[^>]*>[^<]*Reward and Train/);
  });
  it('puts the verdict first in the panel, then Train and Reset, then the sliders', () => {
    const at = s => html.indexOf(s);
    expect(at('id="verdict"')).toBeGreaterThan(at('id="panel"'));
    expect(at('id="train"')).toBeGreaterThan(at('id="verdict"'));
    expect(at('id="reset"')).toBeGreaterThan(at('id="train"'));
    expect(at('id="fare"')).toBeGreaterThan(at('id="reset"'));
    expect(html).toContain('>Train with this reward</button>');
    expect(html).toContain('>Reset</button>');
  });
  it('shows a Driving status chip on the map that starts hidden', () => {
    expect(tag('driving')).toMatch(/\bhidden\b/);
    expect(html).toMatch(/id="driving"[^>]*>Driving…</);
    expect(tag('verdictFloat')).toContain('aria-hidden="true"');
  });
  it('keeps the brief, lesson and write-up below the full screen stage, under #about', () => {
    const at = s => html.indexOf(s);
    expect(at('id="play"')).toBeLessThan(at('id="about"'));
    for (const s of ['class="brief"', 'class="moral"', 'id="how"']) expect(at(s), s).toBeGreaterThan(at('id="about"'));
    expect(html).toContain('href="#about"');
  });
  it('says reward, never pay slip, on the page and in its words', () => {
    expect(html).not.toMatch(/pay ?slip/i);
    for (const t of Object.values(INFO)) expect(t).not.toMatch(/pay ?slip/i);
    for (const f of ['games/city/words.js', 'games/city/stage.js', mainPath]) expect(read(f), f).not.toMatch(/pay ?slip/i);
  });
  it('scrolls the stage into view when Train is pressed, instantly under reduced motion', () => {
    const main = read(mainPath);
    expect(main).toContain('scrollIntoView');
    expect(main).toMatch(/motionAllowed\(\) \? 'smooth' : 'auto'/);
  });
});

describe('city.css', () => {
  it('shows keyboard focus on sliders and buttons', () => {
    expect(css).toMatch(/input\[type="range"\]:focus-visible/);
    expect(css).toMatch(/button:focus-visible/);
  });
  it('fills the screen with the stage and has a phone bottom sheet rule', () => {
    expect(css).toMatch(/100svh/);
    expect(css).toMatch(/@media \(max-width: 720px\)/);
    expect(css).toMatch(/\[data-collapsed="true"\]/);
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
