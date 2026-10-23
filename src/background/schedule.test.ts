import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_SCHEDULE,
  decideReminder,
  describeSchedule,
  formatClock,
  isInWindow,
  isOvernight,
  nextWindowStart,
  normalizeSchedule,
  parseClock,
  pauseMorningMinutes,
  windowAt,
  type Schedule,
} from './schedule';
import type { WatchState } from './pauseMachine';

// Node's time zone can be changed while the process runs; the DST tests below rely on that.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const originalTZ = env.TZ;
afterEach(() => { if (originalTZ === undefined) delete env.TZ; else env.TZ = originalTZ; });
function inZone(zone: string, body: () => void) { env.TZ = zone; body(); }

const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
const sched = (over: Partial<Schedule> = {}): Schedule => ({ ...DEFAULT_SCHEDULE, enabled: true, ...over });
const running: WatchState = { kind: 'running' };
const stopped: WatchState = { kind: 'stopped' };

// 2026-10-19 is a Monday, 2026-10-23 a Friday, 2026-10-24 a Saturday.
describe('weekday window', () => {
  const s = sched(); // Mon-Fri 09:00-17:00

  it('is inside from the start up to, not including, the end', () => {
    expect(isInWindow(s, local(2026, 10, 19, 8, 59))).toBe(false);
    expect(isInWindow(s, local(2026, 10, 19, 9, 0))).toBe(true);
    expect(isInWindow(s, local(2026, 10, 19, 16, 59))).toBe(true);
    expect(isInWindow(s, local(2026, 10, 19, 17, 0))).toBe(false);
  });

  it('is closed on the days that are not chosen', () => {
    expect(isInWindow(s, local(2026, 10, 24, 12, 0))).toBe(false); // Saturday
    expect(isInWindow(s, local(2026, 10, 25, 12, 0))).toBe(false); // Sunday
    expect(isInWindow(sched({ days: [6] }), local(2026, 10, 24, 12, 0))).toBe(true);
  });

  it('no days chosen means no window, ever', () => {
    expect(isInWindow(sched({ days: [] }), local(2026, 10, 19, 12, 0))).toBe(false);
    expect(nextWindowStart(sched({ days: [] }), local(2026, 10, 19, 12, 0))).toBeNull();
  });

  it('gives each window a stable id made of its date and start time', () => {
    expect(windowAt(s, local(2026, 10, 19, 12, 0))?.id).toBe('2026-10-19@540');
    expect(windowAt(s, local(2026, 10, 19, 16, 30))?.id).toBe('2026-10-19@540');
    expect(windowAt(s, local(2026, 10, 20, 9, 0))?.id).toBe('2026-10-20@540');
  });
});

describe('overnight window', () => {
  const s = sched({ days: [5], startMinutes: 22 * 60, endMinutes: 6 * 60 }); // Fridays 22:00 to 06:00

  it('runs from Friday night into Saturday morning', () => {
    expect(isOvernight(s)).toBe(true);
    expect(isInWindow(s, local(2026, 10, 23, 21, 59))).toBe(false);
    expect(isInWindow(s, local(2026, 10, 23, 22, 0))).toBe(true);
    expect(isInWindow(s, local(2026, 10, 24, 0, 30))).toBe(true);
    expect(isInWindow(s, local(2026, 10, 24, 5, 59))).toBe(true);
    expect(isInWindow(s, local(2026, 10, 24, 6, 0))).toBe(false);
  });

  it('belongs to the day it starts on: same id before and after midnight', () => {
    expect(windowAt(s, local(2026, 10, 23, 23, 0))?.id).toBe('2026-10-23@1320');
    expect(windowAt(s, local(2026, 10, 24, 3, 0))?.id).toBe('2026-10-23@1320');
  });

  it('Saturday night is not a window when only Friday is chosen', () => {
    expect(isInWindow(s, local(2026, 10, 24, 23, 0))).toBe(false);
    expect(isInWindow(s, local(2026, 10, 25, 3, 0))).toBe(false);
  });

  it('crosses a month and a year end', () => {
    const everyDay = sched({ days: [0, 1, 2, 3, 4, 5, 6], startMinutes: 22 * 60, endMinutes: 6 * 60 });
    expect(windowAt(everyDay, local(2027, 1, 1, 2, 0))?.id).toBe('2026-12-31@1320');
    expect(windowAt(everyDay, local(2026, 11, 1, 2, 0))?.id).toBe('2026-10-31@1320');
  });
});

describe('next window', () => {
  const s = sched();
  it('finds the next start, today or later', () => {
    expect(nextWindowStart(s, local(2026, 10, 19, 7, 0))).toBe(local(2026, 10, 19, 9, 0));
    expect(nextWindowStart(s, local(2026, 10, 19, 9, 0))).toBe(local(2026, 10, 20, 9, 0)); // strictly after
    expect(nextWindowStart(s, local(2026, 10, 23, 18, 0))).toBe(local(2026, 10, 26, 9, 0)); // Friday evening -> Monday
  });
  it('a single chosen day is found a week ahead', () => {
    expect(nextWindowStart(sched({ days: [3] }), local(2026, 10, 21, 12, 0))).toBe(local(2026, 10, 28, 9, 0));
  });
});

describe('storage hygiene', () => {
  it('turns anything unreadable into the default, field by field', () => {
    expect(normalizeSchedule(null)).toEqual(DEFAULT_SCHEDULE);
    expect(normalizeSchedule('x')).toEqual(DEFAULT_SCHEDULE);
    expect(normalizeSchedule({ enabled: 'yes', days: 'all', startMinutes: -5, endMinutes: 99999 })).toEqual(DEFAULT_SCHEDULE);
  });
  it('keeps good values, sorts and dedupes the days, drops bad ones', () => {
    const n = normalizeSchedule({ enabled: true, days: [5, 1, 1, 9, -1, 2.5, 'x'], startMinutes: 480, endMinutes: 1080 });
    expect(n).toEqual({ enabled: true, days: [1, 5], startMinutes: 480, endMinutes: 1080 });
  });
  it('an empty window (start = end) is replaced by the default hours', () => {
    const n = normalizeSchedule({ enabled: true, days: [1], startMinutes: 600, endMinutes: 600 });
    expect([n.startMinutes, n.endMinutes]).toEqual([DEFAULT_SCHEDULE.startMinutes, DEFAULT_SCHEDULE.endMinutes]);
  });
  it('parses and prints times of day', () => {
    expect(parseClock('09:30')).toBe(570);
    expect(parseClock('9:05')).toBe(545);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('12:60')).toBeNull();
    expect(parseClock('noon')).toBeNull();
    expect(formatClock(570)).toBe('09:30');
    expect(formatClock(0)).toBe('00:00');
  });
  it('describes itself in words', () => {
    const clock = formatClock;
    expect(describeSchedule(sched(), clock)).toBe('09:00 to 17:00, Mon to Fri');
    expect(describeSchedule(sched({ days: [0, 1, 2, 3, 4, 5, 6] }), clock)).toBe('09:00 to 17:00, every day');
    expect(describeSchedule(sched({ days: [2, 4] }), clock)).toBe('09:00 to 17:00, Tue, Thu');
    expect(describeSchedule(sched({ startMinutes: 22 * 60, endMinutes: 6 * 60 }), clock)).toContain('(next morning)');
  });
  it('"until tomorrow" follows the schedule only while it is on and has days', () => {
    expect(pauseMorningMinutes(sched())).toBe(540);
    expect(pauseMorningMinutes(sched({ enabled: false }))).toBeNull();
    expect(pauseMorningMinutes(sched({ days: [] }))).toBeNull();
  });
});

describe('the reminder decision', () => {
  const s = sched();
  const monday10 = local(2026, 10, 19, 10, 0);
  const base = { schedule: s, now: monday10, watch: stopped, lastRemindedId: null, appVisible: false, permission: 'granted' as const };

  it('reminds once the window is open, nothing is watching and nobody is looking at the app', () => {
    expect(decideReminder(base)).toEqual({ remind: true, reason: 'ok', windowId: '2026-10-19@540' });
  });

  it('never outside the schedule', () => {
    for (const now of [local(2026, 10, 19, 8, 59), local(2026, 10, 19, 17, 0), local(2026, 10, 24, 12, 0), local(2026, 10, 19, 3, 0)]) {
      expect(decideReminder({ ...base, now })).toMatchObject({ remind: false, reason: 'outside-window' });
    }
  });

  it('never when the schedule is off', () => {
    expect(decideReminder({ ...base, schedule: sched({ enabled: false }) })).toMatchObject({ remind: false, reason: 'disabled' });
  });

  it('never more than once per window, but again in the next one', () => {
    expect(decideReminder({ ...base, lastRemindedId: '2026-10-19@540' })).toMatchObject({ remind: false, reason: 'already-reminded' });
    expect(decideReminder({ ...base, lastRemindedId: '2026-10-19@540', now: local(2026, 10, 20, 9, 5) }).remind).toBe(true);
  });

  it('respects a pause, and does not nag someone who is already watching or in a meeting', () => {
    expect(decideReminder({ ...base, watch: { kind: 'paused', until: monday10 + 1, releaseCamera: true } })).toMatchObject({ remind: false, reason: 'paused' });
    expect(decideReminder({ ...base, watch: running })).toMatchObject({ remind: false, reason: 'already-watching' });
    expect(decideReminder({ ...base, watch: { kind: 'meeting', until: monday10 + 1 } })).toMatchObject({ remind: false, reason: 'already-watching' });
  });

  it('is not a reason to show a notification while the app is in front of the person (and does not use up the window)', () => {
    const d = decideReminder({ ...base, appVisible: true });
    expect(d).toMatchObject({ remind: false, reason: 'app-visible', windowId: '2026-10-19@540' });
    expect(decideReminder({ ...base, appVisible: false }).remind).toBe(true);
  });

  it('never without permission', () => {
    for (const permission of ['denied', 'default', 'unsupported'] as const) {
      expect(decideReminder({ ...base, permission })).toMatchObject({ remind: false, reason: 'no-permission' });
    }
  });

  it('over a whole working week of checks every minute, shows at most one per window', () => {
    let last: string | null = null;
    let shown = 0;
    for (let t = local(2026, 10, 19, 0, 0); t < local(2026, 10, 26, 0, 0); t += 60_000) {
      const d = decideReminder({ ...base, now: t, lastRemindedId: last });
      if (d.remind) { shown++; last = d.windowId; }
    }
    expect(shown).toBe(5);
  });
});

describe('daylight saving and other time zones', () => {
  it('the zone switch itself works (so the tests below mean what they say)', () => {
    inZone('America/New_York', () => {
      expect(new Date(2026, 2, 8, 2, 30).getHours()).toBe(3); // the hour that does not exist
      expect(new Date(2026, 6, 1, 12, 0).getTimezoneOffset()).toBe(240);
    });
    inZone('Asia/Kolkata', () => expect(new Date(2026, 6, 1, 12, 0).getTimezoneOffset()).toBe(-330));
  });

  it('New York, spring forward (2026-03-08, 02:00 becomes 03:00): a 02:30 start begins at 03:30, once', () => {
    inZone('America/New_York', () => {
      const s = sched({ days: [0], startMinutes: 2 * 60 + 30, endMinutes: 10 * 60 });
      const at = (h: number, m: number) => local(2026, 3, 8, h, m);
      expect(isInWindow(s, at(1, 59))).toBe(false);
      expect(isInWindow(s, at(3, 0))).toBe(false); // 02:30 does not exist; the browser puts it at 03:30
      expect(isInWindow(s, at(3, 30))).toBe(true);
      expect(isInWindow(s, at(9, 59))).toBe(true);
      expect(isInWindow(s, at(10, 0))).toBe(false);
      expect(windowAt(s, at(5, 0))?.id).toBe('2026-03-08@150');
    });
  });

  it('New York, fall back (2026-11-01, 02:00 becomes 01:00): the repeated hour is one window and one reminder', () => {
    inZone('America/New_York', () => {
      const s = sched({ days: [0], startMinutes: 60 + 30, endMinutes: 4 * 60 });
      const first = Date.UTC(2026, 10, 1, 5, 45);  // 01:45 EDT
      const second = Date.UTC(2026, 10, 1, 6, 45); // 01:45 EST, an hour later
      expect(windowAt(s, first)?.id).toBe('2026-11-01@90');
      expect(windowAt(s, second)?.id).toBe('2026-11-01@90');
      const base = { schedule: s, watch: stopped, appVisible: false, permission: 'granted' as const };
      const d1 = decideReminder({ ...base, now: first, lastRemindedId: null });
      expect(d1.remind).toBe(true);
      expect(decideReminder({ ...base, now: second, lastRemindedId: d1.windowId }).remind).toBe(false);
    });
  });

  it('London, the night the clocks go back (2026-10-25): an overnight window is one window', () => {
    inZone('Europe/London', () => {
      const s = sched({ days: [6], startMinutes: 22 * 60, endMinutes: 6 * 60 }); // Saturday 22:00 to 06:00
      expect(windowAt(s, local(2026, 10, 24, 23, 0))?.id).toBe('2026-10-24@1320');
      expect(windowAt(s, local(2026, 10, 25, 5, 30))?.id).toBe('2026-10-24@1320');
      expect(isInWindow(s, local(2026, 10, 25, 6, 0))).toBe(false);
    });
  });

  it('Sydney, spring forward (2026-10-04): the next window after Saturday is found on the right day', () => {
    inZone('Australia/Sydney', () => {
      const s = sched({ days: [0], startMinutes: 9 * 60, endMinutes: 17 * 60 });
      expect(nextWindowStart(s, local(2026, 10, 3, 12, 0))).toBe(local(2026, 10, 4, 9, 0));
    });
  });

  it('Kolkata (UTC+5:30, no daylight saving): half-hour offsets change nothing', () => {
    inZone('Asia/Kolkata', () => {
      const s = sched();
      expect(windowAt(s, local(2026, 10, 19, 9, 0))?.id).toBe('2026-10-19@540');
      expect(isInWindow(s, local(2026, 10, 19, 8, 59))).toBe(false);
    });
  });
});
