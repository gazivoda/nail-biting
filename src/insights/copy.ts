// The sentences the Insights page says about the numbers. Pure and plain: they describe the figures and
// never judge them, never claim a cause, never invent a number (every figure in a sentence comes from the
// data), and make no medical claim. Each is one message in the `insights` scope, with the figures as
// placeholders, so a translation can put them where its grammar wants them.

import type { FalseAlarmStats, Heatmap, Trend } from './aggregate';
import type { CoachingStats } from '../utils/coachingStats';
import { t } from '../i18n/scopes/insights';
import { countPhrase, hourSpan, weekdayLong, type Series } from './labels';

/** "3 fewer than the 7 days before (5)", "Nothing logged in the 7 days before." */
export function trendSentence(trend: Trend, series: Series): string {
  if (trend.current === 0 && trend.previous === 0) return t(series === 'bites' ? 'trend.noneBites' : 'trend.noneEntries');
  if (trend.previous === 0) return t('trend.noPrevious');
  if (trend.change === 0) return t('trend.same', { previous: trend.previous });
  const n = Math.abs(trend.change);
  const fewer = trend.change < 0;
  if (trend.pct !== null) return t(fewer ? 'trend.fewerPct' : 'trend.morePct', { n, previous: trend.previous, pct: Math.abs(trend.pct) });
  return t(fewer ? 'trend.fewer' : 'trend.more', { n, previous: trend.previous });
}

export function heatmapSummary(h: Heatmap): string {
  if (!h.peak) return t('range.noBites');
  const { row, hour, count } = h.peak;
  return t('heatmap.summary', { total: countPhrase('bites', h.total), day: weekdayLong(row), hours: hourSpan(hour), count });
}

/**
 * "12 bites in this period. The most in one day was 4, on Tue 20 Oct."
 * `dates[i]` is the finished date for bucket i ("Tue 20 Oct" for a day, "19 Oct" for the week starting then).
 */
export function seriesSummary(values: readonly number[], series: Series, unit: 'day' | 'week', dates: readonly string[]): string {
  const total = values.reduce((n, v) => n + v, 0);
  if (total === 0) return t(series === 'bites' ? 'series.noneBites' : 'series.noneEntries');
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return t(unit === 'day' ? 'series.summaryDay' : 'series.summaryWeek', { total: countPhrase(series, total), max: values[best], date: dates[best] });
}

export function coachingSentence(c: CoachingStats): string | null {
  if (c.rate === null) return null;
  return t('coaching.sentence', { completed: c.completed, alarms: c.alarms });
}

export function falseAlarmSentence(f: FalseAlarmStats): string {
  if (f.rate === null) return t('falseAlarms.none');
  return t('falseAlarms.sentence', { falsePositives: f.falsePositives, alarms: f.alarms });
}

export function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
