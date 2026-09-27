import { describe, it, expect } from 'vitest';
import { topTrigger, peakHour, hourRange } from './insights';
import type { Incident } from '../types';

const at = (h: number, m = 0) => new Date(2026, 8, 20, h, m).getTime();
const bite = (tag: string, ts: number): Incident => ({ id: `${tag}${ts}`, timestamp: ts, tag, autoDetected: false });

describe('topTrigger', () => {
  it('names the most common tag once there are enough tagged bites', () => {
    const b = [bite('stress', at(9)), bite('stress', at(10)), bite('focus', at(11)), bite('auto-detected', at(12))];
    expect(topTrigger(b)).toEqual({ tag: 'stress', count: 2, of: 3 });
  });
  it('ignores untagged and "not sure" bites, and stays quiet on thin data', () => {
    expect(topTrigger([bite('stress', at(9)), bite('unknown', at(10)), bite('auto-detected', at(11))])).toBeNull();
    expect(topTrigger([bite('stress', at(9)), bite('focus', at(10)), bite('boredom', at(11))])).toBeNull();
  });
});

describe('peakHour', () => {
  it('finds the hour with the most bites', () => {
    const b = [bite('x', at(15, 5)), bite('x', at(15, 40)), bite('x', at(9))];
    expect(peakHour(b)).toEqual({ hour: 15, count: 2 });
  });
  it('needs a sample and a repeat', () => {
    expect(peakHour([bite('x', at(15)), bite('x', at(16))])).toBeNull();
    expect(peakHour([bite('x', at(8)), bite('x', at(9)), bite('x', at(10))])).toBeNull();
  });
});

describe('hourRange', () => {
  it('reads like a person would say it', () => {
    expect(hourRange(15)).toBe('3 to 4 pm');
    expect(hourRange(11)).toBe('11 am to 12 pm');
    expect(hourRange(23)).toBe('11 pm to 12 am');
    expect(hourRange(0)).toBe('12 to 1 am');
  });
});
