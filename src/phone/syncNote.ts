// The one plain sentence about where phone logs live (WS6). Pure.
//
// Three honest states, because "Turn on sync in Settings" is only true when
// Settings has a sync card (the `event_sync` flag is on):
//
//   flag off              Stored on this phone only.
//   flag on, not opted in Stored on this phone only. Turn on sync in Settings to
//                         see it on your computer.        [button: Settings]
//   opted in              Sync is on, then the engine's own status line.

export type SyncNote =
  | { kind: 'phone_only'; text: string; action: null }
  | { kind: 'phone_only_can_sync'; text: string; action: 'settings' }
  | { kind: 'syncing'; text: string; action: null };

export const PHONE_ONLY = 'Stored on this phone only.';
export const PHONE_ONLY_CAN_SYNC = 'Stored on this phone only. Turn on sync in Settings to see it on your computer.';

export function syncNoteFor(input: {
  /** The `event_sync` feature flag. */
  syncAvailable: boolean;
  /** This account switched sync on, on this phone. */
  optedIn: boolean;
}): SyncNote {
  if (!input.syncAvailable) return { kind: 'phone_only', text: PHONE_ONLY, action: null };
  if (!input.optedIn) return { kind: 'phone_only_can_sync', text: PHONE_ONLY_CAN_SYNC, action: 'settings' };
  return { kind: 'syncing', text: 'Sync is on, so your computer sees these entries.', action: null };
}
