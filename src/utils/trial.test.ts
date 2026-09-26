import { describe, it, expect } from 'vitest';
import { trialLeft } from './trial';

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);
const at = (ms: number) => new Date(NOW + ms).toISOString();
const H = 60 * 60 * 1000;

describe('trialLeft', () => {
  it('counts whole days, rounding up, while a day or more is left', () => {
    expect(trialLeft(at(72 * H), NOW)).toBe('3 days left');
    expect(trialLeft(at(25 * H), NOW)).toBe('2 days left');
    expect(trialLeft(at(24 * H), NOW)).toBe('1 day left');
  });
  it('switches to hours inside the last day, never saying "1 day" with minutes left', () => {
    expect(trialLeft(at(23.9 * H), NOW)).toBe('23 hours left');
    expect(trialLeft(at(1.5 * H), NOW)).toBe('1 hour left');
    expect(trialLeft(at(20 * 60 * 1000), NOW)).toBe('Less than an hour left');
  });
  it('returns null when the trial is over or unknown', () => {
    expect(trialLeft(at(-1), NOW)).toBeNull();
    expect(trialLeft(null, NOW)).toBeNull();
  });
});
