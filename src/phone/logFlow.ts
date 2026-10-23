// What a tap does on the phone view (WS6). Pure: no React, no DOM, no storage
// import; everything it touches is passed in, so the rules are tested in node.
//
// The budget is TWO TAPS OR FEWER to log anything, and a mistaken log is one tap
// to undo:
//
//   I bit                  tap 1 logs it at once (tag "Not sure")
//     what set it off      tap 2 (optional) changes the tag on that same entry
//     Undo                 one tap removes the entry
//   I feel an urge         timer on:  tap 1 opens the choice, tap 2 (Start) logs
//                          it and runs the breathing timer (WS2's UrgeTimer)
//                          timer off: tap 1 logs it at once, Undo removes it
//
// Every write is a normal storage-module event (`events.add` / `update` /
// `softDelete`), so the sync engine treats it like any other and the streak
// code is untouched: a bite is a manual entry; an urge carries the `urge` tag
// and `isBite` ignores it.

/** The slice of the storage module's `events` the phone view uses. */
export interface PhoneEventsPort {
  add(input: { source: 'manual'; triggers: string[] }): { id: string };
  update(id: string, patch: { triggers: string[] }): unknown;
  softDelete(id: string): boolean;
}

/** Logged until the person says what set it off. Same marker the "Not sure" tag uses. */
export const DEFAULT_BITE_TRIGGER = 'unknown';

/** Two logs closer together than this are one accidental double tap, not two bites. */
export const DOUBLE_TAP_GUARD_MS = 800;
/** How long the confirmation (and its Undo) stays up. A tag tap restarts the shorter clock. */
export const TOAST_MS = 8000;
export const TOAST_AFTER_TAG_MS = 5000;

/** The most taps any way of logging may take. A test holds every flow to it. */
export const MAX_TAPS_TO_LOG = 2;

export type LogToast =
  | { kind: 'bite'; id: string; trigger: string }
  | { kind: 'urge'; id: string };

export interface LogFlowDeps {
  events: PhoneEventsPort;
  /** WS2's urge logging (src/coaching/urgeLog.ts): the same entry the timer writes. */
  urge: { log(): string; undo(id: string): void };
  now(): number;
  schedule(fn: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}

export interface LogFlow {
  getToast(): LogToast | null;
  subscribe(fn: () => void): () => void;
  /** Taps this flow has been given since it was created (for the budget test). */
  taps(): number;
  tapBite(): void;
  tapTrigger(trigger: string): void;
  tapUrge(): void;
  undo(): void;
  dismiss(): void;
}

export function createLogFlow(deps: LogFlowDeps): LogFlow {
  let toast: LogToast | null = null;
  let timer: unknown = null;
  let lastLogAt = Number.NEGATIVE_INFINITY;
  let taps = 0;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach(fn => fn());
  const clearTimer = () => {
    if (timer !== null) deps.cancel(timer);
    timer = null;
  };
  const show = (next: LogToast | null, ms = TOAST_MS) => {
    clearTimer();
    toast = next;
    if (next) timer = deps.schedule(() => { timer = null; toast = null; emit(); }, ms);
    emit();
  };

  return {
    getToast: () => toast,
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    taps: () => taps,

    tapBite() {
      taps++;
      const t = deps.now();
      if (t - lastLogAt < DOUBLE_TAP_GUARD_MS) return; // a double tap: the first one already logged it
      lastLogAt = t;
      const { id } = deps.events.add({ source: 'manual', triggers: [DEFAULT_BITE_TRIGGER] });
      show({ kind: 'bite', id, trigger: DEFAULT_BITE_TRIGGER });
    },

    tapTrigger(trigger) {
      taps++;
      if (!toast || toast.kind !== 'bite') return;
      deps.events.update(toast.id, { triggers: [trigger] });
      show({ kind: 'bite', id: toast.id, trigger }, TOAST_AFTER_TAG_MS);
    },

    tapUrge() {
      taps++;
      const t = deps.now();
      if (t - lastLogAt < DOUBLE_TAP_GUARD_MS) return;
      lastLogAt = t;
      show({ kind: 'urge', id: deps.urge.log() });
    },

    undo() {
      taps++;
      if (!toast) return;
      if (toast.kind === 'bite') deps.events.softDelete(toast.id);
      else deps.urge.undo(toast.id);
      lastLogAt = Number.NEGATIVE_INFINITY; // an undone log must not block the corrected one
      show(null);
    },

    dismiss() {
      show(null);
    },
  };
}
