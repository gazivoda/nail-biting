// The false-alarm rate in plain words (WS3): of the alarms in the last 7 days, how many did the person mark
// "Not a bite", against the 7 days before, so they can see it improve. Pure.
//
// What it is and is not: it counts alarms the PERSON marked. An alarm nobody reviewed counts as an alarm
// but not as a false one, so the figure understates the truth when many alarms go unreviewed. It is a
// figure about this person's own tapping, not a measure of the detector.

import type { Incident } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RateWindow {
  /** Alarms (auto-detected entries) in the window. A manual log or an urge is not an alarm. */
  alarms: number;
  /** Of those, marked "Not a bite". */
  falsePositives: number;
}

export interface FalsePositiveRates {
  thisWeek: RateWindow;
  lastWeek: RateWindow;
}

type Entry = Pick<Incident, 'timestamp' | 'autoDetected' | 'falsePositive'>;

/** The last 7 days and the 7 before, counted back from `now`. */
export function falsePositiveRates(entries: readonly Entry[], now: number): FalsePositiveRates {
  const out: FalsePositiveRates = { thisWeek: { alarms: 0, falsePositives: 0 }, lastWeek: { alarms: 0, falsePositives: 0 } };
  for (const e of entries) {
    if (!e.autoDetected) continue;
    const age = now - e.timestamp;
    if (age < 0 || age >= 14 * DAY_MS) continue;
    const window = age < 7 * DAY_MS ? out.thisWeek : out.lastWeek;
    window.alarms++;
    if (e.falsePositive === true) window.falsePositives++;
  }
  return out;
}

const percent = (w: RateWindow) => Math.round((w.falsePositives / w.alarms) * 100);

/** Enough alarms in a week for its rate to be worth comparing. */
export const MIN_ALARMS_TO_COMPARE = 3;

/**
 * One sentence, or null when there is nothing to say (no alarms this week). Compares with the week before only
 * when both weeks have at least MIN_ALARMS_TO_COMPARE alarms, and calls a change under 5 points "about the same".
 */
export function describeFalsePositiveRate(rates: FalsePositiveRates): string | null {
  const { thisWeek, lastWeek } = rates;
  if (thisWeek.alarms === 0) return null;
  const now = `${thisWeek.falsePositives} of ${thisWeek.alarms} ${thisWeek.alarms === 1 ? 'alarm' : 'alarms'} in the last 7 days marked not a bite (${percent(thisWeek)}%)`;
  if (thisWeek.alarms < MIN_ALARMS_TO_COMPARE || lastWeek.alarms < MIN_ALARMS_TO_COMPARE) return `${now}.`;
  const change = percent(thisWeek) - percent(lastWeek);
  const before = `${lastWeek.falsePositives} of ${lastWeek.alarms} (${percent(lastWeek)}%) the 7 days before`;
  if (change <= -5) return `${now}, down from ${before}.`;
  if (change >= 5) return `${now}, up from ${before}.`;
  return `${now}, about the same as ${before}.`;
}
