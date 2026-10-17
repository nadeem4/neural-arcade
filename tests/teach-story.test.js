import { describe, it, expect } from 'vitest';
import { recordLesson, lossCurve, rollDown, bestHill, LESSON_SEED } from '../games/teach/story-data.js';
import { TEACH_GENOME } from '../games/teach/sim.js';

// The lesson the write-up tells: the copied brain crashes part-way, corrections fix it.
const L = recordLesson(LESSON_SEED);

describe('the recorded lesson', () => {
  it('records the teacher lap as examples, one per frame', () => {
    expect(L.examples.length).toBe(L.teacherPath.length - 1);
    expect(L.examples.length).toBeGreaterThan(600); // one slow lap
  });

  it('learns: the loss falls a long way', () => {
    expect(L.losses.at(-1)).toBeLessThan(L.losses[0] / 3);
  });

  it('the copied brain crashes part-way round, even with a low loss', () => {
    expect(L.first.end).toBe('crashed');
    expect(L.first.pct).toBeGreaterThan(30);
    expect(L.first.pct).toBeLessThan(200);
  });

  it('corrections add examples where the teacher took the wheel, and the retrained brain drives two laps', () => {
    expect(L.corrected.added.length).toBe(L.corrected.taken.length);
    expect(L.all.length).toBe(L.examples.length + L.corrected.added.length);
    expect(L.after.end).toBe('finished');
  });

  it('the brain that crashed had the lower loss (the write-up says so)', () => {
    expect(L.losses.at(-1)).toBeLessThan(L.relosses.at(-1));
  });

  it('is the same every time', () => {
    const again = recordLesson(LESSON_SEED);
    expect(again.first.pct).toBe(L.first.pct);
    expect(again.losses.at(-1)).toBe(L.losses.at(-1));
  });
});

describe('one weight, one hill', () => {
  it('traces the loss as one weight slides, through the trained value', () => {
    const curve = lossCurve(L.trained, L.examples, 60, { span: 2, steps: 4 });
    expect(curve).toHaveLength(5);
    expect(curve[2].w).toBeCloseTo(L.trained[60]);
  });

  it('rolls a ball downhill: every step lowers the loss', () => {
    const hill = bestHill(L.trained, L.examples);
    expect(hill.index).toBeGreaterThanOrEqual(56);
    expect(hill.index).toBeLessThan(TEACH_GENOME);
    const path = rollDown(L.trained, L.examples, hill.index, hill.from);
    for (let k = 1; k < path.length; k++) expect(path[k].loss).toBeLessThanOrEqual(path[k - 1].loss + 1e-9);
    expect(path.at(-1).loss).toBeLessThan(path[0].loss / 2);
  });
});
