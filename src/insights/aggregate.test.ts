import { describe, it, expect, beforeEach } from 'vitest';
import { computeInsights, computeInsightsMemo, resetInsightsMemo } from './aggregate';
import { localZone, zoneFor } from './zone';
import { alarm, bite, manyEvents, urge } from './testEvents';
import { countsAsAlarm, countsAsBite, countsAsEntry, isFalsePositive } from './predicate';
import { isBite } from '../store/useAppStore';
import type { Incident } from '../types';

// "Local" times: the test builds dates with the local constructor, so it holds in whatever zone runs it.
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, mo - 1, d, h, mi, s, ms).getTime();
// Friday 23 October 2026, 15:00 local.
const NOW = at(2026, 10, 23, 15);
const DAY = 86_400_000;

describe('what counts (the predicate)', () => {
  it('a bite is hand-logged or confirmed, and not an urge, a false positive or deleted', () => {
    expect(countsAsBite(bite(NOW))).toBe(true);
    expect(countsAsBite(alarm(NOW, { confirmed: true }))).toBe(true);
    expect(countsAsBite(alarm(NOW))).toBe(false); // awaiting review
    expect(countsAsBite(urge(NOW))).toBe(false);
    expect(countsAsBite(bite(NOW, { falsePositive: true }))).toBe(false);
    expect(countsAsBite(alarm(NOW, { confirmed: true, falsePositive: true }))).toBe(false);
    expect(countsAsBite(bite(NOW, { deleted: true }))).toBe(false);
  });

  it('an alarm that stands is an alarm the person has not marked "Not a bite", confirmed or not', () => {
    expect(countsAsAlarm(alarm(NOW))).toBe(true);
    expect(countsAsAlarm(alarm(NOW, { confirmed: true }))).toBe(true);
    expect(countsAsAlarm(alarm(NOW, { falsePositive: true }))).toBe(false);
    expect(countsAsAlarm(alarm(NOW, { deleted: true }))).toBe(false);
    expect(countsAsAlarm(bite(NOW))).toBe(false);
  });

  it('the "All" count is every alarm and bite that stands, never an urge', () => {
    expect(countsAsEntry(alarm(NOW))).toBe(true);
    expect(countsAsEntry(bite(NOW))).toBe(true);
    expect(countsAsEntry(urge(NOW))).toBe(false);
    expect(countsAsEntry(alarm(NOW, { falsePositive: true }))).toBe(false);
  });

  it('isFalsePositive is the one place the field is read', () => {
    expect(isFalsePositive({ falsePositive: true })).toBe(true);
    expect(isFalsePositive({ falsePositive: false })).toBe(false);
    expect(isFalsePositive({})).toBe(false);
  });

  it('agrees with the app\'s own isBite whenever nothing is marked false or deleted', () => {
    const events = manyEvents(2000, NOW).filter(e => !e.falsePositive && !e.deleted);
    for (const e of events) expect(countsAsBite(e)).toBe(isBite(e as Incident));
  });
});

describe('computeInsights with no events', () => {
  const r = computeInsights([], { now: NOW });

  it('has nothing, and says so', () => {
    expect(r.hasData).toBe(false);
    expect(r.totals).toEqual({ bites: 0, entries: 0, alarms: 0, urges: 0 });
  });

  it('still lays out every bucket, all zero', () => {
    expect(r.daily).toHaveLength(30);
    expect(r.weekly).toHaveLength(8);
    expect(r.daily.every(d => d.bites === 0 && d.entries === 0)).toBe(true);
    expect(r.weekly.every(w => w.bites === 0 && w.entries === 0)).toBe(true);
    expect(r.heatmap.cells).toHaveLength(7 * 24);
    expect(r.heatmap.max).toBe(0);
    expect(r.heatmap.peak).toBeNull();
  });

  it('never divides by zero', () => {
    expect(r.trend).toEqual({ current: 0, previous: 0, change: 0, pct: null });
    expect(r.falseAlarms).toEqual({ alarms: 0, falsePositives: 0, rate: null });
    expect(r.coaching.rate).toBeNull();
    expect(r.triggers).toEqual({ items: [], total: 0, tagged: 0, top: null });
  });
});

describe('computeInsights with one event', () => {
  const r = computeInsights([bite(at(2026, 10, 23, 9, 30), { tag: 'stress' })], { now: NOW });

  it('puts it in today and this week', () => {
    expect(r.hasData).toBe(true);
    expect(r.daily[29].bites).toBe(1);
    expect(r.daily.slice(0, 29).every(d => d.bites === 0)).toBe(true);
    expect(r.weekly[7].bites).toBe(1);
  });

  it('puts it in the right heatmap cell: Friday is row 4, hour 9', () => {
    expect(r.heatmap.cells[4 * 24 + 9]).toBe(1);
    expect(r.heatmap.peak).toEqual({ row: 4, hour: 9, count: 1 });
    expect(r.heatmap.total).toBe(1);
  });

  it('is below the sample needed to name a top trigger', () => {
    expect(r.triggers.items).toEqual([{ tag: 'stress', count: 1, share: 1 }]);
    expect(r.triggers.top).toBeNull();
  });

  it('has a trend of 1 against 0, with no percentage', () => {
    expect(r.trend).toEqual({ current: 1, previous: 0, change: 1, pct: null });
  });
});

describe('computeInsights: what is excluded', () => {
  const day = at(2026, 10, 22, 12);
  const events = [
    bite(day, { tag: 'stress' }),                              // counts
    alarm(day, { confirmed: true, tag: 'focus' }),             // counts
    alarm(day),                                                // entry + alarm, not a bite
    urge(day),                                                 // nothing
    bite(day, { falsePositive: true }),                        // nothing
    alarm(day, { falsePositive: true }),                       // nothing, but a false alarm
    bite(day, { deleted: true }),                              // nothing
  ];
  const r = computeInsights(events, { now: NOW });

  it('counts bites without urges, false positives and deleted entries', () => {
    expect(r.totals.bites).toBe(2);
    expect(r.daily[28].bites).toBe(2);
    expect(r.heatmap.total).toBe(2);
    expect(r.triggers.total).toBe(2);
  });

  it('the "All" series adds the alarm nobody has reviewed yet', () => {
    expect(r.totals.entries).toBe(3);
    expect(r.daily[28].entries).toBe(3);
    expect(r.totals.alarms).toBe(2); // the confirmed one and the unreviewed one
  });

  it('counts urges on their own', () => {
    expect(r.totals.urges).toBe(1);
  });

  it('works out the false-alarm rate from alarms raised, deleted ones excluded', () => {
    // alarms raised: confirmed, unreviewed, false positive = 3; one of them is a false positive.
    expect(r.falseAlarms).toEqual({ alarms: 3, falsePositives: 1, rate: 1 / 3 });
  });
});

describe('computeInsights: day, week and window boundaries', () => {
  it('the last millisecond of a day belongs to that day, the first of the next to the next', () => {
    const r = computeInsights(
      [bite(at(2026, 10, 22, 23, 59, 59, 999)), bite(at(2026, 10, 23, 0, 0, 0, 0))],
      { now: NOW },
    );
    expect(r.daily[28].bites).toBe(1);
    expect(r.daily[29].bites).toBe(1);
  });

  it('events older than the chart, or in the future, are in the totals but in no bucket', () => {
    const r = computeInsights([bite(NOW - 40 * DAY), bite(NOW + 3 * DAY)], { now: NOW });
    expect(r.daily.reduce((n, d) => n + d.bites, 0)).toBe(0);
    expect(r.totals.bites).toBe(2);
    // The heatmap and the reasons stop at the end of today too: tomorrow's entry is in neither.
    expect(r.heatmap.total).toBe(1);
    expect(r.triggers.total).toBe(1);
  });

  it('weeks start on Monday', () => {
    // Sunday 18 Oct 23:59 and Monday 19 Oct 00:00 are in different weeks.
    const r = computeInsights([bite(at(2026, 10, 18, 23, 59)), bite(at(2026, 10, 19, 0, 0))], { now: NOW });
    expect(r.weekly[6].bites).toBe(1);
    expect(r.weekly[7].bites).toBe(1);
    expect(r.weekly[7].start).toBe(at(2026, 10, 19));
  });

  it('the trend windows are exactly seven calendar days each', () => {
    // Today is Fri 23 Oct. Last 7 days = Sat 17 .. Fri 23. The 7 before = Sat 10 .. Fri 16.
    const r = computeInsights(
      [
        bite(at(2026, 10, 17, 0, 0)),                 // first instant of the current window
        bite(at(2026, 10, 16, 23, 59, 59, 999)),      // last instant of the previous window
        bite(at(2026, 10, 10, 0, 0)),                 // first instant of the previous window
        bite(at(2026, 10, 9, 23, 59, 59, 999)),       // before both
      ],
      { now: NOW },
    );
    expect(r.trend).toEqual({ current: 1, previous: 2, change: -1, pct: -50 });
  });

  it('a percentage is only given when there is something to compare with', () => {
    const r = computeInsights([bite(at(2026, 10, 22)), bite(at(2026, 10, 21)), bite(at(2026, 10, 14))], { now: NOW });
    expect(r.trend).toEqual({ current: 2, previous: 1, change: 1, pct: 100 });
  });
});

describe('computeInsights in other time zones', () => {
  it('a day with 23 hours (clocks forward) is one bucket; 30 buckets cover 30 calendar days', () => {
    const ny = zoneFor('America/New_York');
    const now = Date.UTC(2026, 2, 12, 16); // Thu 12 March 2026, 12:00 EDT
    const r = computeInsights(
      [bite(Date.UTC(2026, 2, 8, 5, 30)), bite(Date.UTC(2026, 2, 9, 3, 30))], // 00:30 EST Mar 8, and 23:30 EST... see below
      { now, zone: ny },
    );
    // Mar 8 00:30 EST and Mar 8 23:30 EDT (03:30 UTC on the 9th) are the same calendar day in New York.
    const mar8 = r.daily.find(d => d.start === ny.startOfDay(Date.UTC(2026, 2, 8, 12)))!;
    expect(mar8.bites).toBe(2);
    expect(r.daily).toHaveLength(30);
    // Consecutive buckets are consecutive calendar days, so the 23-hour day is not skipped or split.
    for (let i = 1; i < r.daily.length; i++) expect(r.daily[i].start).toBe(ny.addDays(r.daily[i - 1].start, 1));
  });

  it('the heatmap and the weekday use the zone, not the machine', () => {
    // 2026-10-24 01:30 in Auckland (UTC+13) is Saturday 01:30; in UTC it is still Friday.
    const auckland = zoneFor('Pacific/Auckland');
    const ts = Date.UTC(2026, 9, 23, 12, 30);
    const r = computeInsights([bite(ts)], { now: ts + 3_600_000, zone: auckland });
    expect(r.heatmap.peak).toEqual({ row: 5, hour: 1, count: 1 });
    const utc = computeInsights([bite(ts)], { now: ts + 3_600_000, zone: zoneFor('UTC') });
    expect(utc.heatmap.peak).toEqual({ row: 4, hour: 12, count: 1 });
  });
});

describe('computeInsights: triggers and the heatmap range', () => {
  const events = [
    bite(at(2026, 10, 22, 10), { tag: 'stress' }),
    bite(at(2026, 10, 21, 10), { tag: 'stress' }),
    bite(at(2026, 10, 20, 10), { tag: 'focus' }),
    bite(at(2026, 10, 19, 10), { tag: 'unknown' }),
    alarm(at(2026, 10, 18, 10), { confirmed: true }),           // never tagged
    bite(at(2026, 8, 1, 22), { tag: 'boredom' }),               // far outside a 30-day range
  ];

  it('counts every bite, groups the never-tagged ones, and names a top trigger once there is enough', () => {
    const r = computeInsights(events, { now: NOW });
    expect(r.triggers.total).toBe(6);
    expect(r.triggers.items.map(i => [i.tag, i.count])).toEqual([
      ['stress', 2], ['auto-detected', 1], ['boredom', 1], ['focus', 1], ['unknown', 1],
    ]);
    expect(r.triggers.tagged).toBe(4); // stress x2, focus, boredom; "unknown" and "never tagged" are not a trigger
    expect(r.triggers.top).toEqual({ tag: 'stress', count: 2, of: 4 });
  });

  it('a range limits the heatmap and the triggers, and nothing else', () => {
    const all = computeInsights(events, { now: NOW });
    const month = computeInsights(events, { now: NOW, rangeDays: 30 });
    expect(month.heatmap.total).toBe(5);
    expect(month.triggers.total).toBe(5);
    expect(month.triggers.items.find(i => i.tag === 'boredom')).toBeUndefined();
    expect(month.daily).toEqual(all.daily);
    expect(month.totals).toEqual(all.totals);
  });

  it('does not name a top trigger from fewer than three tagged bites, or from a tag seen once', () => {
    const two = computeInsights([bite(NOW - 1000, { tag: 'stress' }), bite(NOW - 2000, { tag: 'stress' })], { now: NOW });
    expect(two.triggers.top).toBeNull();
    const spread = computeInsights(
      [bite(NOW - 1000, { tag: 'stress' }), bite(NOW - 2000, { tag: 'focus' }), bite(NOW - 3000, { tag: 'boredom' })],
      { now: NOW },
    );
    expect(spread.triggers.top).toBeNull();
  });

  it('breaks a tie between triggers the same way every time (alphabetical)', () => {
    const r = computeInsights(
      [bite(NOW - 1, { tag: 'focus' }), bite(NOW - 2, { tag: 'boredom' }), bite(NOW - 3, { tag: 'stress' })],
      { now: NOW },
    );
    expect(r.triggers.items.map(i => i.tag)).toEqual(['boredom', 'focus', 'stress']);
  });
});

describe('computeInsights: the competing-response rate (WS2) and the false-alarm rate', () => {
  it('reuses WS2\'s coaching stats on the alarms', () => {
    const r = computeInsights(
      [
        alarm(NOW - 4000, { competingResponse: { done: true, durationSec: 30 } }),
        alarm(NOW - 3000, { competingResponse: { done: false, durationSec: 4 } }),
        alarm(NOW - 2000),
        alarm(NOW - 1000, { falsePositive: true, competingResponse: { done: true } }),
        bite(NOW - 500),
      ],
      { now: NOW },
    );
    expect(r.coaching.alarms).toBe(3); // the false positive is out, the manual bite is not an alarm
    expect(r.coaching.completed).toBe(1);
    expect(r.coaching.rate).toBeCloseTo(1 / 3);
  });

  it('has no rate when no alarm ever carried a prompt', () => {
    expect(computeInsights([alarm(NOW - 1), alarm(NOW - 2)], { now: NOW }).coaching.rate).toBeNull();
  });
});

describe('computeInsights: size and speed', () => {
  // The app keeps at most 5000 entries (MAX_INCIDENTS); the budget is checked well past that.
  // Budgets are an order of magnitude above what a laptop needs, so a slow CI machine does not flake.
  for (const [count, budgetMs] of [[1, 50], [100, 50], [5000, 150], [10_000, 250], [40_000, 800]] as const) {
    it(`${count.toLocaleString('en')} events in under ${budgetMs} ms`, () => {
      const events = manyEvents(count, NOW);
      computeInsights(events, { now: NOW }); // warm up the JIT, then time
      const t0 = performance.now();
      const r = computeInsights(events, { now: NOW });
      const took = performance.now() - t0;
      expect(took).toBeLessThan(budgetMs);
      // The result is sane at every size: buckets never exceed the totals, and nothing is NaN.
      expect(r.daily.reduce((n, d) => n + d.bites, 0)).toBeLessThanOrEqual(r.totals.bites);
      expect(r.heatmap.cells.reduce((n, c) => n + c, 0)).toBe(r.heatmap.total);
      expect(Number.isNaN(r.trend.change)).toBe(false);
    });
  }

  it('is linear: 4x the events takes well under 10x the time (best of 7, with a floor so a loaded machine does not flake)', () => {
    const small = manyEvents(10_000, NOW);
    const big = manyEvents(40_000, NOW, 120, 11);
    const best = (events: ReturnType<typeof manyEvents>) => {
      computeInsights(events, { now: NOW });
      let min = Infinity;
      for (let i = 0; i < 7; i++) {
        const t0 = performance.now();
        computeInsights(events, { now: NOW });
        min = Math.min(min, performance.now() - t0);
      }
      return min;
    };
    expect(best(big)).toBeLessThan(Math.max(best(small) * 10, 60));
  });

  it('a named zone (Intl) stays inside a budget at the realistic maximum', () => {
    const events = manyEvents(5000, NOW);
    const t0 = performance.now();
    computeInsights(events, { now: NOW, zone: zoneFor('America/New_York') });
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it('every count agrees with a plain re-count of the same events', () => {
    const events = manyEvents(10_000, NOW);
    const r = computeInsights(events, { now: NOW });
    expect(r.totals.bites).toBe(events.filter(countsAsBite).length);
    expect(r.totals.entries).toBe(events.filter(countsAsEntry).length);
    expect(r.totals.alarms).toBe(events.filter(countsAsAlarm).length);
    expect(r.heatmap.total).toBe(r.totals.bites);
    expect(r.triggers.total).toBe(r.totals.bites);
    const z = localZone();
    const todayBites = events.filter(e => countsAsBite(e) && z.startOfDay(e.timestamp) === z.startOfDay(NOW)).length;
    expect(r.daily[29].bites).toBe(todayBites);
  });
});

describe('computeInsightsMemo', () => {
  beforeEach(resetInsightsMemo);

  it('returns the same object for the same history, options and minute', () => {
    const events = manyEvents(200, NOW);
    const a = computeInsightsMemo(events, { now: NOW });
    expect(computeInsightsMemo(events, { now: NOW + 20_000 })).toBe(a);
  });

  it('recomputes for a new history array, a new minute or different options', () => {
    const events = manyEvents(200, NOW);
    const a = computeInsightsMemo(events, { now: NOW });
    expect(computeInsightsMemo([...events], { now: NOW })).not.toBe(a);
    const b = computeInsightsMemo(events, { now: NOW });
    expect(computeInsightsMemo(events, { now: NOW + 61_000 })).not.toBe(b);
    const c = computeInsightsMemo(events, { now: NOW + 61_000 });
    expect(computeInsightsMemo(events, { now: NOW + 61_000, rangeDays: 30 })).not.toBe(c);
  });
});
