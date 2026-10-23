// The things a person can do to their sync from Settings, as plain functions
// (the cards only call these). No React.
//
//   enableSync / disableSync     the opt-in toggle
//   deleteSyncedData             wipe the account's server copy; this device keeps its history
//   deleteEverything             erase this device (and, if asked, the server copy too)
//
// Order matters when two things can write at once. Anything that deletes first
// PAUSES the running engine (it waits for a cycle in flight, then makes no
// request), so an upload cannot slip in behind the delete, and a failed delete
// resumes it.

import { apiFetchRequest } from './apiFetchRequest';
import { fetchRemoteStatus, wipeRemote, type HttpRequest, type RemoteStatus } from './api';
import { clearAllSyncState, clearSyncOptIn, getSyncOptIn, setSyncOptIn } from './optIn';
import { getActiveEngine } from './runtime';

export function enableSync(userId: string): void {
  setSyncOptIn(userId);
}

/** Switches sync off. The cursor and acknowledged versions are kept, so switching it on again only moves what changed. */
export function disableSync(): void {
  clearSyncOptIn();
}

export async function loadRemoteStatus(request: HttpRequest = apiFetchRequest): Promise<{ ok: true; status: RemoteStatus } | { ok: false; status: number }> {
  return fetchRemoteStatus(request);
}

export type WipeResult = { ok: true; deleted: number } | { ok: false; status: number };

/**
 * Deletes every event the server holds for the account. History on this device
 * is untouched. On success sync is switched off (it would otherwise upload the
 * history again at its next change) and its local state is forgotten.
 */
export async function deleteSyncedData(request: HttpRequest = apiFetchRequest): Promise<WipeResult> {
  const engine = getActiveEngine();
  await engine?.pause();
  const r = await wipeRemote(request);
  if (!r.ok) {
    engine?.resume();
    return r;
  }
  engine?.forgetState();
  clearAllSyncState({ keepDeviceName: true });
  return r;
}

export interface DeleteEverythingOptions {
  /** Also delete the copy held by the server (only meaningful while sync is on). */
  alsoDeleteSynced: boolean;
  /** Erases this device's history and settings (the store's clearAllData). */
  clearLocal: () => void;
  request?: HttpRequest;
}

/**
 * Erases this device. With `alsoDeleteSynced` the server copy goes first; if that
 * fails nothing local is touched, so the person is never told "deleted" while a
 * copy remains. Sync is switched off and its local state forgotten either way.
 */
export async function deleteEverything(opts: DeleteEverythingOptions): Promise<WipeResult | { ok: true; deleted: 0 }> {
  if (opts.alsoDeleteSynced) {
    const r = await deleteSyncedData(opts.request);
    if (!r.ok) return r;
    opts.clearLocal();
    clearAllSyncState();
    return r;
  }
  const engine = getActiveEngine();
  await engine?.pause();
  engine?.forgetState();
  opts.clearLocal();
  clearAllSyncState();
  return { ok: true, deleted: 0 };
}

/** Whether this browser has sync switched on, for the Data card's wording. */
export function isSyncSwitchedOn(): boolean {
  return getSyncOptIn() !== null;
}
