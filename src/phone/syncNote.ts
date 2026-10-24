// The one plain sentence about where phone logs live (WS6). Pure.
//
// Three honest states, because "Turn on sync in Settings" is only true when
// Settings has a sync card (the `event_sync` flag is on):
//
//   flag off              Stored on this phone only.
//   flag on, not opted in Stored on this phone only. Turn on sync in Settings to
//                         see it on your computer.        [button: Settings]
//   opted in              Sync is on, then the engine's own status line.

import { t, messages } from '../i18n/scopes/phone';

export type SyncNote =
  | { kind: 'phone_only'; text: string; action: null }
  | { kind: 'phone_only_can_sync'; text: string; action: 'settings' }
  | { kind: 'syncing'; text: string; action: null };

// The English sentences, for tests and docs. What the screen shows is t(...) below, in the language showing.
export const PHONE_ONLY = messages['sync.phoneOnly'];
export const PHONE_ONLY_CAN_SYNC = messages['sync.phoneOnlyCanSync'];

export function syncNoteFor(input: {
  /** The `event_sync` feature flag. */
  syncAvailable: boolean;
  /** This account switched sync on, on this phone. */
  optedIn: boolean;
}): SyncNote {
  if (!input.syncAvailable) return { kind: 'phone_only', text: t('sync.phoneOnly'), action: null };
  if (!input.optedIn) return { kind: 'phone_only_can_sync', text: t('sync.phoneOnlyCanSync'), action: 'settings' };
  return { kind: 'syncing', text: t('sync.on'), action: null };
}
