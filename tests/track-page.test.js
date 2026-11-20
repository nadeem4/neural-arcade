import { describe, it, expect } from 'vitest';
import { trackById } from '../assets/tracks/index.js';
import { renderTrack } from '../assets/track-page.js';

const nn = trackById('neural-networks');
const render = storage => {
  const doc = { getElementById: id => (id === 'track' ? el : null) };
  const el = { innerHTML: '' };
  renderTrack(doc, nn, storage);
  return el.innerHTML;
};

describe('renderTrack', () => {
  it('applies saved progress', () => {
    expect(render({ getItem: () => '["learning-from-examples"]' })).toContain('1 of 2 lessons done');
  });
  it('survives storage that throws', () => {
    expect(render({ getItem: () => { throw new Error('blocked'); } })).toContain('0 of 2 lessons done');
  });
  it('survives garbage in storage', () => {
    expect(render({ getItem: () => '{"x":1}' })).toContain('0 of 2 lessons done');
    expect(render({ getItem: () => '{{{' })).toContain('0 of 2 lessons done');
  });
});
