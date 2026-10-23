// Types shared by the sync engine and its ports. The engine talks to the world
// only through these small interfaces, so it runs in node with fakes: no DOM, no
// React, no fetch, no storage, no clock of its own.

import type { HabitEventWire } from '../storage/eventModel';
import type { SyncEvent } from './payload';

/** History as the engine sees it. Production: the `events` facade of src/storage. */
export interface SyncStorePort {
  /** Every record this device knows, live and deleted, in canonical wire form. */
  listAll(): HabitEventWire[];
  /** Folds events from the server into local history (last write wins). */
  merge(incoming: unknown[]): { applied: number; skipped: number };
  /** Calls `fn` after any change to local history. Returns an unsubscribe. */
  subscribe(fn: () => void): () => void;
}

/** A small persistent key-value area. Production: `kv` of src/storage, namespace "sync". */
export interface SyncKvPort {
  get<T>(key: string, fallback: T): T;
  /** false when the browser refused the write. */
  set(key: string, value: unknown): boolean;
  remove(key: string): void;
}

export interface SyncRequest {
  since: number;
  events: SyncEvent[];
  deviceId: string;
  epoch: string | null;
}

export interface SyncResponse {
  events: unknown[];
  cursor: number;
  hasMore: boolean;
  epoch: string;
}

/** `status` 0 means the request never got an answer (offline, DNS, timeout). */
export type TransportResult =
  | { ok: true; body: SyncResponse }
  | { ok: false; status: number; retryAfterMs?: number };

export interface SyncTransport {
  sync(req: SyncRequest): Promise<TransportResult>;
}

export interface SyncTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** What the engine is doing, in words the UI can map to copy. */
export type SyncPhase =
  | 'off'           // not running
  | 'idle'          // running, nothing to do right now
  | 'syncing'
  | 'offline'       // waiting for the network to come back
  | 'backoff'       // the last attempt failed; trying again later
  | 'signed_out'    // the server says the session is gone
  | 'unavailable'   // the server does not offer sync (feature off there)
  | 'rejected'      // the server refused a batch; waits for the next local change
  | 'quota'         // the account is full
  | 'server_reset'; // synced data was deleted elsewhere; sync was switched off

export interface SyncStatus {
  phase: SyncPhase;
  /** Epoch ms of the last cycle that finished without an error, or null. */
  lastSyncedAt: number | null;
  /** Local records the server has not acknowledged yet. */
  pending: number;
  /** When the next attempt is due after an error, or null. */
  retryAt: number | null;
  /** Local records that could not be sent as they are (counted, kept on the device). */
  skipped: number;
  /** Sent and received in the last finished cycle. */
  lastCycle: { pushed: number; pulled: number } | null;
}

export type SyncReason = 'start' | 'timer' | 'change' | 'focus' | 'online' | 'manual';

export interface SyncOptions {
  /** Background sync every this many ms (jittered). */
  intervalMs: number;
  /** After a local change, wait this long to batch more changes. */
  changeDebounceMs: number;
  /** Never start two background attempts closer than this. */
  minGapMs: number;
  /** After the network comes back, wait this long before trying. */
  onlineDelayMs: number;
  /** Events per request (the server accepts at most 500). */
  batchSize: number;
  /** Requests in one cycle; a longer first sync continues in the next cycle. */
  maxRequestsPerCycle: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
}

export const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  intervalMs: 5 * 60 * 1000,
  changeDebounceMs: 30 * 1000,
  minGapMs: 60 * 1000,
  onlineDelayMs: 2 * 1000,
  batchSize: 500,
  maxRequestsPerCycle: 40,
  backoffBaseMs: 30 * 1000,
  backoffMaxMs: 30 * 60 * 1000,
};

/** How one cycle ended. */
export type SyncOutcome =
  | { kind: 'done'; pushed: number; pulled: number }
  | { kind: 'partial'; pushed: number; pulled: number }   // ran out of requests; continues next cycle
  | { kind: 'skipped'; why: 'disabled' | 'offline' | 'stopped' | 'paused' | 'blocked' | 'backoff' }
  | { kind: 'failed'; status: number };
