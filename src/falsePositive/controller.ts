// The "Not a bite" offer shown after an alarm (WS3), as a small shared state machine.
//
// One module-level controller, so the toast in the main window and the button in the minimized
// (Picture-in-Picture) window show the SAME offer: tapping in one settles both.
//
// Like the coaching controller (src/coaching/controller.ts) this file is deliberately free of the app
// store, the storage module and the feature flags. AlertOverlay mounts a seam that reads it, and the
// landing-page demo renders AlertOverlay too: the demo must never pull the store into its bundle.
// The controller stays "disarmed" until the app's FalsePositiveBridge arms it with the two actions
// (flag on, signed-in app), so in the demo, or with the flag off, the seam renders nothing.
//
//   idle --offer--> offered --mark--> marked --undo--> idle
//                      |                |
//                      +--timeout/dismiss+--> idle
//
// It never touches the alarm: it hears about an alarm after the history changed, which is after the
// sound started (see CoachingBridge for the same argument), and every state can be left by doing nothing.

export type OfferPhase = 'offered' | 'marked';

export interface NotABiteOffer {
  /** The History entry the alarm created. */
  eventId: string;
  phase: OfferPhase;
  /** Set once, after the very first "Not a bite": the toast also offers the optional calibration. Never forced. */
  suggestCalibration?: boolean;
}

export interface NotABiteState {
  /** True only while the app's FalsePositiveBridge is mounted (flag on). Disarmed = invisible. */
  armed: boolean;
  offer: NotABiteOffer | null;
}

export interface NotABiteHandlers {
  /** Marks the entry "Not a bite". May answer that the calibration should be offered (the first time only). */
  mark(eventId: string): void | { suggestCalibration?: boolean };
  /** Takes the mark off again. */
  undo(eventId: string): void;
  /** Opens the optional calibration. */
  calibrate?(): void;
}

/** How long the offer stays after an alarm. Long enough to reach for the mouse, short enough not to pile up. */
export const OFFER_MS = 15_000;
/** How long "Undo" stays after the entry was marked. */
export const MARKED_MS = 8_000;

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface NotABiteController {
  getState(): NotABiteState;
  subscribe(fn: () => void): () => void;
  /** An alarm just created this entry. Replaces any offer still showing. Ignored while disarmed. */
  offer(eventId: string): void;
  /** The "Not a bite" button. */
  mark(): void;
  /** The "Undo" button. */
  undo(): void;
  /** The "Calibrate" button the toast shows once, after the first "Not a bite". */
  calibrate(): void;
  /** The close button (or anything else that should just make the offer go away). */
  dismiss(): void;
  arm(handlers: NotABiteHandlers): void;
  disarm(): void;
}

export function createNotABiteController(timers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: h => clearTimeout(h as ReturnType<typeof setTimeout>) }): NotABiteController {
  let state: NotABiteState = { armed: false, offer: null };
  let handlers: NotABiteHandlers | null = null;
  let timer: unknown = null;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* a listener must not break the others */ } });
  const clearTimer = () => { if (timer !== null) { timers.clear(timer); timer = null; } };
  const set = (next: NotABiteState) => { state = next; emit(); };
  const expireIn = (ms: number) => {
    clearTimer();
    timer = timers.set(() => { timer = null; if (state.offer) set({ ...state, offer: null }); }, ms);
  };

  return {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    offer(eventId) {
      if (!state.armed) return;
      set({ ...state, offer: { eventId, phase: 'offered' } });
      expireIn(OFFER_MS);
    },
    mark() {
      const offer = state.offer;
      if (!state.armed || !offer || offer.phase !== 'offered') return;
      let suggestCalibration = false;
      try { suggestCalibration = handlers?.mark(offer.eventId)?.suggestCalibration === true; } catch { /* the entry stays as it was; the offer closes below */ }
      set({ ...state, offer: { eventId: offer.eventId, phase: 'marked', ...(suggestCalibration ? { suggestCalibration: true } : {}) } });
      // A suggestion to calibrate stays long enough to read and decide.
      expireIn(suggestCalibration ? MARKED_MS * 2 : MARKED_MS);
    },
    undo() {
      const offer = state.offer;
      if (!state.armed || !offer || offer.phase !== 'marked') return;
      clearTimer();
      try { handlers?.undo(offer.eventId); } catch { /* ignored */ }
      set({ ...state, offer: null });
    },
    calibrate() {
      if (!state.armed || !state.offer) return;
      clearTimer();
      try { handlers?.calibrate?.(); } catch { /* ignored */ }
      set({ ...state, offer: null });
    },
    dismiss() {
      if (!state.offer) return;
      clearTimer();
      set({ ...state, offer: null });
    },
    arm(next) {
      handlers = next;
      if (!state.armed) set({ ...state, armed: true });
    },
    disarm() {
      clearTimer();
      handlers = null;
      if (state.armed || state.offer) set({ armed: false, offer: null });
    },
  };
}

/** The one shared by the main window's toast, the minimized window's button and the bridge. */
export const notABite = createNotABiteController();
