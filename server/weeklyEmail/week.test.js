import { describe, it, expect } from 'vitest';
import {
  weekBounds, isoWeekKey, isoWeekday, addCivilDays, validTimeZone, localParts, zonedTimeToUtc, dayBoundaries, WEEKDAY_NAMES,
} from './week.js';

const HOUR = 3_600_000;
const utc = (...a) => Date.UTC(...a);

describe('validTimeZone', () => {
  it('accepts real IANA names and UTC', () => {
    for (const z of ['UTC', 'Europe/Belgrade', 'America/New_York', 'Pacific/Kiritimati', 'Asia/Kolkata']) expect(validTimeZone(z)).toBe(z);
  });
  it('rejects anything else without throwing', () => {
    for (const z of ['', 'Not/AZone', 'x'.repeat(65), 123, null, undefined, {}, ['UTC'], 'Europe/Belgrade; DROP TABLE']) {
      expect(validTimeZone(z)).toBeNull();
    }
  });
});

describe('isoWeekKey', () => {
  it('knows the awkward year boundaries', () => {
    expect(isoWeekKey({ year: 2021, month: 1, day: 3 })).toBe('2020-W53'); // a Sunday
    expect(isoWeekKey({ year: 2021, month: 1, day: 4 })).toBe('2021-W01');
    expect(isoWeekKey({ year: 2020, month: 12, day: 31 })).toBe('2020-W53');
    expect(isoWeekKey({ year: 2019, month: 12, day: 30 })).toBe('2020-W01'); // a Monday in the old year
    expect(isoWeekKey({ year: 2024, month: 12, day: 30 })).toBe('2025-W01');
    expect(isoWeekKey({ year: 2015, month: 12, day: 31 })).toBe('2015-W53');
    expect(isoWeekKey({ year: 2025, month: 12, day: 29 })).toBe('2026-W01');
    expect(isoWeekKey({ year: 2026, month: 1, day: 1 })).toBe('2026-W01'); // 1 Jan 2026 is a Thursday
    expect(isoWeekKey({ year: 2026, month: 12, day: 31 })).toBe('2026-W53'); // 2026 has 53 weeks
    expect(isoWeekKey({ year: 2027, month: 1, day: 1 })).toBe('2026-W53');
    expect(isoWeekKey({ year: 2027, month: 1, day: 4 })).toBe('2027-W01');
    expect(isoWeekKey({ year: 2026, month: 10, day: 12 })).toBe('2026-W42');
  });

  it('is monotonic as a string over three years of days (so "older than" is a string comparison)', () => {
    let prev = '';
    let d = { year: 2024, month: 1, day: 1 };
    for (let i = 0; i < 366 * 3; i++) {
      const k = isoWeekKey(d);
      expect(k >= prev).toBe(true);
      prev = k;
      d = addCivilDays(d, 1);
    }
  });

  it('weekday: Monday is 1, Sunday is 7', () => {
    expect(isoWeekday({ year: 2026, month: 10, day: 19 })).toBe(1);
    expect(isoWeekday({ year: 2026, month: 10, day: 25 })).toBe(7);
  });
});

describe('weekBounds in UTC', () => {
  it('is the Monday-to-Monday week before the current one', () => {
    const b = weekBounds(utc(2026, 9, 23, 12), 'UTC'); // Friday 23 Oct 2026
    expect(b.weekStart).toBe(utc(2026, 9, 12));
    expect(b.weekEnd).toBe(utc(2026, 9, 19));
    expect(b.prevWeekStart).toBe(utc(2026, 9, 5));
    expect(b.weekKey).toBe('2026-W42');
    expect(b.timeZone).toBe('UTC');
  });

  it('changes at exactly Monday 00:00', () => {
    expect(weekBounds(utc(2026, 9, 18, 23, 59, 59), 'UTC').weekKey).toBe('2026-W41'); // Sunday, last second
    expect(weekBounds(utc(2026, 9, 19, 0, 0, 0), 'UTC').weekKey).toBe('2026-W42'); // Monday, first second
  });

  it('handles the year boundary and a 53-week year', () => {
    expect(weekBounds(utc(2021, 0, 6, 12), 'UTC').weekKey).toBe('2020-W53');
    expect(weekBounds(utc(2026, 0, 7, 12), 'UTC').weekKey).toBe('2026-W01'); // Mon 29 Dec 2025 is week 1 of 2026
    expect(weekBounds(utc(2026, 0, 14, 12), 'UTC').weekKey).toBe('2026-W02');
    expect(weekBounds(utc(2027, 0, 6, 12), 'UTC').weekKey).toBe('2026-W53');
    expect(weekBounds(utc(2026, 11, 30, 12), 'UTC').weekKey).toBe('2026-W52');
  });

  it('an invalid or missing zone means UTC', () => {
    const base = weekBounds(utc(2026, 9, 23, 12), 'UTC');
    for (const z of [undefined, null, '', 'Nope/Nowhere']) expect(weekBounds(utc(2026, 9, 23, 12), z)).toEqual(base);
  });
});

describe('weekBounds in other zones: the week boundary is the person\'s own midnight', () => {
  it('UTC+13 (Auckland, summer time): it is already Monday there while UTC is still Sunday', () => {
    const now = utc(2026, 9, 18, 12); // Sunday 12:00 UTC = Monday 01:00 in Auckland
    const b = weekBounds(now, 'Pacific/Auckland');
    expect(b.weekKey).toBe('2026-W42'); // Oct 12-19 has just ended there
    expect(b.weekEnd).toBe(utc(2026, 9, 18, 11)); // Monday 00:00 NZDT = Sunday 11:00 UTC
    expect(b.weekStart).toBe(utc(2026, 9, 11, 11));
    expect(weekBounds(now, 'UTC').weekKey).toBe('2026-W41'); // the same instant, another answer
  });

  it('UTC-10 (Honolulu): still Sunday there when UTC is Monday', () => {
    const now = utc(2026, 9, 19, 5); // Monday 05:00 UTC = Sunday 19:00 in Honolulu
    const b = weekBounds(now, 'Pacific/Honolulu');
    expect(b.weekKey).toBe('2026-W41');
    expect(b.weekEnd).toBe(utc(2026, 9, 12, 10)); // Monday 00:00 HST = 10:00 UTC
    expect(weekBounds(now, 'UTC').weekKey).toBe('2026-W42');
  });

  it('UTC+14 (Kiritimati) and a half-hour zone (Kolkata, +5:30)', () => {
    const k = weekBounds(utc(2026, 9, 18, 10), 'Pacific/Kiritimati'); // Monday 00:00 there
    expect(k.weekEnd).toBe(utc(2026, 9, 18, 10));
    expect(k.weekKey).toBe('2026-W42');
    const i = weekBounds(utc(2026, 9, 19, 12), 'Asia/Kolkata');
    expect(i.weekEnd).toBe(utc(2026, 9, 18, 18, 30)); // Monday 00:00 IST
    expect(i.weekKey).toBe('2026-W42');
  });

  it('a week with the clocks going back is 169 hours long (New York, 1 Nov 2026)', () => {
    const b = weekBounds(utc(2026, 10, 4, 12), 'America/New_York');
    expect(b.weekKey).toBe('2026-W44'); // Mon 26 Oct - Mon 2 Nov
    expect(b.weekStart).toBe(utc(2026, 9, 26, 4)); // 00:00 EDT
    expect(b.weekEnd).toBe(utc(2026, 10, 2, 5)); // 00:00 EST
    expect((b.weekEnd - b.weekStart) / HOUR).toBe(169);
    expect(localParts(b.weekStart, 'America/New_York')).toMatchObject({ month: 10, day: 26, hour: 0 });
    expect(localParts(b.weekEnd, 'America/New_York')).toMatchObject({ month: 11, day: 2, hour: 0 });
  });

  it('a week with the clocks going forward is 167 hours long (New York, 8 Mar 2026)', () => {
    const b = weekBounds(utc(2026, 2, 11, 12), 'America/New_York');
    expect(b.weekKey).toBe('2026-W10'); // Mon 2 Mar - Mon 9 Mar
    expect(b.weekStart).toBe(utc(2026, 2, 2, 5)); // 00:00 EST
    expect(b.weekEnd).toBe(utc(2026, 2, 9, 4)); // 00:00 EDT
    expect((b.weekEnd - b.weekStart) / HOUR).toBe(167);
  });

  it('Europe/Belgrade across the last Sunday of October', () => {
    const b = weekBounds(utc(2026, 9, 28, 12), 'Europe/Belgrade'); // Wed 28 Oct
    expect(b.weekKey).toBe('2026-W43'); // Mon 19 Oct - Mon 26 Oct (the change is Sun 25 Oct)
    expect((b.weekEnd - b.weekStart) / HOUR).toBe(169);
  });
});

describe('zonedTimeToUtc', () => {
  it('round-trips ordinary wall times in many zones', () => {
    const zones = ['UTC', 'America/New_York', 'Europe/Belgrade', 'Asia/Kolkata', 'Pacific/Auckland', 'Pacific/Honolulu', 'Australia/Lord_Howe', 'America/St_Johns'];
    for (const tz of zones) {
      for (const [y, m, d] of [[2026, 1, 15], [2026, 7, 4], [2026, 12, 31], [2024, 2, 29]]) {
        const t = zonedTimeToUtc({ year: y, month: m, day: d, hour: 12, minute: 34, second: 56 }, tz);
        expect(localParts(t, tz), `${tz} ${y}-${m}-${d}`).toEqual({ year: y, month: m, day: d, hour: 12, minute: 34, second: 56 });
      }
    }
  });

  it('a wall time that happens twice resolves to the first one (New York, 1 Nov 2026 01:30)', () => {
    const t = zonedTimeToUtc({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York');
    expect(t).toBe(utc(2026, 10, 1, 5, 30)); // 01:30 EDT, not 01:30 EST (06:30 UTC)
  });

  it('a wall time that never happens moves forward by the length of the gap, like new Date does (New York, 8 Mar 2026 02:30)', () => {
    const t = zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, 'America/New_York');
    expect(localParts(t, 'America/New_York')).toMatchObject({ day: 8, hour: 3, minute: 30 });
    expect(t).toBe(utc(2026, 2, 8, 7, 30)); // 03:30 EDT
  });

  it('midnight that never happens (clocks go forward at 00:00 in Havana) is the first instant after the gap', () => {
    const t = zonedTimeToUtc({ year: 2026, month: 3, day: 8 }, 'America/Havana');
    expect(localParts(t, 'America/Havana')).toMatchObject({ day: 8, hour: 1, minute: 0 });
    const before = localParts(t - 1000, 'America/Havana');
    expect(before).toMatchObject({ day: 7, hour: 23, minute: 59 });
  });
});

describe('dayBoundaries', () => {
  it('seven local days, with the 25-hour day in the right place (New York fall-back week)', () => {
    const b = weekBounds(utc(2026, 10, 4, 12), 'America/New_York');
    const bounds = dayBoundaries(b.weekStart, 'America/New_York');
    expect(bounds).toHaveLength(8);
    expect(bounds[0]).toBe(b.weekStart);
    expect(bounds[7]).toBe(b.weekEnd);
    const lengths = bounds.slice(1).map((t, i) => (t - bounds[i]) / HOUR);
    expect(lengths).toEqual([24, 24, 24, 24, 24, 24, 25]); // Sunday 1 Nov, the last day, has 25 hours
  });

  it('weekday names run Monday to Sunday', () => {
    expect(WEEKDAY_NAMES).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  });
});
