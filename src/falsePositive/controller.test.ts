import { describe, it, expect, vi } from 'vitest';
import { MARKED_MS, OFFER_MS, createNotABiteController, type NotABiteHandlers, type Timers } from './controller';

/** Timers the test steps by hand. */
function fakeTimers() {
  let now = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  let next = 1;
  const timers: Timers = {
    set(fn, ms) { const id = next++; pending.set(id, { at: now + ms, fn }); return id; },
    clear(h) { pending.delete(h as number); },
  };
  return {
    timers,
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...pending]) if (t.at <= now) { pending.delete(id); t.fn(); }
    },
    pending: () => pending.size,
  };
}

function setup(handlers: Partial<NotABiteHandlers> = {}) {
  const clock = fakeTimers();
  const c = createNotABiteController(clock.timers);
  const calls: string[] = [];
  const full: NotABiteHandlers = {
    mark: id => { calls.push(`mark:${id}`); },
    undo: id => { calls.push(`undo:${id}`); },
    calibrate: () => { calls.push('calibrate'); },
    ...handlers,
  };
  return { c, clock, calls, arm: () => c.arm(full) };
}

describe('the Not a bite offer', () => {
  it('is invisible until the app arms it (the demo and the flag-off app never do)', () => {
    const { c } = setup();
    c.offer('a');
    expect(c.getState()).toEqual({ armed: false, offer: null });
    c.mark(); c.undo(); c.dismiss(); c.calibrate();
    expect(c.getState()).toEqual({ armed: false, offer: null });
  });

  it('offers, marks, and undoes', () => {
    const { c, calls, arm } = setup();
    arm();
    c.offer('a');
    expect(c.getState().offer).toEqual({ eventId: 'a', phase: 'offered' });
    c.mark();
    expect(c.getState().offer).toEqual({ eventId: 'a', phase: 'marked' });
    c.undo();
    expect(c.getState().offer).toBeNull();
    expect(calls).toEqual(['mark:a', 'undo:a']);
  });

  it('marks once: a second press does nothing, and Undo only works after a mark', () => {
    const { c, calls, arm } = setup();
    arm();
    c.offer('a');
    c.undo();                       // nothing to undo yet
    c.mark(); c.mark();
    expect(calls).toEqual(['mark:a']);
  });

  it('goes away by itself, and sooner if nobody touches it', () => {
    const { c, clock, arm } = setup();
    arm();
    c.offer('a');
    clock.advance(OFFER_MS - 1);
    expect(c.getState().offer).not.toBeNull();
    clock.advance(1);
    expect(c.getState().offer).toBeNull();
    expect(clock.pending()).toBe(0);
  });

  it('after marking, Undo stays for a few seconds and then the toast goes', () => {
    const { c, clock, arm } = setup();
    arm();
    c.offer('a');
    c.mark();
    clock.advance(MARKED_MS - 1);
    expect(c.getState().offer?.phase).toBe('marked');
    clock.advance(1);
    expect(c.getState().offer).toBeNull();
  });

  it('a newer alarm replaces the offer and restarts the clock', () => {
    const { c, clock, arm } = setup();
    arm();
    c.offer('a');
    clock.advance(OFFER_MS - 1000);
    c.offer('b');
    expect(c.getState().offer).toEqual({ eventId: 'b', phase: 'offered' });
    clock.advance(OFFER_MS - 1);
    expect(c.getState().offer?.eventId).toBe('b');
    clock.advance(1);
    expect(c.getState().offer).toBeNull();
  });

  it('dismiss closes it without marking', () => {
    const { c, calls, arm } = setup();
    arm();
    c.offer('a');
    c.dismiss();
    expect(c.getState().offer).toBeNull();
    expect(calls).toEqual([]);
  });

  it('every state can be left: dismiss works offered and marked, and disarm clears everything', () => {
    const { c, clock, arm } = setup();
    arm();
    c.offer('a'); c.mark(); c.dismiss();
    expect(c.getState().offer).toBeNull();
    c.offer('b');
    c.disarm();
    expect(c.getState()).toEqual({ armed: false, offer: null });
    expect(clock.pending()).toBe(0);
  });

  it('a handler that throws cannot break it: the offer still moves on', () => {
    const { c, arm } = setup({ mark: () => { throw new Error('store broke'); }, undo: () => { throw new Error('store broke'); } });
    arm();
    c.offer('a');
    expect(() => c.mark()).not.toThrow();
    expect(c.getState().offer?.phase).toBe('marked');
    expect(() => c.undo()).not.toThrow();
    expect(c.getState().offer).toBeNull();
  });

  it('after the very first mark the toast can suggest the calibration, and opening it closes the toast', () => {
    const { c, calls, arm } = setup({ mark: () => ({ suggestCalibration: true }) });
    arm();
    c.offer('a');
    c.mark();
    expect(c.getState().offer).toEqual({ eventId: 'a', phase: 'marked', suggestCalibration: true });
    c.calibrate();
    expect(calls).toEqual(['calibrate']);
    expect(c.getState().offer).toBeNull();
  });

  it('a suggestion stays long enough to read', () => {
    const { c, clock, arm } = setup({ mark: () => ({ suggestCalibration: true }) });
    arm();
    c.offer('a'); c.mark();
    clock.advance(MARKED_MS + 1);
    expect(c.getState().offer).not.toBeNull();
    clock.advance(MARKED_MS);
    expect(c.getState().offer).toBeNull();
  });

  it('tells listeners about each change, and a listener that throws does not stop the others', () => {
    const { c, arm } = setup();
    const seen = vi.fn();
    c.subscribe(() => { throw new Error('bad listener'); });
    c.subscribe(seen);
    arm();
    c.offer('a');
    expect(seen).toHaveBeenCalled();
  });
});
