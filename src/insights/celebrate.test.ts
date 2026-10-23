import { describe, it, expect } from 'vitest';
import { ALARM_QUIET_MS, decideCelebration } from './celebrate';
import { alarm, bite } from './testEvents';

const D = 86_400_000;
const START = Date.UTC(2026, 9, 1, 8);

describe('decideCelebration', () => {
  it('shows nothing before anything is reached', () => {
    expect(decideCelebration({ events: [], startedAt: START, now: START + 1000, seen: {} })).toEqual({ show: null, silent: [], deferred: false });
  });

  it('shows the first reached milestone, once', () => {
    const d = decideCelebration({ events: [], startedAt: START, now: START + 2 * 3_600_000, seen: {} });
    expect(d.show?.def.id).toBe('hour');
    expect(decideCelebration({ events: [], startedAt: START, now: START + 2 * 3_600_000, seen: { hour: 1 } }).show).toBeNull();
  });

  it('with several streak milestones new at once, shows the longest and absorbs the others', () => {
    const d = decideCelebration({ events: [], startedAt: START, now: START + 9 * D, seen: {} });
    expect(d.show?.def.id).toBe('week');
    expect(d.silent.sort()).toEqual(['day', 'hour']);
  });

  it('waits when an alarm went off in the last minute, and says it is waiting', () => {
    const now = START + 2 * D;
    const events = [alarm(now - ALARM_QUIET_MS + 1000)];
    const d = decideCelebration({ events, startedAt: START, now, seen: {} });
    expect(d).toMatchObject({ show: null, deferred: true });
  });

  it('shows it once that minute has passed', () => {
    const now = START + 2 * D;
    const events = [alarm(now - ALARM_QUIET_MS - 1)];
    expect(decideCelebration({ events, startedAt: START, now, seen: {} }).show).not.toBeNull();
  });

  it('a hand-logged bite a minute ago does not hold it back (only alarms do)', () => {
    const now = START + 2 * D;
    // The bite restarts the streak, so use a milestone that is not about it: the hour was long reached before.
    const events = [bite(START + 3_600_000 + 5), bite(now - 1000)];
    const d = decideCelebration({ events, startedAt: START, now, seen: {} });
    expect(d.deferred).toBe(false);
    expect(d.show?.def.id).toBeDefined();
  });

  it('shows the 100-alarm card after the quiet minute', () => {
    const now = START + 3 * 3_600_000;
    const events = Array.from({ length: 100 }, (_, i) => alarm(now - 10 * 60_000 - i * 1000));
    const d = decideCelebration({ events, startedAt: START, now, seen: { hour: 1 } });
    expect(d.show?.def.id).toBe('caught100');
  });
});
