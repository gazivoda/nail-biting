// The decision "is there a milestone to celebrate right now?", as a pure function, so the host component is
// only timers and a card. Never during or just after an alarm: the screen belongs to the alarm then.

import { evaluateMilestones, planCelebrations, type MilestoneId, type MilestoneStatus, type SeenMilestones } from './milestones';
import type { InsightEvent } from './predicate';

/** No celebration within this long of an alarm. */
export const ALARM_QUIET_MS = 60_000;

export interface CelebrationDecision {
  /** Show this one now, or null. */
  show: MilestoneStatus | null;
  /** Record these as seen without a screen (a longer streak milestone is being celebrated instead). */
  silent: MilestoneId[];
  /** Something is waiting but an alarm was too recent; ask again later. */
  deferred: boolean;
}

export function decideCelebration(input: {
  /** Newest first, like the store's list. Any order works; newest first is faster. */
  events: readonly InsightEvent[];
  startedAt: number;
  now: number;
  seen: SeenMilestones;
}): CelebrationDecision {
  const plan = planCelebrations(
    evaluateMilestones({ events: input.events, startedAt: input.startedAt, now: input.now }),
    input.seen,
  );
  if (plan.celebrate.length === 0) return { show: null, silent: plan.silent, deferred: false };

  const cutoff = input.now - ALARM_QUIET_MS;
  const alarmJustRaised = input.events.some(e => e.autoDetected === true && e.timestamp >= cutoff && e.timestamp <= input.now + ALARM_QUIET_MS);
  if (alarmJustRaised) return { show: null, silent: plan.silent, deferred: true };
  return { show: plan.celebrate[0], silent: plan.silent, deferred: false };
}
