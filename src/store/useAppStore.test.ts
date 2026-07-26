import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { useAppStore, pruneIncidents, computeBestStreak, migrateState, MAX_INCIDENTS } from './useAppStore';
import type { Incident } from '../types';

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

describe('pruneIncidents', () => {
  // Newest-first, matching how the store stores them.
  const bites = (timestamps: number[]): Incident[] =>
    timestamps
      .slice()
      .sort((a, b) => b - a)
      .map(t => ({ id: `i${t}`, timestamp: t, tag: 'stress', autoDetected: false }));

  const filler = (count: number, from: number): Incident[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `f${i}`,
      timestamp: from + i,
      tag: 'auto-detected',
      autoDetected: true,
    })).reverse();

  it('leaves a list under the cap untouched', () => {
    const state = { incidents: bites([10, 20]), historyStartTime: 0, bestStreakFloorMs: 0 };
    expect(pruneIncidents(state)).toBe(state);
  });

  it('caps the list at MAX_INCIDENTS, dropping the oldest', () => {
    const incidents = filler(MAX_INCIDENTS + 50, 1_000);
    const out = pruneIncidents({ incidents, historyStartTime: 0, bestStreakFloorMs: 0 });

    expect(out.incidents).toHaveLength(MAX_INCIDENTS);
    // Newest survives, oldest does not.
    expect(out.incidents[0]).toBe(incidents[0]);
    expect(out.incidents.at(-1)!.timestamp).toBeGreaterThan(incidents.at(-1)!.timestamp);
  });

  it('banks a record streak that is about to be pruned away', () => {
    // One huge early gap (0 -> 10_000_000), then a dense run of recent bites.
    const recent = Array.from({ length: MAX_INCIDENTS + 10 }, (_, i) => 10_000_000 + i * 10);
    const incidents = bites([...recent]);

    const before = computeBestStreak(incidents, 0);
    expect(before).toBe(10_000_000);

    const out = pruneIncidents({ incidents, historyStartTime: 0, bestStreakFloorMs: 0 });

    // The bite that ended the record is gone from the retained list...
    expect(computeBestStreak(out.incidents, out.historyStartTime)).toBeLessThan(before);
    // ...but the record itself survives as the floor.
    expect(out.bestStreakFloorMs).toBe(before);
  });

  it('re-anchors so a retained streak is not measured from before the drop', () => {
    const recent = Array.from({ length: MAX_INCIDENTS + 10 }, (_, i) => 10_000_000 + i * 10);
    const incidents = bites(recent);

    const out = pruneIncidents({ incidents, historyStartTime: 0, bestStreakFloorMs: 0 });

    // Without re-anchoring, the oldest retained bite would measure its streak
    // all the way back to 0 and invent a ~10,000,000ms record that never happened.
    const oldestRetained = out.incidents.at(-1)!.timestamp;
    expect(out.historyStartTime).toBeGreaterThan(0);
    expect(out.historyStartTime).toBeLessThan(oldestRetained);
    expect(computeBestStreak(out.incidents, out.historyStartTime)).toBeLessThan(1_000);
  });

  it('keeps the anchor when nothing dropped was a real bite', () => {
    const incidents = filler(MAX_INCIDENTS + 50, 1_000);
    const out = pruneIncidents({ incidents, historyStartTime: 42, bestStreakFloorMs: 0 });
    expect(out.historyStartTime).toBe(42);
  });

  it('never lowers an existing floor', () => {
    const incidents = filler(MAX_INCIDENTS + 5, 1_000);
    const out = pruneIncidents({ incidents, historyStartTime: 0, bestStreakFloorMs: 999_999 });
    expect(out.bestStreakFloorMs).toBe(999_999);
  });
});

describe('retention in the store', () => {
  it('stops the incident list growing without bound', () => {
    for (let i = 0; i < MAX_INCIDENTS + 25; i++) {
      at(1_000 + i);
      store().logIncident('auto-detected', true);
    }
    expect(store().incidents).toHaveLength(MAX_INCIDENTS);
  });
});

describe('migrateState (v0 -> v1)', () => {
  const v0 = {
    incidents: [
      { id: 'b', timestamp: 20_000, tag: 'stress', autoDetected: false },
      { id: 'a', timestamp: 10_000, tag: 'stress', autoDetected: false },
    ],
    firstOpenTime: 0,
    lastBiteTime: 20_000,
    bestStreakMs: 10_000,
    theme: 'dark',
    customTags: [{ id: 'custom-x', label: 'Zoom calls', emoji: '📞' }],
  };

  it('anchors existing users at their firstOpenTime, not "now"', () => {
    const out = migrateState(v0, 0);
    expect(out.historyStartTime).toBe(0);
    expect(out.bestStreakFloorMs).toBe(0);
  });

  it('leaves the anchor derivable so a stale best streak can still be corrected', () => {
    const out = migrateState(v0, 0);
    // Floor of 0 means bestStreakMs stays purely derived from the visible log.
    expect(computeBestStreak(out.incidents!, out.historyStartTime!)).toBe(10_000);
  });

  it('preserves every unrelated setting', () => {
    const out = migrateState(v0, 0) as Record<string, unknown>;
    expect(out.theme).toBe('dark');
    expect(out.customTags).toEqual(v0.customTags);
    expect(out.incidents).toHaveLength(2);
    expect(out.bestStreakMs).toBe(10_000);
  });

  it('falls back to now when firstOpenTime is somehow missing', () => {
    const out = migrateState({ incidents: [] }, 0);
    expect(typeof out.historyStartTime).toBe('number');
    expect(out.historyStartTime).toBeGreaterThan(0);
  });

  it('is a no-op for state already at the current version', () => {
    const v1 = { ...v0, historyStartTime: 5, bestStreakFloorMs: 77 };
    expect(migrateState(v1, 1)).toEqual(v1);
  });
});
