import type { Incident } from '../types';
import { BEHAVIORS, DEFAULT_BEHAVIOR, isFalsePositive, type Behavior } from '../storage/eventModel';
import { t } from '../i18n/scopes/history';
import { formatDatePattern } from '../i18n/format';

/** The behaviours that appear in a history, in the schema's order. Entries from before WS1 count as nail biting. */
export function behaviorsIn(incidents: readonly Incident[]): Behavior[] {
  const seen = new Set<Behavior>(incidents.map(i => i.behavior ?? DEFAULT_BEHAVIOR));
  return BEHAVIORS.filter(b => seen.has(b));
}

/** The entries of one behaviour, or all of them. The same array comes back for 'all', so nothing re-renders for nothing. */
export function filterByBehavior<T extends Pick<Incident, 'behavior'>>(items: T[], behavior: Behavior | 'all'): T[] {
  if (behavior === 'all') return items;
  return items.filter(i => (i.behavior ?? DEFAULT_BEHAVIOR) === behavior);
}

// What History can honestly say from the bites a person has confirmed or
// logged. Each insight needs a minimum sample, so two bites never become "your
// top trigger". Ties go to the earlier hour / the first tag seen, which keeps
// the answer stable between renders.
export const MIN_SAMPLE = 3;

export function topTrigger(bites: Incident[]): { tag: string; count: number; of: number } | null {
  // Callers pass bites (isBite already leaves "Not a bite" out); the filter is the belt to that braces.
  const tagged = bites.filter(b => !isFalsePositive(b) && b.tag !== 'auto-detected' && b.tag !== 'unknown');
  if (tagged.length < MIN_SAMPLE) return null;
  const counts = new Map<string, number>();
  for (const b of tagged) counts.set(b.tag, (counts.get(b.tag) ?? 0) + 1);
  let best: string | null = null;
  for (const [tag, n] of counts) if (best === null || n > counts.get(best)!) best = tag;
  const count = counts.get(best!)!;
  return count >= 2 ? { tag: best!, count, of: tagged.length } : null;
}

export function peakHour(allBites: Incident[]): { hour: number; count: number } | null {
  const bites = allBites.filter(b => !isFalsePositive(b));
  if (bites.length < MIN_SAMPLE) return null;
  const counts = new Array(24).fill(0);
  for (const b of bites) counts[new Date(b.timestamp).getHours()]++;
  let hour = 0;
  for (let h = 1; h < 24; h++) if (counts[h] > counts[hour]) hour = h;
  return counts[hour] >= 2 ? { hour, count: counts[hour] } : null;
}

// An hour of the day. English keeps its 12-hour wording ("3 pm"); the other languages get their own 24-hour
// clock ("15:00") from Intl, so no am/pm word needs translating.
const CLOCK_24 = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
const atHour = (hour: number, enPattern: string): string => formatDatePattern(new Date(2024, 0, 1, ((hour % 24) + 24) % 24), enPattern, CLOCK_24);

/** 0 -> "12 am", 9 -> "9 am", 13 -> "1 pm". */
export function hourLabel(hour: number): string {
  return atHour(hour, 'h aaa');
}

/** "3 to 4 pm", "11 am to 12 pm" */
export function hourRange(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const sameHalf = (h < 12) === ((h + 1) % 24 < 12);
  return t('hourRange', { from: atHour(h, sameHalf ? 'h' : 'h aaa'), to: atHour(h + 1, 'h aaa') });
}
