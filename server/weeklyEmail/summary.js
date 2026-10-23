// The numbers in the weekly summary email (WS5), built from a user's SYNCED
// events only (server/events/store.js `listUserEvents`). Pure: events in, plain
// object out, so it is tested without a database.
//
// What counts as a bite here is the same rule the app uses (`isBite` in
// src/store/useAppStore.ts, which since WS3 also leaves out falsePositive, and the
// WS5 client predicate in src/insights/predicate.ts), written for the wire shape of an event:
//
//   a bite    = a manual log, or an alarm the person confirmed;
//   NOT a bite: an urge-timer entry, an event marked "Not a bite" (falsePositive),
//               a deleted event (tombstone), an alarm nobody confirmed.
//
// Two small functions are the places to touch if that definition ever changes
// (WS3's client predicate isFalsePositive is `falsePositive === true`, the same test):
//   isFalsePositiveEvent   <- the swap point
//   isCountedBiteEvent
//
// Meant to be checked against the client's aggregation by one shared fixture (a parity
// test, written by the WS5 lead): same bites, same top trigger, same quiet days.

import { WEEKDAY_NAMES, dayBoundaries, validTimeZone } from './week.js';

/** The swap point: is this event marked "Not a bite"? */
export function isFalsePositiveEvent(e) {
  return e.falsePositive === true;
}

/** An urge-timer entry (WS2): a manual event whose primary trigger is `urge`. Not a bite. */
export function isUrgeEvent(e) {
  return e.source === 'manual' && e.triggers?.[0] === 'urge';
}

/** The primary trigger (the app stores one tag per event; `triggers` carries it first). */
export function primaryTrigger(e) {
  const t = e.triggers?.[0];
  return typeof t === 'string' ? t : undefined;
}

/** A bite for the purposes of every count in the email. */
export function isCountedBiteEvent(e) {
  if (e.deleted === true) return false;
  if (isFalsePositiveEvent(e)) return false;
  if (isUrgeEvent(e)) return false;
  return e.source === 'manual' || e.confirmed === true;
}

/** An alarm that has not been confirmed as a bite or marked as a false alarm: "waiting for review" in History. */
export function isAlarmToReview(e) {
  return e.deleted !== true && !isFalsePositiveEvent(e) && e.source === 'alarm' && e.confirmed !== true;
}

/** Minimum sample before a "top trigger" is stated, as in src/utils/insights.ts. */
export const MIN_SAMPLE = 3;

/** Trigger ids the app ships, with the words the app shows (src/components/dashboard/triggerTags.ts; a test keeps them in step). */
export const TRIGGER_LABELS = Object.freeze({ stress: 'Stress', focus: 'Deep focus', boredom: 'Boredom' });

// Not answers to "what set it off": never counted as a stated trigger.
const NOT_A_TRIGGER = new Set(['unknown', 'auto-detected', 'urge']);

/**
 * The most common stated trigger among the week's bites, or null. Needs at least
 * MIN_SAMPLE bites with a stated trigger and the winner at least twice. Ties go to
 * the id that sorts first, so the answer does not depend on the order of the events.
 * A winner we have no words for (a custom reason; custom labels are not synced) is
 * not named: null.
 */
export function topTrigger(bites) {
  const counts = new Map();
  let tagged = 0;
  for (const b of bites) {
    const t = primaryTrigger(b);
    if (t === undefined || NOT_A_TRIGGER.has(t)) continue;
    tagged++;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (tagged < MIN_SAMPLE) return null;
  let best = null;
  for (const [id, n] of counts) {
    if (best === null || n > best.count || (n === best.count && id < best.id)) best = { id, count: n };
  }
  if (best === null || best.count < 2) return null;
  const label = Object.hasOwn(TRIGGER_LABELS, best.id) ? TRIGGER_LABELS[best.id] : null;
  if (label === null) return null;
  return { id: best.id, label, count: best.count, of: tagged };
}

/**
 * @param {Array} events    wire events from `listUserEvents(userId, { since: prevWeekStart, until: weekEnd })`
 * @param {object} range    { weekStart, weekEnd, prevWeekStart } epoch ms (see weekBounds), and the person's time zone
 * @returns {{
 *   thisWeek: number, lastWeek: number,
 *   changePct: number | null,
 *   direction: 'none' | 'same' | 'up' | 'down',
 *   topTrigger: { id: string, label: string, count: number, of: number } | null,
 *   quietestDays: string[] | null,
 *   days: { name: string, count: number }[],
 *   alarmsToReview: number,
 * }}
 *  - `changePct` is whole percent, signed, and null when last week had no bites (never Infinity).
 *  - `quietestDays` are the weekday names with the FEWEST bites; null when all seven days are equal.
 *    A quiet day can also be a day the app was not used: the email says "logged", not "bite free".
 */
export function buildWeeklySummary(events, { weekStart, weekEnd, prevWeekStart, timeZone }) {
  const tz = validTimeZone(timeZone) ?? 'UTC';
  const bounds = dayBoundaries(weekStart, tz);
  const dayCounts = new Array(7).fill(0);
  const weekBites = [];
  let lastWeek = 0;
  let alarmsToReview = 0;

  for (const e of events) {
    const ts = e.ts;
    if (ts >= weekStart && ts < weekEnd) {
      if (isCountedBiteEvent(e)) {
        weekBites.push(e);
        let i = 6;
        while (i > 0 && ts < bounds[i]) i--;
        dayCounts[i]++;
      } else if (isAlarmToReview(e)) {
        alarmsToReview++;
      }
    } else if (ts >= prevWeekStart && ts < weekStart) {
      if (isCountedBiteEvent(e)) lastWeek++;
    }
  }

  const thisWeek = weekBites.length;
  let direction = 'none';
  if (thisWeek > 0 || lastWeek > 0) direction = thisWeek === lastWeek ? 'same' : thisWeek > lastWeek ? 'up' : 'down';
  const changePct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

  const min = Math.min(...dayCounts);
  const max = Math.max(...dayCounts);
  const quietestDays = min === max ? null : WEEKDAY_NAMES.filter((_, i) => dayCounts[i] === min);

  return {
    thisWeek,
    lastWeek,
    changePct,
    direction,
    topTrigger: topTrigger(weekBites),
    quietestDays,
    days: WEEKDAY_NAMES.map((name, i) => ({ name, count: dayCounts[i] })),
    alarmsToReview,
  };
}
