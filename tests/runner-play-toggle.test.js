import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const main = read('games/runner/main.js');
const css = read('games/runner/runner.css');
const html = read('games/runner/index.html');
const fn = name => { const i = main.indexOf(`function ${name}() {`); return main.slice(i, main.indexOf('function ', i + 1)); };

describe('switching between you and the AI mid-try', () => {
  it('the stage button toggles: it starts play, or goes back to the AI from any phase', () => {
    expect(main).toMatch(/\$\('playSelf'\)\.addEventListener\('click', \(\) => \{ if \(s\.mode === 'human'\) backToAi\(\); else startHuman\(\); \}\)/);
  });
  it('relabels the button "Back to the AI" while you play, and back to "Play it yourself" after', () => {
    expect(fn('startHuman')).toMatch(/\$\('playSelf'\)\.textContent = 'Back to the AI'/);
    expect(fn('endHuman')).toMatch(/\$\('playSelf'\)\.textContent = 'Play it yourself'/);
  });
  it('uses a changing label, not aria-pressed, and keeps the amber highlight while playing', () => {
    expect(html).not.toMatch(/id="playSelf"[^>]*aria-pressed/);
    expect(main).not.toMatch(/'playSelf'\)\.setAttribute\('aria-pressed'/);
    expect(css).toMatch(/#playSelf\[data-on\] \{[^}]*background: var\(--amber\)/);
  });
});
