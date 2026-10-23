// The one place the rest of the app can look to see whether sync is running and
// how it is doing. The controller reports the active engine here; the Settings
// card reads the status and can ask for a sync now. No React in this file.

import type { SyncEngine } from './engine';
import type { SyncOutcome, SyncStatus } from './types';

export const OFF_STATUS: SyncStatus = {
  phase: 'off', lastSyncedAt: null, pending: 0, retryAt: null, skipped: 0, lastCycle: null,
};

let active: SyncEngine | null = null;
let unsubscribeEngine: (() => void) | null = null;
let snapshot: SyncStatus = OFF_STATUS;
const listeners = new Set<() => void>();

function publish(next: SyncStatus) {
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
}

/** Called by the controller. */
export function setActiveEngine(engine: SyncEngine | null): void {
  unsubscribeEngine?.();
  unsubscribeEngine = null;
  active = engine;
  if (engine) {
    unsubscribeEngine = engine.subscribe(() => publish(engine.getStatus()));
    publish(engine.getStatus());
  } else {
    publish(OFF_STATUS);
  }
}

/** The running engine, if sync is on. */
export function getActiveEngine(): SyncEngine | null {
  return active;
}

export function getSyncStatus(): SyncStatus {
  return snapshot;
}

export function subscribeSyncStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Runs a sync right now if sync is running; otherwise does nothing. */
export function syncNowIfRunning(): Promise<SyncOutcome> {
  return active ? active.syncNow() : Promise.resolve<SyncOutcome>({ kind: 'skipped', why: 'stopped' });
}

/** Tests only. */
export function resetRuntimeForTests(): void {
  setActiveEngine(null);
  listeners.clear();
}
