// Shared test helpers for anything that persists (src/storage/*, the app store).
// Not part of the app bundle: nothing under src/ imports from here except test
// files, so Vite never includes it.

import { createMemoryAdapter, setStorageAdapter, type StorageAdapter } from '../src/storage/adapter';

export { createMemoryAdapter } from '../src/storage/adapter';
export type { StorageAdapter } from '../src/storage/adapter';

/**
 * An in-memory adapter whose failures can be switched on, to test the "storage
 * is full / blocked" paths. `failWrites` can be a boolean or a predicate on the
 * key, e.g. to refuse only the backup key.
 */
export function createFlakyAdapter(initial: Record<string, string> = {}) {
  const inner = createMemoryAdapter(initial);
  const control = {
    failReads: false as boolean,
    failWrites: false as boolean | ((key: string) => boolean),
    writes: [] as string[],
  };
  const adapter: StorageAdapter = {
    getItem(key) {
      if (control.failReads) throw new Error('storage read blocked');
      return inner.getItem(key);
    },
    setItem(key, value) {
      const fail = typeof control.failWrites === 'function' ? control.failWrites(key) : control.failWrites;
      if (fail) throw new DOMException('quota exceeded', 'QuotaExceededError');
      control.writes.push(key);
      inner.setItem(key, value);
    },
    removeItem(key) { inner.removeItem(key); },
    keys: () => inner.keys!(),
  };
  return { adapter, control, inner };
}

/** Installs a fresh in-memory adapter as the app's storage and returns it. */
export function useMemoryStorage(initial: Record<string, string> = {}): StorageAdapter {
  const adapter = createMemoryAdapter(initial);
  setStorageAdapter(adapter);
  return adapter;
}

/** Puts the real detection back (call from afterEach). */
export function resetStorage(): void {
  setStorageAdapter(null);
}
