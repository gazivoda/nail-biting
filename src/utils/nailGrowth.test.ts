import { describe, it, expect } from 'vitest';
import { monthsToGrow, FINGERNAIL_MM_PER_MONTH, TOENAIL_MM_PER_MONTH } from './nailGrowth';

describe('monthsToGrow', () => {
  it('uses the published averages', () => {
    expect(FINGERNAIL_MM_PER_MONTH).toBe(3.47);
    expect(TOENAIL_MM_PER_MONTH).toBe(1.62);
  });

  it('divides the length by the fingernail rate', () => {
    // 3.47 mm is one month at the average rate.
    expect(monthsToGrow(3.47, 'fingernail')).toEqual({ months: 1, weeks: 4 });
    // 10 mm / 3.47 = 2.88 months, about 12 weeks.
    expect(monthsToGrow(10, 'fingernail')).toEqual({ months: 2.9, weeks: 12 });
  });

  it('is slower for toenails', () => {
    expect(monthsToGrow(10, 'toenail').months).toBe(6.2);
  });

  it('treats blank, negative and non-numeric input as zero', () => {
    expect(monthsToGrow(NaN, 'fingernail')).toEqual({ months: 0, weeks: 0 });
    expect(monthsToGrow(-4, 'toenail')).toEqual({ months: 0, weeks: 0 });
    expect(monthsToGrow(Infinity, 'fingernail')).toEqual({ months: 0, weeks: 0 });
  });
});
