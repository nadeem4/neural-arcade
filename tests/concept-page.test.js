import { describe, it, expect, vi } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { lessonById } from '../assets/tracks/model.js';
import * as cp from '../assets/concept-page.js';

const CONCEPT_IDS = ['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp', 'pid', 'reward-design'];

const { videoHtml, triesHtml, wireTries } = cp;
const pid = { id: 'pid', title: 'PID control', youtube: 'abcdef12345', related: ['mdp'] };

describe('concept-page exports', () => {
  it('keeps only what the lesson pages and the Concepts list use', () => {
    expect(Object.keys(cp).sort()).toEqual(['esc', 'triesHtml', 'videoHtml', 'wireTries']);
  });
});

describe('videoHtml', () => {
  it('is empty without a youtube id', () => expect(videoHtml({ ...pid, youtube: null })).toBe(''));
  it('renders the facade with the id and thumbnail', () => {
    const h = videoHtml(pid);
    expect(h).toContain('data-youtube="abcdef12345"');
    expect(h).toContain('abcdef12345/hqdefault.jpg');
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

  it('defines the classes the lesson pages use', () => {
    for (const sel of ['.stage', '.tries', '.part', '.fig']) expect(css).toContain(sel);
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('prefers-reduced-motion');
  });
  it('has no rules for the removed game cards, where lines, play-level link or chips', () => {
    for (const sel of ['.game ', '.where', '.play-level', '.chip']) expect(css).not.toContain(sel);
  });

  it('uses tokens only, no raw hex colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('pid lesson files', () => {
  const read = f => readFileSync(new URL(`../concepts/pid/${f}`, import.meta.url), 'utf8');
  const html = read('index.html');
  const writeup = read('writeup.html');

  it('is a generated lesson page with the shared header, footer and styles', () => {
    for (const s of ['<header data-site', '<footer data-site', '../../assets/studio.css', '../../assets/concept.css', '../../assets/lesson.css']) expect(html).toContain(s);
  });
  it('has the section ids', () => {
    for (const id of ['play', 'watch', 'read', 'playground', 'tries', 'writeup']) expect(html).toContain(`id="${id}"`);
  });
  it('leads with the lesson line from the track config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(lessonById('pid').says);
  });
  for (const f of ['fig-hill', 'fig-overshoot', 'fig-settle']) {
    it(`${f}.webp exists, is under 150 KB and is an img with alt, width and height`, () => {
      expect(statSync(new URL(`../concepts/pid/${f}.webp`, import.meta.url)).size).toBeLessThan(150000);
      const img = writeup.match(new RegExp(`<img[^>]*src="${f}\.webp"[^>]*>`))?.[0];
      expect(img, f).toBeTruthy();
      for (const a of ['alt', 'width', 'height']) expect(img).toMatch(new RegExp(` ${a}="[^"]+"`));
    });
  }
});

describe('every concept page', () => {
  const read = (id, f) => readFileSync(new URL(`../concepts/${id}/${f}`, import.meta.url), 'utf8');
  const WITH_WRITEUP = ['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp', 'pid', 'reward-design'];
  it('the eight concept pages are generated shells with the shared sections and the lesson says as lead', () => {
    for (const id of WITH_WRITEUP) {
      const html = read(id, 'index.html');
      for (const s of ['playground', 'tries', 'writeup', 'play', 'watch', 'read']) expect(html, `${id} #${s}`).toContain(`id="${s}"`);
      for (const a of ['assets/studio.css', 'assets/concept.css', 'assets/lesson.css', 'assets/lesson-page.js']) expect(html, `${id} ${a}`).toContain(a);
      const lead = html.match(/<p class="lead">(.*?)<\/p>/s)[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      expect(lead, id).toBe(lessonById(id).says);
      expect(read(id, 'writeup.html'), id).toContain('id="writeup"');
      expect(read(id, 'page.js'), id).toContain('wireTries');
    }
  });
  it('every concept has sim.js and play.js', () => {
    for (const id of CONCEPT_IDS) for (const f of ['sim.js', 'play.js']) expect(() => read(id, f), `${id}/${f}`).not.toThrow();
  });
});
