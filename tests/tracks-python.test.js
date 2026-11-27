import { describe, it, expect } from 'vitest';
import { highlightPython } from '../assets/tracks/python.js';

const strip = s => s.replace(/<\/?span[^>]*>/g, '');

describe('highlightPython', () => {
  it.each([
    ['while', 'while done:', '<span class="tk">while</span> done:'],
    ['a double-quoted string', 'x = "right"', 'x = <span class="ts">"right"</span>'],
    ['a single-quoted string', "x = 'up'", "x = <span class=\"ts\">'up'</span>"],
    ['an integer', 'n = 10', 'n = <span class="tn">10</span>'],
    ['a decimal', 'g = 0.9', 'g = <span class="tn">0.9</span>'],
    ['a call', 'print(x)', '<span class="tf">print</span>(x)'],
    ['a comment', 'x = 1  # note', 'x = <span class="tn">1</span>  <span class="tc"># note</span>'],
  ])('colours %s', (_, src, out) => expect(highlightPython(src)).toBe(out));

  it('leaves entities and names that merely contain a keyword alone', () => {
    expect(highlightPython('a &gt; b')).toBe('a &gt; b');
    expect(highlightPython('x &#39;y&#39; z')).toBe('x &#39;y&#39; z');
    expect(highlightPython('returns = 1')).toBe('returns = <span class="tn">1</span>');
  });

  it('does not colour keywords or numbers inside a string or comment', () => {
    expect(highlightPython('"for 1" # in 2')).toBe('<span class="ts">"for 1"</span> <span class="tc"># in 2</span>');
  });

  it('keeps the text: stripping the spans gives the input back', () => {
    const src = 'for g in (1, 0.9):\n    print(g, round(g, 2), "a" if g &gt; 0 else \'b\')  # done';
    expect(strip(highlightPython(src))).toBe(src);
  });
});
