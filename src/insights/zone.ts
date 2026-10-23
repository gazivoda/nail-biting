// Calendar maths in one time zone, without a library and without a DOM.
//
// Charts group events by local day, hour and weekday. The app's own zone is the
// browser's (`localZone`, built on Date's local getters, the fast path), and
// tests (and anything that needs another person's zone) use `zoneFor('Area/City')`,
// built on Intl. Both answer the same three questions, so every aggregation takes
// a `Zone` and the tests can prove daylight-saving behaviour whatever zone the
// machine running them happens to be in.
//
// Days are CALENDAR days: `addDays` moves by whole local days, so a day with 23
// or 25 hours (daylight saving) is still one bucket, never two or a half.

export interface ZoneParts {
  year: number;
  /** 0 = January. */
  month: number;
  /** 1..31 */
  day: number;
  /** 0..23 */
  hour: number;
  /** 0 = Sunday .. 6 = Saturday. */
  weekday: number;
}

export interface Zone {
  /** Local calendar parts of an instant. */
  parts(ts: number): ZoneParts;
  /** The instant of local midnight at the start of the day that contains `ts`. */
  startOfDay(ts: number): number;
  /** Local midnight `n` calendar days after the day that starts at `dayStart` (n may be negative). */
  addDays(dayStart: number, n: number): number;
}

/** The browser's own zone. */
export function localZone(): Zone {
  return {
    parts(ts) {
      const d = new Date(ts);
      return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), hour: d.getHours(), weekday: d.getDay() };
    },
    startOfDay(ts) {
      const d = new Date(ts);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    },
    addDays(dayStart, n) {
      const d = new Date(dayStart);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
    },
  };
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** True when the runtime knows this IANA zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

/** A named IANA zone ('America/New_York'). Throws RangeError for a name Intl does not know. */
export function zoneFor(timeZone: string): Zone {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
  });

  const wallClock = (ts: number): WallClock => {
    const w: WallClock = { year: 0, month: 0, day: 1, hour: 0, minute: 0, second: 0, weekday: 0 };
    for (const p of fmt.formatToParts(ts)) {
      if (p.type === 'year') w.year = Number(p.value);
      else if (p.type === 'month') w.month = Number(p.value) - 1;
      else if (p.type === 'day') w.day = Number(p.value);
      else if (p.type === 'hour') w.hour = Number(p.value) % 24;
      else if (p.type === 'minute') w.minute = Number(p.value);
      else if (p.type === 'second') w.second = Number(p.value);
      else if (p.type === 'weekday') w.weekday = WEEKDAYS[p.value] ?? 0;
    }
    return w;
  };

  /** Local wall clock minus UTC at an instant, in ms (whole seconds; milliseconds never change an offset). */
  const offsetAt = (ts: number): number => {
    const w = wallClock(ts);
    const wall = Date.UTC(w.year, w.month, w.day, w.hour, w.minute, w.second);
    const whole = Math.floor(ts / 1000) * 1000;
    return wall - whole;
  };

  /**
   * The instant at which the wall clock first reads `y-m-d 00:00:00`. When that wall time is
   * repeated (a clock put back at midnight) the earlier instant wins; when it does not exist
   * (a clock put forward at midnight) the day starts at the first instant after the gap.
   */
  const midnightOf = (year: number, month: number, day: number): number => {
    const wall = Date.UTC(year, month, day);
    // Offsets a day either side bracket any transition near this midnight.
    const candidates = [wall - offsetAt(wall - DAY), wall - offsetAt(wall + DAY)];
    const exact = candidates.filter(c => {
      const w = wallClock(c);
      return w.year === year && w.month === month && w.day === day && w.hour === 0 && w.minute === 0 && w.second === 0;
    });
    if (exact.length > 0) return Math.min(...exact);
    return Math.max(...candidates);
  };

  return {
    parts(ts) {
      const w = wallClock(ts);
      return { year: w.year, month: w.month, day: w.day, hour: w.hour, weekday: w.weekday };
    },
    startOfDay(ts) {
      const w = wallClock(ts);
      return midnightOf(w.year, w.month, w.day);
    },
    addDays(dayStart, n) {
      const w = wallClock(dayStart);
      // Date.UTC normalises an out-of-range day, so this is calendar arithmetic.
      const d = new Date(Date.UTC(w.year, w.month, w.day + n));
      return midnightOf(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    },
  };
}

/** Milliseconds in a nominal day. Durations (streaks) use this; calendar buckets use `Zone.addDays`. */
export const MS_PER_DAY = DAY;
export const MS_PER_HOUR = HOUR;
