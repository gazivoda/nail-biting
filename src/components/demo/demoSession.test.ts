import { describe, it, expect } from 'vitest';
import {
  DEMO_DURATION_MS,
  initialSession,
  remainingMs,
  sessionReducer,
  type SessionEvent,
  type SessionState,
} from './demoSession';

// An arbitrary non-zero epoch — nothing here may assume the clock starts at 0.
const T0 = 1_700_000_000_000;

const CATCH: SessionEvent = { type: 'catch' };
const RESET: SessionEvent = { type: 'reset' };
const start = (now: number): SessionEvent => ({ type: 'start', now });
const tick = (now: number): SessionEvent => ({ type: 'tick', now });

/** Fold a sequence of events over the reducer. */
function run(from: SessionState, ...events: SessionEvent[]): SessionState {
  return events.reduce(sessionReducer, from);
}

/** A session that started at T0 and has already expired. */
const expired = (...events: SessionEvent[]) =>
  run(initialSession, start(T0), ...events, tick(T0 + DEMO_DURATION_MS));

describe('sessionReducer', () => {
  it('starts idle with nothing counted', () => {
    expect(initialSession).toEqual({ phase: 'idle', startedAt: null, catches: 0 });
  });

  it('runs from the moment start is dispatched', () => {
    expect(run(initialSession, start(T0))).toEqual({
      phase: 'running',
      startedAt: T0,
      catches: 0,
    });
  });

  it('accumulates catches while running', () => {
    const state = run(initialSession, start(T0), CATCH, CATCH, CATCH);
    expect(state).toEqual({ phase: 'running', startedAt: T0, catches: 3 });
  });

  it('ignores a catch before the session has started', () => {
    const state = sessionReducer(initialSession, CATCH);
    expect(state.catches).toBe(0);
    expect(state).toBe(initialSession); // no-op, so nothing to re-render
  });

  // useDetection can fire a trailing alert after the session expired and the
  // camera was torn down. Counting it would show the visitor a total the
  // 60-second countdown never displayed.
  it('ignores a catch that arrives after the session finished', () => {
    const finished = expired(CATCH);
    expect(finished.phase).toBe('finished');

    const after = sessionReducer(finished, CATCH);
    expect(after.catches).toBe(1);
    expect(after).toBe(finished);
  });

  it('finishes at exactly DEMO_DURATION_MS', () => {
    const running = run(initialSession, start(T0));

    expect(sessionReducer(running, tick(T0 + DEMO_DURATION_MS - 1)).phase).toBe('running');
    expect(sessionReducer(running, tick(T0 + DEMO_DURATION_MS)).phase).toBe('finished');
    expect(sessionReducer(running, tick(T0 + DEMO_DURATION_MS + 5_000)).phase).toBe('finished');
  });

  it('returns the same state object for a tick before expiry', () => {
    const running = run(initialSession, start(T0), CATCH);
    expect(sessionReducer(running, tick(T0 + 250))).toBe(running);
    expect(sessionReducer(running, tick(T0 + DEMO_DURATION_MS - 1))).toBe(running);
  });

  it('ignores ticks outside a running session', () => {
    expect(sessionReducer(initialSession, tick(T0 + DEMO_DURATION_MS))).toBe(initialSession);

    const finished = expired();
    expect(sessionReducer(finished, tick(T0 + DEMO_DURATION_MS * 2))).toBe(finished);
  });

  it('keeps the catch count when the session expires', () => {
    expect(expired(CATCH, CATCH)).toEqual({
      phase: 'finished',
      startedAt: T0,
      catches: 2,
    });
  });

  // "Run it again" dispatches start directly, with no reset in between.
  it('restarting a finished session clears both the phase and the count', () => {
    const restarted = sessionReducer(expired(CATCH, CATCH), start(T0 + 90_000));
    expect(restarted).toEqual({ phase: 'running', startedAt: T0 + 90_000, catches: 0 });
  });

  it('restarting mid-session clears the count too', () => {
    const running = run(initialSession, start(T0), CATCH, CATCH);
    expect(sessionReducer(running, start(T0 + 1_000))).toEqual({
      phase: 'running',
      startedAt: T0 + 1_000,
      catches: 0,
    });
  });

  it('reset returns to the initial state', () => {
    expect(sessionReducer(run(initialSession, start(T0), CATCH), RESET)).toEqual(initialSession);
    expect(sessionReducer(expired(CATCH), RESET)).toEqual(initialSession);
    expect(sessionReducer(initialSession, RESET)).toBe(initialSession);
  });

  it('never mutates the state it is given', () => {
    const running = Object.freeze(run(initialSession, start(T0), CATCH));
    const before = { ...running };
    const events: SessionEvent[] = [start(T0 + 1), CATCH, tick(T0 + DEMO_DURATION_MS), RESET];

    // Modules run in strict mode, so any write to a frozen object throws here.
    for (const event of events) {
      expect(() => sessionReducer(running, event)).not.toThrow();
    }
    expect(running).toEqual(before);
  });
});

describe('remainingMs', () => {
  it('offers the full duration before the session starts', () => {
    expect(remainingMs(initialSession, T0)).toBe(DEMO_DURATION_MS);
  });

  it('counts down while running', () => {
    const running = run(initialSession, start(T0));
    expect(remainingMs(running, T0)).toBe(DEMO_DURATION_MS);
    expect(remainingMs(running, T0 + 23_000)).toBe(DEMO_DURATION_MS - 23_000);
    expect(remainingMs(running, T0 + DEMO_DURATION_MS - 1)).toBe(1);
  });

  it('clamps to zero and never returns a negative number', () => {
    const running = run(initialSession, start(T0));
    expect(remainingMs(running, T0 + DEMO_DURATION_MS)).toBe(0);
    // A backgrounded tab skips the tick that would have ended the session, so
    // remainingMs can be asked about a running state long past its expiry.
    expect(remainingMs(running, T0 + 600_000)).toBe(0);
  });

  // A system clock adjustment can hand back a `now` that predates `startedAt`.
  // Unclamped, the countdown would render above 1:00.
  it('clamps to the full duration if the clock runs backwards', () => {
    const running = run(initialSession, start(T0));
    expect(remainingMs(running, T0 - 5_000)).toBe(DEMO_DURATION_MS);
  });

  it('is zero once the session has finished', () => {
    const finished = expired();
    expect(remainingMs(finished, T0 + DEMO_DURATION_MS)).toBe(0);
    // Even asked about a moment before expiry — finished means finished.
    expect(remainingMs(finished, T0)).toBe(0);
  });
});
