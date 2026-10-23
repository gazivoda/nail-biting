// The words of the sharing card, in one place so they can be tested and reviewed.
// Plain, no medical claims; Stop Biting is an app, not a clinician. The lists below
// say exactly what a link shows and mirror the server's whitelist
// (server/share/summary.js); scripts/shareGuard.test.mjs and copy.test.ts keep them honest.

import { formatDatePattern } from '../i18n/format';
import { t, type messages } from '../i18n/scopes/sharing';
import type { ExpiryChoice } from './types';

type Key = keyof typeof messages;

/**
 * Text that is read from the catalog when it is used, not when this file is loaded, so a constant that other
 * files import still follows the language. `String(INTRO)` and `${INTRO}` give the words.
 */
const lazy = (key: Key): { toString(): string } => ({ toString: () => t(key) });

export const INTRO = lazy('intro');

export const SYNC_NEEDED = lazy('syncNeeded');

export const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: 7, get label() { return t('expiry.days', { count: 7 }); } },
  { value: 30, get label() { return t('expiry.days', { count: 30 }); } },
  { value: 90, get label() { return t('expiry.days', { count: 90 }); } },
  { value: null, get label() { return t('expiry.none'); } },
];

export interface Preview {
  /** What the person who opens the link will see. */
  shows: string[];
  /** What they will never see, whatever you choose. */
  never: string[];
}

const ALWAYS_SHOWN = [
  'preview.shows.daily',
  'preview.shows.streak',
  'preview.shows.triggers',
  'preview.shows.response',
] as const satisfies readonly Key[];

const DETAILED_EXTRA = [
  'preview.shows.dates',
  'preview.shows.hours',
] as const satisfies readonly Key[];

const NEVER_SHOWN = [
  'preview.never.identity',
  'preview.never.photos',
  'preview.never.notes',
  'preview.never.entries',
] as const satisfies readonly Key[];

/** Plain-language preview of exactly what a link with these settings reveals. */
export function previewFor(detailed: boolean): Preview {
  const keys = detailed ? [...ALWAYS_SHOWN, ...DETAILED_EXTRA] : [...ALWAYS_SHOWN];
  return { shows: keys.map(k => t(k)), never: NEVER_SHOWN.map(k => t(k)) };
}

const DAY = 24 * 60 * 60 * 1000;

const dayOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const dayTimeOptions: Intl.DateTimeFormatOptions = { ...dayOptions, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };

/** "No expiry", "Expires 21 Nov 2026" or "Expired". */
export function describeExpiry(expiresAt: number | null, now: number): string {
  if (expiresAt === null) return t('expiry.none');
  if (expiresAt <= now) return t('expiry.expired');
  return t('expiry.expires', { date: formatDatePattern(expiresAt, 'd MMM yyyy', dayOptions) });
}

/** "Not opened yet" or "Last opened 21 Oct 2026, 14:05". */
export function describeViewed(lastViewedAt: number | null): string {
  return lastViewedAt === null
    ? t('viewed.never')
    : t('viewed.last', { date: formatDatePattern(lastViewedAt, 'd MMM yyyy, HH:mm', dayTimeOptions) });
}

export function describeCreated(createdAt: number): string {
  return t('created.on', { date: formatDatePattern(createdAt, 'd MMM yyyy', dayOptions) });
}

/** Whole days until a link expires (for a screen reader hint), or null. */
export function daysLeft(expiresAt: number | null, now: number): number | null {
  return expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now) / DAY));
}

/** What to tell the person when a request failed. Never includes a server message. */
export function failureText(status: number, action: 'load' | 'create' | 'revoke'): string {
  if (status === 0) return t('failure.offline');
  if (status === 401) return t('failure.signIn');
  if (status === 404) return t('failure.unavailable');
  if (status === 429) return t('failure.tooMany');
  if (status === 409 && action === 'create') return t('failure.limit');
  if (status === 400 && action === 'create') return t('failure.badInput');
  if (action === 'load') return t('failure.load');
  if (action === 'revoke') return t('failure.revoke');
  return t('failure.create');
}
