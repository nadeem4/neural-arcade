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
    for (const id of ['stage', 'plate', 'push', 'wind', 'touchLeft', 'touchRight', 'captionText', 'log', 'upFor', 'bestUp', 'gens', 'modeOut', 'pidOut', 'speedOut', 'fresh', 'brain', 'chart', 'chartNote', 'useDials', 'formula', 'gensLabel']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html).toMatch(/id="wind"[^>]*aria-pressed/);
    expect(html).toMatch(/id="log"[^>]*aria-live="polite"/);
  });
  it('has the mode and speed buttons', () => {
    const modes = [...html.matchAll(/<button[^>]*data-mode="(\w+)"/g)].map(m => m[1]);
    expect(modes).toEqual(['you', 'pid', 'tuned', 'ai']);
    for (const r of ['0', '2', '10']) expect(html).toContain(`data-rate="${r}"`);
    expect(html).toMatch(/data-rate="2" aria-pressed="true"/);
  });
  it('has an (i) button on every control and readout', () => {
    for (const id of ['infoPush', 'infoWind', 'infoMode', 'infoSpeed', 'infoFresh', 'infoUpFor', 'infoBestUp', 'infoGens', 'infoBrain', 'infoChart', 'infoUseDials', 'infoFormula']) {
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
  it('stacks the stage over the touch bar and lifts the caption off it', () => {
    expect(rules('.stage-body')).toMatch(/display:\s*block/); // studio.css makes .stage-body a two-column grid
    expect(css).toMatch(/\[data-mode="you"\] \.caption\s*\{\s*bottom:/);
  });
  it('names no other game and has no side stripes', () => {
    expect(css).not.toMatch(/racer|runner/i);
    expect(css).not.toMatch(/border-(left|right):\s*\d+px solid/);
  });
  it('dims dials and colours Wind', () => {
    expect(rules('.dial[data-off]')).not.toMatch(/opacity/); // label text stays full colour for contrast
    expect(rules('.dial[data-off] input')).toMatch(/opacity:\s*\.55/); // only the slider dims
    expect(css).toMatch(/#wind\[aria-pressed="true"\][^}]*var\(--amber\)/);
  });
  it('dims the locked Tuned PID sliders but keeps them readable', () => {
    const op = rules('.dial input:disabled').match(/opacity:\s*([\d.]+)/);
    expect(op).not.toBeNull();
    expect(Number(op[1])).toBeGreaterThanOrEqual(0.55);
  });
  it('swaps the brain for the formula in Tuned PID', () => {
    expect(rules('.insides[data-mode="tuned"] #brain')).toMatch(/display:\s*none/);
    expect(css).toMatch(/\[data-mode="tuned"\][^{]*#formula/);
    expect(rules('#formula')).toMatch(/white-space:\s*pre-line/);
    expect(rules('#formula')).toMatch(/overflow-wrap:\s*(anywhere|break-word)/);
  });
});

describe('touch buttons', () => {
  it('set an explicit line-height of 1.5 or more', () => {
    expect(rules('.touch button')).toMatch(/font:[^;]*\/1\.[5-9]/);
  });
});

describe('balance main.js', () => {
  const block = (start, end) => { const a = main.indexOf(start); const b = main.indexOf(end, a + start.length); return main.slice(a, b); };
  it('imports the pieces it drives', () => {
    for (const n of ['keyDir', 'pidAct', 'advance', 'pushTry', 'createTrainer', 'createTuner']) expect(main, n).toMatch(new RegExp(String.raw`import \{[^}]*\b${n}\b[^}]*\} from`));
  });
  it('ignores keys typed into form fields', () => {
    expect(main).toMatch(/INPUT\|SELECT\|TEXTAREA/);
  });
  it('sets data-mode on the stage wrapper', () => {
    expect(main).toMatch(/dataset\.mode\s*=/);
  });
  it('trains in every mode', () => {
    expect(main).not.toMatch(/if \(s\.mode === 'ai'\) runUnseen/);
    expect(main).toContain('performance.now');
  });
  it('Tuned PID reads the live best dials and never writes them', () => {
    const b = block('function stepOnce', '// Training runs');
    expect(b).toContain("pidAct(run.pid, run.g, s.tuner.bestDials)");
    expect(main).not.toMatch(/s\.tuner\.bestDials\s*=[^=]/);
  });
  it('trains the AI and the tuner together under one budget', () => {
    const b = block('function runUnseen', '// ---------- Drawing');
    expect(b).toContain('s.trainer.runGeneration()');
    expect(b).toContain('s.tuner.runGeneration()');
    expect(b).toContain('performance.now');
  });
  it('locks the dials outside PID and shows Use these dials only in Tuned PID', () => {
    const b = block('function setMode', '// ---------- PID dials');
    expect(b).toMatch(/\.disabled\s*=\s*mode === 'tuned'/);
    expect(b).toMatch(/useDials'\)\.hidden\s*=\s*mode !== 'tuned'/);
  });
  it('Use these dials copies the dials into PID and nothing else', () => {
    const b = block("$('useDials').addEventListener", '// ---------- Push and Wind');
    expect(b).toContain('Object.assign(s.dials, s.tuner.bestDials)');
    expect(b).toContain("setMode('pid')");
    for (const n of ['toggleWind', 'startTry(', 'createTuner', 's.wind', 's.rate']) expect(b, n).not.toContain(n);
  });
  it('every mode writes the line under the stage, and Restart training follows the mode', () => {
    expect(block('function setMode', '// ---------- PID dials')).toContain('say(modeSay(mode))');
    expect(block('function freshBrain', '// ---------- Mode')).toContain('say(freshSay(s.mode))');
    expect(main).toContain("$('fresh').addEventListener('click', freshBrain)");
  });
  it('the chart question and label follow the mode', () => {
    expect(block('function drawChart', 'const brainActs')).toMatch(/chartAsk[\s\S]*best dials/);
    expect(html).toContain('id="chartAsk"');
  });
  it('Wind only toggles Wind: no restart, no new brain, no rate change', () => {
    const b = block("$('wind').addEventListener", "$('fresh')");
    expect(b).toContain('toggleWind');
    for (const n of ['startTry', 'createTrainer', 'freshBrain', 's.rate', 'newTry']) expect(b, n).not.toContain(n);
  });
  it('switching mode starts a new try', () => {
    expect(block('function setMode', '// ---------- PID dials')).toContain('newTry()');
  });
  it('keys are cleared on mode change and blur, and keyup always forgets the code', () => {
    expect(block('function setMode', '// ---------- PID dials')).toContain('clearKeys(keys)');
    expect(main).toMatch(/'blur', \(\) => clearKeys\(keys\)/);
    expect(block("addEventListener('keyup'", "addEventListener('blur'")).toContain('keyUp(keys');
  });
  it('Restart training restarts the try in AI and Tuned PID, and resets both bests', () => {
    const b = block('function freshBrain', '// ---------- Mode');
    expect(b).toMatch(/if \(s\.mode === 'ai' \|\| s\.mode === 'tuned'\) \{ newTry\(\)/);
    expect(b).toMatch(/s\.best\.ai = s\.best\.tuned = 0/);
  });
  it('draws the chart against the 20 s limit', () => {
    expect(main).toMatch(/max: LIMIT \/ 60/);
  });
  it('uses Math.random only in the one seed helper both trainers share and never writes into the best genome', () => {
    expect(main.match(/Math\.random/g)).toHaveLength(1);
    expect(main).toMatch(/createTrainer\(seed\(\)\)/);
    expect(main).toMatch(/createTuner\(seed\(\)\)/);
    expect(main).toMatch(/seed = \(\) => \(Math\.random\(\) \* 2 \*\* 32\) >>> 0/);
  });
});
