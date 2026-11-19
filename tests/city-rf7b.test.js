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
    expect(scene).toMatch(/return \{ x: [^\n]*y: sy\(tmp\), \.\.\.\(top < bottom \? \{ top, bottom \} : \{\}\) \}/);
  });
  it('the swoop and pullback camera starts from the clipped chase pose and is lifted over the roofs, never pulled toward the taxi', () => {
    const scene = read('games/city/scene.js');
    expect(scene).toContain('liftPath(');
    expect(scene).not.toContain('openFrom');
    expect(scene).not.toContain('maxRoof');
    expect(scene).not.toMatch(/clipCamera\(/);
  });
  it('the box is worked out only at phone width, and leaves the flat contact shadow out of it', () => {
    const scene = read('games/city/scene.js');
    expect(scene).not.toContain('(max-width: 720px)'); // one shared phone width, in quality.js
    expect(read('games/city/main.js')).not.toContain('(max-width: 720px)');
    expect(read('games/city/quality.js')).toContain("PHONE_WIDTH = '(max-width: 720px)'");
    expect(scene).toContain('if (narrowScreen()) {');
    expect(scene).toContain('taxiBox.makeEmpty(); for (const part of taxi.children) if (!part.userData.flat) taxiBox.expandByObject(part);');
    expect(scene).not.toContain('taxiBox.setFromObject(taxi)');
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
    expect(main).toContain("infoIds(btn).forEach(id => { $(id).hidden = !open; })");
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
  });
  it('Escape closes the open (i) that holds focus, else the last opened, never a hidden one', () => {
    expect(main).toContain("const visibleInfo = () => infoOpen.filter(b => b.getClientRects().length > 0);");
    expect(main).toContain("visibleInfo().find(b => b === document.activeElement || infoIds(b).some(id => $(id).contains(document.activeElement))) ?? visibleInfo().pop()");
  });
  it('an open (i) closes when its button goes away, for example the Pay (i) when a race starts', () => {
    expect(main).toContain('function closeHiddenInfo() { infoOpen.filter(b => b.getClientRects().length === 0).forEach(b => setInfo(b, false)); }');
    expect(main).toMatch(/\$\('play'\)\.dataset\.screen = screen;\s*closeHiddenInfo\(\);/);
  });
});

describe('RF7b: training shows its percent and can be stopped (F8)', () => {
  it('has a Stop button beside the Train button, shown only while training', () => {
    expect(tagOf('stopTrain')).toMatch(/^<button class="btn" type="button" id="stopTrain"[^>]*hidden/);
    expect(main).toContain("$('stopTrain').hidden = !busy;");
    expect(main).toContain("$('stopTrain').addEventListener('click', () => { $('progress').hidden = true; toMap('failed'); $('train').focus(); });"); // the focused button just hid: focus goes to Train
    expect(tagOf('stopTrain')).toContain('aria-label="Stop training"');
  });
  it('the Train button carries the percent while it trains', () => {
    expect(main).toContain("progress.value = Math.round(100 * p.done / p.total); $('train').textContent = `Training… ${progress.value}%`;");
  });
});

describe('RF7b: small polish (F11, F27, F30, F32, F35)', () => {
  it('F30: the live Pay number takes the fine or pay colour by its sign', () => {
    expect(main).toContain("$('meterTotal').className = rec ? 'meter-total' : `meter-total tone-${m.total < 0 ? 'fine' : m.total > 0 ? 'pay' : 'zero'}`;"); // footage keeps the taxi yellow
  });
  it('F11: the rate card and end card scroll with a thin, dark scrollbar', () => {
    expect(rules('.ratecard, .endcard')).toContain('scrollbar-width: thin');
    expect(rules('.ratecard, .endcard')).toContain('scrollbar-color: #3A4A60 transparent');
  });
  it('F32: the goal chip steps aside while the Garage is open', () => {
    expect(rules('.play[data-garage="true"] .chip-goal')).toContain('display: none');
  });
  it('F35: an empty bay is legible, not 3.3:1 grey', () => {
    expect(rules('.bay.empty')).toContain('color: #9AA7B8');
  });
  it('F27: the bottom bar comes right after the rate card in tab order', () => {
    expect(html.indexOf('id="bar"')).toBeGreaterThan(html.indexOf('</aside>'));
    expect(html.indexOf('id="bar"')).toBeLessThan(html.indexOf('class="topright"')); // before the icon row, the HUD and the end card
    expect(html.indexOf('id="bar"')).toBeLessThan(html.indexOf('id="garageDrawer"'));
  });
  it('footage hides the Pay (i) and its text', () => {
    expect(rules('body.rc-record .meter .info, body.rc-record #info-meters')).toContain('display: none !important');
  });
});

describe('RF7b: the desktop end card fits 1280x720 without scrolling (F12)', () => {
  it('has a city score stat beside time and pay, filled from the same number as the city score line', () => {
    expect(html).toMatch(/<div class="end-city" id="endCityStat" hidden><b class="big" id="endCityNum"><\/b><small>city score<\/small><\/div>/);
    expect(main).toContain("$('endCityNum').textContent = String(m.city); $('endCityStat').hidden = !m.honest;");
  });
  it('the hint comes straight under the stats and the receipt last, by CSS order only (as on the phone)', () => {
    const desk = css.slice(css.indexOf('@media (min-width: 721px)'));
    expect(desk).toMatch(/body:not\(\.rc-record\) \.endcard \.end-stats \{[^}]*order: 1/);
    expect(desk).toMatch(/body:not\(\.rc-record\) \.endcard \.end-verdict \{[^}]*order: 2/);
    expect(desk).toMatch(/body:not\(\.rc-record\) \.endcard \.end-honest \{[^}]*order: 3/);
    expect(desk).toMatch(/body:not\(\.rc-record\) \.endcard \.receipt \{[^}]*order: 4/);
    expect(desk).toMatch(/body:not\(\.rc-record\) \.endcard \.end-actions \{[^}]*order: 6/); // the buttons stay last
  });
  it('shows the stat and drops the city score line on desktop only, never in footage mode', () => {
    expect(rules('.end-stats > .end-city')).toContain('display: none'); // phone and footage; the selector must outrank `.end-stats > div { display: grid }`
    expect(rules('body:not(.rc-record) .end-city:not([hidden])')).toContain('display: grid');
    expect(rules('body:not(.rc-record) #endCity')).toContain('display: none');
    expect(css).toMatch(/@media \(min-width: 721px\) \{[^@]*body:not\(\.rc-record\) \.end-city/);
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
  it('on a desktop the minimap stays at the top right, 60 px down and 12 px in, as before it moved into the HUD (the HUD spans the width so it can be placed against that edge)', () => {
    expect(rules('.hud')).toContain('left: 12px; right: 12px');
    expect(rules('.minimap')).toContain('top: 48px; right: 0'); // the HUD sits at top 12 px: 12 + 48 = 60
  });
  it('the meter (i) text opens right under the Pay meter, before the city score and minimap row, and the HUD rows are 8 px apart', () => {
    expect(hudHtml.indexOf('id="info-meters"')).toBeGreaterThan(hudHtml.indexOf('id="meter"'));
    expect(hudHtml.indexOf('id="info-meters"')).toBeLessThan(hudHtml.indexOf('id="meterGoal"'));
    expect(hudHtml.indexOf('id="info-meters"')).toBeLessThan(hudHtml.indexOf('id="minimap"'));
    expect(css).toMatch(/@media \(max-width: 720px\) \{\s*\.hud \{ gap: 8px; \}/);
    expect(rules('.minimap')).not.toContain('grid-row'); // auto-placed beside the city score, so an open (i) text pushes both down together
  });
  it('a race has no minimap on a phone, and the finished race drops the counts lines so the banner has clear air under the meters', () => {
    expect(rules('.play[data-screen="racing"] .minimap, .play[data-screen="raced"] .minimap')).toContain('display: none');
    expect(rules('.play[data-screen="racing"] .meter-counts, .play[data-screen="raced"] .meter-counts')).toContain('display: none');
  });
  it('both race meters have the same content: no progress bar on either, on any width, so the two boxes are the same height', () => {
    expect(rules('.play[data-screen="racing"] .meter-bar, .play[data-screen="raced"] .meter-bar')).toContain('display: none');
    expect(css.indexOf('.play[data-screen="racing"] .meter-bar')).toBeLessThan(css.indexOf('@media (max-width: 720px)')); // before the phone block: it applies on desktop too
  });
  it('the two race meters sit side by side on a phone, so they cover less of the cars', () => {
    expect(rules('.play[data-screen="racing"] .hud, .play[data-screen="raced"] .hud')).toContain('grid-template-columns: 1fr 1fr');
    expect(rules('.play[data-screen="racing"] .hud .meter, .play[data-screen="raced"] .hud .meter')).toContain('grid-column: auto');
  });
});
