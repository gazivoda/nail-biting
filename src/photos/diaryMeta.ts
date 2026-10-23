// The nail photo diary (WS5): what is remembered about each photo, and the rules about
// when the next one is due. Pure: no DOM, no React, no network, no storage calls of its
// own (the metadata lives in kv, the bytes in the local blob store; see photoStore.ts).
//
// LOCAL ONLY. Nothing in src/photos may import sync, export, auth or network code;
// scripts/photoGuard.test.mjs fails the build if it does.

const DAY = 24 * 60 * 60 * 1000;

/** IndexedDB collection (src/storage/blobs.ts) that holds the JPEG bytes. */
export const PHOTO_COLLECTION = 'photo-diary';
/** kv('insights', META_KEY): the list of PhotoMeta. */
export const META_KEY = 'photo-diary';
/** kv('insights', SNOOZE_KEY): epoch ms until which the in-app reminder stays quiet. */
export const SNOOZE_KEY = 'photo-reminder-snooze';

/** Two years of weekly photos. Past this the person deletes old ones; nothing is dropped for them. */
export const MAX_PHOTOS = 104;
/** A photo is due again once the newest one is this old. */
export const DUE_AFTER_MS = 7 * DAY;
/** "Not now" keeps the reminder quiet for this long. */
export const SNOOZE_MS = DAY;
/** Longest side of a saved photo, in pixels. */
export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.85;

/** What is remembered about one photo. Bytes are elsewhere; there is no name, place or note. */
export interface PhotoMeta {
  id: string;
  /** When the photo was taken, epoch ms. */
  takenAt: number;
  width: number;
  height: number;
  /** Size of the saved JPEG. */
  bytes: number;
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Newest first; ties keep a stable order by id. Returns a new array. */
export function sortNewestFirst(photos: readonly PhotoMeta[]): PhotoMeta[] {
  return [...photos].sort((a, b) => b.takenAt - a.takenAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Reads whatever kv holds, tolerating anything: wrong shapes, missing fields,
 * duplicates. Entries that are not usable are dropped (never repaired).
 * Accepts the stored `{ v: 1, photos: [...] }` or a bare array.
 */
export function parseMeta(raw: unknown): PhotoMeta[] {
  const list = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === 'object' && Array.isArray((raw as { photos?: unknown }).photos)
      ? (raw as { photos: unknown[] }).photos
      : [];
  const seen = new Set<string>();
  const out: PhotoMeta[] = [];
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    if (typeof m.id !== 'string' || m.id === '' || m.id.length > 80 || seen.has(m.id)) continue;
    if (!isNum(m.takenAt) || m.takenAt < 0) continue;
    if (!isNum(m.width) || !isNum(m.height) || m.width <= 0 || m.height <= 0) continue;
    const bytes = isNum(m.bytes) && m.bytes >= 0 ? m.bytes : 0;
    seen.add(m.id);
    out.push({ id: m.id, takenAt: m.takenAt, width: m.width, height: m.height, bytes });
  }
  return sortNewestFirst(out);
}

/** The stored form. */
export function serializeMeta(photos: readonly PhotoMeta[]): { v: 1; photos: PhotoMeta[] } {
  return { v: 1, photos: sortNewestFirst(photos) };
}

/**
 * Is a new photo due? Only for someone who has already started a diary (the empty
 * diary invites, it does not nag). Due when the newest photo is at least a week old.
 *
 * Clock safety: a newest photo dated in the future (the clock was set back) is never
 * due, and a snooze that reaches further than SNOOZE_MS ahead (the clock was set back
 * after snoozing) is ignored instead of silencing the reminder for months.
 */
export function isDue(photos: readonly PhotoMeta[], now: number, snoozedUntil: number | null = null): boolean {
  if (photos.length === 0) return false;
  let newest = photos[0].takenAt;
  for (const p of photos) if (p.takenAt > newest) newest = p.takenAt;
  const age = now - newest;
  if (age < 0 || age < DUE_AFTER_MS) return false;
  if (snoozedUntil !== null && now < snoozedUntil && snoozedUntil - now <= SNOOZE_MS) return false;
  return true;
}

/** Whole days since `takenAt` (never negative). */
export function daysSince(takenAt: number, now: number): number {
  return Math.max(0, Math.floor((now - takenAt) / DAY));
}

/** "today", "1 day ago", "9 days ago". */
export function describeAge(takenAt: number, now: number): string {
  const d = daysSince(takenAt, now);
  return d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
}

/** Oldest and newest, the default pair for the before/after slider; null with fewer than two photos. */
export function defaultComparePair(photos: readonly PhotoMeta[]): { beforeId: string; afterId: string } | null {
  if (photos.length < 2) return null;
  const sorted = sortNewestFirst(photos);
  return { beforeId: sorted[sorted.length - 1].id, afterId: sorted[0].id };
}

/** Scales (w, h) down so the longest side is at most `max`; never scales up; whole pixels. */
export function fitWithin(width: number, height: number, max: number = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!(longest > max)) return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  const k = max / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** "180 KB", "2.4 MB". */
export function formatBytes(bytes: number): string {
  if (!(bytes > 0)) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function totalBytes(photos: readonly PhotoMeta[]): number {
  let n = 0;
  for (const p of photos) n += p.bytes;
  return n;
}
