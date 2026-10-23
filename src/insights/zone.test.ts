import { describe, it, expect } from 'vitest';
import { isValidTimeZone, localZone, zoneFor, MS_PER_DAY, MS_PER_HOUR } from './zone';

const utc = (y: number, m: number, d: number, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi);

describe('zoneFor', () => {
  it('reads wall-clock parts in a named zone', () => {
    const ny = zoneFor('America/New_York');
    // 2026-10-23 20:00 UTC is 16:00 in New York (EDT, UTC-4), a Friday.
    expect(ny.parts(utc(2026, 10, 23, 20))).toEqual({ year: 2026, month: 9, day: 23, hour: 16, weekday: 5 });
    // Midnight UTC on New Year's Day is still the 31st in New York.
    expect(ny.parts(utc(2026, 1, 1, 0))).toEqual({ year: 2025, month: 11, day: 31, hour: 19, weekday: 3 });
  });

  it('knows half-hour and 45-minute zones', () => {
    const kolkata = zoneFor('Asia/Kolkata');
    // 2026-10-23 20:00 UTC = 2026-10-24 01:30 IST
    expect(kolkata.parts(utc(2026, 10, 23, 20))).toMatchObject({ day: 24, hour: 1 });
    expect(kolkata.startOfDay(utc(2026, 10, 23, 20))).toBe(utc(2026, 10, 23, 18, 30));
    const kathmandu = zoneFor('Asia/Kathmandu');
    expect(kathmandu.startOfDay(utc(2026, 10, 23, 20))).toBe(utc(2026, 10, 23, 18, 15));
  });

  it('a spring-forward day is 23 hours and a fall-back day is 25, and each is ONE day', () => {
    const ny = zoneFor('America/New_York');
    const mar8 = ny.startOfDay(utc(2026, 3, 8, 12)); // clocks go forward at 02:00 that day
    expect(mar8).toBe(utc(2026, 3, 8, 5)); // midnight EST
    expect(ny.addDays(mar8, 1)).toBe(utc(2026, 3, 9, 4)); // midnight EDT
    expect(ny.addDays(mar8, 1) - mar8).toBe(23 * MS_PER_HOUR);

    const nov1 = ny.startOfDay(utc(2026, 11, 1, 12)); // clocks go back at 02:00 that day
    expect(nov1).toBe(utc(2026, 11, 1, 4)); // midnight EDT
    expect(ny.addDays(nov1, 1) - nov1).toBe(25 * MS_PER_HOUR);
  });

  it('works on the far side of the date line', () => {
    const auckland = zoneFor('Pacific/Auckland'); // UTC+13 in summer
    expect(auckland.parts(utc(2026, 12, 31, 12))).toMatchObject({ year: 2027, month: 0, day: 1, hour: 1 });
    expect(auckland.startOfDay(utc(2026, 12, 31, 12))).toBe(utc(2026, 12, 31, 11));
    const kiritimati = zoneFor('Pacific/Kiritimati'); // UTC+14
    expect(kiritimati.startOfDay(utc(2026, 6, 1, 12))).toBe(utc(2026, 6, 1, 10));
    const pago = zoneFor('Pacific/Pago_Pago'); // UTC-11
    expect(pago.startOfDay(utc(2026, 6, 1, 3))).toBe(utc(2026, 5, 31, 11));
  });

  it('rejects a name it does not know', () => {
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(() => zoneFor('Mars/Olympus')).toThrow(RangeError);
  });
});

const ZONES = [
  'UTC', 'America/New_York', 'America/Sao_Paulo', 'America/Havana', 'America/St_Johns', 'Europe/London', 'Europe/Berlin',
  'Africa/Cairo', 'Asia/Kolkata', 'Asia/Kathmandu', 'Australia/Lord_Howe', 'Australia/Sydney', 'Pacific/Auckland',
  'Pacific/Kiritimati', 'Pacific/Pago_Pago',
];

describe('startOfDay and addDays hold in every zone, across a whole year of daylight-saving changes', () => {
  for (const tz of ZONES) {
    it(tz, () => {
      const z = zoneFor(tz);
      // Every 6 hours from mid-2018 (a year Brazil still moved clocks at midnight) and all of 2026.
      for (const from of [utc(2018, 1, 1), utc(2026, 1, 1)]) {
        for (let ts = from; ts < from + 366 * MS_PER_DAY; ts += 6 * MS_PER_HOUR) {
          const p = z.parts(ts);
          const s = z.startOfDay(ts);
          expect(s).toBeLessThanOrEqual(ts);
          const ps = z.parts(s);
          // It is the first instant of THE SAME calendar day: the millisecond before is another day.
          expect([ps.year, ps.month, ps.day]).toEqual([p.year, p.month, p.day]);
          const before = z.parts(s - 1);
          expect([before.year, before.month, before.day]).not.toEqual([p.year, p.month, p.day]);
          // startOfDay is idempotent.
          expect(z.startOfDay(s)).toBe(s);
        }
      }
      // Walking forward a day at a time visits every calendar date once and never skips or repeats one.
      let s = z.startOfDay(utc(2026, 1, 1, 12));
      let prev = z.parts(s);
      for (let i = 0; i < 365; i++) {
        const next = z.addDays(s, 1);
        const np = z.parts(next);
        const expected = new Date(Date.UTC(prev.year, prev.month, prev.day + 1));
        expect([np.year, np.month, np.day]).toEqual([expected.getUTCFullYear(), expected.getUTCMonth(), expected.getUTCDate()]);
        expect(next).toBeGreaterThan(s);
        expect(z.addDays(next, -1)).toBe(s);
        s = next;
        prev = np;
      }
    });
  }
});

describe('localZone', () => {
  const system = Intl.DateTimeFormat().resolvedOptions().timeZone;

  it('agrees with the named zone of the machine it runs on', () => {
    const local = localZone();
    const named = zoneFor(system);
    for (let ts = utc(2026, 1, 1); ts < utc(2027, 1, 1); ts += 5 * MS_PER_HOUR + 1234567) {
      expect(local.parts(ts)).toEqual(named.parts(ts));
      expect(local.startOfDay(ts)).toBe(named.startOfDay(ts));
    }
    const s = local.startOfDay(utc(2026, 6, 15, 12));
    expect(local.addDays(s, 40)).toBe(named.addDays(s, 40));
    expect(local.addDays(s, -40)).toBe(named.addDays(s, -40));
  });
});
