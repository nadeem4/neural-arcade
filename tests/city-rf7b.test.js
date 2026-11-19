import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/city/index.html');
const css = read('games/city/city.css').replace(/\/\*[\s\S]*?\*\//g, '');
const main = read('games/city/main.js');
const tagOf = id => html.match(new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`))?.[0];
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

describe('RF7b: each (i) sits beside what it explains (F28)', () => {
  const topright = html.slice(html.indexOf('<div class="topright">'), html.indexOf('<div class="hud">'));
  it('the top-right row holds only the four icon buttons', () => {
    expect(topright).not.toContain('class="info"');
    expect(topright).not.toContain('info-text');
    expect(topright.match(/<button /g)).toHaveLength(3); // chase cam, sound, garage
  });
  it('the map explanation opens from the rate card (i), together with the rate card text', () => {
    const card = html.slice(html.indexOf('<aside class="ratecard"'), html.indexOf('<section class="ladder"'));
    expect(card).toContain('aria-controls="info-reward info-map"');
    expect(card).toMatch(/id="info-map"[^>]*data-info="map"[^>]*hidden/);
    expect(main).toContain("btn.getAttribute('aria-controls').split(' ').forEach(id => { $(id).hidden = !open; })");
  });
  it('the Pay and city score explanation opens from the Pay meter header, visible only while a drive is on screen', () => {
    const meter = html.slice(html.indexOf('<div class="meter" id="meter"'), html.indexOf('<div class="meter meter-goal"'));
    expect(meter).toContain('aria-controls="info-meters"');
    expect(meter).not.toContain('aria-hidden="true"><svg'); // the button is not inside an aria-hidden box
    expect(tagOf('meter')).not.toContain('aria-hidden');
    expect(html.slice(html.indexOf('<div class="hud">'), html.indexOf('<div class="notes">'))).toMatch(/id="info-meters"[^>]*data-info="meters"[^>]*hidden/);
    expect(rules('.hud .info, .hud .info-text')).toContain('pointer-events: auto');
    expect(rules('.play[data-screen="racing"] .meter .info, .play[data-screen="raced"] .meter .info, .play[data-screen="racing"] #info-meters, .play[data-screen="raced"] #info-meters')).toContain('display: none');
  });
  it('the (i) popovers close on Escape and give focus back to their button', () => {
    expect(main).toContain("document.addEventListener('keydown', e => { if (e.key !== 'Escape') return;");
    expect(main).toContain(".info[aria-expanded=\"true\"]");
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
