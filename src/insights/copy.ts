// The sentences the Insights page says about the numbers. Pure and plain: they describe the figures and
// never judge them, never claim a cause, never invent a number (every figure in a sentence comes from the
// data), and make no medical claim. Tested for wording in copy.test.ts.

import type { FalseAlarmStats, Heatmap, Trend } from './aggregate';
import type { CoachingStats } from '../utils/coachingStats';
import { WEEKDAY_LONG, hourSpan, plural } from './labels';

/** "3 fewer than the 7 days before (5)", "Nothing logged in the 7 days before." */
export function trendSentence(t: Trend, nounPlural: string): string {
  if (t.current === 0 && t.previous === 0) return `No ${nounPlural} logged in the last 14 days.`;
  if (t.previous === 0) return `Nothing logged in the 7 days before.`;
  if (t.change === 0) return `The same as the 7 days before (${t.previous}).`;
  const n = Math.abs(t.change);
  const how = t.change < 0 ? 'fewer' : 'more';
  const pct = t.pct !== null ? `, ${t.change < 0 ? 'down' : 'up'} ${Math.abs(t.pct)}%` : '';
  return `${n} ${how} than the 7 days before (${t.previous})${pct}.`;
}

export function heatmapSummary(h: Heatmap): string {
  if (!h.peak) return 'No bites in this range.';
  const { row, hour, count } = h.peak;
  return `${h.total} ${plural(h.total, 'bite')} in this range. The busiest slot is ${WEEKDAY_LONG[row]}, ${hourSpan(hour)}, with ${count}.`;
}

export function dailySummary(values: readonly number[], noun: string, nounPlural: string, dayNames: readonly string[]): string {
  const total = values.reduce((n, v) => n + v, 0);
  if (total === 0) return `No ${nounPlural} in this period.`;
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return `${total} ${plural(total, noun, nounPlural)} in this period. The most in one day was ${values[best]}, on ${dayNames[best]}.`;
}

export function coachingSentence(c: CoachingStats): string | null {
  if (c.rate === null) return null;
  return `${c.completed} of ${c.alarms} ${plural(c.alarms, 'alarm')} followed by a finished competing response.`;
}

export function falseAlarmSentence(f: FalseAlarmStats): string {
  if (f.rate === null) return 'No alarms yet.';
  return `${f.falsePositives} of ${f.alarms} ${plural(f.alarms, 'alarm')} marked "Not a bite".`;
}

export function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
