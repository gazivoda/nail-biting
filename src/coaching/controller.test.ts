import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCoachingController } from './controller';
import { CONFIRMATION_MS, type CoachingResult } from './session';

const offerA = { eventId: 'a', text: 'Clench your fists', durationSec: 30 };

let ctl: ReturnType<typeof createCoachingController>;
let results: CoachingResult[];
let detach: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  ctl = createCoachingController();
  results = [];
  ctl.setResultHandler(r => results.push(r));
  ctl.arm();
  detach = ctl.attach(); // a surface (the overlay) is mounted
});
afterEach(() => vi.useRealTimers());

describe('the shared controller', () => {
  it('is invisible until the app arms it (the landing demo and flag-off never arm it)', () => {
    const fresh = createCoachingController();
    expect(fresh.getState()).toEqual({ armed: false, session: { phase: 'idle' } });
    expect(fresh.offer(offerA)).toBe(false);
    expect(fresh.getState().session.phase).toBe('idle');
  });

  it('runs to the end on its own timer and saves done once', () => {
    expect(ctl.offer(offerA)).toBe(true);
    vi.advanceTimersByTime(29_000);
    expect(ctl.getState().session.phase).toBe('running');
    expect(results).toEqual([]);
    vi.advanceTimersByTime(1_100);
    expect(ctl.getState().session.phase).toBe('finished');
    expect(results).toEqual([{ eventId: 'a', patch: { done: true, durationSec: 30 } }]);
    vi.advanceTimersByTime(CONFIRMATION_MS + 100);
    expect(ctl.getState().session.phase).toBe('idle');
    expect(results).toHaveLength(1);
  });

  it('Skip dismisses at once, saves done:false, and the timer cannot bring it back', () => {
    ctl.offer(offerA);
    vi.advanceTimersByTime(4_000);
    ctl.skip();
    expect(ctl.getState().session.phase).toBe('idle');
    expect(results).toEqual([{ eventId: 'a', patch: { done: false, durationSec: 4 } }]);
    vi.advanceTimersByTime(120_000);
    expect(ctl.getState().session.phase).toBe('idle');
    expect(results).toHaveLength(1);
  });

  it('Done from one surface dismisses the other: both read the same session', () => {
    const seenByMain: string[] = [];
    const seenByPip: string[] = [];
    ctl.subscribe(() => seenByMain.push(ctl.getState().session.phase));
    ctl.subscribe(() => seenByPip.push(ctl.getState().session.phase));
    ctl.offer(offerA);
    vi.advanceTimersByTime(8_000);
    ctl.complete(); // pressed in the minimized window
    expect(seenByMain).toEqual(['running', 'finished']);
    expect(seenByPip).toEqual(['running', 'finished']);
    expect(results).toEqual([{ eventId: 'a', patch: { done: true, durationSec: 8 } }]);
    ctl.skip(); // Escape in the main window afterwards: closes, saves nothing more
    expect(ctl.getState().session.phase).toBe('idle');
    expect(results).toHaveLength(1);
  });

  it('does not start a second session while one is running', () => {
    expect(ctl.offer(offerA)).toBe(true);
    expect(ctl.offer({ ...offerA, eventId: 'b' })).toBe(false);
    expect(ctl.getState().session).toMatchObject({ eventId: 'a' });
  });

  it('a handler that throws cannot break the prompt', () => {
    ctl.setResultHandler(() => { throw new Error('storage exploded'); });
    ctl.offer(offerA);
    expect(() => ctl.skip()).not.toThrow();
    expect(ctl.getState().session.phase).toBe('idle');
  });

  it('a listener that throws does not stop the others', () => {
    const calls: string[] = [];
    ctl.subscribe(() => { throw new Error('bad listener'); });
    ctl.subscribe(() => calls.push('ok'));
    ctl.offer(offerA);
    expect(calls).toEqual(['ok']);
  });

  it('disarming drops a live session without a result and stops its timer', () => {
    ctl.offer(offerA);
    ctl.disarm();
    expect(ctl.getState()).toEqual({ armed: false, session: { phase: 'idle' } });
    vi.advanceTimersByTime(120_000);
    expect(results).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('with no surface mounted nobody could see a prompt, so none starts', () => {
    detach();
    expect(ctl.offer(offerA)).toBe(false);
    expect(ctl.getState().session.phase).toBe('idle');
  });

  it('if the last surface goes away mid-session (camera stopped) the session is dropped and NOT counted as done', () => {
    ctl.offer(offerA);
    vi.advanceTimersByTime(5_000);
    detach();
    expect(ctl.getState().session.phase).toBe('idle');
    vi.advanceTimersByTime(120_000);
    expect(results).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('with two surfaces (overlay and minimized strip) one going away does not end the session', () => {
    const detachPip = ctl.attach();
    ctl.offer(offerA);
    detachPip();
    expect(ctl.getState().session.phase).toBe('running');
    detach();
    expect(ctl.getState().session.phase).toBe('idle');
    detach(); // detaching twice is harmless
    detachPip();
    expect(results).toEqual([]);
  });

  it('unsubscribe stops notifications', () => {
    const calls: number[] = [];
    const off = ctl.subscribe(() => calls.push(1));
    off();
    ctl.offer(offerA);
    expect(calls).toEqual([]);
  });
});
