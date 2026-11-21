import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { levelPanelHtml } from '../games/treasure-room/level-panel.js';

// The Treasure Room level on each page is the only playground; these four lessons used to repeat it as a 2D grid.
const IDS = ['agent', 'state-action-reward', 'policy', 'value'];
const read = (id, f) => readFileSync(new URL(`../concepts/${id}/${f}`, import.meta.url), 'utf8');
const triesOf = id => [...read(id, 'index.html').match(/<ol class="tries" id="tries">([\s\S]*?)<\/ol>/)[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1]);

describe.each(IDS)('%s lesson has no 2D grid playground', id => {
  it('no play.js, no playground stage, no canvas, no playground wiring', () => {
    expect(existsSync(new URL(`../concepts/${id}/play.js`, import.meta.url))).toBe(false);
    const html = read(id, 'index.html');
    expect(html).not.toContain('id="playground"');
    expect(html).not.toContain('<canvas');
    expect(read(id, 'page.js')).not.toMatch(/play\.js|mountPlayground|wireTries/);
  });
  it('keeps the figure and three tries that name the level controls above', () => {
    expect(read(id, 'page.js')).toContain('figureHtml');
    const tries = triesOf(id);
    expect(tries).toHaveLength(3);
    for (const t of tries) expect(t).not.toMatch(/<button/);
  });
});

describe('each lesson try names a control the level really has', () => {
  const panel = levelPanelHtml();
  const level = f => readFileSync(new URL(`../games/treasure-room/${f}`, import.meta.url), 'utf8');
  // A label is real when it is in the panel markup, or is the handover label a level mounts with.
  const inPanel = l => new RegExp(`>${l}[\\s<]`).test(panel);
  const handover = (file, l) => level(file).includes(`handover: '${l}'`);
  const CONTROLS = {
    agent: [['Hand over to the AI', () => handover('level-agent.js', 'Hand over to the AI')], ['What the AI sees', () => inPanel('What the AI sees')]],
    'state-action-reward': [['Log', () => inPanel('Log')]],
    policy: [['Go', () => inPanel('Go')], ['Let the AI fix it', () => inPanel('Let the AI fix it')]],
    value: [['Sweep', () => inPanel('Sweep')], ['Sweep x10', () => inPanel('Sweep x10')], ['Discount', () => inPanel('Discount')], ['Walk uphill', () => inPanel('Walk uphill')]],
  };
  for (const id of IDS) {
    it(id, () => {
      const text = triesOf(id).join(' ');
      for (const [label, real] of CONTROLS[id]) {
        expect(real(), `${label} is a real label`).toBe(true);
        expect(text, label).toContain(label);
      }
    });
  }
  it('no try uses the wrong handover label, adds a pointless Go after the fix, or moves Discount before Walk uphill', () => {
    expect(triesOf('agent').join(' ')).not.toContain('Let the AI play');
    expect(triesOf('policy').join(' ')).not.toMatch(/fix it[^.]*then press Go/i);
    expect(triesOf('value')[2]).not.toMatch(/Discount/);
  });
  it('state-action-reward writes the minus the way the log does', () => {
    expect(triesOf('state-action-reward').join(' ')).toContain('−10');
  });
});
