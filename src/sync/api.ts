// Every request this app makes about synced events is defined in this file, and
// nowhere else. scripts/syncGuard.test.mjs fails if any other file under src/
// mentions the events endpoints, so "sync off means no event network calls" has
// one place to audit.
//
// The functions take an injected `HttpRequest` instead of calling fetch: the
// browser passes one built on the app's `apiFetch` (cookie or Electron bearer
// token, see apiFetchRequest.ts), tests pass a spy or a real local server.

import type { SyncResponse, SyncTransport, TransportResult } from './types';

export const EVENTS_SYNC_PATH = '/api/events/sync';
export const EVENTS_STATUS_PATH = '/api/events/status';
export const EVENTS_PATH = '/api/events';

/** `status` 0 means no answer at all (offline, timeout). */
export interface HttpResult {
  status: number;
  body: unknown;
  retryAfterMs?: number;
}

export type HttpRequest = (method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown) => Promise<HttpResult>;

const isRecord = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

async function safe(request: HttpRequest, method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<HttpResult> {
  try {
    return await request(method, path, body);
  } catch {
    return { status: 0, body: null };
  }
}

/** The engine's transport: one POST per cycle step. */
export function createEngineTransport(request: HttpRequest): SyncTransport {
  return {
    async sync(req): Promise<TransportResult> {
      const r = await safe(request, 'POST', EVENTS_SYNC_PATH, req);
      if (r.status === 200 && isRecord(r.body)) return { ok: true, body: r.body as unknown as SyncResponse };
      return { ok: false, status: r.status === 200 ? 502 : r.status, retryAfterMs: r.retryAfterMs };
    },
  };
}

/** What the server holds for the signed-in account. */
export interface RemoteStatus {
  epoch: string | null;
  /** Live events plus deletion markers. */
  count: number;
  live: number;
  deleted: number;
  quota: number;
  lastChangeAt: number | null;
}

export async function fetchRemoteStatus(request: HttpRequest): Promise<{ ok: true; status: RemoteStatus } | { ok: false; status: number }> {
  const r = await safe(request, 'GET', EVENTS_STATUS_PATH);
  const b = r.body;
  if (r.status === 200 && isRecord(b) && typeof b.count === 'number' && typeof b.live === 'number') {
    return {
      ok: true,
      status: {
        epoch: typeof b.epoch === 'string' ? b.epoch : null,
        count: b.count,
        live: b.live,
        deleted: typeof b.deleted === 'number' ? b.deleted : 0,
        quota: typeof b.quota === 'number' ? b.quota : 0,
        lastChangeAt: typeof b.lastChangeAt === 'number' ? b.lastChangeAt : null,
      },
    };
  }
  return { ok: false, status: r.status === 200 ? 502 : r.status };
}

/** Deletes every event the server holds for the account. History on this device is untouched. */
export async function wipeRemote(request: HttpRequest): Promise<{ ok: true; deleted: number } | { ok: false; status: number }> {
  const r = await safe(request, 'DELETE', EVENTS_PATH);
  if (r.status === 200 && isRecord(r.body) && typeof r.body.deleted === 'number') return { ok: true, deleted: r.body.deleted };
  return { ok: false, status: r.status === 200 ? 502 : r.status };
}
