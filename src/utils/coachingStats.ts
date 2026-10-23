// "How often did an alarm get followed by a completed competing response?" (WS2)
//
// Pure: takes canonical events (events.list() / toHabitEvent), returns numbers.
// WS5 charts can import it.
//
// What counts:
//  - an ALARM is an event with source 'alarm' that is not deleted and not marked
//    a false positive (WS3). Manual logs and urge-timer entries are not alarms.
//  - it is FOLLOWED by a completed response when its `competingResponse.done`
//    is true (Done pressed, or the whole countdown ran).
//  - the window starts at the first alarm that carries a competing response, so
//    the alarms from before the feature was ever used (which could not have had
//    a prompt) do not drag the figure down. Pass `since` to choose another start.
//    Alarms the prompt did not offer for (the "once an hour" setting) still count in
//    the denominator: the figure is about alarms, not about prompts. `prompted`
//    and `completedOfPrompted` are there for anyone who wants the other reading.

import type { HabitEvent } from '../storage/eventModel';

type CoachingEvent = Pick<HabitEvent, 'ts' | 'source' | 'competingResponse'> & { deleted?: boolean; falsePositive?: boolean };

export interface CoachingStats {
  /** Alarms in the window. */
  alarms: number;
  /** Alarms that were offered a prompt (their event carries a competingResponse). */
  prompted: number;
  /** Alarms followed by a completed response. */
  completed: number;
  /** Alarms where the prompt was shown and skipped. */
  skipped: number;
  /** completed / alarms, 0..1. null when there are no alarms in the window (never 0/0). */
  rate: number | null;
  /** completed / prompted, 0..1. null when nothing was prompted. */
  completedOfPrompted: number | null;
  /** Start of the window (epoch ms), or null when no alarm has ever had a prompt. */
  since: number | null;
}

const isAlarm = (e: CoachingEvent) => e.source === 'alarm' && e.deleted !== true && e.falsePositive !== true;

export function coachingStats(events: readonly CoachingEvent[], opts: { since?: number } = {}): CoachingStats {
  const alarms = events.filter(isAlarm);
  let since = opts.since ?? null;
  if (since === null) {
    for (const a of alarms) if (a.competingResponse && (since === null || a.ts < since)) since = a.ts;
  }
  if (since === null) {
    return { alarms: 0, prompted: 0, completed: 0, skipped: 0, rate: null, completedOfPrompted: null, since: null };
  }
  const inWindow = alarms.filter(a => a.ts >= since);
  const prompted = inWindow.filter(a => a.competingResponse !== undefined);
  const completed = prompted.filter(a => a.competingResponse!.done === true).length;
  return {
    alarms: inWindow.length,
    prompted: prompted.length,
    completed,
    skipped: prompted.length - completed,
    rate: inWindow.length > 0 ? completed / inWindow.length : null,
    completedOfPrompted: prompted.length > 0 ? completed / prompted.length : null,
    since,
  };
}

/** "62%", or null when there is nothing to report. */
export function formatRate(rate: number | null): string | null {
  return rate === null ? null : `${Math.round(rate * 100)}%`;
}
