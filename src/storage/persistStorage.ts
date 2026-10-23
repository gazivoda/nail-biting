// The storage object handed to zustand's `persist` middleware for the app store
// ('stop-biting-state'). It is a thin wrapper over the storage adapter with two
// jobs the default `createJSONStorage(() => localStorage)` does not do:
//
//  1. SAFETY NET BEFORE A MIGRATION. When the stored payload is older than the
//     current schema version, the raw JSON string is copied to a separate
//     backup key BEFORE zustand runs `migrate` and writes the upgraded state.
//     Once, never overwritten, never throwing. This is the only place the raw
//     string is visible: `migrate` receives the already-parsed state.
//  2. NEVER THROW. A full quota or a blocked write is swallowed (the in-memory
//     state stays correct; that history just isn't saved), and an unreadable
//     payload is preserved under a separate key instead of being silently
//     replaced by the next write.
//
// Reads and writes still go through src/storage/adapter.ts, so tests can inject
// an in-memory adapter.

import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { readRaw, writeRaw, removeRaw } from './adapter';

export type BackupStatus = 'none' | 'written' | 'exists' | 'failed';

let lastBackup: { status: BackupStatus; key: string | null; fromVersion: number | null } = {
  status: 'none',
  key: null,
  fromVersion: null,
};
let lastWriteFailed = false;

/** What the last load did about the pre-migration backup. For diagnostics and tests. */
export function lastBackupResult() {
  return { ...lastBackup };
}

/** True when the most recent state write was dropped (quota / blocked storage). */
export function lastStateWriteFailed(): boolean {
  return lastWriteFailed;
}

/** Every payload written by a version before v2 lives under the v1 key. */
export function backupKeyFor(name: string, storedVersion: number): string {
  return `${name}-v${Math.max(1, Math.floor(storedVersion))}-backup`;
}

export function corruptKeyFor(name: string): string {
  return `${name}-corrupt-backup`;
}

/** Copies `raw` to `key` unless something is already there. Returns what happened. */
function copyOnce(key: string, raw: string): BackupStatus {
  try {
    if (readRaw(key) !== null) return 'exists';
    return writeRaw(key, raw) ? 'written' : 'failed';
  } catch {
    return 'failed';
  }
}

export function createStatePersistStorage<S>(currentVersion: number): PersistStorage<S> {
  return {
    getItem(name): StorageValue<S> | null {
      const raw = readRaw(name);
      if (raw === null) return null;

      let parsed: StorageValue<S>;
      try {
        parsed = JSON.parse(raw) as StorageValue<S>;
      } catch {
        // Keep what we could not read; the next write would replace it.
        copyOnce(corruptKeyFor(name), raw);
        return null;
      }

      const stored = parsed?.version;
      if (typeof stored === 'number' && stored < currentVersion) {
        const key = backupKeyFor(name, stored);
        lastBackup = { status: copyOnce(key, raw), key, fromVersion: stored };
        if (lastBackup.status === 'failed') {
          console.warn(`[storage] could not write ${key}; migrating without a backup copy`);
        }
      }
      return parsed;
    },

    setItem(name, value) {
      lastWriteFailed = !writeRaw(name, JSON.stringify(value));
    },

    removeItem(name) {
      removeRaw(name);
    },
  };
}
