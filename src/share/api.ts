// Every request this app makes about share links is defined in this file, and nowhere
// else (scripts/shareGuard.test.mjs fails if another file under src/ names the endpoint).
// The functions take an injected request function, so tests can pass a spy; the browser
// passes the app's own apiFetch wrapper (cookie on the web, bearer token in Electron).

import type { CreateInput, CreatedLink, ShareLink, ShareList, ShareResult } from './types';

export const SHARE_LINKS_PATH = '/api/share/links';

export interface ShareHttpResult {
  status: number;
  body: unknown;
}
export type ShareRequest = (method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown) => Promise<ShareHttpResult>;

const isRecord = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

async function safe(request: ShareRequest, method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<ShareHttpResult> {
  try {
    return await request(method, path, body);
  } catch {
    return { status: 0, body: null };
  }
}

export function parseLink(x: unknown): ShareLink | null {
  if (!isRecord(x)) return null;
  const { id, label, createdAt, expiresAt, lastViewedAt, detailed } = x;
  if (typeof id !== 'string' || typeof label !== 'string' || typeof createdAt !== 'number' || typeof detailed !== 'boolean') return null;
  if (expiresAt !== null && typeof expiresAt !== 'number') return null;
  if (lastViewedAt !== null && typeof lastViewedAt !== 'number') return null;
  return { id, label, createdAt, expiresAt, lastViewedAt, detailed };
}

export async function listLinks(request: ShareRequest): Promise<ShareResult<ShareList>> {
  const r = await safe(request, 'GET', SHARE_LINKS_PATH);
  const b = r.body;
  if (r.status === 200 && isRecord(b) && Array.isArray(b.links) && typeof b.max === 'number' && typeof b.syncedEntries === 'number') {
    const links = b.links.map(parseLink);
    if (links.every((l): l is ShareLink => l !== null)) return { ok: true, value: { links, max: b.max, syncedEntries: b.syncedEntries } };
  }
  return { ok: false, status: r.status === 200 ? 502 : r.status };
}

export async function createLink(request: ShareRequest, input: CreateInput): Promise<ShareResult<CreatedLink>> {
  const r = await safe(request, 'POST', SHARE_LINKS_PATH, {
    label: input.label,
    expiresInDays: input.expiresInDays,
    detailed: input.detailed,
    timezone: input.timezone,
  });
  const b = r.body;
  const link = parseLink(b);
  if ((r.status === 200 || r.status === 201) && link && isRecord(b) && typeof b.token === 'string' && typeof b.url === 'string') {
    return { ok: true, value: { ...link, token: b.token, url: b.url } };
  }
  return { ok: false, status: r.status === 200 || r.status === 201 ? 502 : r.status };
}

export async function revokeLink(request: ShareRequest, id: string): Promise<ShareResult<true>> {
  const r = await safe(request, 'DELETE', `${SHARE_LINKS_PATH}/${encodeURIComponent(id)}`);
  if (r.status === 200 && isRecord(r.body) && r.body.ok === true) return { ok: true, value: true };
  return { ok: false, status: r.status === 200 ? 502 : r.status };
}
