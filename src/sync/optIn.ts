// The person's choice to sync, and the small local facts about it. Light on
// purpose (kv only: no store, no React), because SyncHost reads it on every page
// load of the signed-in app and must cost nothing when nobody opted in.
//
// The choice belongs to one account: `userId`. If a different person signs in on
// this browser, sync is OFF for them until they switch it on themselves, so one
// person's history can never be uploaded into another person's account by
// accident.

import { kv } from '../storage/kv';
import type { SyncKvPort } from './types';

const NS = 'sync' as const;
const OPT_IN = 'optin';
const NOTICE = 'notice';
const DEVICE_NAME = 'device-name';

export interface SyncOptIn {
  userId: string;
  /** When the person switched sync on (epoch ms). */
  at: number;
}

/** Why sync was switched off without the person asking, for a one-time message in Settings. */
export type SyncNotice = 'server_reset';

/** The engine's own keys (cursor, acknowledged versions) in the "sync" namespace of kv. */
export const syncKv: SyncKvPort = {
  get: (key, fallback) => kv.get(NS, key, fallback),
  set: (key, value) => kv.set(NS, key, value),
  remove: key => kv.remove(NS, key),
};

export function getSyncOptIn(): SyncOptIn | null {
  const v = kv.get<SyncOptIn | null>(NS, OPT_IN, null);
  return v && typeof v.userId === 'string' && v.userId !== '' ? v : null;
}

/** The account that opted in, or null. A primitive, so it works as a React snapshot. */
export function getOptedInUserId(): string | null {
  return getSyncOptIn()?.userId ?? null;
}

export function setSyncOptIn(userId: string, now: number = Date.now()): void {
  kv.remove(NS, NOTICE);
  kv.set(NS, OPT_IN, { userId, at: now } satisfies SyncOptIn);
}

export function clearSyncOptIn(): void {
  kv.remove(NS, OPT_IN);
}

export function subscribeSyncOptIn(fn: () => void): () => void {
  return kv.subscribe(NS, OPT_IN, fn);
}

export function getSyncNotice(): SyncNotice | null {
  const n = kv.get<SyncNotice | null>(NS, NOTICE, null);
  return n === 'server_reset' ? n : null;
}

export function setSyncNotice(n: SyncNotice | null): void {
  if (n === null) kv.remove(NS, NOTICE);
  else kv.set(NS, NOTICE, n);
}

export function subscribeSyncNotice(fn: () => void): () => void {
  return kv.subscribe(NS, NOTICE, fn);
}

/** The label the person gave this browser, or null. It stays on the device. */
export function getStoredDeviceName(): string | null {
  const n = kv.get<string | null>(NS, DEVICE_NAME, null);
  return typeof n === 'string' && n.trim() !== '' ? n : null;
}

export function setDeviceName(name: string): void {
  const clean = name.trim().slice(0, 40);
  if (clean === '') kv.remove(NS, DEVICE_NAME);
  else kv.set(NS, DEVICE_NAME, clean);
}

export function subscribeDeviceName(fn: () => void): () => void {
  return kv.subscribe(NS, DEVICE_NAME, fn);
}

/**
 * Forgets everything sync keeps on this device: the opt-in, the cursor, the
 * acknowledged versions and notices (and the device label unless asked to keep
 * it). History is not touched.
 */
export function clearAllSyncState(opts: { keepDeviceName?: boolean } = {}): void {
  for (const key of kv.keys(NS)) {
    if (opts.keepDeviceName && key === DEVICE_NAME) continue;
    kv.remove(NS, key);
  }
}
