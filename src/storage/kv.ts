// A small typed key-value area for everything that is not event history and not
// one of the core settings in the app store: per-workstream preferences, caches,
// "last seen" markers. Keys are namespaced so workstreams cannot collide:
//
//     sb:<namespace>:<key>
//
// Values are JSON. Reads never throw (a missing, unreadable or corrupt value
// returns the fallback) and writes never throw (they return false when storage
// refused). Backed by src/storage/adapter.ts, so it works in node tests with an
// injected adapter and keeps working in a private window (in memory).
//
// This module is deliberately light: it imports nothing but the adapter, so a
// marketing page can read a flag without pulling the app store into its bundle.

import { readRaw, writeRaw, removeRaw, listRawKeys } from './adapter';

/**
 * One namespace per area of the product. Add a name here (a one-line change)
 * when a workstream needs a new one; do not write keys outside the scheme.
 */
export const KV_NAMESPACES = [
  'app',           // WS0: device id, storage bookkeeping; WS14: first-alarm-sent marker
  'flags',         // WS0: last-known feature flags, dev overrides
  'detection',     // WS1: monitored behaviours, per-rule settings
  'falsePositive', // WS3: learned poses, calibration, hand filter
  'hrt',           // WS2: competing responses, program progress, urge timer
  'sync',          // WS4: opt-in, cursor, queue, last sync time
  'insights',      // WS5: milestones seen, photo diary metadata
  'phone',         // WS6: companion preferences
  'background',    // WS7a: schedules, pause state
  'desktop',       // WS7b: desktop wrapper preferences
  'auth',          // WS8: sign-in hints (never tokens)
  'billing',       // WS9: referral code seen, plan hints
  'share',         // WS10: share-link list cache
  'marketing',     // WS11: dismissed banners
  'i18n',          // WS12: chosen locale
] as const;
export type KvNamespace = (typeof KV_NAMESPACES)[number];

const PREFIX = 'sb:';

export function kvKey(ns: KvNamespace, key: string): string {
  return `${PREFIX}${ns}:${key}`;
}

const listeners = new Map<string, Set<() => void>>();

function notify(fullKey: string) {
  listeners.get(fullKey)?.forEach(fn => {
    try { fn(); } catch { /* a listener must not break a write */ }
  });
}

export const kv = {
  /** The stored value, or `fallback` when absent, unreadable or not valid JSON. */
  get<T>(ns: KvNamespace, key: string, fallback: T): T {
    const raw = readRaw(kvKey(ns, key));
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  /** Returns false when the value could not be stored (quota, blocked storage). */
  set<T>(ns: KvNamespace, key: string, value: T): boolean {
    let json: string | undefined;
    try {
      json = JSON.stringify(value);
    } catch {
      return false; // circular / BigInt: refuse rather than throw
    }
    if (json === undefined) return false; // undefined / function: nothing to store
    const full = kvKey(ns, key);
    const ok = writeRaw(full, json);
    notify(full); // listeners are told even if the write was not persisted
    return ok;
  },

  remove(ns: KvNamespace, key: string): void {
    const full = kvKey(ns, key);
    removeRaw(full);
    notify(full);
  },

  /** Keys (without the prefix) currently stored in a namespace. */
  keys(ns: KvNamespace): string[] {
    const p = `${PREFIX}${ns}:`;
    return listRawKeys().filter(k => k.startsWith(p)).map(k => k.slice(p.length));
  },

  /** Calls `fn` after every set/remove of this key made in this page. Returns an unsubscribe. */
  subscribe(ns: KvNamespace, key: string, fn: () => void): () => void {
    const full = kvKey(ns, key);
    let set = listeners.get(full);
    if (!set) listeners.set(full, (set = new Set()));
    set.add(fn);
    return () => { set.delete(fn); };
  },
};
