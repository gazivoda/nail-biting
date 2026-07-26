import { describe, it, expect } from 'vitest';
import { severityForCount } from './severity';

const scale = (counts: number[]) => counts.map(severityForCount);

describe('severityForCount', () => {
  it('treats a clean day as neutral', () => {
    expect(severityForCount(0)).toBe('none');
  });

  it('bands counts on fixed boundaries', () => {
    expect(scale([1, 2])).toEqual(['low', 'low']);
    expect(scale([3, 4, 5])).toEqual(['medium', 'medium', 'medium']);
    expect(scale([6, 20, 500])).toEqual(['high', 'high', 'high']);
  });

  it('ignores negative counts rather than banding them', () => {
    expect(severityForCount(-1)).toBe('none');
  });

  // The old chart divided each day by the highest day on screen. These are the
  // three cases that made the colours misleading.
  describe('regressions from the old relative scale', () => {
    it('does not paint a single incident as the worst possible day', () => {
      expect(scale([0, 0, 0, 1, 0, 0, 0])).toEqual(
        ['none', 'none', 'none', 'low', 'none', 'none', 'none'],
      );
    });

    it('shows a week that improved to 1-2/day as good, not alarming', () => {
      expect(scale([2, 2, 1, 2, 1, 2, 2]).every(s => s === 'low')).toBe(true);
    });

    it('does not flatter a bad day just because a worse one shares the week', () => {
      // 3 bites is 'medium' whether or not a 15-bite day is on screen.
      expect(severityForCount(3)).toBe('medium');
      expect(scale([12, 8, 15, 3, 9, 11, 14])).toEqual(
        ['high', 'high', 'high', 'medium', 'high', 'high', 'high'],
      );
    });

    it('gives a day the same colour regardless of the rest of the week', () => {
      const alone = severityForCount(4);
      const amongWorse = scale([4, 30])[0];
      const amongBetter = scale([4, 0])[0];
      expect(amongWorse).toBe(alone);
      expect(amongBetter).toBe(alone);
    });
  });
});
