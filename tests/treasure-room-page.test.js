import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAMES } from '../assets/games.js';
import { LESSON, INFO } from '../games/treasure-room/words.js';
import { LEVELS, levelFromUrl, navModel } from '../games/treasure-room/levels.js';
import { initial, reduce } from '../games/treasure-room/level-agent.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/treasure-room/index.html');
const css = read('games/treasure-room/treasure-room.css').replace(/\/\*[\s\S]*?\*\//g, '');
const main = read('games/treasure-room/main.js');
const entry = GAMES.find(g => g.id === 'treasure-room');
const rules = sel => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');

describe('treasure room deep links', () => {
  it('lands every odd input on a valid level', () => {
    for (const [q, h] of [['?level=0', ''], ['?level=7', ''], ['?level=abc', ''], ['', '#nonsense'], ['', ''], ['?level=-1', '']]) {
      expect(levelFromUrl(q, h), q + h).toBe(1);
    }
  });
  it('takes a number, a slug or a concept id, and the query beats the hash', () => {
    expect(levelFromUrl('?level=3', '')).toBe(3);
    expect(levelFromUrl('', '#value')).toBe(5);
    expect(levelFromUrl('?level=state-action-reward', '')).toBe(2);
    expect(levelFromUrl('?level=2', '#value')).toBe(2);
  });
  it('the nav lists only built levels and marks exactly one current', () => {
    const nav = navModel([1, 2], 2);
    expect(nav.map(n => n.n)).toEqual([1, 2]);
    expect(nav.map(n => n.href)).toEqual(['?level=1', '?level=2']);
    expect(nav.filter(n => n.current)).toHaveLength(1);
    expect(nav.find(n => n.current).n).toBe(2);
    expect(nav[0].title).toBe(LEVELS[0].title);
  });
  it('a level that is not built falls back to the first built one', () => {
    expect(navModel([1, 2], 5).find(n => n.current).n).toBe(1);
  });
});

describe('treasure room input after the episode', () => {
  it('ignores your moves once the AI has taken over', () => {
    const ai = reduce(initial(), { type: 'handover' });
    expect(reduce(ai, { type: 'move', action: 3 })).toEqual(ai);
  });
});

describe('treasure room page markup', () => {
  it('has every id main.js will look up', () => {
    for (const id of ['stage', 'say', 'status', 'levels', 'levelTitle', 'levelBrief', 'levelPanel', 'steps', 'score', 'sees', 'log', 'arrowOut', 'arrowBack']) {
      expect(html, id).toContain(`id="${id}"`);
      expect(main, id).toContain(`$('${id}')`);
    }
    for (const id of ['handover', 'restart']) expect(html, id).toContain(`id="${id}"`);
  });
  it('has the stage canvas with a label, and a live line that is not announced', () => {
    expect(html).toMatch(/<canvas id="stage"[^>]*aria-label="[^"]+"/);
    expect(html).toMatch(/id="say"[^>]*aria-live="off"|aria-live="off"[^>]*id="say"/);
  });
  it('has four move buttons, one per action, as real buttons', () => {
    expect([...html.matchAll(/<button[^>]*data-move="(\d)"/g)].map(m => m[1]).sort()).toEqual(['0', '1', '2', '3']);
  });
  it('has an (i) button on every control, each with its INFO sentence', () => {
    const controls = [...html.matchAll(/class="info"[^>]*aria-controls="([\w-]+)"/g)].map(m => m[1]);
    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const id of controls) expect(html, id).toMatch(new RegExp(`class="info-text"[^>]*id="${id}"[^>]*hidden|id="${id}"[^>]*class="info-text"[^>]*hidden`));
    for (const k of [...html.matchAll(/data-info="(\w+)"/g)].map(m => m[1])) expect(INFO, k).toHaveProperty(k);
    expect(main).toMatch(/INFO\[/);
  });
  it('shows the lesson in the lead and the stated lesson in the moral band', () => {
    expect(html.match(/class="lead lesson">([^<]*)</)[1]).toBe(entry.lesson);
    expect(html.match(/class="moral"[\s\S]*?<\/div>/)[0]).toContain(LESSON);
    expect(html).toMatch(/class="moral"[\s\S]*href="#how"/);
  });
  it('has the brief, the how-it-works link and the arcade chrome', () => {
    for (const t of ['The setup', 'The rule', 'Watch for']) expect(html).toContain(`<dt>${t}</dt>`);
    expect(html).toContain('<body data-game="treasure-room">');
    expect(html).toContain('<header data-site="games">');
    expect(html).toContain('href="treasure-room.css"');
    expect(html).toContain('href="how-it-works/"');
  });
  it('carries the share tags for its own banner', () => {
    expect(html).toContain('<link rel="canonical" href="https://arcade.codewithnk.com/games/treasure-room/">');
    expect(html).toContain('<meta property="og:image" content="https://arcade.codewithnk.com/games/treasure-room/share.png">');
    expect(html).toContain('<meta name="twitter:image" content="https://arcade.codewithnk.com/games/treasure-room/share.png">');
    expect(html).toContain('<meta property="og:image:width" content="1280">');
    expect(html).toContain('<meta property="og:image:height" content="720">');
    expect(html).toMatch(/<meta property="og:image:alt" content="[^"]+">/);
  });
  it('marks each panel part with the levels that show it', () => {
    expect(html).toMatch(/data-levels="1"/);
    expect(html).toMatch(/data-levels="2"/);
  });
});

describe('treasure-room.css', () => {
  it('keeps the stage square and inside a phone width', () => {
    expect(rules('#stage')).toMatch(/aspect-ratio:\s*1/);
    expect(rules('#stage')).toMatch(/width:/);
    expect(css).not.toMatch(/\bwidth:\s*\d{4,}px/);
  });
  it('makes every level control at least 44px tall, with no tight line height', () => {
    expect(rules('.pad button')).toMatch(/min-height:\s*44px/);
    expect(rules('.levels a')).toMatch(/min-height:\s*44px/);
    for (const m of css.matchAll(/line-height:\s*([\d.]+)/g)) expect(+m[1]).toBeGreaterThanOrEqual(1.5);
  });
  it('has no side stripes and names no other game', () => {
    expect(css).not.toMatch(/border-(left|right):\s*\d+px solid/);
    expect(css).not.toMatch(/racer|runner|balance|maze/i);
  });
});
