// Which extra sign-in methods can this visitor use right now?
//
// The server answers GET /auth/providers with three booleans, each true only
// when the owner switched the method's flag on AND configured its keys. While all
// three flags are off the route is a 404; that, a network error, or anything
// unexpected all mean the same thing here: no extra methods, so every sign-in
// button on the site stays exactly as it was (Google only).
//
// No React in this file (tested in node). The answer is cached for ten minutes in
// the key-value store, so moving between marketing pages does not ask again.
// Light on purpose: it imports only the kv adapter, so marketing pages may use it
// (they must never pull in the app store).

import { kv } from '../storage/kv';

export type ProviderAvailability = {
  magic_link: boolean;
  apple: boolean;
  microsoft: boolean;
};

export const NO_PROVIDERS: ProviderAvailability = { magic_link: false, apple: false, microsoft: false };

const CACHE_KEY = 'providers';
export const PROVIDERS_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;

type Cached = { at: number; value: ProviderAvailability };

/** Keeps only the three known keys, and only an exact `true`. */
export function normalizeProviders(input: unknown): ProviderAvailability {
  if (input === null || typeof input !== 'object') return NO_PROVIDERS;
  const o = input as Record<string, unknown>;
  return { magic_link: o.magic_link === true, apple: o.apple === true, microsoft: o.microsoft === true };
}

export const anyExtraProvider = (p: ProviderAvailability): boolean => p.magic_link || p.apple || p.microsoft;

function readCache(): Cached | null {
  const c = kv.get<Cached | null>('auth', CACHE_KEY, null);
  if (!c || typeof c.at !== 'number' || c.value === undefined) return null;
  return { at: c.at, value: normalizeProviders(c.value) };
}

let current: ProviderAvailability | null = null;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* a listener must not break the others */ } });

/** The best answer available without waiting: this session's, else the cached one, else none. */
export function getProviders(): ProviderAvailability {
  if (current) return current;
  current = readCache()?.value ?? NO_PROVIDERS;
  return current;
}

/** True once an answer (fresh or cached and still fresh) is in hand. */
export const providersLoaded = (): boolean => loaded;

export function subscribeProviders(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * Makes sure the answer is fresh. Cheap to call from many components: it makes at
 * most one request per ten minutes, and never throws.
 */
export function ensureProviders(opts: { fetchImpl?: typeof fetch; now?: () => number } = {}): Promise<void> {
  const now = opts.now ?? Date.now;
  const cached = readCache();
  if (cached && now() - cached.at < PROVIDERS_TTL_MS) {
    current = cached.value;
    if (!loaded) { loaded = true; emit(); }
    return Promise.resolve();
  }
  if (inflight) return inflight;

  const doFetch = opts.fetchImpl ?? fetch;
  inflight = (async () => {
    let value = cached?.value ?? NO_PROVIDERS; // a failed request keeps what was known
    let cacheIt = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await doFetch('/auth/providers', { signal: ctrl.signal, credentials: 'same-origin' });
        if (res.ok) { value = normalizeProviders(await res.json()); cacheIt = true; }
        else if (res.status === 404) { value = NO_PROVIDERS; cacheIt = true; } // every flag is off
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // offline or blocked: fall back to what we had
    }
    if (cacheIt) kv.set('auth', CACHE_KEY, { at: now(), value } satisfies Cached);
    current = value;
    loaded = true;
    emit();
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Test hook: forget this session's state. */
export function resetProvidersForTests(): void {
  current = null;
  loaded = false;
  inflight = null;
  listeners.clear();
}
