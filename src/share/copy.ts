// The words of the sharing card, in one place so they can be tested and reviewed.
// Plain, no medical claims; Stop Biting is an app, not a clinician. The lists below
// say exactly what a link shows and mirror the server's whitelist
// (server/share/summary.js); scripts/shareGuard.test.mjs and copy.test.ts keep them honest.

import { format } from 'date-fns';
import type { ExpiryChoice } from './types';

export const INTRO =
  'Show a read-only summary to someone you choose, like a therapist or a friend who helps you stay accountable. '
  + 'Anyone who has the link can open it, so only send it to people you trust. '
  + 'Stop Biting is an app, not a clinician: the summary is your own log, not an assessment.';

export const SYNC_NEEDED = 'Sharing needs your history to be synced.';

export const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: null, label: 'No expiry' },
];

export interface Preview {
  /** What the person who opens the link will see. */
  shows: string[];
  /** What they will never see, whatever you choose. */
  never: string[];
}

const ALWAYS_SHOWN = [
  'How many bites you logged each day over 4 weeks, and each week over 12 weeks',
  'How many whole days it has been since your last logged bite',
  'What set bites off, in groups: stress, deep focus, boredom, not sure, other',
  'How often you finished a competing response after an alarm',
];

const DETAILED_EXTRA = [
  'Calendar dates on the charts, and the date of your last logged bite',
  'A time-of-day chart: which hours of the day bites were logged',
];

const NEVER_SHOWN = [
  'Your name, email or account',
  'Photos, or anything from your camera',
  'Notes, or the names of reasons you wrote yourself',
  'Any single entry, or the exact time of one',
];

/** Plain-language preview of exactly what a link with these settings reveals. */
export function previewFor(detailed: boolean): Preview {
  return { shows: detailed ? [...ALWAYS_SHOWN, ...DETAILED_EXTRA] : [...ALWAYS_SHOWN], never: [...NEVER_SHOWN] };
}

const DAY = 24 * 60 * 60 * 1000;

/** "No expiry", "Expires 21 Nov 2026" or "Expired". */
export function describeExpiry(expiresAt: number | null, now: number): string {
  if (expiresAt === null) return 'No expiry';
  if (expiresAt <= now) return 'Expired';
  return `Expires ${format(expiresAt, 'd MMM yyyy')}`;
}

/** "Not opened yet" or "Last opened 21 Oct 2026, 14:05". */
export function describeViewed(lastViewedAt: number | null): string {
  return lastViewedAt === null ? 'Not opened yet' : `Last opened ${format(lastViewedAt, 'd MMM yyyy, HH:mm')}`;
}

export function describeCreated(createdAt: number): string {
  return `Made ${format(createdAt, 'd MMM yyyy')}`;
}

/** Whole days until a link expires (for a screen reader hint), or null. */
export function daysLeft(expiresAt: number | null, now: number): number | null {
  return expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now) / DAY));
}

/** What to tell the person when a request failed. Never includes a server message. */
export function failureText(status: number, action: 'load' | 'create' | 'revoke'): string {
  if (status === 0) return 'No connection right now. Check your internet and try again.';
  if (status === 401) return 'Please sign in again to manage share links.';
  if (status === 404) return 'Sharing is not available right now.';
  if (status === 429) return 'Too many requests. Wait a minute and try again.';
  if (status === 409 && action === 'create') return 'You have reached the limit of active links. Revoke one to make another.';
  if (status === 400 && action === 'create') return 'That did not look right. Check the note and try again.';
  if (action === 'load') return 'Could not load your links. Try again in a moment.';
  if (action === 'revoke') return 'Could not revoke that link. Try again in a moment.';
  return 'Could not make the link. Try again in a moment.';
}
