// What the phone view shows from history: today's counts and the last few
// entries. Pure, and built on the shared predicates every other screen uses
// (`isBite` in the store; `isUrge`, `isFalsePositive`, `isPendingAlarm` in
// src/storage/eventModel.ts, the state table WS3 documented there), so a number
// here can never disagree with History or the streak: an urge and an alarm marked
// "Not a bite" are never bites, and neither is ever an alarm waiting for review.

import { isBite } from '../store/useAppStore';
import { isFalsePositive, isPendingAlarm, isUrge } from '../storage/eventModel';
import { PRESET_TAGS, URGE_TAG } from '../components/dashboard/triggerTags';
import { formatDate, formatTime } from '../utils/time';
import type { CustomTag, Incident } from '../types';

export type EntryKind = 'bite' | 'urge' | 'alarm' | 'dismissed';

export interface EntryRow {
  id: string;
  /** Epoch ms; the screen formats it. */
  ts: number;
  kind: EntryKind;
  /** The words for the pill: "Bite, Stress", "Urge, timer finished", "Alarm". */
  label: string;
}

/**
 * The pill text, in the words History uses: a bite is "Bite" or "Bite, <what set
 * it off>" (a comma, not a dot: DESIGN.md), an urge "Urge" (plus ", timer
 * finished" when the breathing timer ran to the end or was marked done), an
 * alarm marked "Not a bite" says so, and an alarm nobody has reviewed is "Alarm".
 */
export function describeEntry(inc: Incident, customTags: ReadonlyArray<CustomTag> = []): Pick<EntryRow, 'kind' | 'label'> {
  if (isUrge(inc)) {
    return { kind: 'urge', label: inc.competingResponse?.done ? `${URGE_TAG.label}, timer finished` : URGE_TAG.label };
  }
  if (isFalsePositive(inc)) return { kind: 'dismissed', label: 'Not a bite' };
  if (!isBite(inc)) return { kind: 'alarm', label: 'Alarm' };
  if (inc.tag === 'auto-detected') return { kind: 'bite', label: 'Bite' };
  const preset = PRESET_TAGS.find(t => t.id === inc.tag);
  if (preset) return { kind: 'bite', label: `Bite, ${preset.label}` };
  const custom = customTags.find(t => t.id === inc.tag);
  return { kind: 'bite', label: custom ? ['Bite,', custom.emoji, custom.label].filter(Boolean).join(' ') : 'Bite' };
}

/** The newest `limit` entries, newest first. */
export function recentRows(
  incidents: ReadonlyArray<Incident>,
  customTags: ReadonlyArray<CustomTag> = [],
  limit = 8,
): EntryRow[] {
  return [...incidents]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map(inc => ({ id: inc.id, ts: inc.timestamp, ...describeEntry(inc, customTags) }));
}

export interface TodayCounts {
  bites: number;
  urges: number;
  /** Alarms from a computer (arriving by sync) nobody has confirmed or marked "Not a bite" yet. */
  alarmsToReview: number;
}

/** Counts since local midnight, with the same definitions as the Watch tab's Today card. */
export function todayCounts(incidents: ReadonlyArray<Incident>, now: number = Date.now()): TodayCounts {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const today = incidents.filter(i => i.timestamp >= start.getTime());
  return {
    bites: today.filter(isBite).length,
    urges: today.filter(isUrge).length,
    alarmsToReview: today.filter(isPendingAlarm).length,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Nothing logged today" / "2 bites, 1 urge today" (and alarms to review when there are some). */
export function todaySentence({ bites, urges, alarmsToReview }: TodayCounts): string {
  const parts: string[] = [];
  if (bites > 0) parts.push(plural(bites, 'bite', 'bites'));
  if (urges > 0) parts.push(plural(urges, 'urge', 'urges'));
  if (alarmsToReview > 0) parts.push(plural(alarmsToReview, 'alarm to review', 'alarms to review'));
  return parts.length === 0 ? 'Nothing logged today' : `${parts.join(', ')} today`;
}

/** "14:32" for today, "Yesterday, 14:32" or "Fri, Sep 25, 14:32" before that. */
export function whenLabel(ts: number, now: number = Date.now()): string {
  const sameDay = new Date(ts).toDateString() === new Date(now).toDateString();
  return sameDay ? formatTime(ts) : `${formatDate(ts)}, ${formatTime(ts)}`;
}
