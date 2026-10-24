// Milestones (WS5): pure evaluation, no clock, no storage, no DOM.
//
// Two kinds, both worked out from the history alone:
//
//  - STREAK milestones: the first time there was a gap of at least 1 hour / 24 hours / 7 days / 30
//    days between two bites (or between the start of the record and the first bite, or between the
//    last bite and now). This is the same streak the Watch tab shows ("since your last bite"), so a
//    milestone never disagrees with the big number on the screen. They are DURATIONS in milliseconds,
//    like `useStreak`: a daylight-saving change inside a streak does not move them, and "a day" is
//    24 hours of not biting, not a calendar day.
//  - COUNT milestone: the 100th alarm that still stands (not deleted, not marked "Not a bite").
//
// What a bite is, is ./predicate.ts (a false positive and an urge never break a streak or count).
// The clock is an argument (`now`), so the tests pin it.
//
// What this does NOT know: whether the app was watching. There is no record of watching sessions, so a
// gap is "time since the last logged bite", and the wording says exactly that.

import { countsAsAlarm, countsAsBite, type InsightEvent } from './predicate';
import { t } from '../i18n/scopes/insights';

export type MilestoneId = 'hour' | 'day' | 'week' | 'month' | 'caught100';

export interface MilestoneDef {
  id: MilestoneId;
  kind: 'streak' | 'count';
  /** Short name, used in the list. */
  title: string;
  /** The big figure on the celebration card. */
  figure: string;
  /** What it means, in plain words. */
  detail: string;
  /** streak: milliseconds without a bite. */
  thresholdMs?: number;
  /** count: how many. */
  threshold?: number;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// title, figure and detail are getters: read when a screen renders, in the language showing then (src/i18n).
export const MILESTONES: readonly MilestoneDef[] = [
  {
    id: 'hour', kind: 'streak', thresholdMs: HOUR_MS,
    get title() { return t('milestone.hour.title'); },
    get figure() { return t('milestone.hour.figure'); },
    get detail() { return t('milestone.hour.detail'); },
  },
  {
    id: 'day', kind: 'streak', thresholdMs: DAY_MS,
    get title() { return t('milestone.day.title'); },
    get figure() { return t('milestone.day.figure'); },
    get detail() { return t('milestone.day.detail'); },
  },
  {
    id: 'week', kind: 'streak', thresholdMs: 7 * DAY_MS,
    get title() { return t('milestone.week.title'); },
    get figure() { return t('milestone.week.figure'); },
    get detail() { return t('milestone.week.detail'); },
  },
  {
    id: 'month', kind: 'streak', thresholdMs: 30 * DAY_MS,
    get title() { return t('milestone.month.title'); },
    get figure() { return t('milestone.month.figure'); },
    get detail() { return t('milestone.month.detail'); },
  },
  {
    id: 'caught100', kind: 'count', threshold: 100,
    get title() { return t('milestone.caught100.title'); },
    get figure() { return t('milestone.caught100.figure'); },
    get detail() { return t('milestone.caught100.detail'); },
  },
];

export const MILESTONE_IDS: readonly MilestoneId[] = MILESTONES.map(m => m.id);

export interface MilestoneInput {
  events: readonly InsightEvent[];
  /** Where the record starts: the store's `historyStartTime` (equal to `firstOpenTime` until old entries are pruned). */
  startedAt: number;
  now: number;
}

export interface MilestoneStatus {
  def: MilestoneDef;
  /** When it was first reached, or null if it has not been. */
  reachedAt: number | null;
  /** streak: the longest gap so far, in ms. count: the number so far. Always >= 0. */
  best: number;
  /** streak: the gap that is running now (since the last bite), in ms. 0 for count milestones. */
  current: number;
  /** The figure `best` is measured against: thresholdMs or threshold. */
  target: number;
}

/** Bite times in ascending order that could have ended a streak before `now`. */
function biteTimes(events: readonly InsightEvent[], now: number): number[] {
  const times: number[] = [];
  for (const e of events) {
    if (e.timestamp <= now && countsAsBite(e)) times.push(e.timestamp);
  }
  return times.sort((a, b) => a - b);
}

export function evaluateMilestones(input: MilestoneInput): MilestoneStatus[] {
  const { events, now } = input;
  const bites = biteTimes(events, now);

  // Gaps in time order: [start, first bite], [bite i, bite i+1] ..., [last bite, now].
  // A record that starts after its first bite (an import, a clock set back) starts the first gap at the bite.
  const gaps: { from: number; ms: number }[] = [];
  let from = bites.length > 0 ? Math.min(input.startedAt, bites[0]) : input.startedAt;
  for (const at of bites) {
    if (at > from) gaps.push({ from, ms: at - from });
    from = at;
  }
  const openGap = Math.max(0, now - from);
  if (openGap > 0) gaps.push({ from, ms: openGap });

  let longest = 0;
  for (const g of gaps) if (g.ms > longest) longest = g.ms;

  let alarmTimes: number[] | null = null;
  const alarms = (): number[] => {
    if (alarmTimes) return alarmTimes;
    alarmTimes = [];
    for (const e of events) if (e.timestamp <= now && countsAsAlarm(e)) alarmTimes.push(e.timestamp);
    alarmTimes.sort((a, b) => a - b);
    return alarmTimes;
  };

  return MILESTONES.map((def): MilestoneStatus => {
    if (def.kind === 'streak') {
      const target = def.thresholdMs!;
      // The first gap (they are in time order) that is long enough gives the earliest crossing.
      const hit = gaps.find(g => g.ms >= target);
      return { def, reachedAt: hit ? hit.from + target : null, best: longest, current: openGap, target };
    }
    const target = def.threshold!;
    const times = alarms();
    return { def, reachedAt: times.length >= target ? times[target - 1] : null, best: times.length, current: 0, target };
  });
}

/** What has been celebrated: milestone id -> when (epoch ms). */
export type SeenMilestones = Partial<Record<MilestoneId, number>>;

export interface CelebrationPlan {
  /** Show these, oldest first. */
  celebrate: MilestoneStatus[];
  /** Reached, unseen, but not worth a screen of their own (a longer streak milestone was reached too): record them as seen. */
  silent: MilestoneId[];
}

/**
 * Which reached milestones still need a celebration. Each is celebrated once, ever (`seen` is
 * remembered by the caller). When several streak milestones are unseen at once (someone who turns
 * the feature on with a 12-day streak), only the longest gets a screen and the shorter ones are
 * recorded quietly: congratulating a person for "1 hour" in the same breath as "7 days" is noise.
 */
export function planCelebrations(statuses: readonly MilestoneStatus[], seen: SeenMilestones): CelebrationPlan {
  const unseen = statuses.filter(s => s.reachedAt !== null && seen[s.def.id] === undefined);
  const streaks = unseen.filter(s => s.def.kind === 'streak');
  const longest = streaks.reduce<MilestoneStatus | null>((a, b) => (a === null || b.target > a.target ? b : a), null);
  const celebrate = unseen
    .filter(s => s.def.kind !== 'streak' || s === longest)
    .sort((a, b) => (a.reachedAt! - b.reachedAt!) || (a.target - b.target));
  const silent = streaks.filter(s => s !== longest).map(s => s.def.id);
  return { celebrate, silent };
}
