import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { LESSON, INFO } from '../games/city/words.js';
import { RANGES, DEFAULT_REWARDS } from '../games/city/presets.js';
import { FIELDS } from '../games/city/reward.js';
import { garageLabel } from '../games/city/garage.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/city/index.html');
const css = read('games/city/city.css').replace(/\/\*[\s\S]*?\*\//g, '');
const mainPath = 'games/city/main.js';
const rules = sel => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');
const tag = id => html.match(new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`))?.[0];

const IDS = ['announce', 'play', 'about', 'rateCard', 'stage', 'stageNote', 'status', 'train', 'progress', 'receipt', 'share', 'shareText', 'copy', 'reset', 'chase', 'labels', 'meter', 'meterTotal', 'meterCounts', 'meterGoal', 'meterGoalTotal', 'meterBar', 'meterGoalBar', 'mapGoal', 'minimap', 'mute', 'garage', 'garageCount', 'garageDrawer', 'garageList', 'garageClose', 'garageEmpty', 'bar', 'barDrive', 'viewToggle', 'driveProgress', 'skip', 'endcard', 'endTitle', 'endFlag', 'endTime', 'endGoal', 'endEarned', 'endVerdict', 'endHonest', 'endHonestLine', 'endCity', 'endCheats', 'endEdit', 'endKeep', 'endAgain', 'toast'];

describe('city page markup', () => {
  it('has every id main.js will look up', () => {
    const ids = [...IDS, ...FIELDS.flatMap(f => [f.key + 'Out', f.key + 'Dec', f.key + 'Inc'])];
    for (const id of ids) expect(html, id).toContain(`id="${id}"`);
    const main = read(mainPath); // 'about' and 'rateCard' are anchors and aria targets; #stageNote belongs to the stage, main.js never touches it
    for (const id of IDS.filter(i => !['about', 'rateCard', 'stageNote', 'bar'].includes(i))) expect(main, id).toContain(`$('${id}')`);
    expect(main).toContain("$(r.key + 'Out')"); // the steppers are looked up through FIELDS
    expect(main).toContain("$(f.key + 'Dec')");
    expect(main).toContain("$(f.key + 'Inc')");
  });
  it('announces only the verdict, so the receipt is aria-live off to avoid a double announcement, and shows progress with a progress element', () => {
    expect(tag('announce')).toContain('aria-live="polite"');
    expect(tag('announce')).toContain('class="sr-only"');
    expect(html.slice(html.indexOf('<aside'), html.indexOf('</aside>'))).not.toContain('id="announce"'); // outside the rate card, so hiding it cannot silence it
    expect(tag('endVerdict')).not.toContain('aria-live');
    expect(tag('receipt')).toContain('aria-live="off"');
    expect(html).toMatch(/<progress [^>]*id="progress"/);
  });
  it('has a chase cam toggle (aria-pressed off) and a landmark label layer hidden from screen readers', () => {
    expect(tag('chase')).toMatch(/^<button /);
    expect(tag('chase')).toContain('aria-pressed="false"');
    expect(tag('labels')).toContain('aria-hidden="true"');
  });
  it('has the drive HUD: a live meter and a round minimap hidden from screen readers until a drive starts, and a mute toggle', () => {
    for (const id of ['meter', 'minimap']) {
      if (id === 'minimap') expect(tag(id), id).toContain('aria-hidden="true"'); // the meter holds the (i) button now (RF7b), so it is not aria-hidden
      expect(tag(id), id).toMatch(/\shidden[\s>]/);
    }
    expect(tag('minimap')).toMatch(/^<canvas /);
    expect(tag('meterGoal')).toContain('aria-hidden="true"');
    expect(tag('meterGoal')).toMatch(/\shidden[\s>]/);
    expect(tag('meterGoal')).not.toContain('aria-live');
    expect(html).toContain('City score');
    expect(html).toContain('>Pay<');
    expect(tag('mapGoal')).toMatch(/^<p /);
    expect(read('games/city/main.js')).toContain('goalLine()');
    expect(tag('mute')).toContain('aria-pressed="false"');
    expect(rules('.minimap')).toContain('border-radius: 50%');
    expect(css).toContain('prefers-reduced-motion');
  });
  it('has a - and + stepper per reward line, with a live value, and no sliders left', () => {
    for (const f of FIELDS) {
      expect(tag(f.key + 'Dec'), f.key).toMatch(/^<button .*aria-label="Lower /);
      expect(tag(f.key + 'Inc'), f.key).toMatch(/^<button .*aria-label="Raise /);
      expect(tag(f.key + 'Out'), f.key).toMatch(/^<output /);
      expect(html, f.key).toContain(`>${f.label}</span>`);
    }
    expect(html).not.toContain('type="range"');
  });
  it('has Train & Drive in a bottom bar, a Garage button with a count and a hidden drawer, and a hidden end card with its three buttons', () => {
    expect(html).toContain('>Train and drive</button>');
    expect(tag('garage')).not.toMatch(/\sdisabled[\s>]/);
    expect(tag('garage')).toContain('aria-controls="garageDrawer"');
    expect(tag('garage')).toContain('aria-expanded="false"');
    expect(html).toContain('Train a taxi, then keep it here.');
    expect(tag('garageDrawer')).toMatch(/\shidden[\s>]/);
    expect(tag('garageList')).toMatch(/^<ul /);
    expect(read('games/city/main.js')).not.toContain('Garage arrives next');
    expect(tag('endcard')).toMatch(/\shidden[\s>]/);
    expect(html).toContain('>Change the rates</button>');
    expect(html).toContain('>Keep in the garage</button>');
    expect(html).toContain('>Watch again</button>');
    expect(html).toContain('>Back to step 1</button>');
    expect(tag('barDrive')).toMatch(/\shidden[\s>]/);
    expect(tag('skip')).toContain('aria-label="Skip to the end"');
    expect(tag('viewToggle')).toContain('aria-label="Map view"');
    expect(tag('driveProgress')).toMatch(/^<progress /);
  });
  it('links the write-up now it is listed, mounts the shared game page, and keeps the goal and status announced', () => {
    for (const id of ['howTab', 'whyLink', 'how']) expect(tag(id), id).not.toMatch(/\shidden[\s>]/);
    expect(html).toContain('src="../../assets/game-page.js"');
    expect(tag('moreFrom')).toMatch(/\shidden[\s>]/);
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

describe('city page race markup', () => {
  const RACE_IDS = ['meterLabel', 'meterB', 'meterBTotal', 'meterBLabel', 'meterBCounts', 'raceBar', 'raceLine', 'startRace', 'raceBanner', 'raceTitle', 'raceDetail', 'raceAgain', 'raceBack'];
  it('has the race pieces, each looked up by main.js or race-view.js', () => {
    const code = read(mainPath) + read('games/city/race-view.js');
    for (const id of RACE_IDS) {
      expect(html, id).toContain(`id="${id}"`);
      expect(code, id).toContain(`'${id}'`);
    }
  });
  it('hides the second meter, the race bar and the result banner until a race, and the banner can take focus', () => {
    for (const id of ['meterB', 'raceBar', 'raceBanner']) expect(tag(id), id).toMatch(/\shidden[\s>]/);
    expect(tag('meterB')).toContain('aria-hidden="true"');
    expect(tag('raceBanner')).toContain('tabindex="-1"');
    expect(tag('startRace')).toMatch(/^<button /);
    expect(html).toContain('>Start race</button>');
    expect(html).toContain('>Rematch</button>');
    expect(html).toContain('>Back to garage</button>');
  });
  it('rings the picked taxis in cyan and styles the Start race button cyan', () => {
    expect(rules('.bay.picked')).toContain('var(--hud-route)');
    expect(rules('#startRace')).toContain('var(--hud-route)');
  });
  it('the garage cards carry a Race toggle that says In race when picked, and main.js checks both taxis with validTaxi first', () => {
    const view = read('games/city/garage-view.js');
    expect(view).toContain('In race');
    expect(view).toContain('aria-pressed');
    const main = read(mainPath), start = main.slice(main.indexOf('function startRace'));
    expect(start.indexOf('validTaxi')).toBeGreaterThan(-1);
    expect(start.indexOf('validTaxi')).toBeLessThan(start.indexOf('raceTracks'));
    expect(start.indexOf('raceTracks')).toBeLessThan(start.indexOf("go('race')"));
  });
  it('hides Race without 3D, with a title that says why', () => {
    expect(read(mainPath)).toContain('Racing needs the 3D view.');
  });
});

describe('city page layout', () => {
  it('has no Try cards: no #cards, no card code, no card styles', () => {
    expect(html).not.toContain('id="cards"');
    expect(read(mainPath)).not.toMatch(/PRESETS|cardMatching|card-btn|pick\(/);
    expect(read('games/city/city.css')).not.toMatch(/card-btn|\.cards/);
  });
  it('keeps focus order: rate card, then Train, then the end card', () => {
    const at = x => html.indexOf(x);
    expect(at('id="reset"')).toBeGreaterThan(at('id="rateCard"'));
    expect(at('id="train"')).toBeGreaterThan(at('id="reset"'));
    expect(at('id="endNext"')).toBeGreaterThan(at('id="train"'));
    expect(at('id="endEdit"')).toBeGreaterThan(at('id="endNext"'));
    expect(at('id="endKeep"')).toBeGreaterThan(at('id="endEdit"'));
    expect(at('id="endAgain"')).toBeGreaterThan(at('id="endKeep"'));
  });
  it('has a hidden Next step button on the end card, and sentence case on every button', () => {
    expect(html).toMatch(/id="endNext"[^>]*hidden|hidden[^>]*id="endNext"/);
    const labels = [...html.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map(m => m[1].trim()).filter(t => /[A-Z]{3,}/.test(t));
    expect(labels).toEqual([]);
  });
  it('only the small eyebrow is uppercase: the Not legal flag inside it stays sentence case', () => {
    expect(css).toMatch(/\.end-head\s*\{[^}]*text-transform:\s*uppercase/);
    expect(css).toMatch(/\.end-flag\s*\{[^}]*text-transform:\s*none/);
  });
  it('the race banner keeps its Race done eyebrow first on a phone, where the end card reorders its parts', () => {
    expect(css).toMatch(/\.racebanner \.end-head\s*\{[^}]*order:\s*-1/);
  });
  it('a meter count line that wraps balances its lines, so no lone number sits on the second one', () => {
    expect(css).toMatch(/\.meter-counts\s*\{[^}]*text-wrap:\s*balance/);
  });
  it('starts on the map screen', () => {
    expect(html).toMatch(/id="play"[^>]*data-screen="map"/);
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
  it('shows keyboard focus on buttons', () => {
    expect(css).toMatch(/button:focus-visible/);
  });
  it('fills the screen with the stage, switches panels by screen, and keeps the phone rate card to 40% of the viewport and the end card to 60%', () => {
    expect(css).toMatch(/100svh/);
    expect(css).toMatch(/\[data-screen=/);
    const phone = css.slice(css.indexOf('@media (max-width: 720px)'));
    for (const [sel, h] of [['.ratecard', 40], ['.endcard', 60]]) expect(phone).toMatch(new RegExp(sel.replace('.', String.raw`\.`) + String.raw`[^{}]*\{[^}]*max-height:\s*` + h + 'svh'));
  });
  it('loads Space Grotesk from the vendored font files', () => {
    expect(css).toMatch(/font-family:\s*"Space Grotesk"[^}]*fonts\/space-grotesk-latin-700-normal\.woff2/);
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
  it('garage cards have a flat stripe element, not a thick top border, and show what the taxi earned', () => {
    expect(rules('.bay')).not.toContain('border-top');
    expect(rules('.bay-stripe')).toContain('height: 4px');
    expect(read('games/city/garage-view.js')).toContain('bay-stripe');
    expect(read('games/city/garage-view.js')).toContain('analysis.reward');
  });
});

describe('opening the Garage collapses the rate card (RF5)', () => {
  const main = read(mainPath);
  const showGarage = main.slice(main.indexOf('function showGarage'), main.indexOf('function keepTrip'));
  const inset = main.slice(main.indexOf('function updateInset'), main.indexOf("addEventListener('resize', updateInset)"));
  it('showGarage marks the play area and re-measures the phone inset', () => {
    expect(showGarage).toContain("$('play').dataset.garage = String(open)");
    expect(showGarage).toContain('updateInset()');
  });
  it('updateInset gives the phone no inset while the drawer is open, since the hidden card has no offsetTop', () => {
    expect(inset).toContain("$('garageDrawer').hidden");
  });
  it('the rate card is hidden while the garage is open', () => {
    expect(rules('.play[data-garage="true"] .ratecard')).toMatch(/display:\s*none/);
  });
  it('the bottom bar is hidden while the garage is open', () => {
    expect(rules('.play[data-garage="true"] .gbar')).toMatch(/display:\s*none/);
  });
  it('the phone drawer is tall and compact, the desktop drawer has two bay columns', () => {
    const from = css.indexOf('.drawer { top: auto');
    const phone = css.slice(from).split(/^\}/m)[0]; // only the phone media block
    expect(phone).toMatch(/max-height:\s*calc\(100% - 68px - env\(safe-area-inset-bottom\)\)/); // the lifted drawer must not reach the top button row
    expect(phone).toMatch(/bottom:\s*calc\(8px \+ env\(safe-area-inset-bottom\)\)/); // clears the home indicator
    expect(phone).toMatch(/\.bay-chips\s*\{\s*display:\s*none/);
    expect(phone).toMatch(/\.drawer \.btn,[^}]*height:\s*44px/); // real tap targets
    expect(rules('.bays')).toMatch(/overscroll-behavior:\s*contain/);
    expect(rules('.bay-note')).toMatch(/display:\s*none/);
    expect(rules('.drawer .bays')).toContain('grid-template-columns: 1fr 1fr');
  });
});

describe('phone pass (RF6)', () => {
  const inner = id => html.match(new RegExp(`<(button|a)[^>]*id="${id}"[^>]*>([\\s\\S]*?)</\\1>`))[2];
  const words = id => inner(id).replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<span[^>]*id="garageCount"[^>]*>[\s\S]*?<\/span>/, '').replace(/<[^>]*>/g, '').trim();
  const block = q => { const i = css.indexOf(q); let d = 0, j = css.indexOf('{', i); const a = j; for (; j < css.length; j++) { if (css[j] === '{') d++; if (css[j] === '}' && --d === 0) break; } return css.slice(a, j); };
  const ICONS = ['chase', 'mute', 'garage', 'viewToggle', 'skip', 'garageClose', 'howTab'];
  it('shows the utility buttons as inline SVG icons with an accessible name, a tooltip and no visible words', () => {
    for (const id of ICONS) {
      expect(inner(id), id).toContain('<svg');
      expect(inner(id), id).toContain('stroke="currentColor"');
      expect(tag(id), id).toMatch(/aria-label="[^"]+"/);
      expect(tag(id), id).toMatch(/title="[^"]+"/);
      expect(words(id), id).toBe('');
    }
  });
  it('keeps the toggles as toggles and the garage count as a badge', () => {
    for (const id of ['chase', 'mute', 'viewToggle']) expect(tag(id), id).toContain('aria-pressed=');
    expect(tag('garageCount')).toContain('class="badge"');
    expect(read(mainPath)).toContain("b.setAttribute('aria-label', t)");
    expect(read(mainPath)).not.toMatch(/\$\('mute'\)\.textContent/);
    expect(read(mainPath)).toContain("$('garage').setAttribute('aria-label'");
  });
  it('gives the icon buttons a 44 px tap target and one stroke style', () => {
    expect(rules('.ibtn')).toMatch(/width: 44px/); expect(rules('.ibtn')).toMatch(/height: 44px/);
    expect(rules('.chase.ibtn')).toMatch(/height: 44px/);
    expect(rules('.ibtn svg')).toContain('stroke-linecap: round');
  });
  it('shows the speaker with waves, or crossed out when muted', () => {
    expect(rules('#mute .off, #mute[aria-pressed="true"] .on')).toContain('display: none');
  });
  it('lets the stage be shorter than 420 px in landscape, so the bottom bar stays on screen', () => {
    expect(block('@media (max-height: 500px) and (max-width: 950px)')).toMatch(/\.play \{[^}]*min-height: 0/); // landscape phones only; a short desktop window keeps the minimum
  });
  it('makes the (i) text on the navy cards readable', () => {
    expect(rules('.ratecard .info-text, .endcard .info-text')).toContain('background: var(--navy-soft)');
  });
  it('has 44 px steppers, (i) buttons and end card buttons, and 8 px between ladder steps, on a phone', () => {
    const phone = block('@media (max-width: 720px)'), small = block('@media (max-width: 600px)');
    expect(phone).toMatch(/\.rstep \{[^}]*height: 44px/);
    expect(phone).toMatch(/\.end-actions \.btn, \.end-actions \.go \{[^}]*height: 44px/);
    expect(small).toMatch(/\.ratecard \.info, \.endcard \.info \{[^}]*min-height: 44px/);
    expect(small).toMatch(/\.steps \{[^}]*gap: 8px/);
    expect(rules('.citybar .logo')).toContain('min-height: 44px');
  });
  it('stops a scrolled sheet from scrolling the page behind it, and keeps the open Garage below the top buttons', () => {
    expect(rules('.ratecard, .endcard')).toContain('overscroll-behavior: contain');
    expect(css).toMatch(/\.drawer \{[^}]*max-height: calc\(100% - 68px - env\(safe-area-inset-bottom\)\)/);
  });
  it('lets a long goal line wrap inside a rounded chip, not a pill, on a phone', () => {
    expect(block('@media (max-width: 720px)')).toMatch(/\.notes \.chip \{[^}]*border-radius: 16px/); // only the HUD chips, not the concept chips under About
    expect(block('@media (max-width: 720px)')).toMatch(/\.notes \.chip \{[^}]*height: auto/); // studio.css fixes a chip at 38 px, which a wrapped goal line spills out of
    expect(block('@media (max-width: 720px)')).toMatch(/\.notes \{[^}]*width: calc\(100% - 16px\)/);
  });
});

describe('phone end card (RF6)', () => {
  const phone = css.slice(css.indexOf('@media (max-width: 720px)'));
  it('puts the (i) inline at the end of the goal label, not on a row of its own', () => {
    expect(phone).toMatch(/\.end-stats > div:first-child \{[^}]*grid-template-columns: auto auto/);
    expect(phone).toMatch(/\.end-stats \.info \{[^}]*margin: -12px/);
  });
  it('keeps the three actions on one equal-width row that may wrap its labels', () => {
    expect(phone).toMatch(/#endcard \.end-actions \{[^}]*display: grid[^}]*grid-template-columns: repeat\(3, 1fr\)/);
    expect(phone).toMatch(/#endcard \.end-actions \.btn, #endcard \.end-actions \.go \{[^}]*white-space: normal/);
  });
});

describe('phone review fixes (RF6)', () => {
  it('keeps the race result buttons centred: the 3-column grid is only for #endcard', () => {
    expect(css).not.toMatch(/\.endcard \.end-actions \{[^}]*grid-template-columns/);
    expect(rules('.racebanner .end-actions')).toMatch(/justify-content: center/);
    expect(css).not.toMatch(/\.racebanner \.end-actions \{[^}]*display: grid/);
  });
  it('makes the garage count badge 13 px', () => { expect(rules('.badge')).toMatch(/font: 700 13px/); });
  it('sits the HUD and minimap under one row of top buttons at phone widths', () => {
    expect(css).toMatch(/\.hud \{[^}]*top: 60px/);
    expect(css).toMatch(/\.minimap \{[^}]*top: 48px/); // inside the HUD, which sits 12 px down: 60 px from the page top
  });
  it('words the garage button for no, one and several kept taxis', () => {
    expect(garageLabel(0)).toBe('Garage');
    expect(garageLabel(1)).toBe('Garage, 1 kept');
    expect(garageLabel(4)).toBe('Garage, 4 kept');
    expect(read(mainPath)).toContain('garageLabel(garage.taxis.length)');
  });
});

describe('phone type scale (RF6): 16 px to read, 14 px labels, 13 px captions, nothing smaller', () => {
  const phones = [...css.matchAll(/@media \(max-width: (?:720|600)px\) \{/g)].map(m => { let d = 0, j = m.index + m[0].length - 1; const a = j; for (; j < css.length; j++) { if (css[j] === '{') d++; if (css[j] === '}' && --d === 0) break; } return css.slice(a, j); }).join('\n');
  const size = (sel) => { const esc = sel.replace(/[.#*+?^${}()|[\]\\]/g, '\\$&'); const m = phones.match(new RegExp('(?:^|[\\n}{; ])' + esc + '\\s*\\{[^}]*?font-size:\\s*(\\d+(?:\\.\\d+)?)px')); return m && Number(m[1]); };
  it('declares no font size under 13 px in the phone rules', () => {
    const all = [...phones.matchAll(/font-size:\s*([\d.]+)px/g)].map(m => Number(m[1]));
    expect(all.length).toBeGreaterThan(10);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(13);
  });
  it('lifts what the player reads to 16 px, the labels to 14 px and the small print to 13 px', () => {
    for (const sel of ['.end-verdict', '.ratecard .info-text, .endcard .info-text']) expect(size(sel), sel).toBe(16);
    for (const sel of ['.rate', '.ladder-note', '.end-honest', '.receipt, .receipt .row']) expect(size(sel), sel).toBe(14);
    for (const sel of ['.meter-label', '.meter-counts', '#labels span']) expect(size(sel), sel).toBe(13);
  });
  it('keeps running text at a 1.4 to 1.5 line height', () => {
    expect(phones).toMatch(/\.ladder-note \{[^}]*line-height: 1\.4/);
    expect(phones).toMatch(/\.end-verdict[^{}]*\{[^}]*line-height: 1\.45/);
  });
});
