// Everything the Insights charts show, worked out in ONE pass over the history.
//
// Pure: events in, plain numbers out. No React, no DOM, no store, no clock of its own (`now` and the
// time zone are arguments), so it runs in node tests and the charts are just a drawing of this object.
//
// Cost: O(n) in the number of events (n <= 5000 in the app, because the store keeps the newest
// 5000; the tests go to 10,000 and 20,000). Per event it does a handful of comparisons and one
// binary search over at most a few dozen bucket boundaries; the calendar parts (weekday, hour)
// are only asked of the events that fall in the heatmap's range.
//
// What counts is decided in ./predicate.ts. Short version: a bite is a hand-logged or confirmed
// entry that is not an urge, not marked "Not a bite", not deleted.

import { coachingStats, type CoachingStats } from '../utils/coachingStats';
import { MIN_SAMPLE } from '../utils/insights';
import { isUrge } from '../storage/eventModel';
import { countsAsAlarm, countsAsBite, countsAsEntry, isFalsePositive, isRaisedAlarm, type InsightEvent } from './predicate';
import { localZone, type Zone } from './zone';

export interface DayBucket {
  /** Local midnight that starts the day. */
  start: number;
  bites: number;
  /** Bites plus alarms nobody has reviewed yet (the History chart's "All"). */
  entries: number;
}

export interface WeekBucket {
  /** Local Monday 00:00 that starts the week. */
  start: number;
  bites: number;
  entries: number;
}

export interface Heatmap {
  /** 7 rows (Monday first) x 24 hours, row-major: index = row * 24 + hour. Counts of bites. */
  cells: number[];
  max: number;
  total: number;
  /** The busiest cell, or null when there are no bites. Ties go to the earlier weekday, then the earlier hour. */
  peak: { row: number; hour: number; count: number } | null;
}

export interface TriggerCount {
  /** The stored tag: 'stress', a custom tag id, 'unknown' (not sure) or 'auto-detected' (never tagged). */
  tag: string;
  count: number;
  /** count / bites in range, 0..1. */
  share: number;
}

export interface TriggerBreakdown {
  items: TriggerCount[];
  /** Bites in range. */
  total: number;
  /** Bites in range that carry a real trigger (not 'auto-detected', not 'unknown'). */
  tagged: number;
  /** Same rule as History's "Top trigger": needs MIN_SAMPLE tagged bites and a tag seen at least twice. */
  top: { tag: string; count: number; of: number } | null;
}

export interface Trend {
  /** The last 7 calendar days, today included. */
  current: number;
  /** The 7 days before those. */
  previous: number;
  /** current - previous. */
  change: number;
  /** Percent change against `previous`; null when `previous` is 0 (there is nothing to compare with). */
  pct: number | null;
}

export interface FalseAlarmStats {
  /** Alarms raised (deleted ones excluded). */
  alarms: number;
  /** Of those, marked "Not a bite". */
  falsePositives: number;
  /** falsePositives / alarms, 0..1; null when no alarm was raised (never 0/0). */
  rate: number | null;
}

export interface Insights {
  generatedAt: number;
  hasData: boolean;
  totals: { bites: number; entries: number; alarms: number; urges: number };
  daily: DayBucket[];
  weekly: WeekBucket[];
  heatmap: Heatmap;
  triggers: TriggerBreakdown;
  /** Bites, last 7 days against the 7 before. */
  trend: Trend;
  /** Alarms plus bites, same windows. */
  entryTrend: Trend;
  coaching: CoachingStats;
  falseAlarms: FalseAlarmStats;
}

export interface InsightsOptions {
  now: number;
  zone?: Zone;
  /** Days in the daily chart. Default 30. */
  days?: number;
  /** Weeks in the weekly chart. Default 8. */
  weeks?: number;
  /** Limit the heatmap and the trigger breakdown to the last N calendar days (today included). null / undefined = all history. */
  rangeDays?: number | null;
}

export const DEFAULT_DAYS = 30;
export const DEFAULT_WEEKS = 8;

const NO_TAG = 'auto-detected';
const NOT_SURE = 'unknown';

/** Index of the bucket whose [boundary[i], boundary[i+1]) contains ts, or -1 when ts is outside all of them. */
function bucketIndex(boundaries: readonly number[], ts: number): number {
  const last = boundaries.length - 1;
  if (ts < boundaries[0] || ts >= boundaries[last]) return -1;
  let lo = 0;
  let hi = last; // invariant: boundaries[lo] <= ts < boundaries[hi]
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (boundaries[mid] <= ts) lo = mid;
    else hi = mid;
  }
  return lo;
}

function makeTrend(current: number, previous: number): Trend {
  return {
    current,
    previous,
    change: current - previous,
    pct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
  };
}

export function computeInsights(events: readonly InsightEvent[], opts: InsightsOptions): Insights {
  const zone = opts.zone ?? localZone();
  const days = Math.max(1, Math.floor(opts.days ?? DEFAULT_DAYS));
  const weeks = Math.max(1, Math.floor(opts.weeks ?? DEFAULT_WEEKS));
  const { now } = opts;

  // ── Bucket boundaries ────────────────────────────────────────────────────
  const todayStart = zone.startOfDay(now);
  const dayBounds: number[] = [];
  for (let i = days - 1; i >= -1; i--) dayBounds.push(zone.addDays(todayStart, -i)); // oldest day start .. tomorrow start

  const sinceMonday = (zone.parts(todayStart).weekday + 6) % 7;
  const thisWeekStart = zone.addDays(todayStart, -sinceMonday);
  const weekBounds: number[] = [];
  for (let i = weeks - 1; i >= -1; i--) weekBounds.push(zone.addDays(thisWeekStart, -7 * i)); // oldest week start .. next week start

  const trendStart = zone.addDays(todayStart, -6);
  const trendPrevStart = zone.addDays(todayStart, -13);
  const trendEnd = zone.addDays(todayStart, 1);

  const rangeStart = opts.rangeDays && opts.rangeDays > 0 ? zone.addDays(todayStart, -(Math.floor(opts.rangeDays) - 1)) : -Infinity;

  // ── Accumulators ─────────────────────────────────────────────────────────
  const daily: DayBucket[] = dayBounds.slice(0, -1).map(start => ({ start, bites: 0, entries: 0 }));
  const weekly: WeekBucket[] = weekBounds.slice(0, -1).map(start => ({ start, bites: 0, entries: 0 }));
  const cells = new Array<number>(7 * 24).fill(0);
  const tagCounts = new Map<string, number>();
  let bitesInRange = 0;
  let taggedInRange = 0;
  let totalBites = 0;
  let totalEntries = 0;
  let totalAlarms = 0;
  let totalUrges = 0;
  let trendBites = 0, trendPrevBites = 0, trendEntries = 0, trendPrevEntries = 0;
  let raisedAlarms = 0;
  let falsePositives = 0;
  const alarmEvents: InsightEvent[] = [];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const ts = e.timestamp;
    if (e.deleted === true) continue;

    if (isRaisedAlarm(e)) {
      alarmEvents.push(e);
      raisedAlarms++;
      if (isFalsePositive(e)) falsePositives++;
    }
    if (isUrge(e)) { totalUrges++; continue; }

    const entry = countsAsEntry(e);
    if (!entry) continue;
    const bite = countsAsBite(e);
    totalEntries++;
    if (bite) totalBites++;
    if (countsAsAlarm(e)) totalAlarms++;

    const d = bucketIndex(dayBounds, ts);
    if (d >= 0) {
      daily[d].entries++;
      if (bite) daily[d].bites++;
    }
    const w = bucketIndex(weekBounds, ts);
    if (w >= 0) {
      weekly[w].entries++;
      if (bite) weekly[w].bites++;
    }
    if (ts >= trendStart && ts < trendEnd) {
      trendEntries++;
      if (bite) trendBites++;
    } else if (ts >= trendPrevStart && ts < trendStart) {
      trendPrevEntries++;
      if (bite) trendPrevBites++;
    }

    if (bite && ts >= rangeStart) {
      const p = zone.parts(ts);
      cells[((p.weekday + 6) % 7) * 24 + p.hour]++;
      bitesInRange++;
      const tag = e.tag === undefined || e.tag === '' ? NO_TAG : e.tag;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      if (tag !== NO_TAG && tag !== NOT_SURE) taggedInRange++;
    }
  }

  // ── Heatmap ──────────────────────────────────────────────────────────────
  let max = 0;
  let peakIndex = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] > max) { max = cells[i]; peakIndex = i; }
  }
  const heatmap: Heatmap = {
    cells,
    max,
    total: bitesInRange,
    peak: peakIndex >= 0 ? { row: Math.floor(peakIndex / 24), hour: peakIndex % 24, count: max } : null,
  };

  // ── Triggers ─────────────────────────────────────────────────────────────
  const items: TriggerCount[] = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count, share: bitesInRange > 0 ? count / bitesInRange : 0 }))
    .sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  let top: TriggerBreakdown['top'] = null;
  if (taggedInRange >= MIN_SAMPLE) {
    const best = items.find(it => it.tag !== NO_TAG && it.tag !== NOT_SURE);
    if (best && best.count >= 2) top = { tag: best.tag, count: best.count, of: taggedInRange };
  }

  // ── Rates ────────────────────────────────────────────────────────────────
  const coaching = coachingStats(
    alarmEvents.map(a => ({
      ts: a.ts ?? a.timestamp,
      source: 'alarm' as const,
      competingResponse: a.competingResponse,
      deleted: a.deleted,
      falsePositive: a.falsePositive,
    })),
  );

  return {
    generatedAt: now,
    hasData: totalEntries > 0,
    totals: { bites: totalBites, entries: totalEntries, alarms: totalAlarms, urges: totalUrges },
    daily,
    weekly,
    heatmap,
    triggers: { items, total: bitesInRange, tagged: taggedInRange, top },
    trend: makeTrend(trendBites, trendPrevBites),
    entryTrend: makeTrend(trendEntries, trendPrevEntries),
    coaching,
    falseAlarms: {
      alarms: raisedAlarms,
      falsePositives,
      rate: raisedAlarms > 0 ? falsePositives / raisedAlarms : null,
    },
  };
}

// ── Memoisation ──────────────────────────────────────────────────────────────

let memo: { events: readonly InsightEvent[]; key: string; zone: Zone | undefined; value: Insights } | null = null;

/**
 * `computeInsights` with a one-entry cache: the same history array, the same options and the same
 * minute return the same object, so a re-render (a tooltip, a theme change) costs nothing.
 * The store replaces `incidents` with a new array on every change, so a new bite always recomputes.
 */
export function computeInsightsMemo(events: readonly InsightEvent[], opts: InsightsOptions): Insights {
  const key = `${Math.floor(opts.now / 60_000)}|${opts.days ?? ''}|${opts.weeks ?? ''}|${opts.rangeDays ?? ''}`;
  if (memo && memo.events === events && memo.key === key && memo.zone === opts.zone) return memo.value;
  const value = computeInsights(events, opts);
  memo = { events, key, zone: opts.zone, value };
  return value;
}

/** Tests only. */
export function resetInsightsMemo(): void {
  memo = null;
}
