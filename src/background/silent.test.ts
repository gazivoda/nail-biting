import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { quietNow, silentNow } from './silent';
import { dispatchWatch, resetWatchForTests } from './watchStore';
import { resetFlagsForTests } from '../features/flags';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';

const flags = (...on: string[]) => {
  kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(on.map((n) => [n, true])) });
  resetFlagsForTests();
};

beforeEach(() => {
  setStorageAdapter(createMemoryAdapter());
  resetFlagsForTests();
  resetWatchForTests();
});
afterEach(() => {
  resetStorage();
  resetFlagsForTests();
  resetWatchForTests();
});

describe('silent and quiet', () => {
  it('with the flag off nothing is ever silent or quiet, whatever is stored', () => {
    kv.set('background', 'state', { v: 1, pausedUntil: Date.now() + 600_000, meetingUntil: null });
    expect(silentNow()).toBe(false);
    expect(quietNow()).toBe(false);
    kv.set('background', 'state', { v: 1, pausedUntil: null, meetingUntil: Date.now() + 600_000 });
    resetWatchForTests();
    expect(silentNow()).toBe(false);
    expect(quietNow()).toBe(false);
  });

  it('with the flag on: meeting mode is silent and quiet; a pause is quiet (nothing runs, so nothing sounds)', () => {
    flags('background_watching');
    expect(silentNow()).toBe(false);
    expect(quietNow()).toBe(false);
    dispatchWatch({ type: 'meeting', now: Date.now(), minutes: 30 });
    expect(silentNow()).toBe(true);
    expect(quietNow()).toBe(true);
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 });
    expect(silentNow()).toBe(false);
    expect(quietNow()).toBe(true);
    dispatchWatch({ type: 'resume' });
    expect(quietNow()).toBe(false);
  });
});
