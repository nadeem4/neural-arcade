import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAMES, CONCEPTS, conceptById, usesHtml } from '../assets/games.js';
import { conceptHtml } from '../assets/concepts.js';

const DEFINITIONS = {
  agent: ['Agent and environment', 'The agent is the learner that acts; the environment is everything it acts on, and it answers each move with a new situation and a reward.'],
  'state-action-reward': ['State, action, reward', 'A state is where things stand now, an action is a move the agent can make, and a reward is the number the world hands back for that move.'],
  return: ['Return and discount', 'The return is all the reward still to come, with far-off reward counted for less by the discount.'],
  policy: ['Policy', "A policy is the agent's rulebook: in each state, which action to take."],
  value: ['Value', "A state's value is how much reward the agent can expect from there on, if it keeps following its policy."],
  mdp: ['Markov decision process', 'An MDP is the whole game written down: states, actions, rewards and where each move leads, where only the present state matters, not how you got there.'],
  pid: ['PID control', 'A PID controller steers by mixing three looks at the error: how big it is now, how long it has lasted, and how fast it is changing.'],
};

describe('concepts data', () => {
  it('has exactly the seven concepts with the exact words', () => {
    expect(CONCEPTS.map(c => c.id)).toEqual(Object.keys(DEFINITIONS));
    for (const c of CONCEPTS) {
      expect(c.title).toBe(DEFINITIONS[c.id][0]);
      expect(c.definition).toBe(DEFINITIONS[c.id][1]);
    }
  });
  it('every concept has id, title, definition', () => {
    for (const c of CONCEPTS) for (const f of ['id', 'title', 'definition']) expect(c[f]?.length, `${c.id}.${f}`).toBeGreaterThan(0);
  });
  it("every id in a game's uses exists", () => {
    for (const g of GAMES) for (const id of g.uses ?? []) expect(conceptById(id), `${g.id} uses ${id}`).toBeTruthy();
  });
  it('maze and runner declare their words', () => {
    expect(GAMES.find(g => g.id === 'maze').uses).toEqual(['agent', 'state-action-reward', 'return', 'policy', 'value']);
    expect(GAMES.find(g => g.id === 'runner').uses).toEqual(['agent', 'state-action-reward', 'policy']);
  });
  it('conceptById finds or returns undefined', () => {
    expect(conceptById('policy').title).toBe('Policy');
    expect(conceptById('nope')).toBeUndefined();
  });
});

describe('usesHtml', () => {
  it('returns empty for a game with no uses', () => {
    expect(usesHtml({ id: 'x' }, '../../')).toBe('');
    expect(usesHtml({ id: 'x', uses: [] }, '../../')).toBe('');
  });
  it('renders one chip per word, linking to the concepts page anchor', () => {
    const h = usesHtml({ uses: ['agent', 'value'] }, '../../');
    expect(h).toContain('href="../../concepts/#agent"');
    expect(h).toContain('href="../../concepts/#value"');
    expect(h).toContain('>Agent and environment<');
    expect(h.match(/class="chip"/g)).toHaveLength(2);
  });
  it('skips unknown ids instead of crashing', () => {
    expect(usesHtml({ uses: ['nope'] }, '')).toBe('');
  });
});

describe('concept page rendering', () => {
  const c = { id: 'policy', title: 'Policy', definition: 'Def.', youtube: null };
  it('has the anchor id, the definition and no video without a youtube id', () => {
    const h = conceptHtml(c, [], '../');
    expect(h).toContain('id="policy"');
    expect(h).toContain('Def.');
    expect(h).not.toContain('data-youtube');
  });
  it('shows the click-to-play facade with a youtube id', () => {
    expect(conceptHtml({ ...c, youtube: 'abcdef12345' }, [], '../')).toContain('data-youtube="abcdef12345"');
  });
  it('renders the full facade (box, play button, thumbnail) for a stubbed id, with its styles in studio.css', () => {
    const h = conceptHtml({ ...c, id: 'pid', youtube: 'abcdef12345' }, [], '../');
    expect(h).toMatch(/<div class="video" data-youtube="abcdef12345"[^>]*><button class="video-play"/);
    expect(h).toContain('abcdef12345/hqdefault.jpg');
    const css = readFileSync(new URL('../assets/studio.css', import.meta.url), 'utf8');
    for (const sel of ['.video {', '.video-play {', '.video-label {', '.video iframe {']) expect(css).toContain(sel);
  });
  it('lists the games that use it', () => {
    const h = conceptHtml(c, [{ title: 'Gee', path: 'games/g/' }], '../');
    expect(h).toContain('Used in');
    expect(h).toContain('href="../games/g/"');
  });
  it('renders every concept, with the games using it, from the real config', () => {
    const html = CONCEPTS.map(k => conceptHtml(k, GAMES.filter(g => g.uses?.includes(k.id)), '../')).join('');
    expect(html).toContain('href="../games/maze/"');
    expect(html).toContain('href="../games/runner/"');
    for (const k of CONCEPTS) expect(html).toContain(`id="${k.id}"`);
  });
});

describe('concepts page file', () => {
  const html = readFileSync(new URL('../concepts/index.html', import.meta.url), 'utf8');
  it('uses the shared styles, header, footer and its script', () => {
    expect(html).toContain('<header data-site>');
    expect(html).toContain('<footer data-site>');
    expect(html).toContain('../assets/studio.css');
    expect(html).toContain('concepts.js');
  });
});

describe('game pages', () => {
  for (const g of GAMES.filter(g => g.uses?.length)) {
    it(`${g.id} has the words container`, () => {
      const html = readFileSync(new URL(`../${g.path}index.html`, import.meta.url), 'utf8');
      expect(html).toContain('id="uses"');
      expect(html).toContain('id="usesChips"');
      expect(html).toContain('Words this game uses');
    });
  }
});

describe('mountGamePage words row', () => {
  // no jsdom in this repo: a tiny stand-in document with just the elements the script touches
  const mount = async (ids) => {
    const els = Object.fromEntries([...ids, 'moreFrom', 'moreTitle', 'moreTiles', 'writeup'].map(id => [id, { innerHTML: '', hidden: true, dataset: {}, addEventListener() {} }]));
    vi.stubGlobal('document', {
      body: { dataset: { game: 'maze' } },
      getElementById: id => els[id] ?? null,
      querySelector: () => null,
      querySelectorAll: () => [],
    });
    vi.resetModules();
    await import('../assets/game-page.js');
    return els;
  };
  afterEach(() => vi.unstubAllGlobals());

  it('un-hides #uses and fills #usesChips with links to the concept anchors', async () => {
    const els = await mount(['uses', 'usesChips']);
    expect(els.uses.hidden).toBe(false);
    for (const id of GAMES.find(g => g.id === 'maze').uses) expect(els.usesChips.innerHTML).toContain(`href="../../concepts/#${id}"`);
  });
  it('a page without the #uses section still sets up the rest', async () => {
    const els = await mount(['crumb']);
    expect(els.crumb.innerHTML).toContain('Treasure Maze');
  });
});
