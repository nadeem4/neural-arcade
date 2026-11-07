import { describe, it, expect } from 'vitest';
import { embedUrl, iframeAttrs } from '../assets/video.js';

describe('video facade', () => {
  it('builds the privacy-friendly embed url with autoplay', () => {
    expect(embedUrl('K1I7QxfrgIk')).toBe('https://www.youtube-nocookie.com/embed/K1I7QxfrgIk?autoplay=1&rel=0');
  });
  it('rejects ids that are not plain YouTube ids', () => {
    expect(() => embedUrl('a/b?x=1')).toThrow();
    expect(() => embedUrl('')).toThrow();
  });
  it('describes the iframe: title, permissions, fullscreen', () => {
    const a = iframeAttrs('K1I7QxfrgIk', 'Coin Runner explainer');
    expect(a.src).toBe(embedUrl('K1I7QxfrgIk'));
    expect(a.title).toBe('Coin Runner explainer');
    expect(a.allow).toBe('autoplay; encrypted-media; picture-in-picture; fullscreen');
    expect(a.allowfullscreen).toBe(true);
  });
});
