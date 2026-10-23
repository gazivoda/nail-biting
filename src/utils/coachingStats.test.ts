import { describe, it, expect } from 'vitest';
import { coachingStats, formatRate } from './coachingStats';

const T = 1_700_000_000_000;
const HOUR = 3_600_000;
type E = Parameters<typeof coachingStats>[0][number];
const alarm = (h: number, cr?: { done: boolean; durationSec?: number }, extra: Partial<E> = {}): E =>
  ({ ts: T + h * HOUR, source: 'alarm', ...(cr ? { competingResponse: cr } : {}), ...extra });
const manual = (h: number, cr?: { done: boolean }): E => ({ ts: T + h * HOUR, source: 'manual', ...(cr ? { competingResponse: cr } : {}) });

describe('coachingStats', () => {
  it('has no figure (not 0%) when there are no alarms', () => {
    expect(coachingStats([])).toMatchObject({ alarms: 0, rate: null, completedOfPrompted: null, since: null });
    expect(coachingStats([manual(1)]).rate).toBeNull();
  });

  it('has no figure for old alarms that never had a prompt (the feature was not in use)', () => {
    const s = coachingStats([alarm(1), alarm(2), alarm(3)]);
    expect(s.rate).toBeNull();
    expect(s.alarms).toBe(0);
  });

  it('counts the share of alarms followed by a completed response', () => {
    const s = coachingStats([
      alarm(1, { done: true, durationSec: 30 }),
      alarm(2, { done: false, durationSec: 4 }),
      alarm(3, { done: true, durationSec: 12 }),
      alarm(4, { done: true, durationSec: 30 }),
    ]);
    expect(s).toMatchObject({ alarms: 4, prompted: 4, completed: 3, skipped: 1, rate: 0.75, completedOfPrompted: 0.75 });
    expect(formatRate(s.rate)).toBe('75%');
  });

  it('starts at the first alarm that had a prompt; earlier alarms are not held against the person', () => {
    const s = coachingStats([alarm(0), alarm(1), alarm(5, { done: true }), alarm(6, { done: false })]);
    expect(s).toMatchObject({ alarms: 2, completed: 1, rate: 0.5, since: T + 5 * HOUR });
  });

  it('alarms after that start that were not offered a prompt (once-an-hour mode) count as not followed', () => {
    const s = coachingStats([alarm(1, { done: true }), alarm(1.2), alarm(1.4), alarm(1.6)]);
    expect(s).toMatchObject({ alarms: 4, prompted: 1, completed: 1, rate: 0.25, completedOfPrompted: 1 });
  });

  it('leaves out manual logs, urge entries, false positives and deleted events', () => {
    const s = coachingStats([
      alarm(1, { done: true }),
      manual(2, { done: true }),
      alarm(3, { done: false }, { falsePositive: true }),
      alarm(4, { done: true }, { deleted: true }),
    ]);
    expect(s).toMatchObject({ alarms: 1, completed: 1, rate: 1 });
  });

  it('takes an explicit window start', () => {
    const events = [alarm(1, { done: true }), alarm(2, { done: false }), alarm(3, { done: false })];
    expect(coachingStats(events, { since: T + 2 * HOUR })).toMatchObject({ alarms: 2, completed: 0, rate: 0 });
  });

  it('formats nothing as null', () => {
    expect(formatRate(null)).toBeNull();
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(1 / 3)).toBe('33%');
  });
});
