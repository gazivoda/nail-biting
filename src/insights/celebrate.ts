// The decision "is there a milestone to celebrate right now?", as a pure function, so the host component is
// only timers and a card. Never during or just after an alarm: the screen belongs to the alarm then.

import { evaluateMilestones, planCelebrations, type MilestoneId, type MilestoneStatus, type SeenMilestones } from './milestones';
import type { InsightEvent } from './predicate';

/** No celebration within this long of an alarm. */
export const ALARM_QUIET_MS = 60_000;

export interface CelebrationDecision {
  /** Show this one now, or null. */
  show: MilestoneStatus | null;
  /** Record these as seen without a screen (a longer streak milestone is being celebrated instead, or this is the first run). */
  silent: MilestoneId[];
  /** Something is waiting but an alarm was too recent; ask again later. */
  deferred: boolean;
  /** This was the first run on this device: `silent` is everything already reached, and the baseline is now taken. */
  baseline: boolean;
}

export function decideCelebration(input: {
  /** Newest first, like the store's list. Any order works; newest first is faster. */
  events: readonly InsightEvent[];
  startedAt: number;
  now: number;
  seen: SeenMilestones;
  /** Has the first-run baseline been taken on this device? */
  baselined: boolean;
}): CelebrationDecision {
  const statuses = evaluateMilestones({ events: input.events, startedAt: input.startedAt, now: input.now });
  if (!input.baselined) {
    // First run here: whatever is already reached is history, not news.
    const already = statuses.filter(s => s.reachedAt !== null && input.seen[s.def.id] === undefined).map(s => s.def.id);
    return { show: null, silent: already, deferred: false, baseline: true };
  }
  const plan = planCelebrations(statuses, input.seen);
  if (plan.celebrate.length === 0) return { show: null, silent: plan.silent, deferred: false, baseline: false };

  const cutoff = input.now - ALARM_QUIET_MS;
  const alarmJustRaised = input.events.some(e => e.autoDetected === true && e.timestamp >= cutoff && e.timestamp <= input.now + ALARM_QUIET_MS);
  if (alarmJustRaised) return { show: null, silent: plan.silent, deferred: true, baseline: false };
  return { show: plan.celebrate[0], silent: plan.silent, deferred: false, baseline: false };
}
