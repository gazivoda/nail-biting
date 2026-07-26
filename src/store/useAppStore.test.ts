import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { useAppStore } from './useAppStore';

// The streak maths is all relative to firstOpenTime, so pin the clock and step
// it forward explicitly rather than sleeping.
const T0 = 1_700_000_000_000;
const at = (ms: number) => vi.setSystemTime(T0 + ms);

const store = () => useAppStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  at(0);
  store().clearAllData(); // resets state and sets firstOpenTime = now
});

afterAll(() => vi.useRealTimers());

describe('logIncident', () => {
  it('a manual bite breaks the streak and banks it as the best', () => {
    at(60_000);
    store().logIncident('stress');

    expect(store().lastBiteTime).toBe(T0 + 60_000);
    expect(store().bestStreakMs).toBe(60_000);
    expect(store().incidents).toHaveLength(1);
  });

  it('an auto-detected incident does NOT break the streak until confirmed', () => {
    at(60_000);
    store().logIncident('auto-detected', true);

    expect(store().incidents).toHaveLength(1);
    expect(store().lastBiteTime).toBeNull();
    expect(store().bestStreakMs).toBe(0);
  });

  it('keeps the longest streak, not the most recent one', () => {
    at(10_000);
    store().logIncident('stress');   // streak of 10s
    at(12_000);
    store().logIncident('stress');   // streak of 2s — shorter, must not overwrite

    expect(store().bestStreakMs).toBe(10_000);
  });
});

describe('confirmIncident', () => {
  it('promotes an auto-detected incident to a real bite', () => {
    at(60_000);
    store().logIncident('auto-detected', true);
    const id = store().incidents[0].id;

    at(70_000);
    store().confirmIncident(id);

    expect(store().incidents[0].confirmed).toBe(true);
    // The streak broke when the bite happened, not when it was confirmed.
    expect(store().lastBiteTime).toBe(T0 + 60_000);
  });
});

describe('deleteIncident', () => {
  it('rolls lastBiteTime back to the previous remaining bite', () => {
    at(10_000);
    store().logIncident('stress');
    at(20_000);
    store().logIncident('stress');

    store().deleteIncident(store().incidents[0].id); // delete the newer one

    expect(store().lastBiteTime).toBe(T0 + 10_000);
  });

  it('clears the best streak when the only bite is deleted', () => {
    at(10_000);
    store().logIncident('stress');
    expect(store().bestStreakMs).toBe(10_000);

    store().deleteIncident(store().incidents[0].id);

    // No bites left means no completed streak has ever been recorded.
    expect(store().lastBiteTime).toBeNull();
    expect(store().bestStreakMs).toBe(0);
  });

  it('merges the two streaks either side of a deleted bite', () => {
    at(10_000);
    store().logIncident('stress');   // streak 0 -> 10s
    at(15_000);
    store().logIncident('stress');   // streak 10s -> 15s (5s)
    expect(store().bestStreakMs).toBe(10_000);

    // Deleting the bite at 10s joins the 10s and 5s streaks into one 15s run.
    const first = store().incidents.find(i => i.timestamp === T0 + 10_000)!;
    store().deleteIncident(first.id);

    expect(store().bestStreakMs).toBe(15_000);
  });

  it('leaves the best streak alone when an unconfirmed incident is deleted', () => {
    at(10_000);
    store().logIncident('stress');            // real bite, best = 10s
    at(12_000);
    store().logIncident('auto-detected', true); // never confirmed

    const auto = store().incidents.find(i => i.autoDetected)!;
    store().deleteIncident(auto.id);

    expect(store().bestStreakMs).toBe(10_000);
    expect(store().lastBiteTime).toBe(T0 + 10_000);
  });
});
