import { describe, it, expect } from 'vitest';
import { treesToHide } from '../games/city/scene-math.js';
import { foldTag } from '../games/city/events.js';
import { meterText } from '../games/city/meter.js';

describe('treesToHide', () => {
  // xyz triples; only x and z matter
  const pos = new Float32Array([0, 0, 0, 100, 0, 100, 50, 0, 3, 10, 0, 10]);
  it('hides trees within 15 m of the camera', () => {
    expect(treesToHide(pos, [0, 5], [200, -200])).toContain(0);
    expect(treesToHide(pos, [0, 5], [200, -200])).not.toContain(1);
  });
  it('hides trees near the line from camera to taxi', () => {
    const hide = treesToHide(pos, [0, 0], [100, 0]);
    expect(hide).toContain(2); // 3 m off the line
    expect(hide).not.toContain(1); // far off the line
  });
  it('does not hide trees behind the taxi or behind the camera', () => {
    const hide = treesToHide(new Float32Array([150, 0, 0, -60, 0, 0]), [0, 0], [100, 0]);
    expect(hide).toEqual([]);
  });
});

describe('foldTag', () => {
  it('counts the same tag on consecutive steps', () => {
    const a = foldTag(null, { text: '-20 park tile', kind: 'fine' }, 3);
    const b = foldTag(a, { text: '-20 park tile', kind: 'fine' }, 4);
    expect(a.count).toBe(1);
    expect(b.count).toBe(2);
    expect(b.label).toBe('-20 park tile ×2');
    expect(a.label).toBe('-20 park tile');
  });
  it('starts again for a different tag or a gap in steps', () => {
    const a = foldTag(null, { text: 'x', kind: 'fine' }, 3);
    expect(foldTag(a, { text: 'y', kind: 'fine' }, 4).count).toBe(1);
    expect(foldTag(a, { text: 'x', kind: 'fine' }, 6).count).toBe(1);
  });
});

describe('meterText', () => {
  it('rounds to whole numbers with a real minus sign and a plus for gains', () => {
    expect(meterText(-23.9)).toBe('−24');
    expect(meterText(-20.6)).toBe('−21');
    expect(meterText(12.4)).toBe('+12');
    expect(meterText(0)).toBe('0');
    expect(meterText(-0.2)).toBe('0');
  });
});
