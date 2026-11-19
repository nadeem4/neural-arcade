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

describe('RF7b: phone tags keep off the taxi', () => {
  it('the stage reports the drawn taxi\'s screen box with its anchor, which placeTag hands to tagPlace', () => {
    const scene = read('games/city/scene.js');
    expect(scene).toContain('taxiBox.setFromObject(taxi)');
    expect(scene).toMatch(/return \{ x: [^\n]*y: sy\(tmp\), \.\.\.\(top < bottom \? \{ top, bottom \} : \{\}\) \}/);
  });
});

describe('RF7b: Skip pulls the camera back (F9)', () => {
  it('skipTrip jumps to the start of the pullback even from the chase view, which has no pullback of its own', () => {
    const scene = read('games/city/scene.js');
    expect(scene).toContain('skipTrip() { if (play && !manualClock) { play.swoop = true; play.t0 = performance.now() - SWOOP_MS - play.track.total; } }');
  });
});

describe('RF7b: meters, minimap and banner clear each other on a phone', () => {
  const hudHtml = html.slice(html.indexOf('<div class="hud">'), html.indexOf('<div class="notes">'));
  it('the minimap sits in the HUD grid, beside the city score, so no meter runs under it', () => {
    expect(hudHtml).toContain('id="minimap"');
    expect(rules('.minimap')).toContain('position: static'); // inside the phone media block: the desktop rule stays absolute above
    expect(css).toMatch(/\.hud \{[^}]*grid-template-columns: 1fr auto/);
    expect(css).toMatch(/\.hud \.meter \{[^}]*grid-column: 1 \/ -1/);
    expect(css).toMatch(/\.hud \.meter-goal \{[^}]*grid-column: 1/);
  });
  it('a race has no minimap on a phone, and the finished race drops the counts lines so the banner has clear air under the meters', () => {
    expect(rules('.play[data-screen="racing"] .minimap, .play[data-screen="raced"] .minimap')).toContain('display: none');
    expect(rules('.play[data-screen="racing"] .meter-counts, .play[data-screen="raced"] .meter-counts')).toContain('display: none');
  });
  it('the two race meters sit side by side on a phone, so they cover less of the cars', () => {
    expect(rules('.play[data-screen="racing"] .hud, .play[data-screen="raced"] .hud')).toContain('grid-template-columns: 1fr 1fr');
    expect(rules('.play[data-screen="racing"] .hud .meter, .play[data-screen="raced"] .hud .meter')).toContain('grid-column: auto');
  });
});
