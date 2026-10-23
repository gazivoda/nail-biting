import { describe, it, expect } from 'vitest';
import { topTrigger, peakHour, hourRange, behaviorsIn, filterByBehavior } from './insights';
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

describe('behaviour filter helpers', () => {
  const nail = bite('stress', at(9));                                              // a v1 entry: no behavior field
  const nailExplicit: Incident = { ...bite('focus', at(10)), behavior: 'nail_biting' };
  const nose: Incident = { ...bite('stress', at(11)), behavior: 'nose_picking' };
  const cuticle: Incident = { ...bite('stress', at(12)), behavior: 'cuticle_skin_biting' };

  it('behaviorsIn lists each behaviour once, in the schema order, counting old entries as nail biting', () => {
    expect(behaviorsIn([nose, nail, cuticle, nailExplicit])).toEqual(['nail_biting', 'cuticle_skin_biting', 'nose_picking']);
    expect(behaviorsIn([])).toEqual([]);
    expect(behaviorsIn([nail])).toEqual(['nail_biting']);
  });

  it('filterByBehavior keeps one behaviour, treats old entries as nail biting, and hands back the same array for "all"', () => {
    const all = [nail, nose, nailExplicit, cuticle];
    expect(filterByBehavior(all, 'all')).toBe(all);
    expect(filterByBehavior(all, 'nail_biting')).toEqual([nail, nailExplicit]);
    expect(filterByBehavior(all, 'nose_picking')).toEqual([nose]);
    expect(filterByBehavior(all, 'hair_pulling')).toEqual([]);
  });

  it('the insights computed from a filtered list only count that behaviour', () => {
    const noses = ['a', 'b', 'c'].map((t, i) => ({ ...bite('stress', at(9 + i)), behavior: 'nose_picking' as const, id: t }));
    const mixed = [...noses, bite('focus', at(15)), bite('focus', at(16))];
    expect(topTrigger(filterByBehavior(mixed, 'nose_picking'))).toEqual({ tag: 'stress', count: 3, of: 3 });
    expect(topTrigger(filterByBehavior(mixed, 'nail_biting'))).toBeNull(); // two tagged entries: not enough to say anything
  });
});
