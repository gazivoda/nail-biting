// Parity: the weekly email (plain JS, server) and the Insights page (TypeScript, browser) must give the same
// answer for the same history. They are two implementations of one definition ("a bite is a hand-logged or
// confirmed entry that is not an urge, not marked Not a bite, not deleted"), because the server cannot import
// from src/. This test feeds ONE history through both and compares: bites this week and last week, the bites on
// each of the seven days, the top trigger, and the false-positive / urge / deleted / unconfirmed exclusions.
//
// The history goes through the real conversion to the wire shape (toHabitEvent), so it is what sync would send.

import { describe, it, expect } from 'vitest';
import { buildWeeklySummary, isCountedBiteEvent } from './summary.js';
import { weekBounds } from './week.js';
import { computeInsights } from '../../src/insights/aggregate.ts';
import { zoneFor } from '../../src/insights/zone.ts';
import { alarm, bite, rng, urge } from '../../src/insights/testEvents.ts';
import { toHabitEvent } from '../../src/storage/eventModel.ts';
import { countsAsBite } from '../../src/insights/predicate.ts';

const HOUR = 3_600_000;
const PRESETS = ['stress', 'focus', 'boredom', 'unknown'];

/** A deterministic mixed history across [from, to): every kind of entry the two sides must agree on. */
function history(from, to, count, seed, tags = PRESETS) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const ts = from + Math.floor(r() * (to - from));
    const tag = tags[Math.floor(r() * tags.length)];
    const k = r();
    if (k < 0.3) out.push(bite(ts, { tag }));
    else if (k < 0.5) out.push(alarm(ts, { confirmed: true, tag }));
    else if (k < 0.7) out.push(alarm(ts));
    else if (k < 0.78) out.push(urge(ts));
    else if (k < 0.85) out.push(alarm(ts, { falsePositive: true }));
    else if (k < 0.9) out.push(alarm(ts, { confirmed: true, falsePositive: true, tag }));
    else if (k < 0.95) out.push(bite(ts, { tag, falsePositive: true }));
    else out.push(bite(ts, { tag, deleted: true }));
  }
  return out;
}

function bothSides(events, timeZone, nowMs) {
  const wire = events.map(e => toHabitEvent(e));
  const bounds = weekBounds(nowMs, timeZone);
  const inWindow = wire.filter(e => e.ts >= bounds.prevWeekStart && e.ts < bounds.weekEnd);
  const server = buildWeeklySummary(inWindow, { ...bounds, timeZone });
  // The client looks at the same week by asking on its last millisecond, with the same seven-day windows.
  const client = computeInsights(events, { now: bounds.weekEnd - 1, zone: zoneFor(timeZone), rangeDays: 7 });
  return { server, client, bounds };
}

const ZONES = ['UTC', 'America/New_York', 'Europe/Berlin', 'Asia/Kolkata', 'Pacific/Auckland', 'Pacific/Kiritimati', 'America/Los_Angeles'];
// A moment after each of these weeks ended: a normal week, the spring-forward week, the fall-back week, a year boundary.
const NOWS = [Date.UTC(2026, 9, 26, 12), Date.UTC(2026, 2, 9, 12), Date.UTC(2026, 10, 2, 12), Date.UTC(2027, 0, 4, 12)];

describe('the weekly email and the Insights page count the same', () => {
  for (const tz of ZONES) {
    for (const nowMs of NOWS) {
      it(`${tz}, week ending before ${new Date(nowMs).toISOString().slice(0, 10)}`, () => {
        const { bounds } = bothSides([], tz, nowMs);
        const events = history(bounds.prevWeekStart - 2 * HOUR, bounds.weekEnd + 2 * HOUR, 600, nowMs % 9973);
        const { server, client } = bothSides(events, tz, nowMs);

        expect(server.thisWeek).toBe(client.trend.current);
        expect(server.lastWeek).toBe(client.trend.previous);
        // The seven days, Monday first, are the last seven daily buckets.
        expect(server.days.map(d => d.count)).toEqual(client.daily.slice(-7).map(d => d.bites));
        expect(client.daily.slice(-7).map(d => d.start)).toEqual(client.daily.slice(-7).map((_, i) => zoneFor(tz).addDays(bounds.weekStart, i)));
        // Percent change.
        expect(server.changePct).toBe(client.trend.pct);
        // Alarms awaiting review: the client's "alarms and bites" minus its bites, inside the week.
        expect(server.alarmsToReview).toBe(client.entryTrend.current - client.trend.current);
        // Top trigger: the same reason, the same counts (presets only; see the custom-reason test).
        const top = client.triggers.top;
        if (server.topTrigger === null) expect(top).toBeNull();
        else expect(top).toEqual({ tag: server.topTrigger.id, count: server.topTrigger.count, of: server.topTrigger.of });
      });
    }
  }

  it('counts the same entries as bites, one by one, on a history of every kind', () => {
    const events = history(Date.UTC(2026, 0, 1), Date.UTC(2026, 6, 1), 3000, 99);
    for (const e of events) expect(isCountedBiteEvent(toHabitEvent(e))).toBe(countsAsBite(e));
  });

  it('an entry marked Not a bite is no bite on either side, even if it was confirmed', () => {
    const e = alarm(Date.UTC(2026, 9, 20, 10), { confirmed: true, falsePositive: true });
    expect(countsAsBite(e)).toBe(false);
    expect(isCountedBiteEvent(toHabitEvent(e))).toBe(false);
  });

  it('a urge-timer entry and a deleted entry are no bite on either side', () => {
    const u = urge(Date.UTC(2026, 9, 20, 10));
    const d = bite(Date.UTC(2026, 9, 20, 11), { deleted: true });
    expect(countsAsBite(u)).toBe(false);
    expect(isCountedBiteEvent(toHabitEvent(u))).toBe(false);
    expect(countsAsBite(d)).toBe(false);
    expect(isCountedBiteEvent({ ...toHabitEvent(d), deleted: true })).toBe(false);
  });

  it('a custom reason that wins is named on the page but not in the email (custom labels are not synced)', () => {
    const tz = 'UTC';
    const { bounds } = bothSides([], tz, NOWS[0]);
    const events = [0, 1, 2, 3].map(i => bite(bounds.weekStart + (i + 1) * HOUR, { tag: 'custom-1' }));
    events.push(bite(bounds.weekStart + 10 * HOUR, { tag: 'stress' }));
    const { server, client } = bothSides(events, tz, NOWS[0]);
    expect(client.triggers.top).toEqual({ tag: 'custom-1', count: 4, of: 5 });
    expect(server.topTrigger).toBeNull();
    expect(server.thisWeek).toBe(client.trend.current);
  });

  it('breaks a tie between reasons the same way: the one that sorts first', () => {
    const tz = 'UTC';
    const { bounds } = bothSides([], tz, NOWS[0]);
    const events = [
      bite(bounds.weekStart + HOUR, { tag: 'stress' }), bite(bounds.weekStart + 2 * HOUR, { tag: 'stress' }),
      bite(bounds.weekStart + 3 * HOUR, { tag: 'focus' }), bite(bounds.weekStart + 4 * HOUR, { tag: 'focus' }),
    ];
    const { server, client } = bothSides(events, tz, NOWS[0]);
    expect(server.topTrigger).toMatchObject({ id: 'focus', count: 2, of: 4 });
    expect(client.triggers.top).toEqual({ tag: 'focus', count: 2, of: 4 });
  });

  it('agrees that two bites with a reason are not enough to name one', () => {
    const tz = 'UTC';
    const { bounds } = bothSides([], tz, NOWS[0]);
    const events = [bite(bounds.weekStart + HOUR, { tag: 'stress' }), bite(bounds.weekStart + 2 * HOUR, { tag: 'stress' })];
    const { server, client } = bothSides(events, tz, NOWS[0]);
    expect(server.topTrigger).toBeNull();
    expect(client.triggers.top).toBeNull();
  });
});
