// The landing demo's 60-second session, kept out of the HeroDemo component so
// the timing and counting rules can be exercised without a camera, MediaPipe, or
// React. It owns no clock of its own: every event carries the `now` it happened
// at, which is what makes the expiry boundary testable to the millisecond.

/** How long one demo session runs — also the countdown's starting value. */
export const DEMO_DURATION_MS = 60_000;

export type DemoPhase = 'idle' | 'running' | 'finished';

export interface SessionState {
  phase: DemoPhase;
  /** When the current session began; null until the first `start`. */
  startedAt: number | null;
  catches: number;
}

export type SessionEvent =
  | { type: 'start'; now: number }
  | { type: 'catch' }
  | { type: 'tick'; now: number }
  | { type: 'reset' };

export const initialSession: SessionState = {
  phase: 'idle',
  startedAt: null,
  catches: 0,
};

/**
 * Pure reducer — never mutates `state`, and hands back the *same* reference for
 * a genuine no-op. That matters here: the 250 ms tick fires ~240 times per
 * session and only one of them changes anything, so every other dispatch should
 * cost React nothing.
 */
export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    // Start is valid from any phase, including `finished`: "Run it again" goes
    // straight here with no reset in between, so the count must clear on start
    // rather than on reset.
    case 'start':
      return { phase: 'running', startedAt: event.now, catches: 0 };

    // useDetection dedupes per episode but can still fire a trailing alert after
    // the session expired and the camera was torn down. Counting it would show a
    // number the countdown never displayed, so an out-of-phase catch is dropped.
    case 'catch':
      return state.phase === 'running'
        ? { ...state, catches: state.catches + 1 }
        : state;

    case 'tick': {
      // The null check is for the compiler's benefit — a running session always
      // carries a `startedAt` — but it also stops a hand-built state from
      // finishing on NaN arithmetic.
      if (state.phase !== 'running' || state.startedAt === null) return state;
      // `>=`, not `>`: a tick landing exactly on the boundary ends the session.
      if (event.now - state.startedAt < DEMO_DURATION_MS) return state;
      return { ...state, phase: 'finished' };
    }

    // The constant doubles as the reset result, so consecutive resets are
    // reference-stable. Safe to share because nothing here ever mutates state.
    case 'reset':
      return initialSession;
  }
}

/**
 * Milliseconds left on the clock, clamped to `[0, DEMO_DURATION_MS]`.
 *
 * The clamp is not defensive noise: the countdown renders straight from this.
 * A backgrounded tab can skip the tick that would have ended the session, and a
 * system clock adjustment can hand back a `now` that predates `startedAt` —
 * unclamped, those render as a negative time or a countdown above 1:00.
 */
export function remainingMs(state: SessionState, now: number): number {
  if (state.phase === 'finished') return 0;
  if (state.phase === 'idle' || state.startedAt === null) return DEMO_DURATION_MS;

  const left = DEMO_DURATION_MS - (now - state.startedAt);
  return Math.min(DEMO_DURATION_MS, Math.max(0, left));
}
