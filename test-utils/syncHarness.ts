// Building blocks for the sync tests: an in-memory kv, a "browser" (its own app
// store, kv and device id) and the glue that turns an HTTP base URL into the
// engine's transport. Two of these in one process are two browsers: nothing is
// shared between them except the server they talk to.

import { createAppStore } from '../src/store/useAppStore';
import {
  fromHabitEvent,
  mergeEvents,
  type EventPatch,
  toHabitEvent,
  type HabitEventWire,
} from '../src/storage/eventModel';
import { parseWireEvent } from '../src/storage';
import type { SyncKvPort, SyncStorePort, SyncTransport } from '../src/sync/types';
import { createEngineTransport, type HttpRequest } from '../src/sync/api';

type AppStore = ReturnType<typeof createAppStore>;

export function createMapKv(initial: Record<string, unknown> = {}): SyncKvPort & { dump(): Record<string, unknown> } {
  const m = new Map<string, string>(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    get<T>(key: string, fallback: T): T {
      const raw = m.get(key);
      if (raw === undefined) return fallback;
      try { return JSON.parse(raw) as T; } catch { return fallback; }
    },
    set(key, value) { m.set(key, JSON.stringify(value)); return true; },
    remove(key) { m.delete(key); },
    dump: () => Object.fromEntries([...m].map(([k, v]) => [k, JSON.parse(v)])),
  };
}

/**
 * The same operations the `events` facade of src/storage performs, over any app
 * store instance. (The facade is bound to the one global store, so two browsers
 * in a test cannot both use it; src/sync/ports.test.ts proves this port and the
 * facade give identical results.)
 */
export function createAppStorePort(store: AppStore): SyncStorePort {
  return {
    listAll() {
      const s = store.getState();
      return [...s.incidents.map(toHabitEvent), ...s.tombstones.map(t => ({ ...t }))];
    },
    merge(incoming) {
      const parsed = incoming.map(parseWireEvent);
      const good = parsed.filter((e): e is HabitEventWire => e !== null);
      const s = store.getState();
      const result = mergeEvents({ incidents: s.incidents, tombstones: s.tombstones }, good);
      s.replaceEvents({
        incidents: result.incidents,
        tombstones: result.tombstones,
        firstOpenTime: s.firstOpenTime,
        historyStartTime: s.historyStartTime,
        bestStreakFloorMs: s.bestStreakFloorMs,
      });
      return { applied: result.applied, skipped: incoming.length - good.length };
    },
    subscribe(fn) {
      let incidents = store.getState().incidents;
      let tombstones = store.getState().tombstones;
      return store.subscribe(state => {
        if (state.incidents !== incidents || state.tombstones !== tombstones) {
          incidents = state.incidents;
          tombstones = state.tombstones;
          fn();
        }
      });
    },
  };
}

export interface TestBrowser {
  name: string;
  store: AppStore;
  port: SyncStorePort;
  kv: ReturnType<typeof createMapKv>;
  deviceId: string;
  /** Records an event the way the app does (id, ts, updatedAt from the injected clock). */
  add(partial: Partial<HabitEventWire> & { id: string }, at: number): void;
  /** Changes mutable fields of an event and stamps `updatedAt = at`. */
  edit(id: string, patch: EventPatch, at: number): void;
  /** Deletes an event, leaving a tombstone stamped `at`. */
  remove(id: string, at: number): void;
  /** The device's history in canonical form, ordered by id, ready to compare. */
  snapshot(): HabitEventWire[];
}

export function createTestBrowser(name: string): TestBrowser {
  const store = createAppStore();
  const port = createAppStorePort(store);
  const deviceId = `dev-${name}`;
  const api: TestBrowser = {
    name,
    store,
    port,
    kv: createMapKv(),
    deviceId,
    add(partial, at) {
      const e: HabitEventWire = {
        ts: at, source: 'manual', behavior: 'nail_biting', updatedAt: at, deviceId, triggers: ['stress'],
        ...partial,
      };
      store.getState().insertEvent(fromHabitEvent(e));
    },
    edit(id, patch, at) {
      const real = Date.now;
      Date.now = () => at; // the store stamps updatedAt from Date.now(): pin it to the test's clock
      try {
        if (!store.getState().patchEvent(id, patch)) throw new Error(`no live event ${id} on ${name}`);
      } finally {
        Date.now = real;
      }
    },
    remove(id, at) {
      const real = Date.now;
      Date.now = () => at;
      try {
        if (!store.getState().incidents.some(i => i.id === id)) throw new Error(`no live event ${id} on ${name}`);
        store.getState().deleteIncident(id);
      } finally {
        Date.now = real;
      }
    },
    snapshot() {
      return port.listAll().sort((a, b) => (a.id < b.id ? -1 : 1));
    },
  };
  return api;
}

/** An HttpRequest over a real HTTP server, signed in as `user` (the test harness reads x-user). */
export function httpRequestFor(baseUrl: string, user: string, tap?: (method: string, path: string, body: unknown) => void): HttpRequest {
  return async (method, path, body) => {
    tap?.(method, path, body);
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'x-user': user, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json: unknown = null;
    try { json = await res.json(); } catch { /* no body */ }
    const retry = Number(res.headers.get('retry-after'));
    return { status: res.status, body: json, retryAfterMs: Number.isFinite(retry) && retry > 0 ? retry * 1000 : undefined };
  };
}

export function transportFor(baseUrl: string, user: string): SyncTransport {
  return createEngineTransport(httpRequestFor(baseUrl, user));
}

