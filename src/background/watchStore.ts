// The one live copy of the pause / meeting state (WS7a): a tiny store around the pure machine in pauseMachine.ts.
//
// It is NOT the app store (useAppStore.ts): that persisted shape is frozen. This state is saved through the
// storage module's key-value area, namespace `background`, key `state`, so it survives a reload, and it is read
// from there once per page load (an expired or unreadable value starts the app running).
//
// Nothing in here touches the camera or the detector. Components and hooks read the state (useWatchGate) and the
// camera / detection follow it. Nothing is read or written until something calls getWatchState, and the
// callers only do so with the `background_watching` flag on.

import { kv } from '../storage/kv';
import { reduceWatch, restoreWatch, serializeWatch, type WatchEvent, type WatchState } from './pauseMachine';

const NS = 'background' as const;
const KEY = 'state';

let current: WatchState | null = null;
// When the state last changed (or was loaded). The words for a pause ("tomorrow 6:00 AM") are relative to this, so a
// component never has to read the clock while it renders.
let changedAt = 0;
const listeners = new Set<() => void>();

/** The state. The first call loads it from storage: an expired pause or meeting is gone by then. */
export function getWatchState(now: number = Date.now()): WatchState {
  if (current === null) {
    current = restoreWatch(kv.get<unknown>(NS, KEY, null), now);
    changedAt = now;
    // A value that expired (or was garbage) is cleaned up now, not left to be re-read next time.
    if (kv.get<unknown>(NS, KEY, null) !== null && current.kind === 'running') kv.remove(NS, KEY);
  }
  return current;
}

/** Applies one event. Saves only when something that is saved changed, and tells listeners only on a change. */
export function dispatchWatch(event: WatchEvent): WatchState {
  const before = getWatchState();
  const after = reduceWatch(before, event);
  if (after === before) return before;
  current = after;
  changedAt = Date.now();
  const wasSaved = JSON.stringify(serializeWatch(before));
  const nowSaved = JSON.stringify(serializeWatch(after));
  if (wasSaved !== nowSaved) {
    if (after.kind === 'paused' || after.kind === 'meeting') kv.set(NS, KEY, serializeWatch(after));
    else kv.remove(NS, KEY);
  }
  listeners.forEach((fn) => {
    try { fn(); } catch { /* one listener must not stop the others */ }
  });
  return after;
}

/** The time (epoch ms) the state last changed or was loaded. */
export function getWatchStamp(): number {
  getWatchState();
  return changedAt;
}

export function subscribeWatch(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Tests only: forget the loaded state so the next read loads from storage again (a "reload"). */
export function resetWatchForTests(): void {
  current = null;
  changedAt = 0;
  listeners.clear();
}
