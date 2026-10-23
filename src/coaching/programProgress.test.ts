import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EMPTY_PROGRESS, PROGRAM_LESSON_COUNT, completedCount, currentLesson, getProgress, isUnlocked, localDateKey, markDone,
  resetProgress, resetProgressCache, sanitizeProgress, saveProgress, start, subscribeProgress, unlockedCount,
  type ProgramProgress,
} from './programProgress';
import { useMemoryStorage, resetStorage } from '../../test-utils/memoryStorage';

const started = (on = '2026-10-01'): ProgramProgress => start(EMPTY_PROGRESS, on);

describe('local dates', () => {
  it('formats the LOCAL calendar day, zero padded, not UTC', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

describe('unlocking', () => {
  it('nothing is open before the person starts', () => {
    expect(unlockedCount(EMPTY_PROGRESS, '2026-10-01')).toBe(0);
    expect(currentLesson(EMPTY_PROGRESS, '2026-10-01')).toBeNull();
    expect(isUnlocked(EMPTY_PROGRESS, 1, '2026-10-01')).toBe(false);
  });

  it('lesson 1 is open on the day they start', () => {
    const p = started();
    expect(unlockedCount(p, '2026-10-01')).toBe(1);
    expect(currentLesson(p, '2026-10-01')).toBe(1);
  });

  it('finishing a lesson opens the next one only on a later local day (one per day)', () => {
    let p = markDone(started(), 1, '2026-10-01');
    expect(unlockedCount(p, '2026-10-01')).toBe(1); // same day: lesson 2 not yet
    expect(currentLesson(p, '2026-10-01')).toBeNull(); // everything open is done: "see you tomorrow"
    expect(unlockedCount(p, '2026-10-02')).toBe(2);
    expect(currentLesson(p, '2026-10-02')).toBe(2);

    p = markDone(p, 2, '2026-10-02');
    expect(unlockedCount(p, '2026-10-02')).toBe(2);
    expect(unlockedCount(p, '2026-10-03')).toBe(3);
  });

  it('a gap loses nothing: after a month away the very next lesson is simply open, one at a time', () => {
    let p = markDone(started('2026-10-01'), 1, '2026-10-01');
    p = markDone(p, 2, '2026-10-02');
    expect(unlockedCount(p, '2026-11-20')).toBe(3);      // not 50 lessons stacked up
    expect(currentLesson(p, '2026-11-20')).toBe(3);
    expect(p.completed).toEqual({ '1': '2026-10-01', '2': '2026-10-02' }); // nothing was taken away
    p = markDone(p, 3, '2026-11-20');
    expect(unlockedCount(p, '2026-11-21')).toBe(4);
  });

  it('works across a month and a year boundary and a clock change (dates are strings, not 24 hour steps)', () => {
    const p = markDone(started('2026-12-31'), 1, '2026-12-31');
    expect(unlockedCount(p, '2027-01-01')).toBe(2);
    const q = markDone(started('2026-03-28'), 1, '2026-03-28'); // around a DST change in many zones
    expect(unlockedCount(q, '2026-03-29')).toBe(2);
  });

  it('a completion date in the future (the clock was set back) does not lock the next lesson', () => {
    const p = markDone(started('2026-10-10'), 1, '2026-10-10');
    expect(unlockedCount(p, '2026-10-05')).toBe(2);
  });

  it('cannot mark a locked lesson, a lesson twice, or an out-of-range one', () => {
    const p = started();
    expect(markDone(p, 2, '2026-10-01')).toBe(p);
    expect(markDone(p, 0, '2026-10-01')).toBe(p);
    expect(markDone(p, 99, '2026-10-01')).toBe(p);
    const once = markDone(p, 1, '2026-10-01');
    expect(markDone(once, 1, '2026-10-05')).toBe(once);
    expect(once.completed['1']).toBe('2026-10-01');
  });

  it('can be finished: after lesson 28 nothing more opens', () => {
    let p = started('2026-01-01');
    for (let n = 1; n <= PROGRAM_LESSON_COUNT; n++) {
      const day = new Date(2026, 0, n);
      p = markDone(p, n, localDateKey(day));
    }
    expect(completedCount(p)).toBe(28);
    expect(unlockedCount(p, '2026-06-01')).toBe(28);
    expect(currentLesson(p, '2026-06-01')).toBeNull();
  });

  it('starting twice keeps the first start date', () => {
    const p = started('2026-10-01');
    expect(start(p, '2026-10-09')).toBe(p);
  });
});

describe('sanitizeProgress', () => {
  it('survives junk and drops bad entries', () => {
    expect(sanitizeProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(sanitizeProgress('x')).toEqual(EMPTY_PROGRESS);
    expect(sanitizeProgress({ startedOn: 'yesterday', completed: { '1': 'soon', '0': '2026-10-01', '29': '2026-10-01', '2': '2026-10-02', a: '2026-10-03' } }))
      .toEqual({ version: 1, startedOn: null, completed: { '2': '2026-10-02' } });
  });
});

describe('the kv-backed store', () => {
  beforeEach(() => { useMemoryStorage(); resetProgressCache(); });
  afterEach(() => { resetStorage(); resetProgressCache(); });

  it('starts empty, saves, notifies, reloads, and can be reset', () => {
    expect(getProgress()).toEqual(EMPTY_PROGRESS);
    let notified = 0;
    const off = subscribeProgress(() => { notified++; });
    saveProgress(markDone(started('2026-10-01'), 1, '2026-10-01'));
    expect(notified).toBeGreaterThan(0);
    resetProgressCache(); // new page load
    expect(getProgress().completed).toEqual({ '1': '2026-10-01' });
    resetProgress();
    expect(getProgress()).toEqual(EMPTY_PROGRESS);
    off();
  });
});
