// The storage facade (src/storage/index.ts), the key-value area and the blob
// store, exercised in node with an injected in-memory adapter.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { events, settings, kv, localBlobs, blobStorageStatus, parseWireEvent, storageStatus, getDeviceId } from './index';
import { createMemoryBlobStore, setBlobStoreForTests } from './blobs';
import { setStorageAdapter, readRaw } from './adapter';
import { resetDeviceIdCacheForTests } from './deviceId';
import { createFlakyAdapter, createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';

const T0 = 1_700_000_000_000;
const at = (ms: number) => vi.setSystemTime(T0 + ms);

beforeEach(() => {
  vi.useFakeTimers();
  at(0);
  setStorageAdapter(createMemoryAdapter());
  resetDeviceIdCacheForTests();
  useAppStore.getState().clearAllData();
});
afterEach(() => {
  vi.useRealTimers();
  resetStorage();
});

describe('events', () => {
  it('add() records a canonical event and the store streak follows', () => {
    at(60_000);
    const e = events.add({ source: 'manual', triggers: ['stress'] });
    expect(e).toMatchObject({ source: 'manual', behavior: 'nail_biting', ts: T0 + 60_000, triggers: ['stress'], updatedAt: T0 + 60_000 });
    expect(e.deviceId).toBe(getDeviceId());
    expect(useAppStore.getState().lastBiteTime).toBe(T0 + 60_000);
    expect(useAppStore.getState().incidents[0]).toMatchObject({ tag: 'stress', autoDetected: false });
  });

  it('an alarm added through the facade stays pending until confirmed, like logIncident', () => {
    at(1_000);
    const e = events.add({ source: 'alarm' });
    expect(useAppStore.getState().lastBiteTime).toBeNull();
    at(2_000);
    const c = events.update(e.id, { confirmed: true, triggers: ['focus'] });
    expect(c).toMatchObject({ confirmed: true, triggers: ['focus'], updatedAt: T0 + 2_000 });
    expect(useAppStore.getState().lastBiteTime).toBe(T0 + 1_000);
  });

  it('update() changes mutable fields only and stamps updatedAt', () => {
    at(1_000);
    const e = events.add({ source: 'alarm' });
    at(5_000);
    const u = events.update(e.id, {
      behavior: 'cuticle_skin_biting', hand: 'left', falsePositive: true, competingResponse: { done: true, durationSec: 30 },
    })!;
    expect(u).toMatchObject({
      id: e.id, ts: e.ts, source: 'alarm',
      behavior: 'cuticle_skin_biting', hand: 'left', falsePositive: true,
      competingResponse: { done: true, durationSec: 30 }, updatedAt: T0 + 5_000,
    });
    expect(events.update('missing', { hand: 'right' })).toBeUndefined();
  });

  it('softDelete() removes it from lists and leaves a tombstone', () => {
    at(1_000);
    const a = events.add({ source: 'manual' });
    at(2_000);
    const b = events.add({ source: 'manual' });
    at(3_000);
    expect(events.softDelete(a.id)).toBe(true);
    expect(events.softDelete(a.id)).toBe(false);

    expect(events.list().map(e => e.id)).toEqual([b.id]);
    const withDeleted = events.list({ includeDeleted: true });
    expect(withDeleted.map(e => e.id).sort()).toEqual([a.id, b.id].sort());
    expect(withDeleted.find(e => e.id === a.id)).toMatchObject({ deleted: true, updatedAt: T0 + 3_000 });
    expect(events.count()).toBe(1);
  });

  it('list() filters by behavior, source, time, trigger and false positives; orders and limits', () => {
    at(1_000); events.add({ source: 'manual', triggers: ['stress'] });
    at(2_000); events.add({ source: 'alarm', behavior: 'nose_picking' });
    at(3_000); events.add({ source: 'alarm', behavior: 'nail_biting', falsePositive: true });
    at(4_000); events.add({ source: 'manual', behavior: 'hair_pulling', triggers: ['stress', 'boredom'] });

    expect(events.list().map(e => e.ts - T0)).toEqual([4_000, 3_000, 2_000, 1_000]);
    expect(events.list({ order: 'oldest' }).map(e => e.ts - T0)).toEqual([1_000, 2_000, 3_000, 4_000]);
    expect(events.list({ behavior: 'nose_picking' })).toHaveLength(1);
    expect(events.list({ behavior: ['nose_picking', 'hair_pulling'] })).toHaveLength(2);
    expect(events.list({ source: 'alarm' })).toHaveLength(2);
    expect(events.list({ since: T0 + 2_000, until: T0 + 4_000 }).map(e => e.ts - T0)).toEqual([3_000, 2_000]);
    expect(events.list({ trigger: 'stress' })).toHaveLength(2);
    expect(events.list({ falsePositive: true })).toHaveLength(1);
    expect(events.list({ falsePositive: false })).toHaveLength(3);
    expect(events.list({ limit: 2 })).toHaveLength(2);
    expect(events.count({ behavior: 'nail_biting' })).toBe(2);
  });

  it('export -> wipe -> import restores the history and the streak exactly', () => {
    at(10_000); events.add({ source: 'manual', triggers: ['stress'] });
    at(20_000); const alarm = events.add({ source: 'alarm', behavior: 'cuticle_skin_biting' });
    at(25_000); events.update(alarm.id, { confirmed: true, triggers: ['focus'] });
    at(30_000); const gone = events.add({ source: 'manual' });
    at(31_000); events.softDelete(gone.id);

    const s = useAppStore.getState();
    const snapshot = {
      ids: s.incidents.map(i => i.id),
      last: s.lastBiteTime, best: s.bestStreakMs,
      first: s.firstOpenTime, start: s.historyStartTime, floor: s.bestStreakFloorMs,
      list: events.list({ includeDeleted: true }),
    };
    const file = JSON.parse(JSON.stringify(events.exportAll()));
    expect(file).toMatchObject({ format: 'stop-biting-events', version: 2 });

    useAppStore.getState().clearAllData();
    expect(events.list()).toEqual([]);

    expect(events.replaceAll(file)).toEqual({ imported: 3 - 1, skipped: 0 });
    const r = useAppStore.getState();
    expect(r.incidents.map(i => i.id)).toEqual(snapshot.ids);
    expect(r.lastBiteTime).toBe(snapshot.last);
    expect(r.bestStreakMs).toBe(snapshot.best);
    expect(r.firstOpenTime).toBe(snapshot.first);
    expect(r.historyStartTime).toBe(snapshot.start);
    expect(r.bestStreakFloorMs).toBe(snapshot.floor);
    expect(events.list({ includeDeleted: true })).toEqual(snapshot.list);
  });

  it('replaceAll() accepts a bare list, skips malformed entries and counts them', () => {
    const good = { id: 'a', ts: T0 + 5, source: 'manual', behavior: 'nail_biting', updatedAt: T0 + 5 };
    const out = events.replaceAll([good, { id: '', ts: 1, source: 'manual' }, 'nope', { id: 'b', ts: 'x' }, { ...good, id: 'c', behavior: 'bogus' }]);
    expect(out).toEqual({ imported: 1, skipped: 4 });
    expect(events.list().map(e => e.id)).toEqual(['a']);
  });

  it('merge() is last-write-wins by updatedAt, and tombstones beat older copies', () => {
    at(1_000);
    const a = events.add({ source: 'manual', triggers: ['stress'] });
    at(2_000);
    const b = events.add({ source: 'manual' });

    const out = events.merge([
      { ...a, triggers: ['focus'], updatedAt: T0 + 9_000 },                  // newer: wins
      { ...b, hand: 'left', updatedAt: T0 + 100 },                           // older: ignored
      { id: 'new', ts: T0 + 3_000, source: 'alarm', behavior: 'nail_biting', updatedAt: T0 + 3_000 }, // unknown: added
      { id: 'junk' },                                                         // malformed: skipped
    ]);
    expect(out).toEqual({ applied: 2, skipped: 1 });
    expect(events.get(a.id)?.triggers).toEqual(['focus']);
    expect(events.get(b.id)?.hand).toBeUndefined();
    expect(events.get('new')).toBeDefined();

    events.merge([{ ...b, deleted: true, updatedAt: T0 + 10_000 }]);
    expect(events.get(b.id)).toBeUndefined();
    // A live copy older than the tombstone does not resurrect it.
    events.merge([{ ...b, updatedAt: T0 + 5_000 }]);
    expect(events.get(b.id)).toBeUndefined();
  });

  it('subscribe() fires on history changes only', () => {
    const fn = vi.fn();
    const off = events.subscribe(fn);
    events.add({ source: 'manual' });
    expect(fn).toHaveBeenCalledTimes(1);
    useAppStore.getState().setTheme('dark');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    events.add({ source: 'manual' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('parseWireEvent() cleans what it accepts', () => {
    expect(parseWireEvent({ id: 'x', ts: 5, source: 'alarm', evil: '<script>' })).toEqual({
      id: 'x', ts: 5, source: 'alarm', behavior: 'nail_biting', updatedAt: 5,
    });
    expect(parseWireEvent(null)).toBeNull();
    expect(parseWireEvent({ id: 'x', ts: 5, source: 'other' })).toBeNull();
  });
});

describe('settings', () => {
  it('reads and writes the core settings through the store', () => {
    settings.update({ theme: 'dark', alertVolume: 2, detectionSensitivity: 'high' });
    expect(settings.get()).toMatchObject({ theme: 'dark', alertVolume: 1, detectionSensitivity: 'high' });
    expect(useAppStore.getState().theme).toBe('dark');
  });
});

describe('kv', () => {
  it('stores JSON under a namespaced key and reads it back', () => {
    expect(kv.get('hrt', 'responses', ['default'])).toEqual(['default']);
    expect(kv.set('hrt', 'responses', ['a', 'b'])).toBe(true);
    expect(kv.get('hrt', 'responses', [])).toEqual(['a', 'b']);
    expect(readRaw('sb:hrt:responses')).toBe('["a","b"]');
    expect(kv.keys('hrt')).toEqual(['responses']);
    expect(kv.keys('sync')).toEqual([]);
    kv.remove('hrt', 'responses');
    expect(kv.get('hrt', 'responses', null)).toBeNull();
  });

  it('namespaces cannot collide', () => {
    kv.set('hrt', 'x', 1);
    kv.set('sync', 'x', 2);
    expect(kv.get('hrt', 'x', 0)).toBe(1);
    expect(kv.get('sync', 'x', 0)).toBe(2);
  });

  it('returns the fallback for a corrupt value and refuses values it cannot serialise', () => {
    const adapter = createMemoryAdapter({ 'sb:app:bad': '{nope' });
    setStorageAdapter(adapter);
    expect(kv.get('app', 'bad', 'fallback')).toBe('fallback');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(kv.set('app', 'c', circular)).toBe(false);
    expect(kv.set('app', 'u', undefined)).toBe(false);
  });

  it('keeps working in memory when storage refuses writes or reads', () => {
    const { adapter, control } = createFlakyAdapter();
    setStorageAdapter(adapter);
    control.failWrites = true;
    expect(kv.set('app', 'k', 'v')).toBe(false);
    expect(kv.get('app', 'k', 'none')).toBe('v'); // same page still sees it
    control.failReads = true;
    expect(() => kv.get('app', 'other', 1)).not.toThrow();
    expect(kv.get('app', 'other', 1)).toBe(1);
  });

  it('notifies subscribers of the same key', () => {
    const fn = vi.fn();
    const off = kv.subscribe('flags', 'last-known', fn);
    kv.set('flags', 'last-known', { a: true });
    kv.set('flags', 'other', 1);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    kv.remove('flags', 'last-known');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reports whether storage is persistent', () => {
    resetStorage(); // no localStorage in node: memory fallback
    expect(storageStatus().persistent).toBe(false);
    expect(storageStatus().reason).toMatch(/in-memory/);
  });
});

describe('localBlobs (local-only)', () => {
  afterEach(() => setBlobStoreForTests(null));

  it('falls back to memory with no IndexedDB and says it is not persistent', async () => {
    setBlobStoreForTests(null);
    expect(blobStorageStatus().persistent).toBe(false);
    const b = new Blob(['hello'], { type: 'text/plain' });
    expect(await localBlobs.put('photos', '2026-10-01', b)).toBe(true);
    expect(await localBlobs.keys('photos')).toEqual(['2026-10-01']);
    expect(await (await localBlobs.get('photos', '2026-10-01'))!.text()).toBe('hello');
    expect(await localBlobs.get('photos', 'missing')).toBeNull();
    await localBlobs.delete('photos', '2026-10-01');
    expect(await localBlobs.keys('photos')).toEqual([]);
  });

  it('keeps collections apart and clears one at a time', async () => {
    setBlobStoreForTests(createMemoryBlobStore());
    await localBlobs.put('a', '1', new Blob(['x']));
    await localBlobs.put('b', '1', new Blob(['y']));
    await localBlobs.clear('a');
    expect(await localBlobs.keys('a')).toEqual([]);
    expect(await localBlobs.keys('b')).toEqual(['1']);
  });

  it('never throws when the backing store fails', async () => {
    setBlobStoreForTests({
      put: () => Promise.reject(new Error('boom')),
      get: () => Promise.reject(new Error('boom')),
      delete: () => Promise.reject(new Error('boom')),
      keys: () => Promise.reject(new Error('boom')),
      clear: () => Promise.reject(new Error('boom')),
    });
    expect(await localBlobs.put('a', '1', new Blob(['x']))).toBe(false);
    expect(await localBlobs.get('a', '1')).toBeNull();
    expect(await localBlobs.keys('a')).toEqual([]);
  });
});
