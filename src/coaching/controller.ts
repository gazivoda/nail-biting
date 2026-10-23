// The live competing-response session shared by every surface (WS2).
//
// One module-level controller, so the overlay in the main window and the strip
// in the minimized (Picture-in-Picture) window render the SAME session: Done in
// one dismisses the other, and a result is saved once.
//
// This file is deliberately free of the app store, the storage facade and the
// flags. AlertOverlay (which the landing-page demo also renders) mounts a seam
// that reads this controller, and the demo must never pull the store into its
// bundle. The controller stays "disarmed" until CoachingBridge (app only)
// arms it, so in the demo, or with the flag off, the seam renders nothing.

import {
  IDLE, complete as sComplete, offer as sOffer, skip as sSkip, tick as sTick,
  CONFIRMATION_MS, type CoachingOffer, type CoachingResult, type CoachingSession, type Transition,
} from './session';

export interface ControllerState {
  /** True only while the app's CoachingBridge is mounted (flag on). Disarmed = invisible. */
  armed: boolean;
  session: CoachingSession;
}

export interface CoachingController {
  getState(): ControllerState;
  subscribe(fn: () => void): () => void;
  /** Starts a session unless one is running. Returns whether it started. */
  offer(o: CoachingOffer): boolean;
  complete(): void;
  skip(): void;
  /** Surfaces call this on their own timer too; idempotent. */
  tick(): void;
  /** Called with each session's single result. */
  setResultHandler(fn: ((r: CoachingResult) => void) | null): void;
  arm(): void;
  /** Disarms and drops any session without producing a result. */
  disarm(): void;
  /**
   * A surface (the overlay, the minimized strip) calls this while it is mounted
   * and calls the returned function when it goes away. With no surface mounted
   * nobody can see a prompt, so none is started; and if the last surface goes
   * away mid-session (the camera was stopped) the session is dropped with NO
   * result: a countdown nobody saw must not be counted as done.
   */
  attach(): () => void;
}

export function createCoachingController(now: () => number = Date.now): CoachingController {
  let state: ControllerState = { armed: false, session: IDLE };
  let handler: ((r: CoachingResult) => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let surfaces = 0;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* a listener must not break the others */ } });

  function schedule() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    const s = state.session;
    let wait: number | null = null;
    if (s.phase === 'running') wait = Math.max(0, s.startedAt + s.durationSec * 1000 - now());
    else if (s.phase === 'finished') wait = Math.max(0, s.finishedAt + CONFIRMATION_MS - now());
    // +20 ms so the timer never fires a hair before the deadline and has to reschedule.
    if (wait !== null) timer = setTimeout(() => { timer = null; apply(sTick(state.session, now())); }, wait + 20);
  }

  function apply(t: Transition) {
    const changed = t.session !== state.session;
    if (changed) state = { ...state, session: t.session };
    if (t.result && handler) {
      try { handler(t.result); } catch { /* saving must never break the prompt */ }
    }
    if (changed) { schedule(); emit(); }
  }

  return {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    offer(o) {
      if (!state.armed || surfaces === 0 || state.session.phase === 'running') return false;
      apply({ session: sOffer(state.session, o, now()) });
      return true;
    },
    complete() { apply(sComplete(state.session, now())); },
    skip() { apply(sSkip(state.session, now())); },
    tick() { apply(sTick(state.session, now())); },
    setResultHandler(fn) { handler = fn; },
    arm() {
      if (state.armed) return;
      state = { ...state, armed: true };
      emit();
    },
    disarm() {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (!state.armed && state.session === IDLE) return;
      state = { armed: false, session: IDLE };
      emit();
    },
    attach() {
      surfaces++;
      let attached = true;
      return () => {
        if (!attached) return;
        attached = false;
        surfaces--;
        if (surfaces === 0 && state.session !== IDLE) {
          if (timer !== null) { clearTimeout(timer); timer = null; }
          state = { ...state, session: IDLE }; // dropped: no result, nothing saved
          emit();
        }
      };
    },
  };
}

/** The one shared by the main overlay, the minimized window and the bridge. */
export const alarmCoaching: CoachingController = createCoachingController();
