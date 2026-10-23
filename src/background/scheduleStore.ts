// The person's schedule and the memory of which window was already reminded, kept in the storage module's
// key-value area (namespace `background`). Nothing here is synced, exported or sent anywhere.

import { kv } from '../storage/kv';
import { DEFAULT_SCHEDULE, normalizeSchedule, type Schedule } from './schedule';

const NS = 'background' as const;
const SCHEDULE_KEY = 'schedule';
const REMINDED_KEY = 'last-reminded';

export function loadSchedule(): Schedule {
  return normalizeSchedule(kv.get<unknown>(NS, SCHEDULE_KEY, DEFAULT_SCHEDULE));
}

export function saveSchedule(schedule: Schedule): boolean {
  return kv.set(NS, SCHEDULE_KEY, normalizeSchedule(schedule));
}

export function subscribeSchedule(fn: () => void): () => void {
  return kv.subscribe(NS, SCHEDULE_KEY, fn);
}

/** The id of the last window a reminder was shown for (see schedule.ts), or null. */
export function loadLastReminded(): string | null {
  const v = kv.get<unknown>(NS, REMINDED_KEY, null);
  return typeof v === 'string' ? v : null;
}

export function saveLastReminded(windowId: string): void {
  kv.set(NS, REMINDED_KEY, windowId);
}
