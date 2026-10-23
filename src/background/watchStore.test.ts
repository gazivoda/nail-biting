import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dispatchWatch, getWatchState, getWatchStamp, resetWatchForTests, subscribeWatch } from './watchStore';
import { isDetecting, type WatchState } from './pauseMachine';
import { kv } from '../storage/kv';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { setStorageAdapter } from '../storage/adapter';

const MIN = 60_000;

beforeEach(() => {
  setStorageAdapter(createMemoryAdapter());
  resetWatchForTests();
});
afterEach(() => {
  vi.useRealTimers();
  resetStorage();
  resetWatchForTests();
});

describe('the watch store', () => {
  it('starts out running and reads nothing it cannot trust', () => {
    expect(getWatchState()).toEqual({ kind: 'running' });
    kv.set('background', 'state', 'garbage');
    resetWatchForTests();
    expect(getWatchState()).toEqual({ kind: 'running' });
  });

  it('a pause is saved, survives a reload, and is gone once it ends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 0));
    const t0 = Date.now();
    dispatchWatch({ type: 'pause', now: t0, minutes: 30 });
    expect(kv.get('background', 'state', null)).toEqual({ v: 1, pausedUntil: t0 + 30 * MIN, meetingUntil: null });

    // "reload" 10 minutes later: the page starts over, the pause is still there
    vi.setSystemTime(t0 + 10 * MIN);
    resetWatchForTests();
    expect(getWatchState()).toEqual({ kind: 'paused', until: t0 + 30 * MIN, releaseCamera: true });

    // it ends by itself
    dispatchWatch({ type: 'tick', now: t0 + 30 * MIN });
    expect(getWatchState()).toEqual({ kind: 'running' });
    expect(kv.get('background', 'state', 'gone')).toBe('gone');
  });

  it('a pause that ended while the app was closed is cleared on load, and removed from storage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 0));
    const t0 = Date.now();
    dispatchWatch({ type: 'pause', now: t0, minutes: 15 });
    vi.setSystemTime(t0 + 3 * 60 * MIN); // closed for three hours
    resetWatchForTests();
    expect(getWatchState()).toEqual({ kind: 'running' });
    expect(kv.get('background', 'state', 'gone')).toBe('gone');
  });

  it('meeting mode is saved and restored the same way', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 0));
    const t0 = Date.now();
    dispatchWatch({ type: 'meeting', now: t0, minutes: 60 });
    resetWatchForTests();
    expect(getWatchState()).toEqual({ kind: 'meeting', until: t0 + 60 * MIN });
  });

  it('stopping clears a saved pause (and starting again does not bring it back)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 0));
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 60 });
    dispatchWatch({ type: 'stop' });
    expect(kv.get('background', 'state', 'gone')).toBe('gone');
    dispatchWatch({ type: 'start' });
    resetWatchForTests();
    expect(getWatchState()).toEqual({ kind: 'running' });
  });

  it('tells listeners about real changes only, and the stamp is when it changed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 0));
    const seen = vi.fn();
    const off = subscribeWatch(seen);
    dispatchWatch({ type: 'resume' }); // nothing to resume
    dispatchWatch({ type: 'tick', now: Date.now() });
    expect(seen).not.toHaveBeenCalled();
    const before = getWatchStamp();
    vi.setSystemTime(Date.now() + 5000);
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(getWatchStamp()).toBe(before + 5000);
    off();
    dispatchWatch({ type: 'resume' });
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('a listener that throws does not stop the others or the change', () => {
    const second = vi.fn();
    subscribeWatch(() => { throw new Error('bad listener'); });
    subscribeWatch(second);
    expect(() => dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 })).not.toThrow();
    expect(second).toHaveBeenCalled();
    expect(getWatchState().kind).toBe('paused');
  });

  it('keeps working when storage refuses writes (the pause just does not survive a reload)', () => {
    vi.spyOn(kv, 'set').mockReturnValue(false);
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 });
    expect(getWatchState().kind).toBe('paused');
    vi.restoreAllMocks();
  });
});

describe('what counts as "detecting" (the tray and WS9\'s free-tier meter read this)', () => {
  const live = { cameraEnabled: true, cameraError: null, status: 'watching' };
  const paused: WatchState = { kind: 'paused', until: 1, releaseCamera: true };

  it('is true while watching, in meeting mode too', () => {
    expect(isDetecting({ ...live, watch: { kind: 'running' } })).toBe(true);
    expect(isDetecting({ ...live, watch: { kind: 'meeting', until: 1 } })).toBe(true);
    expect(isDetecting({ ...live, status: 'alert', watch: { kind: 'running' } })).toBe(true);
  });

  it('is false while paused, even in the one render where the detector still says "watching"', () => {
    expect(isDetecting({ ...live, watch: paused })).toBe(false);
    expect(isDetecting({ ...live, status: 'alert', watch: paused })).toBe(false);
  });

  it('is false with the switch off, a camera error, or a detector that is not running', () => {
    expect(isDetecting({ ...live, cameraEnabled: false, watch: { kind: 'running' } })).toBe(false);
    expect(isDetecting({ ...live, cameraError: 'no camera', watch: { kind: 'running' } })).toBe(false);
    for (const status of ['idle', 'loading', 'error']) expect(isDetecting({ ...live, status, watch: { kind: 'running' } })).toBe(false);
  });
});
