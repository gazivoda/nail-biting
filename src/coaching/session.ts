// The competing-response session as a pure state machine (WS2). No DOM, no
// React, no store, no clock: every function takes `now`, so the whole life of
// the prompt is tested in node (session.test.ts).
//
//   idle --offer--> running --tick(time up)-----> finished --tick(+2.5 s)--> idle
//                      |   \--complete (Done)---> finished
//                      \------skip (Skip/Esc)---> idle
//
// What it guarantees, and why the overlay can never get in the way:
//  - Nothing here starts, stops, delays or waits for the alarm. The alarm is
//    sounded by useDetection before the history changes; this machine only
//    ever hears about the alarm afterwards (see CoachingBridge).
//  - `skip` works from every state and always ends in `idle`. There is no state
//    that Skip, Escape, or the passing of time cannot leave.
//  - Each offer produces at most ONE result (the patch that is saved on the
//    alarm's event). A second Done, a late timer or Escape after Done produces
//    none, so a result can never be saved twice.
//  - A clock that jumps backwards cannot lock the prompt open: elapsed time is
//    clamped to [0, duration], and a `finished` card that looks "from the
//    future" is dismissed.

/** What gets stored on the alarm's event (HabitEvent.competingResponse). */
export interface CoachingPatch {
  done: boolean;
  durationSec: number;
}

export interface CoachingResult {
  eventId: string;
  patch: CoachingPatch;
}

export interface CoachingOffer {
  /** The event the result will be saved on. */
  eventId: string;
  /** The competing response, in the person's words. */
  text: string;
  /** Length of the countdown, in whole seconds. */
  durationSec: number;
}

export type CoachingSession =
  | { phase: 'idle' }
  | { phase: 'running'; eventId: string; text: string; durationSec: number; startedAt: number }
  | { phase: 'finished'; eventId: string; text: string; durationSec: number; finishedAt: number };

export interface Transition {
  session: CoachingSession;
  /** Present exactly when this transition ended a running session. */
  result?: CoachingResult;
}

export const IDLE: CoachingSession = { phase: 'idle' };

/** How long the calm "Done" confirmation stays before the card goes away. */
export const CONFIRMATION_MS = 2500;

export const MIN_DURATION_SEC = 15;
export const MAX_DURATION_SEC = 60;
export const DEFAULT_DURATION_SEC = 30;

/** A whole number of seconds in [15, 60]; anything unusable becomes the default. */
export function clampDuration(sec: unknown): number {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return DEFAULT_DURATION_SEC;
  return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, Math.round(sec)));
}

export const isRunning = (s: CoachingSession): s is Extract<CoachingSession, { phase: 'running' }> =>
  s.phase === 'running';

/** Starts a session. Ignored (returns the same session) while one is running; replaces the "Done" card. */
export function offer(session: CoachingSession, o: CoachingOffer, now: number): CoachingSession {
  if (session.phase === 'running') return session;
  const durationSec = Math.max(1, Math.round(o.durationSec));
  return { phase: 'running', eventId: o.eventId, text: o.text, durationSec, startedAt: now };
}

/** Milliseconds elapsed since the start, clamped to [0, duration]. */
export function elapsedMs(session: CoachingSession, now: number): number {
  if (session.phase !== 'running') return 0;
  return Math.min(session.durationSec * 1000, Math.max(0, now - session.startedAt));
}

export function remainingMs(session: CoachingSession, now: number): number {
  if (session.phase !== 'running') return 0;
  return session.durationSec * 1000 - elapsedMs(session, now);
}

/** Seconds left, rounded up (so the ring shows "1" until the last instant, never "0" while running). */
export function remainingSec(session: CoachingSession, now: number): number {
  return Math.ceil(remainingMs(session, now) / 1000);
}

/** 0 at the start, 1 when the time is up. */
export function progress(session: CoachingSession, now: number): number {
  if (session.phase !== 'running') return session.phase === 'finished' ? 1 : 0;
  return elapsedMs(session, now) / (session.durationSec * 1000);
}

function finish(s: Extract<CoachingSession, { phase: 'running' }>, now: number, patch: CoachingPatch): Transition {
  return {
    session: { phase: 'finished', eventId: s.eventId, text: s.text, durationSec: s.durationSec, finishedAt: now },
    result: { eventId: s.eventId, patch },
  };
}

/**
 * Advances time. Running and out of time: the full duration was spent, so it is
 * done. Finished and the confirmation has been up long enough (or the clock
 * went backwards): back to idle.
 */
export function tick(session: CoachingSession, now: number): Transition {
  if (session.phase === 'running') {
    if (now - session.startedAt >= session.durationSec * 1000) {
      return finish(session, now, { done: true, durationSec: session.durationSec });
    }
    return { session };
  }
  if (session.phase === 'finished') {
    const age = now - session.finishedAt;
    if (age >= CONFIRMATION_MS || age < 0) return { session: IDLE };
  }
  return { session };
}

/** "Done": the person did it. Saved with the seconds actually spent. */
export function complete(session: CoachingSession, now: number): Transition {
  if (session.phase !== 'running') return { session };
  return finish(session, now, { done: true, durationSec: Math.round(elapsedMs(session, now) / 1000) });
}

/**
 * "Skip" / Escape. From `running` it saves "not done" (with the seconds spent)
 * and goes straight to idle. From `finished` it just closes the card. From idle
 * it does nothing. This is the dismissal that can never be refused.
 */
export function skip(session: CoachingSession, now: number): Transition {
  if (session.phase === 'running') {
    return {
      session: IDLE,
      result: { eventId: session.eventId, patch: { done: false, durationSec: Math.round(elapsedMs(session, now) / 1000) } },
    };
  }
  return { session: IDLE };
}
