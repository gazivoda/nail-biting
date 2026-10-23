import { describe, it, expect } from 'vitest';
import {
  buildWeeklySummary, isCountedBiteEvent, isFalsePositiveEvent, isUrgeEvent, isAlarmToReview, topTrigger, TRIGGER_LABELS,
} from './summary.js';
import { weekBounds } from './week.js';
import { PRESET_TAGS } from '../../src/components/dashboard/triggerTags.ts';

const utc = (...a) => Date.UTC(...a);
const NOW = utc(2026, 9, 23, 12); // Friday 23 Oct 2026
const UTC = weekBounds(NOW, 'UTC'); // week Mon 12 Oct - Mon 19 Oct, previous week from 5 Oct
const DAY = 86_400_000;

let n = 0;
const ev = (ts, over = {}) => ({ id: `e${++n}`, ts, source: 'manual', behavior: 'nail_biting', updatedAt: ts, ...over });
const alarm = (ts, over = {}) => ev(ts, { source: 'alarm', ...over });
/** `count` manual bites on the day `dayIndex` (0 = Monday) of the week that starts at `start`. */
const bitesOn = (start, dayIndex, count, over = {}) =>
  Array.from({ length: count }, (_, i) => ev(start + dayIndex * DAY + (10 + i) * 3_600_000, over));

const build = (events, bounds = UTC, tz = 'UTC') => buildWeeklySummary(events, { ...bounds, timeZone: tz });

describe('what counts as a bite', () => {
  it('a manual log is a bite; an alarm is one only once confirmed', () => {
    expect(isCountedBiteEvent(ev(1))).toBe(true);
    expect(isCountedBiteEvent(alarm(1))).toBe(false);
    expect(isCountedBiteEvent(alarm(1, { confirmed: false }))).toBe(false);
    expect(isCountedBiteEvent(alarm(1, { confirmed: true }))).toBe(true);
  });

  it('a false positive, a tombstone and an urge-timer entry are never bites', () => {
    expect(isCountedBiteEvent(ev(1, { falsePositive: true }))).toBe(false);
    expect(isCountedBiteEvent(alarm(1, { confirmed: true, falsePositive: true }))).toBe(false);
    expect(isCountedBiteEvent(ev(1, { deleted: true }))).toBe(false);
    expect(isCountedBiteEvent(ev(1, { triggers: ['urge'] }))).toBe(false);
    expect(isFalsePositiveEvent({ falsePositive: true })).toBe(true);
    expect(isFalsePositiveEvent({ falsePositive: false })).toBe(false);
    expect(isFalsePositiveEvent({})).toBe(false);
  });

  it('an alarm confirmed with the reason "urge" is still a bite (an urge entry is a manual log)', () => {
    const a = alarm(1, { confirmed: true, triggers: ['urge'] });
    expect(isUrgeEvent(a)).toBe(false);
    expect(isCountedBiteEvent(a)).toBe(true);
  });

  it('an urge is manual with "urge" as its primary reason', () => {
    expect(isUrgeEvent(ev(1, { triggers: ['urge'] }))).toBe(true);
    expect(isUrgeEvent(ev(1, { triggers: ['stress', 'urge'] }))).toBe(false);
    expect(isUrgeEvent(ev(1))).toBe(false);
  });

  it('"waiting for review" is an unconfirmed alarm that is not a false alarm or deleted', () => {
    expect(isAlarmToReview(alarm(1))).toBe(true);
    expect(isAlarmToReview(alarm(1, { confirmed: true }))).toBe(false);
    expect(isAlarmToReview(alarm(1, { falsePositive: true }))).toBe(false);
    expect(isAlarmToReview(alarm(1, { deleted: true }))).toBe(false);
    expect(isAlarmToReview(ev(1))).toBe(false);
  });
});

describe('counts and the change since last week', () => {
  it('counts this week and last week, and the signed whole-percent change', () => {
    const events = [...bitesOn(UTC.weekStart, 1, 4), ...bitesOn(UTC.prevWeekStart, 2, 5)];
    const s = build(events);
    expect(s).toMatchObject({ thisWeek: 4, lastWeek: 5, changePct: -20, direction: 'down' });
    expect(build([...bitesOn(UTC.weekStart, 0, 6), ...bitesOn(UTC.prevWeekStart, 0, 4)])).toMatchObject({ changePct: 50, direction: 'up' });
    expect(build([...bitesOn(UTC.weekStart, 0, 3), ...bitesOn(UTC.prevWeekStart, 0, 3)])).toMatchObject({ changePct: 0, direction: 'same' });
    expect(build([...bitesOn(UTC.weekStart, 0, 1), ...bitesOn(UTC.prevWeekStart, 0, 3)]).changePct).toBe(-67); // rounds, not truncates
  });

  it('the change is null, never Infinity, when last week had no bites', () => {
    const s = build(bitesOn(UTC.weekStart, 3, 2));
    expect(s.lastWeek).toBe(0);
    expect(s.changePct).toBeNull();
    expect(s.direction).toBe('up');
  });

  it('nothing at all in either week: zeros, direction none', () => {
    expect(build([])).toMatchObject({ thisWeek: 0, lastWeek: 0, changePct: null, direction: 'none', topTrigger: null, quietestDays: null, alarmsToReview: 0 });
  });

  it('no bites this week but some last week: a drop of 100 percent', () => {
    expect(build(bitesOn(UTC.prevWeekStart, 0, 2))).toMatchObject({ thisWeek: 0, lastWeek: 2, changePct: -100, direction: 'down' });
  });

  it('week edges: the first millisecond of the week is in it, the first of the next is not', () => {
    const { weekStart, weekEnd, prevWeekStart } = UTC;
    const s = build([ev(weekStart), ev(weekEnd - 1), ev(weekEnd), ev(weekStart - 1), ev(prevWeekStart), ev(prevWeekStart - 1)]);
    expect(s.thisWeek).toBe(2); // weekStart and weekEnd - 1
    expect(s.lastWeek).toBe(2); // weekStart - 1 and prevWeekStart
  });

  it('leaves out urges, false positives, tombstones and unconfirmed alarms, in both weeks', () => {
    const w = UTC.weekStart + 5 * 3_600_000;
    const p = UTC.prevWeekStart + 5 * 3_600_000;
    const noise = at => [
      ev(at, { triggers: ['urge'] }),
      ev(at, { falsePositive: true }),
      ev(at, { deleted: true }),
      alarm(at),
      alarm(at, { confirmed: true, falsePositive: true }),
    ];
    const s = build([ev(w), alarm(w, { confirmed: true }), ...noise(w), ev(p), ...noise(p)]);
    expect(s.thisWeek).toBe(2);
    expect(s.lastWeek).toBe(1);
  });

  it('counts every behaviour the app logs, like History does', () => {
    expect(build([ev(UTC.weekStart + 1000, { behavior: 'nose_picking' }), ev(UTC.weekStart + 2000)]).thisWeek).toBe(2);
  });

  it('alarms waiting for review are counted for this week only', () => {
    const s = build([alarm(UTC.weekStart + 1000), alarm(UTC.weekStart + 2000), alarm(UTC.weekStart + 3000, { confirmed: true }), alarm(UTC.prevWeekStart + 1000), ev(UTC.weekStart + 4000)]);
    expect(s.alarmsToReview).toBe(2);
  });
});

describe('quietest days', () => {
  it('lists every weekday tied for the fewest bites', () => {
    const events = [...bitesOn(UTC.weekStart, 0, 2), ...bitesOn(UTC.weekStart, 1, 1), ...bitesOn(UTC.weekStart, 2, 1), ...bitesOn(UTC.weekStart, 3, 1), ...bitesOn(UTC.weekStart, 5, 1), ...bitesOn(UTC.weekStart, 6, 1)];
    const s = build(events);
    expect(s.quietestDays).toEqual(['Friday']);
    expect(s.days.map(d => d.count)).toEqual([2, 1, 1, 1, 0, 1, 1]);
    expect(s.days.map(d => d.name)[0]).toBe('Monday');
  });

  it('a single bite leaves six quiet days, in weekday order', () => {
    expect(build(bitesOn(UTC.weekStart, 2, 1)).quietestDays).toEqual(['Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  });

  it('is null when all seven days are equal (including all zero), so no day is named', () => {
    expect(build([]).quietestDays).toBeNull();
    const every = [0, 1, 2, 3, 4, 5, 6].flatMap(d => bitesOn(UTC.weekStart, d, 1));
    expect(build(every).quietestDays).toBeNull();
  });
});

describe("days are the person's own days", () => {
  it('UTC+13: an entry just after local Monday midnight is Monday of this week, not Sunday of the last', () => {
    const b = weekBounds(utc(2026, 9, 18, 12), 'Pacific/Auckland'); // week W42 there
    const mondayLocal0030 = utc(2026, 9, 11, 11, 30); // 00:30 NZDT, Monday 12 Oct = 11:30 UTC on the 11th
    expect(mondayLocal0030).toBeLessThan(utc(2026, 9, 12)); // the UTC week would not have it
    const s = build([ev(mondayLocal0030)], b, 'Pacific/Auckland');
    expect(s.thisWeek).toBe(1);
    expect(s.days[0].count).toBe(1);
    expect(build([ev(mondayLocal0030)]).thisWeek).toBe(0); // the UTC reading of the same data
  });

  it('a 25-hour day: entries either side of the clocks going back land on Sunday, one past the week end does not', () => {
    const b = weekBounds(utc(2026, 10, 4, 12), 'America/New_York'); // Mon 26 Oct - Mon 2 Nov
    const events = [
      ev(utc(2026, 10, 1, 5, 30)), // 01:30 EDT, Sunday 1 Nov
      ev(utc(2026, 10, 2, 4, 59)), // 23:59 EST, Sunday 1 Nov
      ev(utc(2026, 10, 2, 5, 0)), // 00:00 EST, Monday 2 Nov: next week
      ev(utc(2026, 9, 26, 3, 59)), // 23:59 EDT Sunday 25 Oct: last week
      ev(utc(2026, 9, 26, 4, 0)), // 00:00 EDT Monday 26 Oct
    ];
    const s = build(events, b, 'America/New_York');
    expect(s.thisWeek).toBe(3);
    expect(s.lastWeek).toBe(1);
    expect(s.days.map(d => d.count)).toEqual([1, 0, 0, 0, 0, 0, 2]);
  });

  it('an invalid zone is read as UTC', () => {
    expect(build(bitesOn(UTC.weekStart, 0, 2), UTC, 'Nope/Nowhere').thisWeek).toBe(2);
  });
});

describe('top trigger', () => {
  const tagged = (...ids) => ids.map((id, i) => ev(UTC.weekStart + (i + 1) * 3_600_000, { triggers: [id] }));

  it('names the most common stated reason, with how many bites had one', () => {
    expect(topTrigger(tagged('stress', 'stress', 'boredom'))).toEqual({ id: 'stress', label: 'Stress', count: 2, of: 3 });
    expect(topTrigger(tagged('focus', 'focus', 'focus', 'stress', 'boredom'))).toEqual({ id: 'focus', label: 'Deep focus', count: 3, of: 5 });
  });

  it('needs at least three bites with a reason and a winner at least twice', () => {
    expect(topTrigger(tagged('stress', 'stress'))).toBeNull();
    expect(topTrigger(tagged('stress', 'focus', 'boredom'))).toBeNull();
    expect(topTrigger([])).toBeNull();
  });

  it('"Not sure", an alarm\'s placeholder and the urge reason are not stated reasons', () => {
    expect(topTrigger(tagged('unknown', 'unknown', 'unknown', 'stress'))).toBeNull(); // only 1 tagged
    expect(topTrigger([...tagged('unknown', 'unknown'), ...tagged('stress', 'stress', 'boredom')])).toEqual({ id: 'stress', label: 'Stress', count: 2, of: 3 });
    expect(topTrigger(tagged('auto-detected', 'urge', 'stress', 'stress', 'focus'))).toMatchObject({ id: 'stress', of: 3 });
    expect(topTrigger([ev(1), ev(2), ev(3)])).toBeNull(); // no triggers at all
  });

  it('a reason the server has no words for (a custom one) is not named', () => {
    expect(topTrigger(tagged('custom-1a2b3c4d', 'custom-1a2b3c4d', 'custom-1a2b3c4d', 'stress'))).toBeNull();
  });

  it('ties go to the id that sorts first, whatever the order of the events', () => {
    const a = tagged('stress', 'boredom', 'stress', 'boredom');
    expect(topTrigger(a)?.id).toBe('boredom');
    expect(topTrigger([...a].reverse())?.id).toBe('boredom');
  });

  it('uses only the week\'s counted bites, not last week\'s and not noise', () => {
    const noise = [
      ...tagged('stress', 'stress', 'stress').map(e => ({ ...e, falsePositive: true })),
      ...tagged('stress').map(e => ({ ...e, ts: UTC.prevWeekStart + 1000 })),
      alarm(UTC.weekStart + 9, { triggers: ['stress'] }), // unconfirmed
    ];
    const s = build([...noise, ...tagged('boredom', 'boredom', 'focus')]);
    expect(s.topTrigger).toEqual({ id: 'boredom', label: 'Boredom', count: 2, of: 3 });
  });

  it('its labels are the words the app shows for the three preset reasons', () => {
    const fromApp = Object.fromEntries(PRESET_TAGS.filter(t => t.id !== 'unknown').map(t => [t.id, t.label]));
    expect(TRIGGER_LABELS).toEqual(fromApp);
  });
});

describe('size', () => {
  it('a week of 5,000 entries summarises in well under a second', () => {
    const events = Array.from({ length: 5000 }, (_, i) => ev(UTC.prevWeekStart + (i * (14 * DAY)) / 5000, { triggers: [i % 3 ? 'stress' : 'boredom'] }));
    const t0 = performance.now();
    const s = build(events);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(s.thisWeek + s.lastWeek).toBe(5000);
  });
});
