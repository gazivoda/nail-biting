import { describe, it, expect } from 'vitest';
import { describeEntry, recentRows, todayCounts, todaySentence, whenLabel } from './history';
import { isBite } from '../store/useAppStore';
import type { CustomTag, Incident } from '../types';

const T = new Date(2026, 9, 23, 15, 0, 0).getTime(); // 23 Oct 2026, 15:00 local
const H = 3_600_000;

const bite = (id: string, ts: number, tag: Incident['tag'] = 'unknown'): Incident =>
  ({ id, timestamp: ts, tag, autoDetected: false });
const urge = (id: string, ts: number, done = false): Incident =>
  ({ id, timestamp: ts, tag: 'urge', autoDetected: false, ...(done ? { competingResponse: { done: true, durationSec: 60 } } : {}) });
const alarm = (id: string, ts: number, confirmed?: boolean): Incident =>
  ({ id, timestamp: ts, tag: 'auto-detected', autoDetected: true, ...(confirmed === undefined ? {} : { confirmed }) });

const custom: CustomTag[] = [{ id: 'commute', label: 'Commute', emoji: 'T' }];

describe('describeEntry: the words History uses', () => {
  it('a bite, with and without what set it off', () => {
    expect(describeEntry(bite('a', T, 'stress'))).toEqual({ kind: 'bite', label: 'Bite, Stress' });
    expect(describeEntry(bite('a', T, 'focus'))).toEqual({ kind: 'bite', label: 'Bite, Deep focus' });
    expect(describeEntry(bite('a', T, 'unknown'))).toEqual({ kind: 'bite', label: 'Bite, Not sure' });
    expect(describeEntry(bite('a', T, 'who-knows'))).toEqual({ kind: 'bite', label: 'Bite' });
  });
  it('a custom reason keeps its emoji, a removed one falls back to plain "Bite"', () => {
    expect(describeEntry(bite('a', T, 'commute'), custom)).toEqual({ kind: 'bite', label: 'Bite, T Commute' });
    expect(describeEntry(bite('a', T, 'commute'), [])).toEqual({ kind: 'bite', label: 'Bite' });
  });
  it('an urge, with the timer result when there is one', () => {
    expect(describeEntry(urge('u', T))).toEqual({ kind: 'urge', label: 'Urge' });
    expect(describeEntry(urge('u', T, true))).toEqual({ kind: 'urge', label: 'Urge, timer finished' });
  });
  it('an alarm from a computer: "Alarm" until it is confirmed, then a bite', () => {
    expect(describeEntry(alarm('x', T))).toEqual({ kind: 'alarm', label: 'Alarm' });
    expect(describeEntry(alarm('x', T, true))).toEqual({ kind: 'bite', label: 'Bite' });
  });
  it('an alarm confirmed as a bite with the tag "urge" is still a bite, never an urge', () => {
    const tricky: Incident = { id: 't', timestamp: T, tag: 'urge', autoDetected: true, confirmed: true };
    expect(describeEntry(tricky).kind).toBe('bite');
  });
});

describe('recentRows', () => {
  it('is newest first, bounded, and keeps ids and times', () => {
    const list = [bite('old', T - 5 * H), urge('mid', T - 2 * H), bite('new', T - H, 'stress')];
    const rows = recentRows(list, [], 2);
    expect(rows.map(r => r.id)).toEqual(['new', 'mid']);
    expect(rows[0]).toEqual({ id: 'new', ts: T - H, kind: 'bite', label: 'Bite, Stress' });
  });
  it('does not change the list it was given', () => {
    const list = [bite('a', T - 3 * H), bite('b', T - H)];
    recentRows(list);
    expect(list.map(i => i.id)).toEqual(['a', 'b']);
  });
  it('is empty for no history', () => {
    expect(recentRows([])).toEqual([]);
  });
});

describe('todayCounts: the same definitions as the Watch tab', () => {
  const midnight = new Date(T).setHours(0, 0, 0, 0);

  it('counts bites, urges and alarms to review since local midnight, and no earlier', () => {
    const list = [
      bite('b1', T - H), bite('b2', T - 2 * H, 'stress'),
      urge('u1', T - H),
      alarm('a1', T - H), alarm('a2', T - H, true),
      bite('yesterday', midnight - 1), urge('u-old', midnight - 5),
    ];
    expect(todayCounts(list, T)).toEqual({ bites: 3, urges: 1, alarmsToReview: 1 });
  });
  it('its bite count is exactly the number of isBite entries today', () => {
    const list = [bite('b', T - H), urge('u', T - H), alarm('a', T - H), alarm('c', T - H, true)];
    expect(todayCounts(list, T).bites).toBe(list.filter(isBite).length);
  });
  it('the first instant of the day belongs to today', () => {
    expect(todayCounts([bite('b', midnight)], T).bites).toBe(1);
  });
});

describe('words', () => {
  it('todaySentence', () => {
    expect(todaySentence({ bites: 0, urges: 0, alarmsToReview: 0 })).toBe('Nothing logged today');
    expect(todaySentence({ bites: 1, urges: 0, alarmsToReview: 0 })).toBe('1 bite today');
    expect(todaySentence({ bites: 2, urges: 1, alarmsToReview: 0 })).toBe('2 bites, 1 urge today');
    expect(todaySentence({ bites: 0, urges: 3, alarmsToReview: 1 })).toBe('3 urges, 1 alarm to review today');
  });
  it('whenLabel: the time today, the day and time before', () => {
    expect(whenLabel(T - H, T)).toMatch(/^\d{1,2}:\d{2}/);
    const earlier = whenLabel(T - 3 * 24 * H, T);
    expect(earlier).toContain(',');
    expect(earlier).toMatch(/\d{1,2}:\d{2}/);
  });
});
