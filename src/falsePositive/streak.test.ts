// "Not a bite" and the streak, through the real store and the storage module (WS3).
// An alarm only breaks the streak once it is confirmed; "Not a bite" takes a confirmed one back out,
// and undoing it puts the streak back exactly. Nothing is accumulated: every figure is re-derived.

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { events } from '../storage';

const T0 = 1_700_000_000_000;
const at = (ms: number) => vi.setSystemTime(T0 + ms);
const store = () => useAppStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  at(0);
  store().clearAllData();
});
afterAll(() => vi.useRealTimers());

function confirmedAlarm(atMs: number) {
  at(atMs);
  store().logIncident('auto-detected', true);
  const id = store().incidents[0].id;
  store().confirmIncident(id);
  return id;
}

describe('Not a bite and the streak', () => {
  it('a confirmed alarm that is then marked Not a bite no longer breaks the streak, and the undo puts it back', () => {
    const id = confirmedAlarm(60_000);
    expect(store().lastBiteTime).toBe(T0 + 60_000);
    expect(store().bestStreakMs).toBe(60_000);

    at(90_000);
    events.update(id, { falsePositive: true });
    expect(store().lastBiteTime).toBeNull();
    expect(store().bestStreakMs).toBe(0);
    expect(store().incidents[0].confirmed).toBe(true); // the review state is kept, only outranked

    events.update(id, { falsePositive: false });
    expect(store().lastBiteTime).toBe(T0 + 60_000);
    expect(store().bestStreakMs).toBe(60_000);
  });

  it('an unreviewed alarm marked Not a bite is still not a bite, and stays out of every figure', () => {
    at(30_000);
    store().logIncident('auto-detected', true);
    const id = store().incidents[0].id;
    events.update(id, { falsePositive: true });
    expect(store().lastBiteTime).toBeNull();
    expect(store().bestStreakMs).toBe(0);
    expect(events.count({ falsePositive: true })).toBe(1);
    expect(events.count({ falsePositive: false })).toBe(0);
  });

  it('the best streak is measured across the false positive, as if it had not happened', () => {
    at(10_000);
    store().logIncident('stress');
    const fp = confirmedAlarm(20_000);
    at(30_000);
    store().logIncident('stress');
    expect(store().bestStreakMs).toBe(10_000);
    events.update(fp, { falsePositive: true });
    expect(store().bestStreakMs).toBe(20_000); // 10 s to the next real bite, 20 s across the gap
    expect(store().lastBiteTime).toBe(T0 + 30_000);
  });

  it('saying "this was a bite" about a Not a bite alarm takes the mark off (History\'s Bite button)', () => {
    at(60_000);
    store().logIncident('auto-detected', true);
    const id = store().incidents[0].id;
    events.update(id, { falsePositive: true });
    expect(store().lastBiteTime).toBeNull();
    store().confirmIncident(id, 'stress');
    expect(store().incidents[0]).toMatchObject({ confirmed: true, falsePositive: false, tag: 'stress' });
    expect(store().lastBiteTime).toBe(T0 + 60_000);
  });

  it('marking stamps updatedAt, so the change wins when it is synced later', () => {
    at(60_000);
    store().logIncident('auto-detected', true);
    const id = store().incidents[0].id;
    const before = events.get(id)!.updatedAt;
    at(120_000);
    const after = events.update(id, { falsePositive: true })!;
    expect(after.falsePositive).toBe(true);
    expect(after.updatedAt).toBeGreaterThan(before);
  });
});
