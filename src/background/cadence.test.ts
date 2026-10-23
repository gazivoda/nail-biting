import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cadenceNote, isSlow, judgeHidden, loadCadence, saveCadence, REPORT_TTL_MS } from './cadence';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';

beforeEach(() => setStorageAdapter(createMemoryAdapter()));
afterEach(() => resetStorage());

describe('judging a stretch in the background', () => {
  it('ignores a short trip to another tab', () => {
    expect(judgeHidden(3, 12, 1000)).toBeNull();
    expect(judgeHidden(150, 29.9, 1000)).toBeNull();
  });

  it('computes checks per second over the stretch', () => {
    expect(judgeHidden(300, 60, 5)).toEqual({ at: 5, seconds: 60, stepsPerSecond: 5 });
    expect(judgeHidden(60, 60, 5)).toEqual({ at: 5, seconds: 60, stepsPerSecond: 1 });
    expect(judgeHidden(0, 600, 5)?.stepsPerSecond).toBe(0);
  });

  it('refuses numbers that are not numbers', () => {
    expect(judgeHidden(NaN, 60, 1)).toBeNull();
    expect(judgeHidden(10, Infinity, 1)).toBeNull();
  });

  it('calls under three a second slow', () => {
    expect(isSlow({ at: 0, seconds: 60, stepsPerSecond: 1 })).toBe(true);
    expect(isSlow({ at: 0, seconds: 60, stepsPerSecond: 2.9 })).toBe(true);
    expect(isSlow({ at: 0, seconds: 60, stepsPerSecond: 3 })).toBe(false);
    expect(isSlow({ at: 0, seconds: 60, stepsPerSecond: 4.8 })).toBe(false);
  });
});

describe('the sentence', () => {
  const slow = { at: 10_000, seconds: 120, stepsPerSecond: 1 };

  it('says nothing when the background ran at a good rate, or when nothing was measured', () => {
    expect(cadenceNote(null, 20_000, true)).toBeNull();
    expect(cadenceNote({ at: 10_000, seconds: 120, stepsPerSecond: 4.9 }, 20_000, true)).toBeNull();
  });

  it('says what happened and what to do, depending on whether a mini window exists', () => {
    expect(cadenceNote(slow, 20_000, true)).toContain('about once a second instead of 5');
    expect(cadenceNote(slow, 20_000, true)).toContain('Minimize');
    expect(cadenceNote(slow, 20_000, false)).toContain('own window');
    expect(cadenceNote(slow, 20_000, false)).not.toContain('Minimize');
    expect(cadenceNote({ ...slow, stepsPerSecond: 2 }, 20_000, true)).toContain('about 2 a second');
  });

  it('is forgotten after twelve hours, and a clock that went backwards shows nothing', () => {
    expect(cadenceNote(slow, slow.at + REPORT_TTL_MS, true)).not.toBeNull();
    expect(cadenceNote(slow, slow.at + REPORT_TTL_MS + 1, true)).toBeNull();
    expect(cadenceNote(slow, slow.at - 1, true)).toBeNull();
  });

  it('makes no medical or privacy claim', () => {
    expect(cadenceNote(slow, 20_000, true)).not.toMatch(/treat|cure|private|never leaves|100%/i);
  });
});

describe('storage', () => {
  it('round-trips a report', () => {
    const r = { at: 123, seconds: 90, stepsPerSecond: 1.2 };
    saveCadence(r);
    expect(loadCadence()).toEqual(r);
  });
  it('reads garbage as nothing', () => {
    for (const bad of [5, 'x', [], { at: 'now' }, { at: 1, seconds: 2 }]) {
      kv.set('background', 'cadence', bad);
      expect(loadCadence()).toBeNull();
    }
  });
});
