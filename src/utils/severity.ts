export type Severity = 'none' | 'low' | 'medium' | 'high';

// Absolute per-day counts, deliberately not a scale relative to the worst day
// in view. The chart used to divide each day by the highest day on screen, which
// made the colours mean nothing in isolation and inverted the signal in the
// cases that matter most:
//
//   [0,0,0,1,0,0,0]  one incident all week -> that day saturated to "high" (red)
//   [2,2,1,2,1,2,2]  improved from 20/day  -> still an almost entirely red chart
//   [12,8,15,3,...]  a 3-bite day in a bad week -> green
//
// Fixed boundaries mean a colour means the same thing every week, so the chart
// can actually show progress. These are a judgement call, not a measurement —
// tune them here if real usage suggests different bands.
export const SEVERITY_BANDS = {
  /** 1-2 incidents in a day */
  low: 1,
  /** 3-5 */
  medium: 3,
  /** 6 or more */
  high: 6,
} as const;

export function severityForCount(count: number): Severity {
  if (count <= 0) return 'none';
  if (count < SEVERITY_BANDS.medium) return 'low';
  if (count < SEVERITY_BANDS.high) return 'medium';
  return 'high';
}
