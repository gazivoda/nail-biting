// Which milestones have been celebrated, remembered on this device (kv namespace `insights`).
//
// Once per milestone, ever: clearing History does not reset it, so a person who starts over is not
// congratulated for "1 hour" a second time (they can still see the list in Insights).
// Reads never throw and never trust the stored shape: an unknown id or a non-number is dropped.

import { kv } from '../storage/kv';
import { MILESTONE_IDS, type MilestoneId, type SeenMilestones } from './milestones';

const NS = 'insights';
const KEY = 'milestones';

export function readSeenMilestones(): SeenMilestones {
  const raw = kv.get<unknown>(NS, KEY, null);
  const stored = raw !== null && typeof raw === 'object' ? (raw as { seen?: unknown }).seen : undefined;
  const out: SeenMilestones = {};
  if (stored !== null && typeof stored === 'object') {
    for (const id of MILESTONE_IDS) {
      const at = (stored as Record<string, unknown>)[id];
      if (typeof at === 'number' && Number.isFinite(at)) out[id] = at;
    }
  }
  return out;
}

/** Records milestones as celebrated (or quietly absorbed). Already-seen ids keep their first time. */
export function markMilestonesSeen(ids: readonly MilestoneId[], at: number): SeenMilestones {
  const seen = readSeenMilestones();
  for (const id of ids) if (seen[id] === undefined) seen[id] = at;
  kv.set(NS, KEY, { v: 1, seen });
  return seen;
}
