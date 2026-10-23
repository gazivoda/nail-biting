import { describe, it, expect } from 'vitest';
import { CYCLE_SEC, EXHALE_SEC, INHALE_SEC, URGE_DURATIONS_SEC, breathAt, isUrgeDuration } from './breathing';

describe('the breathing pattern', () => {
  it('is 4 seconds in and 6 out, so 60 and 90 seconds are whole cycles', () => {
    expect(INHALE_SEC).toBe(4);
    expect(EXHALE_SEC).toBe(6);
    for (const d of URGE_DURATIONS_SEC) expect(d % CYCLE_SEC).toBe(0);
  });

  it('starts breathing in, counting down the seconds of the phase', () => {
    expect(breathAt(0)).toEqual({ phase: 'in', secondsLeft: 4, phaseSec: 4, target: 1 });
    expect(breathAt(1000)).toMatchObject({ phase: 'in', secondsLeft: 3 });
    expect(breathAt(3999)).toMatchObject({ phase: 'in', secondsLeft: 1 });
  });

  it('then breathes out, and repeats', () => {
    expect(breathAt(4000)).toEqual({ phase: 'out', secondsLeft: 6, phaseSec: 6, target: 0 });
    expect(breathAt(9999)).toMatchObject({ phase: 'out', secondsLeft: 1 });
    expect(breathAt(10_000)).toMatchObject({ phase: 'in', secondsLeft: 4 });
    expect(breathAt(64_000)).toMatchObject({ phase: 'out' });
  });

  it('treats a negative elapsed time as the start', () => {
    expect(breathAt(-500)).toEqual(breathAt(0));
  });

  it('allows exactly 60 and 90 seconds', () => {
    expect(isUrgeDuration(60)).toBe(true);
    expect(isUrgeDuration(90)).toBe(true);
    expect(isUrgeDuration(75)).toBe(false);
  });
});
