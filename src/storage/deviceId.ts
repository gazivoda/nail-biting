// A stable, random identifier for this browser profile, generated once and
// persisted. It labels events (`HabitEvent.deviceId`) so sync can tell devices
// apart. It identifies a browser profile, not a person, and carries no personal
// data. If storage is unavailable the id lives for the page load only.

import { kv } from './kv';

const KEY = 'device-id';
let inMemory: string | null = null;

function generate(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Non-secure contexts have no randomUUID. This id is a label, not a secret.
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId(): string {
  const stored = kv.get<string | null>('app', KEY, null);
  if (typeof stored === 'string' && stored !== '') return stored;
  if (inMemory) {
    kv.set('app', KEY, inMemory); // storage may have recovered; try again
    return inMemory;
  }
  inMemory = generate();
  kv.set('app', KEY, inMemory);
  return inMemory;
}

/** Tests only: forget the in-memory copy so a swapped adapter is honoured. */
export function resetDeviceIdCacheForTests(): void {
  inMemory = null;
}
