import { useSyncExternalStore } from 'react';
import { OFF_STATUS, getSyncStatus, subscribeSyncStatus } from './runtime';
import type { SyncStatus } from './types';

/** How sync is doing right now; `phase: 'off'` when it is not running. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, () => OFF_STATUS);
}
