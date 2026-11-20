import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { conceptById, CONCEPTS, GAMES } from '../assets/games.js';
import { lessonById } from '../assets/tracks/model.js';
import { LEVELS } from '../games/treasure-room/levels.js';
import { videoHtml, gamesHtml, playLevelHtml, relatedHtml, triesHtml, mountConceptPage, wireTries } from '../assets/concept-page.js';

const pid = { id: 'pid', title: 'PID control', youtube: 'abcdef12345', related: ['mdp'] };

describe('videoHtml', () => {
  it('is empty without a youtube id', () => expect(videoHtml({ ...pid, youtube: null })).toBe(''));
  it('renders the facade with the id and thumbnail', () => {
    const h = videoHtml(pid);
    expect(h).toContain('data-youtube="abcdef12345"');
    expect(h).toContain('abcdef12345/hqdefault.jpg');
  });
});

describe('gamesHtml', () => {
  const g = { title: 'Balance', lesson: 'Steer by error.', path: 'games/balance/', where: { pid: 'The pole is the error.' } };
  it('is empty for no games', () => expect(gamesHtml(pid, [], '../../')).toBe(''));
  it('renders a card per game with link, lesson, heading and where text', () => {
    const h = gamesHtml(pid, [g], '../../');
    expect(h).toContain('See it in the games');
    expect(h).toContain('href="../../games/balance/"');
    expect(h).toContain('Steer by error.');
    expect(h).toContain('<p class="where">The pole is the error.</p>');
    expect(h.match(/class="game"/g)).toHaveLength(1);
  });
  it('wraps the cards in the .games grid after the heading', () => {
    expect(gamesHtml(pid, [g], '')).toMatch(/^<h2>See it in the games<\/h2><div class="games">.*<\/div>$/);
  });
  it('has no where paragraph when missing', () => {
    expect(gamesHtml(pid, [{ ...g, where: {} }], '')).not.toContain('class="where"');
  });
  it('escapes text', () => {
    expect(gamesHtml(pid, [{ ...g, title: 'A<b>' }], '')).toContain('A&lt;b&gt;');
  });
});

describe('playLevelHtml', () => {
  const room = GAMES.find(g => g.id === 'treasure-room');
  const usingGames = c => GAMES.filter(g => g.uses?.includes(c.id));
  it('links the concept to its level of the game', () => {
    const h = playLevelHtml(conceptById('policy'), usingGames(conceptById('policy')), '../../');
    expect(h).toContain('href="../../games/treasure-room/?level=4"');
    expect(h).toContain('Play this level: Treasure Room, level 4');
    expect(h).toContain('class="play-level"');
  });
  it('is empty for a concept no game has a level for', () => {
    expect(playLevelHtml(pid, GAMES, '../../')).toBe('');
    expect(playLevelHtml(conceptById('reward-design'), usingGames(conceptById('reward-design')), '../../')).toBe('');
  });
  it('skips games that use the concept but have no level for it', () => {
    const h = playLevelHtml(conceptById('agent'), usingGames(conceptById('agent')), '');
    expect(h).toContain('href="games/treasure-room/?level=1"');
  });
  it('the six level concepts each point at their own level number', () => {
    for (const l of LEVELS) {
      const h = playLevelHtml(conceptById(l.concept), usingGames(conceptById(l.concept)), '');
      expect(h, l.concept).toContain(`?level=${l.n}"`);
      expect(room.levels[l.concept]).toBe(l.n);
    }
  });
  it('escapes the game title', () => {
    const g = { title: 'A<b>', path: 'g/', levels: { pid: 2 } };
    expect(playLevelHtml(pid, [g], '')).toContain('A&lt;b&gt;');
  });
});

describe('gamesHtml with a level link', () => {
  it('puts the play link between the heading and the cards, for any concept page', () => {
    const c = conceptById('mdp');
    const h = gamesHtml(c, GAMES.filter(g => g.uses?.includes('mdp')), '../../');
    expect(h).toMatch(/^<h2>See it in the games<\/h2><p class="play-level">.*<\/p><div class="games">/);
  });
});

describe('relatedHtml', () => {
  it('renders a chip linking to the related concept', () => {
    const h = relatedHtml(pid, '../../');
    expect(h).toContain('Where it fits');
    expect(h).toContain('class="chip"');
    expect(h).toContain('href="../../concepts/mdp/"');
  });
  it('wraps the chips in a .chips row', () => {
    expect(relatedHtml(pid, '')).toMatch(/<h2>Where it fits<\/h2><div class="chips"><a class="chip".*<\/a><\/div>$/);
  });
  it('is empty when no related id is known', () => {
    expect(relatedHtml({ related: ['nope'] }, '')).toBe('');
    expect(relatedHtml({ related: [] }, '')).toBe('');
  });
});

describe('triesHtml', () => {
  const presets = [{ label: 'Only P', text: 'It <wobbles>.', state: { p: 1 } }, { label: 'Add D', text: 'Calmer.', state: { p: 1, d: 1 } }];
  it('renders an ordered list with a button per preset', () => {
    const h = triesHtml(presets);
    expect(h).toContain('data-preset="0"');
    expect(h).toContain('data-preset="1"');
    expect(h).toContain('>Only P<');
    expect(h).toContain('Calmer.');
    expect(h.match(/<li/g)).toHaveLength(2);
  });
  it('escapes text', () => expect(triesHtml(presets)).toContain('It &lt;wobbles&gt;.'));
});

describe('DOM helpers', () => {
  afterEach(() => vi.unstubAllGlobals());
  const el = () => ({ innerHTML: '', hidden: true, querySelectorAll: () => [], addEventListener() {} });

  it('mountConceptPage fills and un-hides sections', () => {
    const els = { video: el(), games: el(), related: el() };
    const doc = { getElementById: id => els[id] ?? null };
    mountConceptPage('pid', '../../', doc);
    expect(els.video.hidden).toBe(false);
    expect(els.video.innerHTML).toContain('data-youtube');
    expect(els.video.innerHTML).toContain('<h2>Watch it explained</h2>');
    expect(els.games.hidden).toBe(false);
    expect(els.games.innerHTML).toContain('href="../../games/balance/"');
    expect(els.games.innerHTML).toContain('class="where"');
    expect(els.related.hidden).toBe(false);
    expect(els.related.innerHTML).toContain('href="../../concepts/policy/"');
  });
  it('keeps an empty section hidden', () => {
    const els = { video: el(), games: el(), related: el() };
    mountConceptPage('mdp', '../../', { getElementById: id => els[id] ?? null });
    expect(els.video.innerHTML).toBe('');
    expect(els.games.hidden).toBe(false); // Treasure Room uses mdp
    expect(els.games.innerHTML).toContain('Treasure Room');
  });

  it('wireTries applies the clicked preset state', () => {
    const presets = [{ state: { p: 1 } }, { state: { p: 2 } }];
    let handler;
    const root = { addEventListener: (_t, fn) => { handler = fn; } };
    const apply = vi.fn();
    wireTries(root, presets, apply);
    handler({ target: { closest: () => ({ dataset: { preset: '1' } }) } });
    expect(apply).toHaveBeenCalledWith({ p: 2 });
    handler({ target: { closest: () => null } });
    expect(apply).toHaveBeenCalledTimes(1);
  });
});

describe('concept.css', () => {
  const css = readFileSync(new URL('../assets/concept.css', import.meta.url), 'utf8');

  it('defines the classes the builders emit', () => {
    for (const sel of ['.stage', '.tries', '.part', '.fig', '.game', '.where', '.chip', '.chips', '.play-level']) {
      expect(css).toContain(sel);
    }
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('prefers-reduced-motion');
  });

  it('uses tokens only, no raw hex colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('pid page file', () => {
  const html = readFileSync(new URL('../concepts/pid/index.html', import.meta.url), 'utf8');

  it('has the shared header, footer and styles', () => {
    for (const s of ['<header data-site', '<footer data-site', '../../assets/studio.css', '../../assets/concept.css']) expect(html).toContain(s);
  });
  it('has the section ids', () => {
    for (const id of ['playground', 'tries', 'writeup', 'video', 'games', 'related']) expect(html).toContain(`id="${id}"`);
  });
  it('leads with the definition from the config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(conceptById('pid').definition);
  });
  for (const f of ['fig-hill', 'fig-overshoot', 'fig-settle']) {
    it(`${f}.webp exists, is under 150 KB and is an img with alt, width and height`, () => {
      expect(statSync(new URL(`../concepts/pid/${f}.webp`, import.meta.url)).size).toBeLessThan(150000);
      const img = html.match(new RegExp(`<img[^>]*src="${f}\.webp"[^>]*>`))?.[0];
      expect(img, f).toBeTruthy();
      for (const a of ['alt', 'width', 'height']) expect(img).toMatch(new RegExp(` ${a}="[^"]+"`));
    });
  }
});

describe('every concept page', () => {
  const read = (id, f) => readFileSync(new URL(`../concepts/${id}/${f}`, import.meta.url), 'utf8');
  const LESSONS = ['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp'];
  it('the six lesson pages are generated shells with the shared sections and the lesson says as lead', () => {
    for (const id of LESSONS) {
      const html = read(id, 'index.html');
      for (const s of ['playground', 'tries', 'writeup', 'play', 'watch', 'read']) expect(html, `${id} #${s}`).toContain(`id="${s}"`);
      for (const a of ['assets/studio.css', 'assets/concept.css', 'assets/lesson.css', 'assets/lesson-page.js']) expect(html, `${id} ${a}`).toContain(a);
      const lead = html.match(/<p class="lead">(.*?)<\/p>/s)[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      expect(lead, id).toBe(lessonById(id).says);
      expect(read(id, 'writeup.html'), id).toContain('id="writeup"');
      expect(read(id, 'page.js'), id).toContain('wireTries');
    }
  });
  it('every other concept has a page file with the shared sections', () => {
    for (const c of CONCEPTS.filter(c => !LESSONS.includes(c.id))) {
      const html = read(c.id, 'index.html');
      for (const id of ['playground', 'tries', 'writeup', 'video', 'games', 'related']) expect(html, `${c.id} #${id}`).toContain(`id="${id}"`);
      for (const a of ['assets/studio.css', 'assets/concept.css', 'assets/site.js', 'assets/concept-page.js']) expect(html, `${c.id} ${a}`).toContain(a);
      const lead = html.match(/<p class="lead">(.*?)<\/p>/s)[1].replace(/<[^>]+>/g, '').replace(/&#39;/g, "'");
      expect(lead, c.id).toBe(c.definition);
    }
  });
  it('every concept has sim.js and play.js', () => {
    for (const c of CONCEPTS) for (const f of ['sim.js', 'play.js']) expect(() => read(c.id, f), `${c.id}/${f}`).not.toThrow();
  });
});
