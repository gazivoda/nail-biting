// End-to-end persistence tests: a real zustand store, hydrated from a seeded
// in-memory adapter, going through the real persist middleware, migrate and
// backup path. Node only; the adapter stands in for localStorage.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createAppStore, STATE_VERSION, computeBestStreak } from '../store/useAppStore';
import { createStatePersistStorage, lastBackupResult, backupKeyFor, corruptKeyFor, lastStateWriteFailed } from './persistStorage';
import { setStorageAdapter, readRaw } from './adapter';
import { getDeviceId, resetDeviceIdCacheForTests } from './deviceId';
import { createFlakyAdapter, createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { basicState, emptyState, largeState, persistedJson, v0State } from './fixtures/v1State';
import type { Incident } from '../types';

const KEY = 'stop-biting-state';
const BACKUP = 'stop-biting-state-v1-backup';

function hydrate(initial: Record<string, string>) {
  const adapter = createMemoryAdapter(initial);
  setStorageAdapter(adapter);
  const store = createAppStore(createStatePersistStorage(STATE_VERSION));
  return { adapter, store };
}

beforeEach(() => resetDeviceIdCacheForTests());
afterEach(() => resetStorage());

describe('first load after the upgrade (v1 payload on disk)', () => {
  const v1 = persistedJson(basicState(), 1);

  it('backs up the raw v1 JSON, byte for byte, before anything is rewritten', () => {
    const { adapter } = hydrate({ [KEY]: v1 });
    expect(adapter.getItem(BACKUP)).toBe(v1);
    expect(lastBackupResult()).toMatchObject({ status: 'written', key: BACKUP, fromVersion: 1 });
  });

  it('then hydrates the migrated state and rewrites the payload as v2', () => {
    const { adapter, store } = hydrate({ [KEY]: v1 });
    const s = store.getState();
    const original = (JSON.parse(v1) as { state: { incidents: Incident[] } }).state.incidents;

    expect(s.incidents.map(i => i.id)).toEqual(original.map(i => i.id));
    expect(s.incidents.map(i => i.timestamp)).toEqual(original.map(i => i.timestamp));
    expect(s.incidents.every(i => i.behavior === 'nail_biting' && typeof i.updatedAt === 'number')).toBe(true);

    const rewritten = JSON.parse(adapter.getItem(KEY)!) as { version: number; state: { incidents: Incident[] } };
    expect(rewritten.version).toBe(2);
    expect(rewritten.state.incidents).toHaveLength(original.length);
  });

  it('keeps the streak the user had', () => {
    const state = basicState();
    const { store } = hydrate({ [KEY]: persistedJson(state, 1) });
    const s = store.getState();
    expect(s.lastBiteTime).toBe(state.lastBiteTime);
    expect(s.bestStreakMs).toBe(state.bestStreakMs);
    expect(computeBestStreak(s.incidents, s.historyStartTime)).toBe(state.bestStreakMs);
    expect(s.firstOpenTime).toBe(state.firstOpenTime);
    expect(s.theme).toBe('dark');
    expect(s.customTags).toEqual(state.customTags);
  });

  it('never overwrites an existing backup', () => {
    const earlier = persistedJson(emptyState(), 1);
    const { adapter } = hydrate({ [KEY]: v1, [BACKUP]: earlier });
    expect(adapter.getItem(BACKUP)).toBe(earlier);
    expect(lastBackupResult().status).toBe('exists');
  });

  it('does not back up twice across loads (the second load sees v2)', () => {
    const { adapter } = hydrate({ [KEY]: v1 });
    const backup = adapter.getItem(BACKUP);
    // Reload: the rewritten payload is v2 now.
    createAppStore(createStatePersistStorage(STATE_VERSION));
    expect(adapter.getItem(BACKUP)).toBe(backup);
  });

  it('survives a v0 payload, backing it up under the same v1 key', () => {
    const v0 = persistedJson(v0State(), 0);
    const { adapter, store } = hydrate({ [KEY]: v0 });
    expect(adapter.getItem(BACKUP)).toBe(v0);
    expect(store.getState().incidents).toHaveLength((basicState().incidents as unknown[]).length);
    expect(store.getState().historyStartTime).toBe(basicState().firstOpenTime);
  });

  it('handles a 10,000 event payload', () => {
    const big = persistedJson(largeState(10_000), 1);
    const { adapter, store } = hydrate({ [KEY]: big });
    expect(adapter.getItem(BACKUP)).toBe(big);
    expect(store.getState().incidents).toHaveLength(10_000);
  });
});

describe('no backup when there is nothing to migrate', () => {
  it('a brand new user (nothing stored)', () => {
    const { adapter } = hydrate({});
    expect(adapter.getItem(BACKUP)).toBeNull();
  });

  it('a user already on the current version', () => {
    const current = persistedJson(basicState(), STATE_VERSION);
    const { adapter } = hydrate({ [KEY]: current });
    expect(adapter.getItem(BACKUP)).toBeNull();
  });
});

describe('storage that fails', () => {
  it('still migrates when the backup cannot be written, and says so', () => {
    const v1 = persistedJson(basicState(), 1);
    const { adapter, control } = createFlakyAdapter({ [KEY]: v1 });
    control.failWrites = key => key === BACKUP;
    setStorageAdapter(adapter);

    const store = createAppStore(createStatePersistStorage(STATE_VERSION));
    expect(lastBackupResult().status).toBe('failed');
    expect(store.getState().incidents).toHaveLength((basicState().incidents as unknown[]).length);
    // The original payload is untouched until the migrated one is written.
    expect(JSON.parse(adapter.getItem(KEY)!).version).toBe(2);
  });

  it('a write that fails (full quota) does not throw into the caller, and memory stays right', () => {
    const { adapter, control } = createFlakyAdapter({});
    setStorageAdapter(adapter);
    const store = createAppStore(createStatePersistStorage(STATE_VERSION));

    control.failWrites = true;
    expect(() => store.getState().logIncident('stress')).not.toThrow();
    expect(store.getState().incidents).toHaveLength(1);
    expect(lastStateWriteFailed()).toBe(true);

    control.failWrites = false;
    store.getState().logIncident('focus');
    expect(lastStateWriteFailed()).toBe(false);
    expect(JSON.parse(adapter.getItem(KEY)!).state.incidents).toHaveLength(2);
  });

  it('unreadable storage hydrates as a fresh install instead of crashing', () => {
    const { adapter, control } = createFlakyAdapter({ [KEY]: persistedJson(basicState(), 1) });
    control.failReads = true;
    setStorageAdapter(adapter);
    const store = createAppStore(createStatePersistStorage(STATE_VERSION));
    expect(store.getState().incidents).toEqual([]);
  });

  it('keeps a corrupt payload instead of silently replacing it', () => {
    const { adapter } = hydrate({ [KEY]: '{"state": {"incidents": [' });
    expect(adapter.getItem(corruptKeyFor(KEY))).toBe('{"state": {"incidents": [');
  });

  it('backup keys are stable', () => {
    expect(backupKeyFor(KEY, 0)).toBe(BACKUP);
    expect(backupKeyFor(KEY, 1)).toBe(BACKUP);
    expect(backupKeyFor(KEY, 2)).toBe('stop-biting-state-v2-backup');
  });
});

describe('new events are recorded with the v2 fields', () => {
  it('a manual log and an alarm both carry behavior, source, updatedAt and the device id', () => {
    const { adapter, store } = hydrate({});
    store.getState().logIncident('stress');
    store.getState().logIncident('auto-detected', true);

    const [alarm, manual] = store.getState().incidents;
    const device = getDeviceId();
    expect(device).toMatch(/\S/);

    expect(manual).toMatchObject({
      tag: 'stress', autoDetected: false, source: 'manual', behavior: 'nail_biting', deviceId: device,
    });
    expect(alarm).toMatchObject({
      tag: 'auto-detected', autoDetected: true, source: 'alarm', behavior: 'nail_biting', deviceId: device,
    });
    for (const rec of [alarm, manual]) {
      expect(rec.ts).toBe(rec.timestamp);
      expect(rec.updatedAt).toBe(rec.timestamp);
    }

    const persisted = JSON.parse(adapter.getItem(KEY)!) as { version: number; state: { incidents: Incident[] } };
    expect(persisted.version).toBe(STATE_VERSION);
    expect(persisted.state.incidents[0].behavior).toBe('nail_biting');
  });

  it('the device id is generated once and stays stable', () => {
    hydrate({});
    const a = getDeviceId();
    expect(getDeviceId()).toBe(a);
    expect(readRaw('sb:app:device-id')).toBe(JSON.stringify(a));
    resetDeviceIdCacheForTests();
    expect(getDeviceId()).toBe(a); // read back from storage
  });

  it('a confirmed alarm bumps updatedAt and keeps its place in the history', () => {
    const { store } = hydrate({});
    store.getState().logIncident('auto-detected', true);
    const before = store.getState().incidents[0];
    store.getState().confirmIncident(before.id, 'stress');
    const after = store.getState().incidents[0];
    expect(after).toMatchObject({ id: before.id, timestamp: before.timestamp, confirmed: true, tag: 'stress' });
    expect(after.updatedAt!).toBeGreaterThanOrEqual(before.updatedAt!);
  });

  it('a deleted event leaves a minimal tombstone and undo removes it', () => {
    const { store } = hydrate({});
    store.getState().logIncident('stress');
    const rec = store.getState().incidents[0];
    store.getState().deleteIncident(rec.id);

    expect(store.getState().incidents).toEqual([]);
    expect(store.getState().tombstones).toHaveLength(1);
    expect(store.getState().tombstones[0]).toMatchObject({ id: rec.id, deleted: true, behavior: 'nail_biting' });
    // A tombstone carries no tag or trigger.
    expect(store.getState().tombstones[0]).not.toHaveProperty('tag');

    store.getState().restoreIncident(rec);
    expect(store.getState().incidents.map(i => i.id)).toEqual([rec.id]);
    expect(store.getState().tombstones).toEqual([]);
  });
});
