// The small pieces around the engine: the opt-in, device names, status words, the
// runtime registry, the real `events` facade as the engine's history port, and
// the delete actions.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearAllSyncState, clearSyncOptIn, getOptedInUserId, getStoredDeviceName, getSyncNotice, getSyncOptIn, setDeviceName, setSyncNotice, setSyncOptIn, subscribeSyncOptIn, syncKv } from './optIn';
import { defaultDeviceName } from './deviceName';
import { describeNotice, describeStatus } from './statusText';
import { OFF_STATUS, getActiveEngine, getSyncStatus, resetRuntimeForTests, setActiveEngine, subscribeSyncStatus } from './runtime';
import { createSyncEngine, STATE_KEY, VERSIONS_KEY, type SyncEngine } from './engine';
import { createFacadePort } from './ports';
import { deleteEverything, deleteSyncedData, disableSync, enableSync, loadRemoteStatus } from './actions';
import { EVENTS_PATH, EVENTS_STATUS_PATH, createEngineTransport, fetchRemoteStatus, wipeRemote, type HttpRequest } from './api';
import { events } from '../storage';
import { kv } from '../storage/kv';
import { useAppStore } from '../store/useAppStore';
import { createAppStorePort, createMapKv, createTestBrowser } from '../../test-utils/syncHarness';
import { createFakeClock } from '../../test-utils/fakeClock';
import { resetStorage, useMemoryStorage } from '../../test-utils/memoryStorage';
import type { SyncStatus } from './types';

beforeEach(() => { useMemoryStorage(); useAppStore.getState().clearAllData(); resetRuntimeForTests(); });
afterEach(() => { useAppStore.getState().clearAllData(); resetRuntimeForTests(); resetStorage(); });

describe('the opt-in', () => {
  it('is off until somebody turns it on, and belongs to one account', () => {
    expect(getSyncOptIn()).toBeNull();
    expect(getOptedInUserId()).toBeNull();
    setSyncOptIn('alice', 1234);
    expect(getSyncOptIn()).toEqual({ userId: 'alice', at: 1234 });
    expect(getOptedInUserId()).toBe('alice');
    clearSyncOptIn();
    expect(getOptedInUserId()).toBeNull();
  });

  it('tells subscribers when it changes', () => {
    let n = 0;
    const off = subscribeSyncOptIn(() => { n++; });
    setSyncOptIn('alice');
    clearSyncOptIn();
    off();
    setSyncOptIn('bob');
    expect(n).toBe(2);
  });

  it('turning it on clears an old notice; a malformed value reads as off', () => {
    setSyncNotice('server_reset');
    expect(getSyncNotice()).toBe('server_reset');
    setSyncOptIn('alice');
    expect(getSyncNotice()).toBeNull();
    kv.set('sync', 'optin', { userId: 5 });
    expect(getSyncOptIn()).toBeNull();
    kv.set('sync', 'optin', 'yes');
    expect(getSyncOptIn()).toBeNull();
  });

  it('forgetting sync state removes every sync key, optionally keeping the device name', () => {
    setSyncOptIn('alice');
    setDeviceName('Kitchen laptop');
    syncKv.set(STATE_KEY, { v: 1 });
    syncKv.set(VERSIONS_KEY, { v: 1 });
    setSyncNotice('server_reset');
    clearAllSyncState({ keepDeviceName: true });
    expect(kv.keys('sync')).toEqual(['device-name']);
    expect(getStoredDeviceName()).toBe('Kitchen laptop');
    clearAllSyncState();
    expect(kv.keys('sync')).toEqual([]);
  });

  it('stores a trimmed, bounded device name, and clears it when emptied', () => {
    setDeviceName('  Desk  ');
    expect(getStoredDeviceName()).toBe('Desk');
    setDeviceName('x'.repeat(100));
    expect(getStoredDeviceName()).toHaveLength(40);
    setDeviceName('   ');
    expect(getStoredDeviceName()).toBeNull();
  });

  it('keeps nothing in sync storage about the camera, only small bookkeeping', () => {
    setSyncOptIn('alice');
    const dump = JSON.stringify(kv.keys('sync'));
    expect(dump).toBe('["optin"]');
  });
});

describe('defaultDeviceName', () => {
  it.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'Chrome on macOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', 'Edge on Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 'Safari on macOS'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0', 'Firefox on Linux'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) stop-biting/1.1.0 Chrome/126.0.0.0 Electron/31.0.0 Safari/537.36', 'Stop Biting app on macOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Safari on iOS'],
    ['', 'This device'],
    [undefined, 'This device'],
  ])('%s', (ua, expected) => {
    expect(defaultDeviceName(ua)).toBe(expected);
  });
});

describe('describeStatus', () => {
  const NOW = 1_700_000_000_000;
  const base: SyncStatus = { ...OFF_STATUS, phase: 'idle' };
  const say = (patch: Partial<SyncStatus>) => describeStatus({ ...base, ...patch }, NOW);

  it('says when it last synced, and what is waiting', () => {
    expect(say({ lastSyncedAt: NOW - 5 * 60_000 }).headline).toBe('Last synced 5 minutes ago.');
    expect(say({ lastSyncedAt: NOW - 5 * 60_000, pending: 3 }).detail).toBe('3 changes are waiting to be sent.');
    expect(say({ lastSyncedAt: NOW, pending: 1 }).detail).toBe('1 change is waiting to be sent.');
    expect(say({ lastSyncedAt: null }).headline).toBe('Waiting for the first sync.');
    expect(say({ lastSyncedAt: NOW - 60_000 }).tone).toBe('ok');
  });

  it('reassures in every problem state that the history on the device is safe', () => {
    expect(say({ phase: 'offline', pending: 2 }).detail).toMatch(/saved on this device/);
    expect(say({ phase: 'backoff', retryAt: NOW + 120_000 }).detail).toMatch(/safe on this device. Trying again in 2 minutes/);
    expect(say({ phase: 'signed_out' }).detail).toMatch(/untouched/);
    expect(say({ phase: 'unavailable' }).detail).toMatch(/safe on this device/);
    expect(say({ phase: 'rejected' }).detail).toMatch(/Nothing is lost/);
    expect(say({ phase: 'quota' }).headline).toMatch(/full/);
    expect(say({ phase: 'syncing' }).headline).toBe('Syncing…');
    for (const phase of ['offline', 'backoff', 'signed_out', 'unavailable', 'rejected', 'quota', 'server_reset'] as const) {
      expect(say({ phase }).tone, phase).toBe('warn');
    }
  });

  it('never uses wording the owner ruled out', () => {
    const phases = ['off', 'idle', 'syncing', 'offline', 'backoff', 'signed_out', 'unavailable', 'rejected', 'quota', 'server_reset'] as const;
    const all = phases.map(phase => JSON.stringify(say({ phase, lastSyncedAt: NOW, retryAt: NOW + 1000 }))).join(' ') + JSON.stringify(describeNotice('server_reset'));
    expect(all).not.toMatch(/100% private|no cloud|zero network|nothing leaves/i);
  });

  it('has a message for the server-reset notice', () => {
    expect(describeNotice('server_reset').headline).toMatch(/deleted from another device/);
  });
});

describe('the runtime registry', () => {
  it('reports off when no engine runs, and the engine\'s status while one does', () => {
    expect(getSyncStatus()).toBe(OFF_STATUS);
    expect(getActiveEngine()).toBeNull();

    const clock = createFakeClock();
    const b = createTestBrowser('a');
    const engine: SyncEngine = createSyncEngine({
      userId: 'u', deviceId: 'd', store: b.port, kv: b.kv,
      transport: { sync: async () => ({ ok: true, body: { events: [], cursor: 1, hasMore: false, epoch: 'e' } }) },
      isEnabled: () => true, isOnline: () => true, now: clock.now, timers: clock.timers,
    });
    let heard = 0;
    const off = subscribeSyncStatus(() => { heard++; });
    setActiveEngine(engine);
    expect(getActiveEngine()).toBe(engine);
    engine.start();
    expect(getSyncStatus().phase).toBe('idle');
    expect(heard).toBeGreaterThan(0);
    setActiveEngine(null);
    expect(getSyncStatus()).toBe(OFF_STATUS);
    off();
  });
});

describe('the engine\'s history port over the real events facade', () => {
  it('lists live and deleted events, merges, and hears about changes', () => {
    const port = createFacadePort(events);
    let heard = 0;
    const off = port.subscribe(() => { heard++; });
    events.add({ id: 'a', source: 'manual', triggers: ['stress'] });
    events.add({ id: 'b', source: 'manual', triggers: ['focus'] });
    events.softDelete('b');
    expect(port.listAll().map(e => [e.id, e.deleted === true]).sort()).toEqual([['a', false], ['b', true]]);
    expect(heard).toBe(3);
    const r = port.merge([{ id: 'c', ts: 5, source: 'manual', behavior: 'nail_biting', updatedAt: 5, triggers: ['focus'] }]);
    expect(r).toEqual({ applied: 1, skipped: 0 });
    expect(events.get('c')).toBeDefined();
    off();
  });

  it('behaves exactly like the app-store port the two-browser tests use', () => {
    // Same operations on (a) the global store through the facade and (b) a fresh store through the test port.
    const fresh = createTestBrowser('b');
    const facadePort = createFacadePort(events);
    const incoming = [
      { id: 'x1', ts: 100, source: 'manual', behavior: 'nail_biting', updatedAt: 100, triggers: ['stress'], deviceId: 'dev-z' },
      { id: 'x2', ts: 200, source: 'alarm', behavior: 'cuticle_skin_biting', updatedAt: 200, confirmed: true, hand: 'left', competingResponse: { done: true, durationSec: 4 } },
      { id: 'x3', ts: 300, source: 'manual', behavior: 'nail_biting', updatedAt: 300, deleted: true },
      { id: 'x1', ts: 100, source: 'manual', behavior: 'nail_biting', updatedAt: 150, triggers: ['boredom'], deviceId: 'dev-z' },
      { id: 'bad', ts: 'no' },
      { id: 'x2', ts: 200, source: 'alarm', behavior: 'cuticle_skin_biting', updatedAt: 50, confirmed: false },
    ];
    const r1 = facadePort.merge(incoming);
    const r2 = createAppStorePort(fresh.store).merge(incoming);
    expect(r1).toEqual(r2);
    const sort = (l: ReturnType<typeof facadePort.listAll>) => [...l].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(sort(facadePort.listAll())).toEqual(sort(fresh.port.listAll()));
  });
});

// ── The delete actions ──────────────────────────────────────────────────────

function fakeServer(opts: { wipeStatus?: number } = {}) {
  const calls: Array<{ method: string; path: string }> = [];
  const request: HttpRequest = async (method, path) => {
    calls.push({ method, path });
    if (method === 'DELETE' && path === EVENTS_PATH) {
      return opts.wipeStatus !== undefined && opts.wipeStatus !== 200 ? { status: opts.wipeStatus, body: null } : { status: 200, body: { deleted: 7, epoch: 'e2' } };
    }
    if (method === 'GET' && path === EVENTS_STATUS_PATH) {
      return { status: 200, body: { epoch: 'e1', count: 9, live: 7, deleted: 2, quota: 50000, lastChangeAt: 1 } };
    }
    return { status: 404, body: null };
  };
  return { calls, request };
}

function runningEngine() {
  const clock = createFakeClock();
  const b = createTestBrowser('a');
  const kvp = createMapKv();
  const sent: unknown[] = [];
  const engine = createSyncEngine({
    userId: 'alice', deviceId: 'dev-a', store: b.port, kv: kvp,
    transport: { sync: async req => { sent.push(req); return { ok: true, body: { events: [], cursor: 1, hasMore: false, epoch: 'e1' } }; } },
    isEnabled: () => true, isOnline: () => true, now: clock.now, timers: clock.timers, random: () => 0.5,
  });
  engine.start();
  setActiveEngine(engine);
  return { engine, clock, b, kvp, sent };
}

describe('the sync actions', () => {
  it('enable and disable only flip the opt-in', () => {
    enableSync('alice');
    expect(getOptedInUserId()).toBe('alice');
    disableSync();
    expect(getOptedInUserId()).toBeNull();
  });

  it('reads how much the server holds', async () => {
    const { request, calls } = fakeServer();
    const r = await loadRemoteStatus(request);
    expect(r).toMatchObject({ ok: true, status: { count: 9, live: 7, deleted: 2, quota: 50000 } });
    expect(calls).toEqual([{ method: 'GET', path: EVENTS_STATUS_PATH }]);
  });

  it('Delete synced data: wipes the server copy, switches sync off, leaves history on the device', async () => {
    events.add({ id: 'mine', source: 'manual', triggers: ['stress'] });
    setSyncOptIn('alice');
    setDeviceName('Desk');
    const { engine, sent } = runningEngine();
    await engine.syncNow();
    const sentBefore = sent.length;

    const { request, calls } = fakeServer();
    const r = await deleteSyncedData(request);
    expect(r).toEqual({ ok: true, deleted: 7 });
    expect(calls).toEqual([{ method: 'DELETE', path: EVENTS_PATH }]);
    expect(getSyncOptIn()).toBeNull();                       // sync is off
    expect(kv.keys('sync')).toEqual(['device-name']);        // and forgotten, except the device label
    expect(events.get('mine')).toBeDefined();                // the history on this device is untouched
    expect(await engine.syncNow()).toEqual({ kind: 'skipped', why: 'paused' }); // the engine did not upload behind the delete
    expect(sent).toHaveLength(sentBefore);
  });

  it('Delete synced data: if the server says no, nothing changes and sync carries on', async () => {
    setSyncOptIn('alice');
    const { engine, sent } = runningEngine();
    await engine.syncNow();
    const r = await deleteSyncedData(fakeServer({ wipeStatus: 500 }).request);
    expect(r).toEqual({ ok: false, status: 500 });
    expect(getSyncOptIn()).not.toBeNull();
    const before = sent.length;
    await engine.syncNow();
    expect(sent.length).toBe(before + 1); // resumed
  });

  it('Delete everything with the synced copy: server first, then this device', async () => {
    events.add({ id: 'mine', source: 'manual' });
    setSyncOptIn('alice');
    const { request, calls } = fakeServer();
    let cleared = 0;
    const order: string[] = [];
    const wrapped: HttpRequest = async (m, p, b) => { order.push('server'); return request(m, p, b); };
    const r = await deleteEverything({ alsoDeleteSynced: true, clearLocal: () => { order.push('local'); cleared++; useAppStore.getState().clearAllData(); }, request: wrapped });
    expect(r.ok).toBe(true);
    expect(order).toEqual(['server', 'local']);
    expect(cleared).toBe(1);
    expect(calls).toEqual([{ method: 'DELETE', path: EVENTS_PATH }]);
    expect(events.list({ includeDeleted: true })).toEqual([]);
    expect(kv.keys('sync')).toEqual([]);
  });

  it('Delete everything: if the server copy cannot be deleted, nothing local is erased', async () => {
    events.add({ id: 'mine', source: 'manual' });
    setSyncOptIn('alice');
    let cleared = 0;
    const r = await deleteEverything({ alsoDeleteSynced: true, clearLocal: () => { cleared++; }, request: fakeServer({ wipeStatus: 0 }).request });
    expect(r).toEqual({ ok: false, status: 0 });
    expect(cleared).toBe(0);
    expect(events.get('mine')).toBeDefined();
    expect(getSyncOptIn()).not.toBeNull();
  });

  it('Delete everything on this device only: no server call, sync switched off, the synced copy stays', async () => {
    events.add({ id: 'mine', source: 'manual' });
    setSyncOptIn('alice');
    const { request, calls } = fakeServer();
    const r = await deleteEverything({ alsoDeleteSynced: false, clearLocal: () => useAppStore.getState().clearAllData(), request });
    expect(r.ok).toBe(true);
    expect(calls).toEqual([]);
    expect(events.list({ includeDeleted: true })).toEqual([]);
    expect(kv.keys('sync')).toEqual([]);
  });
});

describe('api.ts', () => {
  it('builds the transport result from the HTTP result', async () => {
    const ok = createEngineTransport(async () => ({ status: 200, body: { events: [], cursor: 3, hasMore: false, epoch: 'e' } }));
    expect(await ok.sync({ since: 0, events: [], deviceId: 'd', epoch: null })).toEqual({ ok: true, body: { events: [], cursor: 3, hasMore: false, epoch: 'e' } });
    const limited = createEngineTransport(async () => ({ status: 429, body: null, retryAfterMs: 5000 }));
    expect(await limited.sync({ since: 0, events: [], deviceId: 'd', epoch: null })).toEqual({ ok: false, status: 429, retryAfterMs: 5000 });
    const weird = createEngineTransport(async () => ({ status: 200, body: 'not an object' }));
    expect(await weird.sync({ since: 0, events: [], deviceId: 'd', epoch: null })).toMatchObject({ ok: false, status: 502 });
    const boom = createEngineTransport(async () => { throw new Error('offline'); });
    expect(await boom.sync({ since: 0, events: [], deviceId: 'd', epoch: null })).toEqual({ ok: false, status: 0, retryAfterMs: undefined });
  });

  it('wipe and status wrap failures as plain results', async () => {
    expect(await wipeRemote(async () => { throw new Error('x'); })).toEqual({ ok: false, status: 0 });
    expect(await wipeRemote(async () => ({ status: 200, body: { nope: 1 } }))).toEqual({ ok: false, status: 502 });
    expect(await fetchRemoteStatus(async () => ({ status: 401, body: null }))).toEqual({ ok: false, status: 401 });
  });
});
