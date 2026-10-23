// Client side of the feature flags. No React here, so it is tested in node.
//
//   isFeatureOn('event_sync')      synchronous read of the current value
//   useFeature('event_sync')       React hook (src/features/useFeature.ts)
//
// How a value is decided, in order:
//   1. (development only) a ?ff= override, see devOverride.ts
//   2. the last answer from GET /api/features, fetched at most every few minutes
//   3. the last-known answer from a previous visit (src/storage/kv), so the app
//      behaves the same offline
//   4. OFF. While the answer is unknown every flag is off.
//
// Flags are never read from the build, so the owner changes them with a server
// environment variable and a restart (server/features.js).

import { kv } from '../storage/kv';
import { FEATURE_NAMES, isFeatureName, type FeatureName } from './registry';
import { readDevOverrides } from './devOverride';

export type { FeatureName } from './registry';
export type FlagMap = Record<FeatureName, boolean>;

const CACHE_KEY = 'last-known';
/** A fetched answer is reused for this long before the next use asks again. */
export const FLAGS_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;

const allOff = (): FlagMap =>
  Object.fromEntries(FEATURE_NAMES.map(n => [n, false])) as FlagMap;

/** Keeps known names whose value is exactly `true`; everything else is off. */
export function normalizeFlags(input: unknown): FlagMap {
  const out = allOff();
  if (input === null || typeof input !== 'object') return out;
  for (const [name, value] of Object.entries(input as Record<string, unknown>)) {
    if (isFeatureName(name) && value === true) out[name] = true;
  }
  return out;
}

interface Cached { at: number; flags: Record<string, boolean> }

function loadCached(): { flags: FlagMap; at: number } {
  const c = kv.get<Cached | null>('flags', CACHE_KEY, null);
  if (!c || typeof c !== 'object') return { flags: allOff(), at: 0 };
  return { flags: normalizeFlags(c.flags), at: typeof c.at === 'number' ? c.at : 0 };
}

// ── State ────────────────────────────────────────────────────────────────────

let known: FlagMap = allOff();
let fetchedAt = 0; // 0 = not asked in this page load
let snapshot: FlagMap = allOff();
let inFlight: Promise<FlagMap> | null = null;
const listeners = new Set<() => void>();
let hydrated = false;

function devOverrides(): Partial<Record<FeatureName, true>> {
  // Replaced by `false` in production builds; the call below is then dead code.
  if (import.meta.env.DEV) return readDevOverrides();
  return {};
}

function recompute() {
  const next = { ...known, ...devOverrides() };
  const changed = FEATURE_NAMES.some(n => next[n] !== snapshot[n]);
  if (changed) {
    snapshot = next;
    listeners.forEach(fn => fn());
  }
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  known = loadCached().flags;
  snapshot = { ...known, ...devOverrides() };
}

/** The current flags. The same object is returned until a value changes. */
export function getFlags(): FlagMap {
  hydrate();
  return snapshot;
}

export function isFeatureOn(name: FeatureName): boolean {
  return getFlags()[name] === true;
}

export function subscribeFlags(fn: () => void): () => void {
  hydrate();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ── Fetching ─────────────────────────────────────────────────────────────────

export interface RefreshOptions {
  /** Injected in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * Asks the server for the flags and stores the answer. Never throws and never
 * clears what is already known: a failed request (offline, server down, bad
 * JSON) leaves the last-known flags in place.
 */
export function refreshFlags(options: RefreshOptions = {}): Promise<FlagMap> {
  hydrate();
  if (inFlight) return inFlight;
  const doFetch = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  const now = options.now ?? Date.now;
  if (!doFetch) return Promise.resolve(snapshot);

  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null;

  inFlight = (async () => {
    try {
      const res = await doFetch('/api/features', {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: ctrl?.signal,
      });
      if (!res.ok) throw new Error(`features ${res.status}`);
      const body: unknown = await res.json();
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('features: not a map');
      known = normalizeFlags(body);
      fetchedAt = now();
      kv.set('flags', CACHE_KEY, { at: fetchedAt, flags: known } satisfies Cached);
      recompute();
    } catch {
      // Keep the last-known flags. Counting the attempt stops a dead server
      // being hit again on every component mount.
      fetchedAt = now();
    } finally {
      if (timer) clearTimeout(timer);
      inFlight = null;
    }
    return snapshot;
  })();
  return inFlight;
}

let visibilityHooked = false;

/**
 * Refreshes if the last answer is older than FLAGS_TTL_MS (or there was none in
 * this page load). Cheap to call from every component that reads a flag; also
 * re-checks when a long-lived tab becomes visible again.
 */
export function ensureFlags(options: RefreshOptions = {}): void {
  const now = (options.now ?? Date.now)();
  if (fetchedAt === 0 || now - fetchedAt > FLAGS_TTL_MS) void refreshFlags(options);

  const doc = (globalThis as { document?: Document }).document;
  if (!visibilityHooked && doc) {
    visibilityHooked = true;
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'visible') ensureFlags();
    });
  }
}

/** Tests only: forget everything and start from a clean slate. */
export function resetFlagsForTests(): void {
  known = allOff();
  snapshot = allOff();
  fetchedAt = 0;
  inFlight = null;
  hydrated = false;
  listeners.clear();
}
