import { describe, it, expect } from 'vitest';
import { ALARM_QUIET_MS, decideCelebration } from './celebrate';
import { alarm, bite } from './testEvents';

const D = 86_400_000;
const START = Date.UTC(2026, 9, 1, 8);

describe('decideCelebration', () => {
  it('shows nothing before anything is reached', () => {
    expect(decideCelebration({ events: [], startedAt: START, now: START + 1000, seen: {}, baselined: true })).toEqual({ show: null, silent: [], deferred: false, baseline: false });
  });

  it('shows the first reached milestone, once', () => {
    const d = decideCelebration({ events: [], startedAt: START, now: START + 2 * 3_600_000, seen: {}, baselined: true });
    expect(d.show?.def.id).toBe('hour');
    expect(decideCelebration({ events: [], startedAt: START, now: START + 2 * 3_600_000, seen: { hour: 1 }, baselined: true }).show).toBeNull();
  });

  it('with several streak milestones new at once, shows the longest and absorbs the others', () => {
    const d = decideCelebration({ events: [], startedAt: START, now: START + 9 * D, seen: {}, baselined: true });
    expect(d.show?.def.id).toBe('week');
    expect(d.silent.sort()).toEqual(['day', 'hour']);
  });

  it('waits when an alarm went off in the last minute, and says it is waiting', () => {
    const now = START + 2 * D;
    const events = [alarm(now - ALARM_QUIET_MS + 1000)];
    const d = decideCelebration({ events, startedAt: START, now, seen: {}, baselined: true });
    expect(d).toMatchObject({ show: null, deferred: true });
  });

  it('shows it once that minute has passed', () => {
    const now = START + 2 * D;
    const events = [alarm(now - ALARM_QUIET_MS - 1)];
    expect(decideCelebration({ events, startedAt: START, now, seen: {}, baselined: true }).show).not.toBeNull();
  });

  it('a hand-logged bite a minute ago does not hold it back (only alarms do)', () => {
    const now = START + 2 * D;
    // The bite restarts the streak, so use a milestone that is not about it: the hour was long reached before.
    const events = [bite(START + 3_600_000 + 5), bite(now - 1000)];
    const d = decideCelebration({ events, startedAt: START, now, seen: {}, baselined: true });
    expect(d.deferred).toBe(false);
    expect(d.show?.def.id).toBeDefined();
  });

  it('shows the 100-alarm card after the quiet minute', () => {
    const now = START + 3 * 3_600_000;
    const events = Array.from({ length: 100 }, (_, i) => alarm(now - 10 * 60_000 - i * 1000));
    const d = decideCelebration({ events, startedAt: START, now, seen: { hour: 1 }, baselined: true });
    expect(d.show?.def.id).toBe('caught100');
  });

  describe('the first run on a device (baseline)', () => {
    it('shows nothing and records what is already reached, so switching Insights on is not a flood of old news', () => {
      const d = decideCelebration({ events: [], startedAt: START, now: START + 12 * D, seen: {}, baselined: false });
      expect(d.show).toBeNull();
      expect(d.baseline).toBe(true);
      expect(d.silent.sort()).toEqual(['day', 'hour', 'week']);
    });

    it('a brand-new person baselines an empty set, and the first hour is then celebrated when it comes', () => {
      const first = decideCelebration({ events: [], startedAt: START, now: START + 1000, seen: {}, baselined: false });
      expect(first).toEqual({ show: null, silent: [], deferred: false, baseline: true });
      const later = decideCelebration({ events: [], startedAt: START, now: START + 2 * 3_600_000, seen: {}, baselined: true });
      expect(later.show?.def.id).toBe('hour');
    });

    it('does not re-record a milestone that is already marked', () => {
      const d = decideCelebration({ events: [], startedAt: START, now: START + 2 * D, seen: { hour: 5 }, baselined: false });
      expect(d.silent).toEqual(['day']);
    });
  });
});
