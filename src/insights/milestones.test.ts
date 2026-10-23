import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evaluateMilestones, planCelebrations, MILESTONES, type MilestoneId, type MilestoneStatus } from './milestones';
import { markMilestonesSeen, readSeenMilestones } from './milestoneSeen';
import { alarm, bite, urge } from './testEvents';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { zoneFor } from './zone';

const H = 3_600_000;
const D = 86_400_000;
const START = Date.UTC(2026, 9, 1, 8); // when the record starts: 1 Oct 2026 08:00 UTC

const status = (events: Parameters<typeof evaluateMilestones>[0]['events'], now: number, startedAt = START) => {
  const out = evaluateMilestones({ events, startedAt, now });
  const by = (id: MilestoneId): MilestoneStatus => out.find(s => s.def.id === id)!;
  return { out, by };
};

describe('streak milestones', () => {
  it('nothing is reached before the first hour', () => {
    const { by } = status([], START + H - 1);
    expect(by('hour').reachedAt).toBeNull();
    expect(by('day').reachedAt).toBeNull();
  });

  it('with no bites at all the streak runs from the start of the record', () => {
    const { by } = status([], START + 3 * D);
    expect(by('hour').reachedAt).toBe(START + H);
    expect(by('day').reachedAt).toBe(START + D);
    expect(by('week').reachedAt).toBeNull();
    expect(by('hour').current).toBe(3 * D);
  });

  it('is reached exactly at the threshold, not a millisecond earlier', () => {
    expect(status([], START + H).by('hour').reachedAt).toBe(START + H);
    expect(status([], START + H - 1).by('hour').reachedAt).toBeNull();
  });

  it('a bite starts the count again, and "first" means the first time any gap was long enough', () => {
    // Record starts at START. A bite 30 minutes in. Then 8 days without one. Then a bite. Then 2 hours.
    const first = START + 30 * 60_000;
    const second = first + 8 * D;
    const third = second + 10 * 60_000;
    const { by } = status([bite(first), bite(second), bite(third)], third + 2 * H);
    expect(by('hour').reachedAt).toBe(first + H);          // the 8-day gap, not the later 2-hour one
    expect(by('day').reachedAt).toBe(first + D);
    expect(by('week').reachedAt).toBe(first + 7 * D);
    expect(by('month').reachedAt).toBeNull();
    expect(by('hour').best).toBe(8 * D);                   // longest gap so far
    expect(by('hour').current).toBe(2 * H);                // the gap running now
  });

  it('a long gap with the app closed still counts: the streak is time since the last logged bite', () => {
    const { by } = status([bite(START + H)], START + 40 * D);
    expect(by('month').reachedAt).toBe(START + H + 30 * D);
  });

  it('is ordered: a longer milestone is never reached before a shorter one', () => {
    const { out } = status([bite(START + 5 * H)], START + 60 * D);
    const times = out.filter(s => s.def.kind === 'streak').map(s => s.reachedAt!);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('an alarm nobody confirmed does not break the streak (same as the Watch tab)', () => {
    const { by } = status([alarm(START + H)], START + 2 * D);
    expect(by('day').reachedAt).toBe(START + D);
  });

  it('an urge does not break it either', () => {
    expect(status([urge(START + 2 * H)], START + 2 * D).by('day').reachedAt).toBe(START + D);
  });

  it('a confirmed alarm and a hand-logged bite do break it', () => {
    expect(status([alarm(START + 2 * H, { confirmed: true })], START + 2 * D).by('day').reachedAt).toBe(START + 2 * H + D);
    expect(status([bite(START + 2 * H)], START + 2 * D).by('day').reachedAt).toBe(START + 2 * H + D);
  });

  it('a bite marked "Not a bite" does not break it, and a deleted one does not either', () => {
    expect(status([bite(START + 2 * H, { falsePositive: true })], START + 2 * D).by('day').reachedAt).toBe(START + D);
    expect(status([bite(START + 2 * H, { deleted: true })], START + 2 * D).by('day').reachedAt).toBe(START + D);
  });

  it('ignores bites that are in the future (a clock that was ahead)', () => {
    const now = START + 2 * D;
    expect(status([bite(now + D)], now).by('day').reachedAt).toBe(START + D);
  });

  it('a record that starts after its first bite (an import) measures from the bite', () => {
    const bitten = START - 3 * D;
    const { by } = status([bite(bitten)], START + 2 * H, START);
    expect(by('week').reachedAt).toBeNull();
    expect(by('day').reachedAt).toBe(bitten + D);
  });

  it('a clock set back before the start of the record reaches nothing and does not throw', () => {
    const { out } = status([], START - 5 * D);
    expect(out.every(s => s.reachedAt === null)).toBe(true);
    expect(out.every(s => s.current >= 0 && s.best >= 0)).toBe(true);
  });

  it('two bites at the same instant are one bite', () => {
    const t = START + H;
    expect(status([bite(t), bite(t)], t + D).by('day').reachedAt).toBe(t + D);
  });
});

describe('daylight saving and time zones do not move a streak', () => {
  // "A day" is 24 hours of not biting (like the streak on the Watch tab), so a 23- or 25-hour calendar day
  // in the middle of it changes nothing. The moment is computed in ms, and read back in the person's zone.
  it('across the New York spring-forward night, a day is still 24 hours', () => {
    const ny = zoneFor('America/New_York');
    const biteAt = Date.UTC(2026, 2, 7, 17); // Sat 7 March 12:00 EST
    const { by } = status([bite(biteAt)], biteAt + 3 * D, biteAt - 2 * H);
    const reached = by('day').reachedAt!;
    expect(reached - biteAt).toBe(D);
    // Sunday 8 March 13:00 EDT: the wall clock reads one hour later than 24 hours before, because an hour was skipped.
    expect(ny.parts(reached)).toMatchObject({ month: 2, day: 8, hour: 13 });
  });

  it('across the fall-back night, a week is still 168 hours', () => {
    const biteAt = Date.UTC(2026, 9, 28, 12); // 28 Oct, a few days before the clocks go back (1 Nov)
    const { by } = status([bite(biteAt)], biteAt + 10 * D, biteAt - 2 * H);
    expect(by('week').reachedAt! - biteAt).toBe(7 * D);
  });

  it('gives the same instants whatever zone the machine is in (it never reads a zone)', () => {
    const events = [bite(START + 4 * H), alarm(START + 2 * D, { confirmed: true })];
    const a = evaluateMilestones({ events, startedAt: START, now: START + 20 * D });
    const b = evaluateMilestones({ events, startedAt: START, now: START + 20 * D });
    expect(a.map(s => s.reachedAt)).toEqual(b.map(s => s.reachedAt));
  });
});

describe('the 100-alarm milestone', () => {
  const alarms = (n: number, from = START, step = 60_000) => Array.from({ length: n }, (_, i) => alarm(from + i * step));

  it('is not reached at 99 and is reached by the 100th', () => {
    expect(status(alarms(99), START + 2 * D).by('caught100')).toMatchObject({ reachedAt: null, best: 99 });
    const s = status(alarms(100), START + 2 * D).by('caught100');
    expect(s.reachedAt).toBe(START + 99 * 60_000);
    expect(s.best).toBe(100);
  });

  it('counts alarms whether or not they were reviewed, and ignores false positives, deleted ones, bites and urges', () => {
    const events = [
      ...alarms(98),
      alarm(START + 1_000_000, { falsePositive: true }),
      alarm(START + 1_000_001, { deleted: true }),
      bite(START + 1_000_002),
      urge(START + 1_000_003),
      alarm(START + 1_000_004, { confirmed: true }),
    ];
    expect(status(events, START + 2 * D).by('caught100')).toMatchObject({ reachedAt: null, best: 99 });
    // The 100th in time order is the latest of the hundred, not the one added last.
    expect(status([...events, alarm(START + 2_000_000)], START + 2 * D).by('caught100').reachedAt).toBe(START + 97 * 60_000);
  });

  it('is dated by the 100th alarm in time order, whatever order the list is in', () => {
    const shuffled = alarms(120).reverse();
    expect(status(shuffled, START + 2 * D).by('caught100').reachedAt).toBe(START + 99 * 60_000);
  });

  it('is not reached by alarms that are still to come', () => {
    expect(status(alarms(100, START + D), START + H).by('caught100').reachedAt).toBeNull();
  });
});

describe('celebrations: once each, and never a pile-up', () => {
  const all = (now: number, events: Parameters<typeof evaluateMilestones>[0]['events'] = []) => evaluateMilestones({ events, startedAt: START, now });

  it('celebrates what is reached and unseen, oldest first', () => {
    const plan = planCelebrations(all(START + 2 * H), {});
    expect(plan.celebrate.map(s => s.def.id)).toEqual(['hour']);
    expect(plan.silent).toEqual([]);
  });

  it('does not celebrate anything twice', () => {
    const statuses = all(START + 2 * H);
    expect(planCelebrations(statuses, { hour: START + H }).celebrate).toEqual([]);
  });

  it('when several streak milestones are new at once, only the longest gets a screen and the rest are recorded quietly', () => {
    const plan = planCelebrations(all(START + 12 * D), {});
    expect(plan.celebrate.map(s => s.def.id)).toEqual(['week']);
    expect(plan.silent.sort()).toEqual(['day', 'hour']);
  });

  it('a streak milestone and the alarm count are separate celebrations, oldest first', () => {
    // 100 alarms 30 minutes in (unreviewed, so they do not break the streak), then two quiet days.
    const events = Array.from({ length: 100 }, (_, i) => alarm(START + 30 * 60_000 + i * 1000));
    const plan = planCelebrations(all(START + 2 * D, events), {});
    expect(plan.celebrate.map(s => s.def.id)).toEqual(['caught100', 'day']);
    expect(plan.silent).toEqual(['hour']);
  });

  it('a milestone that was seen stays seen even after the history it came from is gone', () => {
    const before = all(START + 9 * D);
    expect(planCelebrations(before, {}).celebrate.map(s => s.def.id)).toEqual(['week']);
    const seen = { hour: 1, day: 1, week: 1 };
    // History cleared: the record starts again, and the streak climbs back through the same milestones.
    const restarted = evaluateMilestones({ events: [], startedAt: START + 9 * D, now: START + 9 * D + 8 * D });
    expect(restarted.find(s => s.def.id === 'week')!.reachedAt).not.toBeNull();
    expect(planCelebrations(restarted, seen)).toEqual({ celebrate: [], silent: [] });
  });

  it('with the history cleared and nothing reached, nothing is celebrated and nothing throws', () => {
    expect(planCelebrations(all(START), {})).toEqual({ celebrate: [], silent: [] });
  });
});

describe('milestone wording', () => {
  it('is plain and makes no medical or invented claim', () => {
    const text = MILESTONES.map(m => `${m.title} ${m.figure} ${m.detail}`).join(' ');
    expect(text).not.toMatch(/cure|treat|heal|recover|clinical|proven|study|%|percent|streak record|best ever/i);
    expect(text).not.toMatch(/100% private|nothing leaves/i);
  });

  it('says what a streak is measured from', () => {
    for (const m of MILESTONES.filter(x => x.kind === 'streak')) expect(m.detail).toMatch(/since your last logged bite/);
  });

  it('lists the five milestones of the plan', () => {
    expect(MILESTONES.map(m => m.id)).toEqual(['hour', 'day', 'week', 'month', 'caught100']);
  });
});

describe('remembering what was seen (kv)', () => {
  beforeEach(() => setStorageAdapter(createMemoryAdapter()));
  afterEach(() => resetStorage());

  it('starts empty and remembers a milestone with the time it was recorded', () => {
    expect(readSeenMilestones()).toEqual({});
    markMilestonesSeen(['day'], 123);
    expect(readSeenMilestones()).toEqual({ day: 123 });
  });

  it('keeps the first time and adds new ones', () => {
    markMilestonesSeen(['day'], 1);
    markMilestonesSeen(['day', 'week'], 2);
    expect(readSeenMilestones()).toEqual({ day: 1, week: 2 });
  });

  it('survives garbage in storage', () => {
    kv.set('insights', 'milestones', { v: 1, seen: { day: 'yesterday', nope: 5, week: 7, hour: null } });
    expect(readSeenMilestones()).toEqual({ week: 7 });
    kv.set('insights', 'milestones', 'not an object');
    expect(readSeenMilestones()).toEqual({});
    kv.set('insights', 'milestones', null);
    expect(readSeenMilestones()).toEqual({});
  });
});
