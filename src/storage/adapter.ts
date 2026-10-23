// The one place that touches Web Storage (localStorage). Everything else in the
// app reaches persistent storage through src/storage/* (see
// docs/agents/ARCHITECTURE.md, "Storage module").
//
// Design rules:
//  - The raw adapter interface is tiny and may throw. The `readRaw` / `writeRaw`
//    / `removeRaw` helpers wrap it so that callers never see an exception:
//    private windows, blocked site data and a full quota all degrade to "nothing
//    persisted" instead of crashing the app.
//  - If no usable Web Storage exists (node tests, Safari private mode in older
//    versions, storage blocked by policy), the module falls back to an in-memory
//    adapter for the lifetime of the page. The app keeps working; it just
//    doesn't remember anything. `storageStatus().persistent` says which one is
//    in use.
//  - Tests inject their own adapter with `setStorageAdapter` (see
//    test-utils/memoryStorage.ts) and reset with `setStorageAdapter(null)`.

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Every key currently stored. Used to list a namespace; may be omitted. */
  keys?(): string[];
}

/** In-memory adapter: the fallback, and the default for tests. */
export function createMemoryAdapter(initial: Record<string, string> = {}): StorageAdapter {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: key => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
    keys: () => [...map.keys()],
  };
}

/** Wraps a DOM-style `Storage` as an adapter. */
export function adapterFromWebStorage(ws: Storage): StorageAdapter {
  return {
    getItem: key => ws.getItem(key),
    setItem: (key, value) => ws.setItem(key, value),
    removeItem: key => ws.removeItem(key),
    keys: () => {
      const out: string[] = [];
      for (let i = 0; i < ws.length; i++) {
        const k = ws.key(i);
        if (k !== null) out.push(k);
      }
      return out;
    },
  };
}

const PROBE_KEY = '__sb_storage_probe__';

/**
 * Returns the browser's localStorage as an adapter, or null when it is missing
 * or blocked (reading the `localStorage` property or a key throws).
 *
 * Only READING is probed. A full quota or a private window that refuses writes
 * still lets existing data be read, and refusing to hydrate saved history just
 * because a probe write failed would look like data loss to the user. Writes
 * that fail later are handled by `writeRaw` (see the overlay below).
 */
export function detectLocalStorage(): StorageAdapter | null {
  try {
    const ws = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ws) return null;
    ws.getItem(PROBE_KEY);
    return adapterFromWebStorage(ws);
  } catch {
    return null;
  }
}

let current: StorageAdapter | null = null;
let persistent = false;
let fallbackReason: string | null = null;

// Values whose write the adapter refused (quota, private window). Reads see them
// first, so the page behaves consistently for its lifetime even though nothing
// was persisted. An entry is dropped as soon as a write for that key succeeds.
const overlay = new Map<string, string>();

function resolve(): StorageAdapter {
  if (current) return current;
  const real = detectLocalStorage();
  if (real) {
    current = real;
    persistent = true;
  } else {
    current = createMemoryAdapter();
    persistent = false;
    fallbackReason = 'Web Storage is unavailable; using in-memory storage for this page load.'; // i18n-ignore: diagnostic only (storageStatus().reason is read by tests, never rendered)
  }
  return current;
}

/**
 * Swaps the adapter. Pass `null` to forget the current one and re-detect on the
 * next access. Intended for tests and for embedders with their own storage.
 */
export function setStorageAdapter(adapter: StorageAdapter | null): void {
  overlay.clear();
  current = adapter;
  persistent = adapter !== null;
  fallbackReason = null;
}

export function getStorageAdapter(): StorageAdapter {
  return resolve();
}

export function storageStatus(): { persistent: boolean; reason: string | null } {
  resolve();
  return { persistent, reason: fallbackReason };
}

// ── Never-throwing access ────────────────────────────────────────────────────

export function readRaw(key: string): string | null {
  const shadow = overlay.get(key);
  if (shadow !== undefined) return shadow;
  try {
    return resolve().getItem(key);
  } catch {
    return null;
  }
}

/**
 * True when the value was persisted. False means storage refused it (quota,
 * blocked, ...); it is then kept in memory for this page load so reads agree.
 */
export function writeRaw(key: string, value: string): boolean {
  try {
    resolve().setItem(key, value);
    overlay.delete(key);
    return true;
  } catch {
    overlay.set(key, value);
    return false;
  }
}

export function removeRaw(key: string): void {
  overlay.delete(key);
  try {
    resolve().removeItem(key);
  } catch {
    /* nothing to do */
  }
}

export function listRawKeys(): string[] {
  let stored: string[] = [];
  try {
    stored = resolve().keys?.() ?? [];
  } catch {
    /* fall through with what the overlay knows */
  }
  return [...new Set([...stored, ...overlay.keys()])];
}
