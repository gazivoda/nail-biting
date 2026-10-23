import { describe, expect, it } from 'vitest';
import { SYNC_EVENT_FIELDS, SYNC_LIMITS, toSyncEvent } from './payload';
import type { HabitEventWire } from '../storage/eventModel';

const base: HabitEventWire = { id: 'a', ts: 1_700_000_000_000, source: 'manual', behavior: 'nail_biting', updatedAt: 1_700_000_000_100 };

describe('toSyncEvent', () => {
  it('copies exactly the whitelisted fields of a full event', () => {
    const full: HabitEventWire = {
      ...base, hand: 'left', triggers: ['stress', 'focus'], falsePositive: false, confirmed: true,
      competingResponse: { done: true, durationSec: 12.5 }, deviceId: 'dev-1',
    };
    expect(toSyncEvent(full)).toEqual(full);
    expect(Object.keys(toSyncEvent(full)!).sort()).toEqual(
      ['behavior', 'competingResponse', 'confirmed', 'deviceId', 'falsePositive', 'hand', 'id', 'source', 'triggers', 'ts', 'updatedAt'],
    );
  });

  it('leaves out anything not on the list, however it got onto the object', () => {
    const dirty = {
      ...base,
      landmarks: [[0, 0, 0]], frame: 'data:image/png;base64,AAAA', photo: new Uint8Array(4),
      calibration: { chin: 1 }, tag: 'stress', timestamp: 5, autoDetected: true, note: 'private',
      competingResponse: { done: true, durationSec: 3, screenshot: 'x' },
    } as unknown as HabitEventWire;
    const out = toSyncEvent(dirty)!;
    expect(Object.keys(out).sort()).toEqual(['behavior', 'competingResponse', 'id', 'source', 'ts', 'updatedAt']);
    expect(out.competingResponse).toEqual({ done: true, durationSec: 3 });
    expect(JSON.stringify(out)).not.toMatch(/landmarks|data:image|calibration|private|screenshot/);
  });

  it('every key of the output is on the published list (SYNC_EVENT_FIELDS)', () => {
    const out = toSyncEvent({ ...base, hand: 'right', triggers: ['x'], falsePositive: true, confirmed: false, competingResponse: { done: false }, deviceId: 'd' })!;
    for (const k of Object.keys(out)) expect(SYNC_EVENT_FIELDS as readonly string[]).toContain(k);
  });

  it('a tombstone carries no content, even if the object still has some', () => {
    const out = toSyncEvent({ ...base, deleted: true, triggers: ['stress'], hand: 'left', confirmed: true, deviceId: 'd' })!;
    expect(out).toEqual({ ...base, deleted: true, deviceId: 'd' });
  });

  it('does not share arrays or objects with its input', () => {
    const input: HabitEventWire = { ...base, triggers: ['a'], competingResponse: { done: true } };
    const out = toSyncEvent(input)!;
    out.triggers!.push('b');
    out.competingResponse!.done = false;
    expect(input.triggers).toEqual(['a']);
    expect(input.competingResponse).toEqual({ done: true });
  });

  it.each<[string, Partial<HabitEventWire>]>([
    ['an empty id', { id: '' }],
    ['an id with a slash', { id: 'a/b' }],
    ['an id that is too long', { id: 'a'.repeat(SYNC_LIMITS.maxIdLength + 1) }],
    ['a ts that is NaN', { ts: NaN }],
    ['an updatedAt in the year 3000', { updatedAt: 32_503_680_000_000 }],
    ['a negative updatedAt', { updatedAt: -1 }],
    ['an unknown source', { source: 'robot' as never }],
    ['an unknown behavior', { behavior: 'other' as never }],
    ['an unknown hand', { hand: 'both' as never }],
    ['too many triggers', { triggers: Array.from({ length: SYNC_LIMITS.maxTriggers + 1 }, (_, i) => `t${i}`) }],
    ['a trigger that is too long', { triggers: ['x'.repeat(SYNC_LIMITS.maxTriggerLength + 1)] }],
    ['a trigger that is an object', { triggers: [{} as never] }],
    ['a non-boolean falsePositive', { falsePositive: 1 as never }],
    ['a competingResponse with no done', { competingResponse: {} as never }],
    ['a competingResponse of a day and a second', { competingResponse: { done: true, durationSec: SYNC_LIMITS.maxDurationSec + 1 } }],
    ['a device id with spaces', { deviceId: 'my laptop' }],
  ])('refuses %s (null: the record stays on the device)', (_name, patch) => {
    expect(toSyncEvent({ ...base, ...patch })).toBeNull();
  });
});
