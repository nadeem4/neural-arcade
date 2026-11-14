import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAMES } from '../assets/games.js';
import { LESSON, INFO } from '../games/maze/words.js';
import { DEFAULTS, MAP_IDS } from '../games/maze/sim.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/maze/index.html');
const css = read('games/maze/maze.css').replace(/\/\*[\s\S]*?\*\//g, '');
const main = read('games/maze/main.js');
const entry = GAMES.find(g => g.id === 'maze');
const rules = sel => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');
const tag = id => html.match(new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`))?.[0];

describe('maze page markup', () => {
  it('has every id main.js will look up', () => {
    for (const id of ['stage', 'chart', 'gamma', 'epsilon', 'gammaOut', 'epsilonOut', 'reset', 'episodes', 'lastReward', 'bestPath', 'log']) {
      expect(html, id).toContain(`id="${id}"`);
      expect(main, id).toContain(`$('${id}')`);
    }
    expect(tag('log')).toContain('aria-live="off"');
  });
  it('lets both sliders reach their ends, starting at the sim defaults', () => {
    expect(tag('gamma')).toMatch(/type="range"/);
    expect(tag('gamma')).toContain('min="0" max="0.99" step="0.01"');
    expect(tag('gamma')).toContain(`value="${DEFAULTS.gamma}"`);
    expect(tag('epsilon')).toContain('min="0" max="1" step="0.01"');
    expect(tag('epsilon')).toContain(`value="${DEFAULTS.epsilon}"`);
  });
  it('has the two maps and the four speeds, one speed pressed', () => {
    expect([...html.matchAll(/<button[^>]*data-map="([\w-]+)"/g)].map(m => m[1])).toEqual(['near-or-far', 'cliff-edge']);
    expect(MAP_IDS).toEqual(['near-or-far', 'cliff-edge']);
    expect([...html.matchAll(/<button[^>]*data-rate="(\w+)"/g)].map(m => m[1])).toEqual(['step', '1', 'fast', '0']);
    expect(html.match(/<button[^>]*data-rate[^>]*aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/<button[^>]*data-map[^>]*aria-pressed="true"/g)).toHaveLength(1);
  });
  it('has an (i) button on every control and readout, each with its INFO sentence', () => {
    const controls = [...html.matchAll(/class="info"[^>]*aria-controls="([\w-]+)"/g)].map(m => m[1]);
    expect(controls.length).toBeGreaterThanOrEqual(7);
    for (const id of controls) expect(html, id).toMatch(new RegExp(`class="info-text"[^>]*id="${id}"[^>]*hidden|id="${id}"[^>]*class="info-text"[^>]*hidden`));
    const used = [...html.matchAll(/data-info="(\w+)"/g)].map(m => m[1]);
    for (const k of used) expect(INFO, k).toHaveProperty(k);
    for (const k of Object.keys(INFO)) expect(used, k).toContain(k);
    expect(main).toMatch(/INFO\[/);
  });
  it('has the four-values toggle, off to begin with, with its (i) button, wired in main.js', () => {
    expect(tag('four')).toContain('aria-pressed="false"');
    expect(html).toMatch(/aria-controls="info-four"/);
    expect(html).toMatch(/id="info-four"[^>]*data-info="fourValues"|data-info="fourValues"[^>]*id="info-four"/);
    expect(main).toMatch(/showFour/);
    expect(main).toMatch(/q: s\.agent\.q/);
  });
  it('calls the learner the explorer everywhere a player reads it', () => {
    expect(html).not.toMatch(/robot/i);
    expect(main).not.toMatch(/say\('[^']*robot/i);
    expect(entry.lesson).not.toMatch(/robot/i);
  });
  it('tells you to leave exploring on for the discount lesson', () => {
    expect(html).toMatch(/exploring[^<]*0\.5/);
  });
  it('shows the lesson in the lead and the stated lesson in the moral band', () => {
    expect(html.match(/class="lead lesson">([^<]*)</)[1]).toBe(entry.lesson);
    expect(html.match(/class="moral"[\s\S]*?<\/div>/)[0]).toContain(LESSON);
    expect(html).toMatch(/class="moral"[\s\S]*href="#how"/);
  });
  it('has the brief, the how-it-works link and the arcade chrome', () => {
    for (const t of ['The setup', 'The rule', 'Watch for']) expect(html).toContain(`<dt>${t}</dt>`);
    expect(html).toContain('<body data-game="maze">');
    expect(html).toContain('<header data-site="games">');
    for (const css of ['assets/studio.css', 'assets/game.css', 'maze.css']) expect(html).toContain(`href="${css.includes('/') ? '../../' : ''}${css}"`);
    expect(html).toContain('id="how"');
    expect(html).toContain('href="how-it-works/"');
  });
  it('carries the share tags for its own banner', () => {
    expect(html).toContain('<link rel="canonical" href="https://arcade.codewithnk.com/games/maze/">');
    expect(html).toContain('<meta property="og:image" content="https://arcade.codewithnk.com/games/maze/share.png">');
    expect(html).toContain('<meta name="twitter:image" content="https://arcade.codewithnk.com/games/maze/share.png">');
    expect(html).toContain('<meta property="og:image:width" content="1280">');
    expect(html).toContain('<meta property="og:image:height" content="720">');
    expect(html).toMatch(/<meta property="og:image:alt" content="[^"]+">/);
  });
});

describe('maze.css', () => {
  it('keeps the stage inside a phone width', () => {
    expect(rules('#stage')).toMatch(/width:\s*100%/);
    expect(rules('#stage')).toMatch(/max-width:/);
    expect(css).not.toMatch(/\bwidth:\s*\d{4,}px/);
  });
  it('names no other game and has no side stripes', () => {
    expect(css).not.toMatch(/racer|runner|balance/i);
    expect(css).not.toMatch(/border-(left|right):\s*\d+px solid/);
  });
});

describe('maze main.js', () => {
  it('drives the sim, the words and the curve', () => {
    for (const n of ['createAgent', 'runEpisode', 'stepEpisode', 'startEpisode', 'valueGrid', 'policyGrid', 'DEFAULTS']) expect(main, n).toMatch(new RegExp(String.raw`import \{[^}]*\b${n}\b[^}]*\} from`));
    expect(main).toMatch(/import \{[^}]*drawLine[^}]*\} from '..\/..\/engine\/curve\.js'/);
    expect(main).toMatch(/import \{[^}]*\bcurvePoints\b[^}]*\} from '.\/render\.js'/);
    expect(main).toContain('first: `Episode ${');
    expect(main).toContain('No episode yet.');
  });
  it('fast trains a fixed number of episodes a frame, not whatever fits in a time budget', () => {
    expect(main).toMatch(new RegExp('FAST = [0-9]+'));
    expect(main).not.toContain('performance.now');
    expect(main).toContain('curvePoints(');
    expect(main).not.toContain('Math.max(0');
  });
  it('announces the log only in Step mode, and has no leftover hold state', () => {
    expect(main).toContain("setAttribute('aria-live'");
    expect(main).not.toMatch(/hold/);
  });
  it('uses Math.random only for the seed', () => {
    expect(main.match(/Math\.random/g)).toHaveLength(1);
    expect(main).toMatch(/seed = \(\) => \(Math\.random\(\) \* 2 \*\* 32\) >>> 0/);
  });
  it('switching map and Reset both start a new brain; sliders do not', () => {
    expect(main).toMatch(/function newBrain/);
    expect(main).toContain("$('reset').addEventListener('click', newBrain)");
    expect(main).toMatch(/dataset\.map[\s\S]*newBrain\(\)/);
  });
});
