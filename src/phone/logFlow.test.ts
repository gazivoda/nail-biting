import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  DEFAULT_BITE_TRIGGER, DOUBLE_TAP_GUARD_MS, MAX_TAPS_TO_LOG, TOAST_AFTER_TAG_MS, TOAST_MS,
  createLogFlow, type LogFlowDeps, type PhoneEventsPort,
} from './logFlow';
import { events } from '../storage';
import { useAppStore, isBite, computeBestStreak } from '../store/useAppStore';
import { isUrge } from '../storage/eventModel';
import { logUrge, undoUrge } from '../coaching/urgeLog';

// ── A flow over fakes: what is written, and how many taps it took ────────────

interface Call { op: 'add' | 'update' | 'softDelete' | 'urgeLog' | 'urgeUndo'; args: unknown[] }

function fakeFlow(startAt = 1_000_000) {
  const calls: Call[] = [];
  let clock = startAt;
  let n = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let tid = 0;
  const events: PhoneEventsPort = {
    add: input => { calls.push({ op: 'add', args: [input] }); return { id: `e${++n}` }; },
    update: (id, patch) => { calls.push({ op: 'update', args: [id, patch] }); },
    softDelete: id => { calls.push({ op: 'softDelete', args: [id] }); return true; },
  };
  const deps: LogFlowDeps = {
    events,
    urge: {
      log: () => { calls.push({ op: 'urgeLog', args: [] }); return `u${++n}`; },
      undo: id => { calls.push({ op: 'urgeUndo', args: [id] }); },
    },
    now: () => clock,
    schedule: (fn, ms) => { const id = ++tid; timers.set(id, { at: clock + ms, fn }); return id; },
    cancel: h => { timers.delete(h as number); },
  };
  const flow = createLogFlow(deps);
  const advance = (ms: number) => {
    clock += ms;
    for (const [id, t] of [...timers]) if (t.at <= clock) { timers.delete(id); t.fn(); }
  };
  return { flow, calls, advance, pending: () => timers.size };
}

describe('the tap budget: logging takes two taps or fewer', () => {
  it('"I bit" logs on the first tap', () => {
    const { flow, calls } = fakeFlow();
    flow.tapBite();
    expect(flow.taps()).toBe(1);
    expect(calls).toEqual([{ op: 'add', args: [{ source: 'manual', triggers: [DEFAULT_BITE_TRIGGER] }] }]);
    expect(flow.getToast()).toEqual({ kind: 'bite', id: 'e1', trigger: 'unknown' });
  });

  it('what set it off is an optional second tap, on the SAME entry (no second event)', () => {
    const { flow, calls } = fakeFlow();
    flow.tapBite();
    flow.tapTrigger('stress');
    expect(flow.taps()).toBe(2);
    expect(flow.taps()).toBeLessThanOrEqual(MAX_TAPS_TO_LOG);
    expect(calls.map(c => c.op)).toEqual(['add', 'update']);
    expect(calls[1].args).toEqual(['e1', { triggers: ['stress'] }]);
    expect(flow.getToast()).toEqual({ kind: 'bite', id: 'e1', trigger: 'stress' });
  });

  it('the tag can be changed again without logging again', () => {
    const { flow, calls } = fakeFlow();
    flow.tapBite();
    flow.tapTrigger('stress');
    flow.tapTrigger('boredom');
    expect(calls.filter(c => c.op === 'add')).toHaveLength(1);
    expect(flow.getToast()).toEqual({ kind: 'bite', id: 'e1', trigger: 'boredom' });
  });

  it('with the urge timer off, "I feel an urge" logs on the first tap', () => {
    const { flow, calls } = fakeFlow();
    flow.tapUrge();
    expect(flow.taps()).toBe(1);
    expect(calls).toEqual([{ op: 'urgeLog', args: [] }]);
    expect(flow.getToast()).toEqual({ kind: 'urge', id: 'u1' });
  });

  it('Undo is one tap and removes exactly the entry on screen', () => {
    const bite = fakeFlow();
    bite.flow.tapBite();
    bite.flow.undo();
    expect(bite.calls.map(c => c.op)).toEqual(['add', 'softDelete']);
    expect(bite.calls[1].args).toEqual(['e1']);
    expect(bite.flow.getToast()).toBeNull();

    const urge = fakeFlow();
    urge.flow.tapUrge();
    urge.flow.undo();
    expect(urge.calls.map(c => c.op)).toEqual(['urgeLog', 'urgeUndo']);
    expect(urge.flow.getToast()).toBeNull();
  });

  it('every documented way of logging is within the budget (the timer path is button + Start)', () => {
    const FLOWS: Record<string, string[]> = {
      bite: ['I bit'],
      biteWithTrigger: ['I bit', 'a trigger chip'],
      urgeWithoutTimer: ['I feel an urge'],
      urgeWithTimer: ['I feel an urge', 'Start'], // WS2's UrgeTimer logs on Start
    };
    for (const [name, taps] of Object.entries(FLOWS)) expect(taps.length, name).toBeLessThanOrEqual(MAX_TAPS_TO_LOG);
  });
});

describe('mistakes and accidents', () => {
  it('two taps within the guard window are one log (an accidental double tap)', () => {
    const { flow, calls, advance } = fakeFlow();
    flow.tapBite();
    advance(DOUBLE_TAP_GUARD_MS - 1);
    flow.tapBite();
    expect(calls.filter(c => c.op === 'add')).toHaveLength(1);
    advance(DOUBLE_TAP_GUARD_MS);
    flow.tapBite();
    expect(calls.filter(c => c.op === 'add')).toHaveLength(2);
  });

  it('an undone log does not block the corrected one', () => {
    const { flow, calls } = fakeFlow();
    flow.tapUrge();
    flow.undo();
    flow.tapBite(); // the person meant a bite, straight away
    expect(calls.map(c => c.op)).toEqual(['urgeLog', 'urgeUndo', 'add']);
  });

  it('a trigger tap with nothing to attach it to writes nothing', () => {
    const { flow, calls } = fakeFlow();
    flow.tapTrigger('stress');
    expect(calls).toEqual([]);
    flow.tapUrge();
    flow.tapTrigger('stress'); // an urge has no trigger to choose
    expect(calls.map(c => c.op)).toEqual(['urgeLog']);
  });

  it('the confirmation goes away by itself, sooner after a tag', () => {
    const a = fakeFlow();
    a.flow.tapBite();
    a.advance(TOAST_MS - 1);
    expect(a.flow.getToast()).not.toBeNull();
    a.advance(1);
    expect(a.flow.getToast()).toBeNull();
    expect(a.pending()).toBe(0);

    const b = fakeFlow();
    b.flow.tapBite();
    b.advance(TOAST_MS - 100);
    b.flow.tapTrigger('focus');
    b.advance(TOAST_AFTER_TAG_MS - 1);
    expect(b.flow.getToast()).not.toBeNull();
    b.advance(1);
    expect(b.flow.getToast()).toBeNull();
  });

  it('tells subscribers about every change and stops after unsubscribe', () => {
    const { flow, advance } = fakeFlow();
    let seen = 0;
    const off = flow.subscribe(() => { seen++; });
    flow.tapBite();
    flow.tapTrigger('stress');
    flow.undo();
    expect(seen).toBe(3);
    off();
    advance(10_000);
    flow.tapBite();
    expect(seen).toBe(3);
  });
});

// ── The same flow over the REAL storage module and streak code ───────────────

const T0 = 1_700_000_000_000;
const at = (ms: number) => vi.setSystemTime(T0 + ms);
const store = () => useAppStore.getState();

function realFlow() {
  let n = 0;
  return createLogFlow({
    events,
    urge: { log: logUrge, undo: undoUrge },
    now: () => Date.now(),
    schedule: () => ++n,
    cancel: () => {},
  });
}

describe('through the real storage module', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    at(0);
    store().clearAllData();
  });
  afterAll(() => vi.useRealTimers());

  it('"I bit" is a normal manual event: it is a bite, it resets the streak, and it carries the device and update stamps sync relies on', () => {
    at(60_000);
    const flow = realFlow();
    flow.tapBite();
    const rec = store().incidents[0];
    expect(rec).toMatchObject({ tag: 'unknown', autoDetected: false, source: 'manual', behavior: 'nail_biting', ts: T0 + 60_000 });
    expect(rec.deviceId).toBeTruthy();
    expect(rec.updatedAt).toBe(T0 + 60_000);
    expect(isBite(rec)).toBe(true);
    expect(store().lastBiteTime).toBe(T0 + 60_000);
    expect(events.get(rec.id)?.triggers).toEqual(['unknown']);
  });

  it('the tag tap rewrites that entry and stamps updatedAt, so sync sees the change', () => {
    at(1000);
    const flow = realFlow();
    flow.tapBite();
    at(4000);
    flow.tapTrigger('stress');
    expect(store().incidents).toHaveLength(1);
    expect(store().incidents[0]).toMatchObject({ tag: 'stress', updatedAt: T0 + 4000, ts: T0 + 1000 });
    expect(events.get(store().incidents[0].id)?.triggers).toEqual(['stress']);
  });

  it('Undo on a bite leaves a tombstone for sync and puts the streak back', () => {
    at(1000);
    store().logIncident('stress'); // an earlier bite: the streak runs from here
    const earlier = store().lastBiteTime;
    at(100_000);
    const flow = realFlow();
    flow.tapBite();
    expect(store().lastBiteTime).toBe(T0 + 100_000);
    flow.undo();
    expect(store().incidents).toHaveLength(1);
    expect(store().tombstones[0]).toMatchObject({ deleted: true, source: 'manual' });
    expect(store().lastBiteTime).toBe(earlier);
  });

  it('an urge is not a bite: streak, best streak and the bite count are exactly what they were', () => {
    at(1000);
    store().logIncident('boredom');
    at(500_000);
    const before = { last: store().lastBiteTime, best: store().bestStreakMs };
    const flow = realFlow();
    at(600_000);
    flow.tapUrge();
    const urge = store().incidents[0];
    expect(isUrge(urge)).toBe(true);
    expect(isBite(urge)).toBe(false);
    expect(store().lastBiteTime).toBe(before.last);
    expect(store().bestStreakMs).toBe(before.best);
    expect(store().incidents.filter(isBite)).toHaveLength(1);
  });

  it('streak maths is unchanged: the best streak of a log made through the phone flow equals computeBestStreak over the same history', () => {
    const flow = realFlow();
    at(1_000);
    flow.tapBite();
    at(10_000_000);
    flow.tapBite();
    at(30_000_000);
    flow.tapUrge();
    at(31_000_000);
    flow.tapBite();
    const s = store();
    expect(s.bestStreakMs).toBe(computeBestStreak(s.incidents, s.historyStartTime));
    expect(s.lastBiteTime).toBe(T0 + 31_000_000);
  });
});
