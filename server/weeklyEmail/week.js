// Calendar maths for the weekly summary email (WS5): "which ISO week is the last
// completed one, in THIS person's time zone, and where exactly does it start and
// end". No dependency: `Intl.DateTimeFormat` knows every IANA zone and every DST
// rule, so a week that contains a clock change is 167 or 169 hours long and still
// starts and ends at local midnight.
//
// Everything is plain data in, plain data out (epoch ms and civil dates), so the
// tests can pin it and the client can mirror it.
//
//   weekBounds(nowMs, 'Pacific/Auckland')
//     -> { weekStart, weekEnd, prevWeekStart, weekKey: '2026-W42', timeZone }
//
// `weekStart` is Monday 00:00 local of the LAST COMPLETED ISO week, `weekEnd` is the
// next Monday 00:00 local (exclusive), `prevWeekStart` is the Monday before that.

const DAY_MS = 86_400_000;

export const WEEKDAY_NAMES = Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

const formatters = new Map();

function formatterFor(timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** A usable IANA zone name, or null. Never throws. Max 64 characters, as the longest real names are about 30. */
export function validTimeZone(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

/** The wall-clock reading of instant `ts` in `timeZone`: { year, month (1-12), day, hour, minute, second }. */
export function localParts(ts, timeZone) {
  const out = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(ts))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  // Some engines print midnight as hour 24 even with h23; normalise.
  if (out.hour === 24) out.hour = 0;
  return out;
}

/** (offset of the zone from UTC at instant ts) in ms: local wall clock read as UTC, minus ts. */
function offsetAt(ts, timeZone) {
  const p = localParts(ts, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // `ts` may carry milliseconds the formatter drops; compare on whole seconds.
  return asUtc - Math.floor(ts / 1000) * 1000;
}

const sameWall = (p, w) =>
  p.year === w.year && p.month === w.month && p.day === w.day && p.hour === w.hour && p.minute === w.minute && p.second === w.second;

/**
 * The instant at which the clock in `timeZone` reads the civil date and time `wall`
 * ({ year, month, day, hour?, minute?, second? }). Across a clock change:
 *  - a wall time that happens twice (clocks go back) resolves to the first one;
 *  - a wall time that never happens moves forward by the length of the gap, as
 *    `new Date` does (so a midnight that is skipped, as in a few zones, becomes the
 *    first instant after the gap).
 */
export function zonedTimeToUtc(wall, timeZone) {
  const w = { hour: 0, minute: 0, second: 0, ...wall };
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const t1 = guess - offsetAt(guess, timeZone);
  const t2 = guess - offsetAt(t1, timeZone);
  const ok1 = sameWall(localParts(t1, timeZone), w);
  const ok2 = sameWall(localParts(t2, timeZone), w);
  if (ok1 && ok2) return Math.min(t1, t2);
  if (ok1) return t1;
  if (ok2) return t2;
  return Math.max(t1, t2);
}

/** Civil-date arithmetic on { year, month, day } with no time zone involved (UTC noon avoids any edge). */
export function addCivilDays(date, days) {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 1 = Monday ... 7 = Sunday, of a civil date. */
export function isoWeekday(date) {
  const w = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay(); // 0 = Sunday
  return w === 0 ? 7 : w;
}

/** 'YYYY-Www' of the ISO week a civil date falls in (the ISO year is the year of that week's Thursday). */
export function isoWeekKey(date) {
  const thursday = addCivilDays(date, 4 - isoWeekday(date));
  const startOfYear = Date.UTC(thursday.year, 0, 1);
  const dayOfYear = Math.round((Date.UTC(thursday.year, thursday.month - 1, thursday.day) - startOfYear) / DAY_MS) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${thursday.year}-W${String(week).padStart(2, '0')}`;
}

/** Local midnight (epoch ms) at the start of a civil date. */
export function startOfCivilDay(date, timeZone) {
  return zonedTimeToUtc({ year: date.year, month: date.month, day: date.day }, timeZone);
}

/** The last completed ISO week as of `nowMs`, in `timeZone` (an invalid or missing zone means UTC). */
export function weekBounds(nowMs, timeZone) {
  const tz = validTimeZone(timeZone) ?? 'UTC';
  const p = localParts(nowMs, tz);
  const today = { year: p.year, month: p.month, day: p.day };
  const thisMonday = addCivilDays(today, 1 - isoWeekday(today));
  const lastMonday = addCivilDays(thisMonday, -7);
  const beforeMonday = addCivilDays(thisMonday, -14);
  return {
    weekStart: startOfCivilDay(lastMonday, tz),
    weekEnd: startOfCivilDay(thisMonday, tz),
    prevWeekStart: startOfCivilDay(beforeMonday, tz),
    weekKey: isoWeekKey(lastMonday),
    timeZone: tz,
  };
}

/** The 8 instants that bound the 7 local days of the week starting at `weekStart` (last one = the next Monday 00:00). */
export function dayBoundaries(weekStart, timeZone) {
  const tz = validTimeZone(timeZone) ?? 'UTC';
  const p = localParts(weekStart, tz);
  const monday = { year: p.year, month: p.month, day: p.day };
  const out = [];
  for (let i = 0; i <= 7; i++) out.push(startOfCivilDay(addCivilDays(monday, i), tz));
  return out;
}
