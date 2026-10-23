import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  NO_PROVIDERS, PROVIDERS_TTL_MS, anyExtraProvider, ensureProviders, getProviders, normalizeProviders,
  providersLoaded, resetProvidersForTests, subscribeProviders,
} from './providers';
import { kv } from '../storage/kv';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { setStorageAdapter } from '../storage/adapter';

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

beforeEach(() => {
  setStorageAdapter(createMemoryAdapter());
  resetProvidersForTests();
});
afterEach(() => resetStorage());

describe('normalizeProviders', () => {
  it('keeps only the three known keys, and only an exact true', () => {
    expect(normalizeProviders({ magic_link: true, apple: 'true', microsoft: 1, extra: true }))
      .toEqual({ magic_link: true, apple: false, microsoft: false });
    expect(normalizeProviders(null)).toEqual(NO_PROVIDERS);
    expect(normalizeProviders('x')).toEqual(NO_PROVIDERS);
    expect(normalizeProviders(undefined)).toEqual(NO_PROVIDERS);
  });
  it('anyExtraProvider', () => {
    expect(anyExtraProvider(NO_PROVIDERS)).toBe(false);
    expect(anyExtraProvider({ ...NO_PROVIDERS, apple: true })).toBe(true);
  });
});

describe('ensureProviders', () => {
  it('starts with no extra providers (so every button stays Google-only) before anything is known', () => {
    expect(getProviders()).toEqual(NO_PROVIDERS);
    expect(providersLoaded()).toBe(false);
  });

  it('asks the server once and tells subscribers', async () => {
    let calls = 0;
    let told = 0;
    subscribeProviders(() => { told++; });
    await ensureProviders({ fetchImpl: () => { calls++; return reply({ magic_link: true, apple: false, microsoft: true }); } });
    expect(calls).toBe(1);
    expect(getProviders()).toEqual({ magic_link: true, apple: false, microsoft: true });
    expect(providersLoaded()).toBe(true);
    expect(told).toBeGreaterThan(0);
  });

  it('reuses the answer for ten minutes, then asks again', async () => {
    let t = 1_000_000;
    let calls = 0;
    const fetchImpl = () => { calls++; return reply({ magic_link: true }); };
    await ensureProviders({ fetchImpl, now: () => t });
    t += PROVIDERS_TTL_MS - 1;
    await ensureProviders({ fetchImpl, now: () => t });
    expect(calls).toBe(1);
    t += 2;
    await ensureProviders({ fetchImpl, now: () => t });
    expect(calls).toBe(2);
  });

  it('shares one request between callers', async () => {
    let calls = 0;
    const fetchImpl = () => { calls++; return reply({ apple: true }); };
    await Promise.all([ensureProviders({ fetchImpl }), ensureProviders({ fetchImpl }), ensureProviders({ fetchImpl })]);
    expect(calls).toBe(1);
  });

  it('a 404 (every flag off) means none, and is remembered so pages do not keep asking', async () => {
    let calls = 0;
    const fetchImpl = () => { calls++; return reply({ error: 'Not found' }, 404); };
    await ensureProviders({ fetchImpl });
    expect(getProviders()).toEqual(NO_PROVIDERS);
    expect(providersLoaded()).toBe(true);
    resetProvidersForTests();
    await ensureProviders({ fetchImpl }); // a later page load
    expect(calls).toBe(1);
  });

  it('a network failure keeps what was known and never turns anything on', async () => {
    kv.set('auth', 'providers', { at: 0, value: { magic_link: true, apple: false, microsoft: false } }); // stale cache
    await ensureProviders({ fetchImpl: () => Promise.reject(new Error('offline')), now: () => PROVIDERS_TTL_MS * 5 });
    expect(getProviders()).toEqual({ magic_link: true, apple: false, microsoft: false });

    resetProvidersForTests();
    kv.remove('auth', 'providers');
    await ensureProviders({ fetchImpl: () => Promise.reject(new Error('offline')) });
    expect(getProviders()).toEqual(NO_PROVIDERS);
  });

  it('a server error is not cached as "none"', async () => {
    let calls = 0;
    await ensureProviders({ fetchImpl: () => { calls++; return reply({}, 500); } });
    resetProvidersForTests();
    await ensureProviders({ fetchImpl: () => { calls++; return reply({ apple: true }); } });
    expect(calls).toBe(2);
    expect(getProviders().apple).toBe(true);
  });

  it('ignores a corrupt cache entry', async () => {
    kv.set('auth', 'providers', 'garbage');
    expect(getProviders()).toEqual(NO_PROVIDERS);
  });

  it('never stores anything but the three booleans (no tokens, no PII)', async () => {
    await ensureProviders({ fetchImpl: () => reply({ magic_link: true, apple: true, microsoft: false, secret: 'x' }) });
    const stored = kv.get<{ at: number; value: Record<string, unknown> } | null>('auth', 'providers', null);
    expect(Object.keys(stored!.value).sort()).toEqual(['apple', 'magic_link', 'microsoft']);
  });
});
