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

const IDS = ['announce', 'play', 'about', 'rateCard', 'stage', 'stageNote', 'status', 'train', 'progress', 'receipt', 'share', 'shareText', 'copy', 'reset', 'chase', 'labels', 'meter', 'meterTotal', 'meterCounts', 'minimap', 'mute', 'garage', 'garageCount', 'garageDrawer', 'garageList', 'garageClose', 'garageEmpty', 'bar', 'barDrive', 'viewToggle', 'driveProgress', 'skip', 'endcard', 'endTitle', 'endFlag', 'endTime', 'endGoal', 'endEarned', 'endVerdict', 'endEdit', 'endKeep', 'endAgain', 'toast'];

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
      expect(tag(id), id).toContain('aria-hidden="true"');
      expect(tag(id), id).toMatch(/\shidden[\s>]/);
    }
    expect(tag('minimap')).toMatch(/^<canvas /);
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
    expect(html).toContain('>TRAIN &amp; DRIVE</button>');
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
    expect(html).toContain('>Reset to the default</button>');
    expect(tag('barDrive')).toMatch(/\shidden[\s>]/);
    expect(html).toContain('>Skip to the end</button>');
    expect(html).toContain('>Map view</button>');
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
    expect(html).toContain('>START RACE</button>');
    expect(html).toContain('>Rematch</button>');
    expect(html).toContain('>Back to garage</button>');
  });
  it('rings the picked taxis in cyan and styles the START RACE button cyan', () => {
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
    expect(at('id="endEdit"')).toBeGreaterThan(at('id="train"'));
    expect(at('id="endKeep"')).toBeGreaterThan(at('id="endEdit"'));
    expect(at('id="endAgain"')).toBeGreaterThan(at('id="endKeep"'));
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
  it('fills the screen with the stage, switches panels by screen, and keeps the phone sheets to 35% of the viewport', () => {
    expect(css).toMatch(/100svh/);
    expect(css).toMatch(/\[data-screen=/);
    const phone = css.slice(css.indexOf('@media (max-width: 720px)'));
    for (const sel of ['.ratecard', '.endcard']) expect(phone).toMatch(new RegExp(sel.replace('.', String.raw`\.`) + String.raw`[^{}]*\{[^}]*max-height:\s*35svh`));
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
