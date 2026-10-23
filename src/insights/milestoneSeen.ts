// Which milestones have been celebrated, remembered on this device (kv namespace `insights`).
//
// Once per milestone, ever: clearing History does not reset it, so a person who starts over is not
// congratulated for "1 hour" a second time (they can still see the list in Insights).
//
// BASELINE: the first time the feature runs on a device, whatever has already been reached is recorded
// as seen without a screen (someone who switches Insights on with a 12-day streak is not greeted with
// "1 hour" from two weeks ago). From then on, every newly reached milestone is celebrated. `baselined`
// says the baseline was taken. The list in Insights still shows what was reached, with "View card".
//
// Reads never throw and never trust the stored shape: an unknown id or a non-number is dropped.

import { kv } from '../storage/kv';
import { MILESTONE_IDS, type MilestoneId, type SeenMilestones } from './milestones';

const NS = 'insights';
const KEY = 'milestones';

export interface MilestoneRecord {
  seen: SeenMilestones;
  /** The first-run baseline has been taken on this device. */
  baselined: boolean;
}

export function readMilestoneRecord(): MilestoneRecord {
  const raw = kv.get<unknown>(NS, KEY, null);
  const obj = raw !== null && typeof raw === 'object' ? (raw as { seen?: unknown; baselined?: unknown }) : {};
  const seen: SeenMilestones = {};
  if (obj.seen !== null && typeof obj.seen === 'object') {
    for (const id of MILESTONE_IDS) {
      const at = (obj.seen as Record<string, unknown>)[id];
      if (typeof at === 'number' && Number.isFinite(at)) seen[id] = at;
    }
  }
  return { seen, baselined: obj.baselined === true };
}

export function readSeenMilestones(): SeenMilestones {
  return readMilestoneRecord().seen;
}

/** Records milestones as celebrated (or quietly absorbed). Already-seen ids keep their first time. */
export function markMilestonesSeen(ids: readonly MilestoneId[], at: number, opts: { baseline?: boolean } = {}): SeenMilestones {
  const { seen, baselined } = readMilestoneRecord();
  for (const id of ids) if (seen[id] === undefined) seen[id] = at;
  kv.set(NS, KEY, { v: 1, seen, baselined: baselined || opts.baseline === true });
  return seen;
}
