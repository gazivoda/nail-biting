// The words for what sync is doing. Pure, so every state has a test and a person
// is never left with a code like "phase: backoff".

import { formatDistance } from '../i18n/format';
import { t } from '../i18n/scopes/data';
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

function waiting(pending: number): string | undefined {
  return pending > 0 ? t('status.waiting', { pending }) : undefined;
}

/** How long until `at`, in plain words ("in about 2 minutes"). */
function inAbout(at: number, now: number): string {
  return formatDistance(at, now, { addSuffix: true });
}

export function describeStatus(status: SyncStatus, now: number): StatusLine {
  switch (status.phase) {
    case 'syncing':
      return { headline: t('status.syncing'), tone: 'busy' };

    case 'offline':
      return {
        headline: t('status.offline.headline'),
        detail: status.pending > 0 ? t('status.offline.detailPending', { pending: status.pending }) : t('status.offline.detail'),
        tone: 'warn',
      };

    case 'backoff':
      return {
        headline: t('status.backoff.headline'),
        detail: status.retryAt ? t('status.backoff.detailAt', { when: inAbout(status.retryAt, now) }) : t('status.backoff.detailSoon'),
        tone: 'warn',
      };

    case 'signed_out':
      return {
        headline: t('status.signedOut.headline'),
        detail: t('status.signedOut.detail'),
        tone: 'warn',
      };

    case 'unavailable':
      return {
        headline: t('status.unavailable.headline'),
        detail: t('status.unavailable.detail'),
        tone: 'warn',
      };

    case 'rejected':
      return {
        headline: t('status.rejected.headline'),
        detail: t('status.rejected.detail'),
        tone: 'warn',
      };

    case 'quota':
      return {
        headline: t('status.quota.headline'),
        detail: t('status.quota.detail'),
        tone: 'warn',
      };

    case 'server_reset':
      return {
        headline: t('status.serverReset.headline'),
        detail: t('status.serverReset.detail'),
        tone: 'warn',
      };

    case 'idle':
    case 'off':
    default: {
      const w = waiting(status.pending);
      if (status.lastSyncedAt === null) {
        return { headline: t('status.firstSync'), detail: w, tone: 'busy' };
      }
      return {
        headline: t('status.lastSynced', { when: formatDistance(status.lastSyncedAt, now, { addSuffix: true }) }),
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
        headline: t('notice.serverReset.headline'),
        detail: t('notice.serverReset.detail'),
        tone: 'warn',
      };
  }
}

/** Why deleting the synced copy failed, for a server answer (`status` 0 means no answer at all). Called when the answer arrives. */
export function describeDeleteFailure(status: number): string {
  return status === 0 ? t('failure.network')
    : status === 401 ? t('failure.signedOut')
    : status === 429 ? t('failure.rateLimited')
    : t('failure.server');
}
