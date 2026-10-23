import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { finishUrge, logUrge, undoUrge } from './urgeLog';
import { events } from '../storage';
import { useAppStore, isBite } from '../store/useAppStore';
import { isUrge } from '../storage/eventModel';
import { toHabitEvent } from '../storage/eventModel';

const T0 = 1_700_000_000_000;
const at = (ms: number) => vi.setSystemTime(T0 + ms);
const store = () => useAppStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  at(0);
  store().clearAllData();
});
afterAll(() => vi.useRealTimers());

describe('an urge-timer entry', () => {
  it('is a manual event with the trigger "urge"', () => {
    at(1000);
    const id = logUrge();
    const e = events.get(id)!;
    expect(e).toMatchObject({ source: 'manual', behavior: 'nail_biting', triggers: ['urge'], ts: T0 + 1000 });
    const rec = store().incidents[0];
    expect(rec).toMatchObject({ tag: 'urge', autoDetected: false });
    expect(isUrge(rec)).toBe(true);
  });

  it('is not a bite: the streak is untouched and no bite is counted', () => {
    at(60_000);
    store().logIncident('stress'); // a real bite, to have a streak
    at(120_000);
    const before = { last: store().lastBiteTime, best: store().bestStreakMs };
    expect(before.last).toBe(T0 + 60_000);

    at(150_000);
    logUrge();
    expect(store().lastBiteTime).toBe(before.last);
    expect(store().bestStreakMs).toBe(before.best);
    expect(store().incidents.filter(isBite)).toHaveLength(1);
    expect(store().incidents).toHaveLength(2);
  });

  it('on its own it does not start a streak clock', () => {
    at(5000);
    logUrge();
    expect(store().lastBiteTime).toBeNull();
  });

  it('is still not a bite after the timer result is saved, or after an undo and restore', () => {
    at(1000);
    const id = logUrge();
    at(31_000);
    finishUrge(id, { done: true, durationSec: 30 });
    expect(events.get(id)?.competingResponse).toEqual({ done: true, durationSec: 30 });
    expect(isBite(store().incidents[0])).toBe(false);
    expect(store().lastBiteTime).toBeNull();

    undoUrge(id);
    expect(store().incidents).toHaveLength(0);
    expect(store().tombstones.some(t => t.id === id)).toBe(true);
  });

  it('is excluded from the alarm statistics (its source is manual)', () => {
    at(1000);
    const id = logUrge();
    finishUrge(id, { done: true, durationSec: 60 });
    expect(toHabitEvent(store().incidents[0]).source).toBe('manual');
  });

  it('cannot be faked by an alarm: an alarm confirmed with the tag "urge" is still a bite', () => {
    at(1000);
    store().logIncident('auto-detected', true);
    const alarm = store().incidents[0];
    at(2000);
    store().confirmIncident(alarm.id, 'urge');
    const confirmed = store().incidents[0];
    expect(isUrge(confirmed)).toBe(false);
    expect(isBite(confirmed)).toBe(true);
  });

  it('does not change what a bite is for every other kind of entry', () => {
    at(1000);
    store().logIncident('stress');                 // manual bite
    store().logIncident('custom-ab12cd34');         // manual bite, custom tag
    at(40_000);
    store().logIncident('auto-detected', true);     // unconfirmed alarm
    const [alarm, custom, stress] = store().incidents;
    expect(isBite(stress)).toBe(true);
    expect(isBite(custom)).toBe(true);
    expect(isBite(alarm)).toBe(false);
    store().confirmIncident(alarm.id);
    expect(isBite(store().incidents[0])).toBe(true);
  });
});
