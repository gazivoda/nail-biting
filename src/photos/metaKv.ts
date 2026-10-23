// The photo diary's metadata and reminder snooze, in kv('insights', ...). Light on
// purpose (kv only; no blob store, so no IndexedDB is opened): the History tab's
// reminder reads this and nothing heavier.

import { kv } from '../storage/kv';
import { META_KEY, SNOOZE_KEY, SNOOZE_MS, parseMeta, serializeMeta, type PhotoMeta } from './diaryMeta';

/** The kv port the store works against. Bound to one key so tests can swap it. */
export interface MetaPort {
  read(): PhotoMeta[];
  write(photos: readonly PhotoMeta[]): boolean;
  subscribe(fn: () => void): () => void;
}

export const kvMetaPort: MetaPort = {
  read: () => parseMeta(kv.get<unknown>('insights', META_KEY, null)),
  write: photos => kv.set('insights', META_KEY, serializeMeta(photos)),
  subscribe: fn => kv.subscribe('insights', META_KEY, fn),
};

export function readPhotoMeta(): PhotoMeta[] {
  return kvMetaPort.read();
}

export function subscribePhotoMeta(fn: () => void): () => void {
  return kvMetaPort.subscribe(fn);
}

/** Epoch ms until which the reminder is quiet, or null. */
export function readSnoozedUntil(): number | null {
  const v = kv.get<unknown>('insights', SNOOZE_KEY, null);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function snoozeReminder(now: number): void {
  kv.set('insights', SNOOZE_KEY, now + SNOOZE_MS);
}

export function subscribeSnooze(fn: () => void): () => void {
  return kv.subscribe('insights', SNOOZE_KEY, fn);
}
