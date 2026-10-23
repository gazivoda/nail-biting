import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FLAGS_TTL_MS, ensureFlags, getFlags, isFeatureOn, normalizeFlags, refreshFlags, resetFlagsForTests, subscribeFlags,
} from './flags';
import { FEATURE_NAMES, FEATURES, isFeatureName } from './registry';
import { kv } from '../storage/kv';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { setStorageAdapter } from '../storage/adapter';

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

beforeEach(() => {
  setStorageAdapter(createMemoryAdapter());
  resetFlagsForTests();
  // Vitest runs with import.meta.env.DEV true; keep the dev override out of the way.
  vi.stubGlobal('location', { search: '' });
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetStorage();
});

describe('registry', () => {
  it('has an owner and a description for every flag', () => {
    for (const name of FEATURE_NAMES) {
      expect(FEATURES[name].owner, name).toMatch(/^WS\d+[ab]?$/);
      expect(FEATURES[name].description.length, name).toBeGreaterThan(10);
    }
  });
  it('isFeatureName separates real names from prototype keys', () => {
    expect(isFeatureName('event_sync')).toBe(true);
    expect(isFeatureName('toString')).toBe(false);
    expect(isFeatureName('nope')).toBe(false);
  });
});

describe('normalizeFlags', () => {
  it('keeps only known flags that are exactly true', () => {
    const out = normalizeFlags({ event_sync: true, insights: 'true', referrals: 1, nope: true, share_links: false });
    expect(out.event_sync).toBe(true);
    expect(Object.values(out).filter(Boolean)).toHaveLength(1);
  });
  it('turns anything unusable into all-off', () => {
    for (const bad of [null, undefined, 'x', 42, []]) {
      expect(Object.values(normalizeFlags(bad)).some(Boolean)).toBe(false);
    }
  });
});

describe('defaults', () => {
  it('every flag is off while the answer is unknown', () => {
    expect(Object.values(getFlags()).some(Boolean)).toBe(false);
    expect(isFeatureOn('event_sync')).toBe(false);
  });
});

describe('refreshFlags', () => {
  it('stores the server answer and notifies subscribers', async () => {
    const seen = vi.fn();
    subscribeFlags(seen);
    const fetchImpl = vi.fn(() => reply({ event_sync: true, insights: false, bogus: true })) as unknown as typeof fetch;
    await refreshFlags({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/api/features', expect.objectContaining({ credentials: 'omit' }));
    expect(isFeatureOn('event_sync')).toBe(true);
    expect(isFeatureOn('insights')).toBe(false);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('keeps the same snapshot object when nothing changed', async () => {
    const fetchImpl = (() => reply({ event_sync: true })) as unknown as typeof fetch;
    await refreshFlags({ fetchImpl });
    const first = getFlags();
    await refreshFlags({ fetchImpl });
    expect(getFlags()).toBe(first);
  });

  it('caches the answer so the next visit starts from it, offline', async () => {
    await refreshFlags({ fetchImpl: (() => reply({ referrals: true })) as unknown as typeof fetch });
    expect(kv.get<{ flags: Record<string, boolean> } | null>('flags', 'last-known', null)?.flags.referrals).toBe(true);

    resetFlagsForTests(); // a new page load
    const offline = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    expect(isFeatureOn('referrals')).toBe(true); // from the cache, before any network
    await refreshFlags({ fetchImpl: offline });
    expect(isFeatureOn('referrals')).toBe(true); // a failed request changes nothing
  });

  it('a server error or garbage never turns anything on or clears the cache', async () => {
    await refreshFlags({ fetchImpl: (() => reply({ referrals: true })) as unknown as typeof fetch });
    for (const bad of [
      () => reply({ error: 'x' }, 500),
      () => Promise.resolve(new Response('<html>', { status: 200 })),
      () => reply([true, true]),
      () => Promise.reject(new Error('down')),
    ]) {
      await refreshFlags({ fetchImpl: bad as unknown as typeof fetch });
      expect(isFeatureOn('referrals')).toBe(true);
      expect(isFeatureOn('event_sync')).toBe(false);
    }
  });

  it('a later answer can switch a flag off again', async () => {
    await refreshFlags({ fetchImpl: (() => reply({ referrals: true })) as unknown as typeof fetch });
    await refreshFlags({ fetchImpl: (() => reply({ referrals: false })) as unknown as typeof fetch });
    expect(isFeatureOn('referrals')).toBe(false);
  });

  it('shares one request between concurrent callers', async () => {
    const fetchImpl = vi.fn(() => reply({})) as unknown as typeof fetch;
    await Promise.all([refreshFlags({ fetchImpl }), refreshFlags({ fetchImpl }), refreshFlags({ fetchImpl })]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('ignores a corrupt cache', () => {
    setStorageAdapter(createMemoryAdapter({ 'sb:flags:last-known': '{"flags": "nope"' }));
    resetFlagsForTests();
    expect(Object.values(getFlags()).some(Boolean)).toBe(false);
  });
});

describe('ensureFlags', () => {
  it('asks once, then not again until the answer is stale', async () => {
    let t = 1_000_000;
    const fetchImpl = vi.fn(() => reply({})) as unknown as typeof fetch;
    const opts = { fetchImpl, now: () => t };
    ensureFlags(opts);
    await refreshFlags(opts); // joins the request ensureFlags started and waits for it
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    ensureFlags(opts);
    ensureFlags(opts);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t += FLAGS_TTL_MS + 1;
    ensureFlags(opts);
    await refreshFlags(opts);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not hammer a dead server: a failed attempt also counts', async () => {
    const t = 5_000_000;
    const down = vi.fn(() => Promise.reject(new Error('down'))) as unknown as typeof fetch;
    ensureFlags({ fetchImpl: down, now: () => t });
    await refreshFlags({ fetchImpl: down, now: () => t });
    expect(down).toHaveBeenCalledTimes(1);
    ensureFlags({ fetchImpl: down, now: () => t + 1000 });
    expect(down).toHaveBeenCalledTimes(1);
  });
});

describe('development override (?ff=)', () => {
  it('forces named flags on in dev, ignores unknown names, and is remembered', () => {
    vi.stubGlobal('location', { search: '?ff=event_sync,not_a_flag,insights' });
    resetFlagsForTests();
    expect(isFeatureOn('event_sync')).toBe(true);
    expect(isFeatureOn('insights')).toBe(true);
    expect(isFeatureOn('referrals')).toBe(false);

    vi.stubGlobal('location', { search: '' });
    resetFlagsForTests();
    expect(isFeatureOn('event_sync')).toBe(true); // remembered across a reload
    vi.stubGlobal('location', { search: '?ff=' });
    resetFlagsForTests();
    expect(isFeatureOn('event_sync')).toBe(false); // empty value clears it
  });

  it('an override never turns off what the server turned on', async () => {
    await refreshFlags({ fetchImpl: (() => reply({ referrals: true })) as unknown as typeof fetch });
    vi.stubGlobal('location', { search: '?ff=insights' });
    resetFlagsForTests();
    expect(isFeatureOn('referrals')).toBe(true);
    expect(isFeatureOn('insights')).toBe(true);
  });
});
