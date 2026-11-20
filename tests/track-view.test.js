import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { trackById } from '../assets/tracks/index.js';
import { trackBodyHtml, lessonRowHtml, wildRowHtml } from '../assets/tracks/track-view.js';
import { lessonById } from '../assets/tracks/model.js';

const rl = trackById('reinforcement-learning');
const nn = trackById('neural-networks');

describe('track body', () => {
  const html = trackBodyHtml(rl, { done: ['agent'], base: '../' });
  it('shows progress and the continue button', () => {
    expect(html).toContain('1 of 7 lessons done');
    expect(html).toContain('Continue: Lesson 2, State, action, reward');
    expect(html).toContain('class="btn primary"');
  });
  it('marks each row with its state', () => {
    expect(html).toMatch(/<li[^>]*data-lesson="agent"[^>]*data-state="done"/);
    expect(html).toMatch(/data-lesson="state-action-reward"[^>]*data-state="next"/);
    expect(html).toMatch(/data-lesson="sarsa"[^>]*data-state="soon"[\s\S]*?Coming soon/);
  });
  it('gives soon lessons no links', () => {
    expect(html).not.toContain('concepts/sarsa/');
    expect(html).toContain('href="../concepts/agent/#play"');
  });
  it('names the game, the needs note and wild rows', () => {
    expect(html).toContain('Played in Treasure Room');
    expect(html).toContain('Before Lesson 14: Function approximation');
    expect(html).toMatch(/class="wild"[\s\S]*Treasure Maze/);
    expect(html).toContain('Lesson 3: Return');
  });
  it('renders show:true wild rows of soon lessons, never own-game or hidden ones', () => {
    expect(html.match(/class="wild"/g).length).toBe(2);   // lessons 13 and 16
    expect(html).toContain('href="../games/runner/"');
    expect(trackBodyHtml(trackById('physical-ai'), {})).not.toContain('class="wild"');
  });
  it('starts at lesson 1 with no progress and omits the game line when there is none', () => {
    expect(trackBodyHtml(rl, { done: [] })).toContain('Start: Lesson 1, Agent');
    expect(trackBodyHtml(nn, { done: [] })).not.toContain('Played in');
  });
  it('has no primary button when finished', () => {
    expect(trackBodyHtml(nn, { done: ['learning-from-examples', 'learning-by-selection'] })).not.toContain('class="btn primary"');
  });
  it('ignores stale ids', () => {
    expect(trackBodyHtml(nn, { done: ['gone', 'x'] })).toContain('0 of 2 lessons done');
  });
  it('has a progress bar with a text label', () => {
    expect(html).toMatch(/role="img"[^>]*aria-label="1 of 7 lessons done"/);
  });
  it('shows Watch only when a video exists', () => {
    const nnHtml = trackBodyHtml(nn, {});
    expect(nnHtml).toContain('#watch');
    expect(html).not.toContain('#watch');
  });
});

describe('rows', () => {
  it('lesson row has play and read links', () => {
    const row = lessonRowHtml(lessonById('return'), { state: '', base: '../' });
    expect(row).toContain('concepts/return/#play');
    expect(row).toContain('concepts/return/#read');
  });
  it('wild row links the game', () => {
    expect(wildRowHtml({ game: 'maze', says: 'x', show: true }, '../')).toContain('href="../games/maze/"');
  });
});

describe('track.css', () => {
  const css = readFileSync(new URL('../assets/track.css', import.meta.url), 'utf8');
  it('uses tokens only and fits a phone', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/width:\s*\d{4}px/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/max-width:\s*480px/);
  });
});
