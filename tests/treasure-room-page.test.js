import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAMES } from '../assets/games.js';
import { LESSON } from '../games/treasure-room/words.js';
import { levelFromUrl, navModel } from '../games/treasure-room/levels.js';
import { BUILT_LEVELS } from '../games/treasure-room/level-panel.js';
import { lessonOfLevel } from '../assets/tracks/model.js';
import { initial, reduce } from '../games/treasure-room/level-agent.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/treasure-room/index.html');
const css = read('games/treasure-room/treasure-room.css').replace(/\/\*[\s\S]*?\*\//g, '');
const main = read('games/treasure-room/main.js');
const entry = GAMES.find(g => g.id === 'treasure-room');
const rules = sel => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');

describe('treasure room deep links', () => {
  it('lands every odd input on a valid level', () => {
    for (const [q, h] of [['?level=0', ''], ['?level=7', ''], ['?level=abc', ''], ['', '#nonsense'], ['', ''], ['?level=-1', '']]) {
      expect(levelFromUrl(q, h), q + h).toBe(1);
    }
  });
  it('takes a number, a slug or a concept id, and the query beats the hash', () => {
    expect(levelFromUrl('?level=3', '')).toBe(3);
    expect(levelFromUrl('', '#value')).toBe(5);
    expect(levelFromUrl('?level=state-action-reward', '')).toBe(2);
    expect(levelFromUrl('?level=2', '#value')).toBe(2);
  });
  it('the nav lists only built levels and marks exactly one current', () => {
    const nav = navModel([1, 2], 2, n => `T${n}`);
    expect(nav.map(n => n.n)).toEqual([1, 2]);
    expect(nav.map(n => n.href)).toEqual(['?level=1', '?level=2']);
    expect(nav.filter(n => n.current)).toHaveLength(1);
    expect(nav.find(n => n.current).n).toBe(2);
    expect(nav[0].title).toBe('T1');
  });
  it('a level that is not built falls back to the first built one', () => {
    expect(navModel([1, 2], 5, String).find(n => n.current).n).toBe(1);
  });
});

describe('treasure room input after the episode', () => {
  it('ignores your moves once the AI has taken over', () => {
    const ai = reduce(initial(), { type: 'handover' });
    expect(reduce(ai, { type: 'move', action: 3 })).toEqual(ai);
  });
});

describe('treasure room page mounts the shared panel', () => {
  it('has an empty mount point and no second copy of the panel', () => {
    expect(html).toContain('id="levelRoot"');
    expect(html).toContain('id="levels"');
    for (const bad of ['id="stage"', 'data-move=', 'id="levelPanel"']) expect(html, bad).not.toContain(bad);
  });
  it('main.js mounts the panel and draws nothing itself', () => {
    expect(main).toMatch(/import \{[^}]*mountLevelPlay[^}]*\} from '\.\/level-panel\.js'/);
    expect(main).not.toContain('getContext');
  });
  it('the nav reads its names from the track config', () => {
    const titleOf = n => lessonOfLevel('treasure-room', n).title;
    expect(navModel(BUILT_LEVELS, 3, titleOf).find(x => x.n === 3).title).toBe('Return');
    expect(navModel(BUILT_LEVELS, 3, titleOf).find(x => x.n === 6).title).toBe('MDP');
    expect(main).toContain('lessonOfLevel');
  });
});

describe('treasure room page markup', () => {
  it('shows the lesson in the lead and the stated lesson in the moral band', () => {
    expect(html.match(/class="lead lesson">([^<]*)</)[1]).toBe(entry.lesson);
    expect(html.match(/class="moral"[\s\S]*?<\/div>/)[0]).toContain(LESSON);
    expect(html).toMatch(/class="moral"[\s\S]*href="#how"/);
  });
  it('has the brief, the how-it-works link and the arcade chrome', () => {
    for (const t of ['The setup', 'The rule', 'Watch for']) expect(html).toContain(`<dt>${t}</dt>`);
    expect(html).toContain('<body data-game="treasure-room">');
    expect(html).toContain('<header data-site="games">');
    expect(html).toContain('href="treasure-room.css"');
    expect(html).toContain('href="how-it-works/"');
  });
  it('carries the share tags for its own banner', () => {
    expect(html).toContain('<link rel="canonical" href="https://arcade.codewithnk.com/games/treasure-room/">');
    expect(html).toContain('<meta property="og:image" content="https://arcade.codewithnk.com/games/treasure-room/share.png">');
    expect(html).toContain('<meta name="twitter:image" content="https://arcade.codewithnk.com/games/treasure-room/share.png">');
    expect(html).toContain('<meta property="og:image:width" content="1280">');
    expect(html).toContain('<meta property="og:image:height" content="720">');
    expect(html).toMatch(/<meta property="og:image:alt" content="[^"]+">/);
  });
  it('lists levels 3 and 4 in the nav once they are built', () => {
    expect(navModel([1, 2, 3, 4], 4, String).filter(n => n.current)).toHaveLength(1);
    expect(navModel([1, 2, 3, 4], 3, String).map(n => n.href)).toEqual(['?level=1', '?level=2', '?level=3', '?level=4']);
  });
});

describe('treasure-room.css', () => {
  it('keeps the stage 4:3 and inside a phone width', () => {
    expect(rules('#roomBox')).toMatch(/aspect-ratio:\s*4\s*\/\s*3/);
    expect(rules('#roomBox')).not.toMatch(/16\s*\/\s*10/);
    expect(rules('.room')).toMatch(/width:/);
    expect(rules('.room')).not.toMatch(/480px|56vh/);
    expect(css).not.toMatch(/\bwidth:\s*\d{4,}px/);
  });
  it('collapses the empty result strip to one line without hiding it', () => {
    expect(rules('.stage .say:empty')).toMatch(/min-height:\s*1\.5em/);
    expect(rules('.stage .say:empty')).not.toMatch(/display:\s*none/);
  });
  it('styles the level labels from tokens, with 44px touch targets and a visible focus', () => {
    expect(rules('.marker-layer')).toMatch(/pointer-events:\s*none/);
    expect(rules('.marker')).toMatch(/pointer-events:\s*auto/);
    expect(rules('.marker::before')).toMatch(/inset:\s*-/);
    expect(rules('.marker-pill .marker::after')).toMatch(/border/);
    expect(rules('.marker-wrap[data-open]')).toMatch(/z-index/);
    expect(rules('.marker-card')).toMatch(/max-width:\s*240px/);
    expect(rules('.marker:focus-visible')).toMatch(/var\(--signal\)/);
    for (const m of css.matchAll(/([^{}]*marker[^{}]*)\{([^{}]*)\}/g)) expect(m[2], m[1]).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
  it('styles the loader from tokens only, with no 2D leftovers', () => {
    expect(rules('.room-loader')).toMatch(/background:\s*var\(--stage\)/);
    expect(rules('.room-loader')).toMatch(/aspect-ratio:\s*1|inset:\s*0/);
    expect(css).toMatch(/room-loader-fill[^}]*var\(--signal\)/);
    for (const m of css.matchAll(/([^{}]*room-loader[^{}]*)\{([^{}]*)\}/g)) expect(m[2], m[1]).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(css).not.toContain('#stage');
    expect(css).not.toContain('data-room="2d"');
  });
  it('makes every level control at least 44px tall, with no tight line height', () => {
    expect(rules('.pad button')).toMatch(/min-height:\s*44px/);
    expect(rules('.levels a')).toMatch(/min-height:\s*44px/);
    for (const m of css.matchAll(/line-height:\s*([\d.]+)/g)) expect(+m[1]).toBeGreaterThanOrEqual(1.5);
  });
  it('has no side stripes and names no other game', () => {
    expect(css).not.toMatch(/border-(left|right):\s*\d+px solid/);
    expect(css).not.toMatch(/racer|runner|balance|maze/i);
  });
});

describe('3D by default needs the import map and the docs say so', () => {
  it('carries the import map on the game page and the six lesson pages', () => {
    expect(read('games/treasure-room/index.html')).toContain('importmap');
    for (const id of ['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp']) expect(read(`concepts/${id}/index.html`), id).toContain('importmap');
  });
  it('documents the loader and the 3D-only host', () => {
    expect(read('README.md')).toMatch(/room-loader\.js/);
    expect(read('CLAUDE.md')).toMatch(/room-host\.js/);
    expect(read('CLAUDE.md')).toMatch(/room-loader\.js/);
    expect(read('DESIGN.md')).toMatch(/3D by default/);
    expect(read('DESIGN.md')).toMatch(/Entering the room/);
    expect(read('DESIGN.md')).toMatch(/Try again/);
  });
  it('no longer documents the 2D switches', () => {
    for (const f of ['README.md', 'CLAUDE.md', 'DESIGN.md']) {
      const txt = read(f).split('\n').filter((l) => /treasure room|room-host|room-view/i.test(l)).join('\n');
      expect(txt, f).not.toMatch(/room=(2d|3d)|2D first|falls? back to (room-view|2D)/);
    }
  });
});
