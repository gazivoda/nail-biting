import { describe, it, expect } from 'vitest';
import { HOUR_MS, PROMPT_MODES, isPromptMode, shouldPrompt } from './promptPolicy';
import { newestAlarmId, newestFreshAlarm, FRESH_ALARM_MS, type WatchedEvent } from './alarmWatcher';

const NOW = 1_700_000_000_000;

describe('shouldPrompt', () => {
  it('off never prompts', () => {
    expect(shouldPrompt('off', null, NOW)).toBe(false);
    expect(shouldPrompt('off', NOW - 10 * HOUR_MS, NOW)).toBe(false);
  });

  it('every prompts on every alarm, whatever happened before', () => {
    expect(shouldPrompt('every', null, NOW)).toBe(true);
    expect(shouldPrompt('every', NOW - 1000, NOW)).toBe(true);
    expect(shouldPrompt('every', NOW, NOW)).toBe(true);
  });

  it('hourly: the first alarm ever prompts', () => {
    expect(shouldPrompt('hourly', null, NOW)).toBe(true);
  });

  it('hourly: not again until a rolling hour has passed since the last prompt', () => {
    expect(shouldPrompt('hourly', NOW - 1000, NOW)).toBe(false);
    expect(shouldPrompt('hourly', NOW - (HOUR_MS - 1), NOW)).toBe(false);
    expect(shouldPrompt('hourly', NOW - HOUR_MS, NOW)).toBe(true);
    expect(shouldPrompt('hourly', NOW - 5 * HOUR_MS, NOW)).toBe(true);
  });

  it('hourly is rolling, not per clock hour: 10:55 then 11:00 does not prompt twice', () => {
    const ten55 = new Date(2026, 9, 23, 10, 55).getTime();
    const eleven = new Date(2026, 9, 23, 11, 0).getTime();
    expect(shouldPrompt('hourly', ten55, eleven)).toBe(false);
    expect(shouldPrompt('hourly', ten55, ten55 + HOUR_MS)).toBe(true);
  });

  it('hourly: a clock that moved backwards, or a junk value, does not silence coaching', () => {
    expect(shouldPrompt('hourly', NOW + 3 * HOUR_MS, NOW)).toBe(true);
    expect(shouldPrompt('hourly', NaN, NOW)).toBe(true);
  });

  it('knows its three modes', () => {
    expect([...PROMPT_MODES].sort()).toEqual(['every', 'hourly', 'off']);
    expect(isPromptMode('hourly')).toBe(true);
    expect(isPromptMode('always')).toBe(false);
    expect(isPromptMode(undefined)).toBe(false);
  });
});

describe('newestFreshAlarm', () => {
  const alarm = (id: string, age: number): WatchedEvent => ({ id, timestamp: NOW - age, autoDetected: true });
  const manual = (id: string, age: number): WatchedEvent => ({ id, timestamp: NOW - age, autoDetected: false });

  it('finds an alarm that was just logged', () => {
    expect(newestFreshAlarm([alarm('a', 100)], null, NOW)?.id).toBe('a');
  });

  it('ignores an alarm it has already offered coaching for', () => {
    expect(newestFreshAlarm([alarm('a', 100)], 'a', NOW)).toBeNull();
  });

  it('ignores old alarms: a restored, imported or synced event is not "just now"', () => {
    expect(newestFreshAlarm([alarm('a', FRESH_ALARM_MS + 1)], null, NOW)).toBeNull();
    expect(newestFreshAlarm([alarm('a', 3_600_000)], null, NOW)).toBeNull();
  });

  it('looks past a manual log that came after the alarm', () => {
    expect(newestFreshAlarm([manual('m', 10), alarm('a', 900)], null, NOW)?.id).toBe('a');
  });

  it('ignores manual events and an empty history', () => {
    expect(newestFreshAlarm([manual('m', 10)], null, NOW)).toBeNull();
    expect(newestFreshAlarm([], null, NOW)).toBeNull();
  });

  it('a startup baseline means old alarms never prompt', () => {
    const history = [alarm('old', 200)];
    // freshness would let this through, the baseline is what stops it
    expect(newestFreshAlarm(history, newestAlarmId(history), NOW)).toBeNull();
    expect(newestAlarmId([manual('m', 1)])).toBeNull();
  });
});
