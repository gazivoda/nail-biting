import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startCoachingWatcher } from './watcher';
import { createCoachingController } from './controller';
import { DEFAULT_COACHING_SETTINGS, type CoachingSettings } from './settings';
import { HOUR_MS } from './promptPolicy';
import type { WatchedEvent } from './alarmWatcher';
import type { CoachingPatch } from './session';

const T0 = 1_700_000_000_000;

// A fake history: newest first, with a store-like subscribe.
function fakeHistory(initial: WatchedEvent[] = []) {
  let incidents = initial;
  const listeners = new Set<() => void>();
  return {
    getIncidents: () => incidents,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    add(e: WatchedEvent) { incidents = [e, ...incidents]; listeners.forEach(fn => fn()); },
    touch() { listeners.forEach(fn => fn()); },
    listenerCount: () => listeners.size,
  };
}
const alarm = (id: string): WatchedEvent => ({ id, timestamp: Date.now(), autoDetected: true });

let settings: CoachingSettings;
let lastPrompt: number | null;
let saved: Array<[string, CoachingPatch]>;
let controller: ReturnType<typeof createCoachingController>;

function start(history: ReturnType<typeof fakeHistory>) {
  return startCoachingWatcher({
    ...history,
    controller,
    save: (id, patch) => saved.push([id, patch]),
    defer: fn => fn(),
    getSettings: () => settings,
    getLastPromptAt: () => lastPrompt,
    setLastPromptAt: ts => { lastPrompt = ts; },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  settings = { ...DEFAULT_COACHING_SETTINGS, promptMode: 'every', durationSec: 20 };
  lastPrompt = null;
  saved = [];
  controller = createCoachingController();
  controller.attach(); // the overlay is mounted
});
afterEach(() => vi.useRealTimers());

describe('the coaching watcher', () => {
  it('offers the chosen response, for the chosen time, on a new alarm event', () => {
    settings = { ...settings, selectedId: 'palms' };
    const h = fakeHistory();
    start(h);
    h.add(alarm('a1'));
    expect(controller.getState().session).toMatchObject({ phase: 'running', eventId: 'a1', text: 'Palms flat on the desk', durationSec: 20 });
  });

  it('saves the result on the alarm event it was offered for', () => {
    const h = fakeHistory();
    start(h);
    h.add(alarm('a1'));
    vi.advanceTimersByTime(5_000);
    controller.complete();
    expect(saved).toEqual([['a1', { done: true, durationSec: 5 }]]);
  });

  it('default settings (prompt off): an alarm changes nothing', () => {
    settings = { ...DEFAULT_COACHING_SETTINGS };
    const h = fakeHistory();
    start(h);
    h.add(alarm('a1'));
    expect(controller.getState().session.phase).toBe('idle');
    expect(lastPrompt).toBeNull();
  });

  it('every alarm: a second alarm event prompts again once the first is dismissed', () => {
    const h = fakeHistory();
    start(h);
    h.add(alarm('a1'));
    controller.skip();
    vi.advanceTimersByTime(60_000);
    h.add(alarm('a2'));
    expect(controller.getState().session).toMatchObject({ phase: 'running', eventId: 'a2' });
  });

  it('first alarm per hour: prompts the first, not the next within the hour, then again after it', () => {
    settings = { ...settings, promptMode: 'hourly' };
    const h = fakeHistory();
    start(h);
    h.add(alarm('a1'));
    expect(controller.getState().session).toMatchObject({ phase: 'running', eventId: 'a1' });
    controller.skip();
    expect(lastPrompt).toBe(T0);

    vi.advanceTimersByTime(40 * 60_000);
    h.add(alarm('a2'));
    expect(controller.getState().session.phase).toBe('idle');
    expect(lastPrompt).toBe(T0); // a skipped-by-policy alarm does not move the hour

    vi.advanceTimersByTime(21 * 60_000);
    h.add(alarm('a3'));
    expect(controller.getState().session).toMatchObject({ phase: 'running', eventId: 'a3' });
    expect(lastPrompt).toBe(T0 + 61 * 60_000);
  });

  it('a new alarm while a prompt is running does not stack or restart it', () => {
    const h = fakeHistory();
    start(h);
    h.add(alarm('a1'));
    vi.advanceTimersByTime(3_000);
    h.add(alarm('a2'));
    expect(controller.getState().session).toMatchObject({ eventId: 'a1' });
    expect(lastPrompt).toBe(T0); // only the shown prompt is remembered
  });

  it('alarms that were already in the history at start-up never prompt', () => {
    const h = fakeHistory([{ id: 'old', timestamp: Date.now() - 1_000, autoDetected: true }]);
    start(h);
    h.touch(); // any unrelated change to the history
    expect(controller.getState().session.phase).toBe('idle');
  });

  it('other history changes (a manual log, a delete) do not prompt', () => {
    const h = fakeHistory();
    start(h);
    h.add({ id: 'm1', timestamp: Date.now(), autoDetected: false });
    expect(controller.getState().session.phase).toBe('idle');
  });

  it('is armed while watching and disarmed (invisible) after stop, with the subscription removed', () => {
    const h = fakeHistory();
    const stop = start(h);
    expect(controller.getState().armed).toBe(true);
    expect(h.listenerCount()).toBe(1);
    h.add(alarm('a1'));
    stop();
    expect(controller.getState()).toEqual({ armed: false, session: { phase: 'idle' } });
    expect(h.listenerCount()).toBe(0);
    h.add(alarm('a2'));
    expect(controller.getState().session.phase).toBe('idle');
  });

  describe('it can never get in the way of the alarm', () => {
    it('the listener inside the store update does no work except one cheap check and a deferral', () => {
      const deferred: Array<() => void> = [];
      const h = fakeHistory();
      const getSettings = vi.fn(() => settings);
      startCoachingWatcher({
        ...h, controller, save: () => {}, defer: fn => deferred.push(fn),
        getSettings, getLastPromptAt: () => null, setLastPromptAt: () => {},
      });
      h.add(alarm('a1'));
      // inside the store update: nothing read, nothing started
      expect(getSettings).not.toHaveBeenCalled();
      expect(controller.getState().session.phase).toBe('idle');
      expect(deferred).toHaveLength(1);
      deferred[0]();
      expect(controller.getState().session.phase).toBe('running');
    });

    it('errors from settings, storage or the history never reach the caller', () => {
      const h = fakeHistory();
      startCoachingWatcher({
        ...h, controller, save: () => {}, defer: fn => fn(),
        getSettings: () => { throw new Error('settings exploded'); },
        getLastPromptAt: () => null, setLastPromptAt: () => {},
      });
      expect(() => h.add(alarm('a1'))).not.toThrow();

      const broken = {
        getIncidents: () => { throw new Error('history exploded'); },
        subscribe: (fn: () => void) => { fn(); return () => {}; },
      };
      expect(() => startCoachingWatcher({ ...broken, controller: createCoachingController(), save: () => {}, defer: fn => fn() })).not.toThrow();
    });

    it('a failure while saving the result does not break dismissal', () => {
      const h = fakeHistory();
      startCoachingWatcher({
        ...h, controller, save: () => { throw new Error('quota'); }, defer: fn => fn(),
        getSettings: () => settings, getLastPromptAt: () => null, setLastPromptAt: () => {},
      });
      h.add(alarm('a1'));
      expect(() => controller.skip()).not.toThrow();
      expect(controller.getState().session.phase).toBe('idle');
    });
  });
});

describe('the hour constant', () => {
  it('is 60 minutes', () => { expect(HOUR_MS).toBe(3_600_000); });
});
