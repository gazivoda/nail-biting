// The words for what sync is doing. Pure, so every state has a test and a person
// is never left with a code like "phase: backoff".

import { formatDistance } from 'date-fns';
import type { SyncStatus } from './types';
import type { SyncNotice } from './optIn';

export interface StatusLine {
  /** One short sentence. */
  headline: string;
  /** An optional second sentence with the reassurance or the next step. */
  detail?: string;
  /** For styling: calm, needs-attention, or in-progress. */
  tone: 'ok' | 'busy' | 'warn';
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

function waiting(pending: number): string | undefined {
  return pending > 0 ? `${plural(pending, 'change is', 'changes are')} waiting to be sent.` : undefined;
}

/** How long until `at`, in plain words ("in about 2 minutes"). */
function inAbout(at: number, now: number): string {
  return formatDistance(at, now, { addSuffix: true });
}

export function describeStatus(status: SyncStatus, now: number): StatusLine {
  switch (status.phase) {
    case 'syncing':
      return { headline: 'Syncing…', tone: 'busy' };

    case 'offline':
      return {
        headline: 'You are offline.',
        detail: `Everything is saved on this device and will sync when you are back online.${status.pending > 0 ? ` ${waiting(status.pending)}` : ''}`,
        tone: 'warn',
      };

    case 'backoff':
      return {
        headline: 'Could not reach the server.',
        detail: `Your history is safe on this device. Trying again ${status.retryAt ? inAbout(status.retryAt, now) : 'soon'}.`,
        tone: 'warn',
      };

    case 'signed_out':
      return {
        headline: 'You have been signed out.',
        detail: 'Sign in again to keep syncing. Your history on this device is untouched.',
        tone: 'warn',
      };

    case 'unavailable':
      return {
        headline: 'Sync is not available right now.',
        detail: 'Your history is safe on this device. It will try again later.',
        tone: 'warn',
      };

    case 'rejected':
      return {
        headline: 'The server did not accept some changes.',
        detail: 'Nothing is lost on this device. Try Sync now.',
        tone: 'warn',
      };

    case 'quota':
      return {
        headline: 'Your synced history is full.',
        detail: 'Export a copy from Data below, then delete the synced copy to start fresh.',
        tone: 'warn',
      };

    case 'server_reset':
      return {
        headline: 'Synced data was deleted, so sync is off.',
        detail: 'Your history on this device is untouched.',
        tone: 'warn',
      };

    case 'idle':
    case 'off':
    default: {
      const w = waiting(status.pending);
      if (status.lastSyncedAt === null) {
        return { headline: 'Waiting for the first sync.', detail: w, tone: 'busy' };
      }
      return {
        headline: `Last synced ${formatDistance(status.lastSyncedAt, now, { addSuffix: true })}.`,
        detail: w,
        tone: 'ok',
      };
    }
  }
}

/** The one-time message shown after sync was switched off for the person. */
export function describeNotice(notice: SyncNotice): StatusLine {
  switch (notice) {
    case 'server_reset':
      return {
        headline: 'Your synced data was deleted from another device, so sync is off here.',
        detail: 'Your history on this device is untouched. Turn sync on to upload it again.',
        tone: 'warn',
      };
  }
}
