// The share summary runs on the server, from synced wire events; the app decides what a bite
// is on the device, from stored incidents (WS3: docs/agents/ws3-notes.md, "The review states").
// The two must never disagree, or a therapist would see a different count from the person.
// This file pins the server's definition to the app's own predicates, state by state and on
// random events.
//
// What the server counts (summary.js header says the same):
//   bite   live (not deleted), falsePositive !== true, not an urge, and either logged by hand
//          (source manual) or an alarm with confirmed === true.
//   NOT a bite: an unconfirmed alarm ("alarms to review"), a false positive (it outranks
//          `confirmed`), an urge-timer entry, a tombstone.
//   alarm (for the competing-response rate): live, source alarm, falsePositive !== true.

import { describe, expect, it } from 'vitest';
import { fromHabitEvent, isAlarmOrBite, isFalsePositive, isPendingAlarm, isUrge } from '../../src/storage/eventModel.ts';
import { isBite } from '../../src/store/useAppStore.ts';
import { buildShareView } from './summary.js';

const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const TS = NOW - 2 * 3600000;

const wire = (over) => ({ id: 'x', ts: TS, source: 'manual', behavior: 'nail_biting', updatedAt: TS, ...over });
const biteCount = e => buildShareView([e], { now: NOW }).totals.last12Weeks;
const alarmCount = e => buildShareView([{ ...e, competingResponse: { done: true } }], { now: NOW }).competingResponse.alarms;

describe('the WS3 state table, as the server counts it', () => {
  const rows = [
    // state                         wire event                                              bite   pending alarmOrBite
    ['unreviewed alarm',             { source: 'alarm' },                                    false, true,  true],
    ['confirmed bite',               { source: 'alarm', confirmed: true },                   true,  false, true],
    ['false positive',               { source: 'alarm', falsePositive: true },               false, false, false],
    ['false positive, confirmed',    { source: 'alarm', confirmed: true, falsePositive: true }, false, false, false],
    ['manual log ("I bit")',         { source: 'manual', triggers: ['stress'] },             true,  false, true],
    ['manual log with no reason',    { source: 'manual' },                                   true,  false, true],
    ['urge (urge timer)',            { source: 'manual', triggers: ['urge'] },                false, false, false],
    ['alarm confirmed as "urge"',    { source: 'alarm', confirmed: true, triggers: ['urge'] }, true, false, true],
    ['manual, marked false positive', { source: 'manual', falsePositive: true },             false, false, false],
    ['undo of not-a-bite (false)',   { source: 'alarm', confirmed: true, falsePositive: false }, true, false, true],
  ];

  for (const [name, over, bite, pending, alarmOrBite] of rows) {
    it(`${name}: bite ${bite}`, () => {
      const e = wire(over);
      const stored = fromHabitEvent(e);
      // the app's answers
      expect(isBite(stored), 'app isBite').toBe(bite);
      expect(isPendingAlarm(stored), 'app isPendingAlarm').toBe(pending);
      expect(isAlarmOrBite(stored), 'app isAlarmOrBite').toBe(alarmOrBite);
      // the server's answers agree
      expect(biteCount(e), 'server bite').toBe(bite ? 1 : 0);
      expect(biteCount({ ...e, deleted: true }), 'server, tombstone').toBe(0);
      // an alarm in the competing-response rate = an alarm the person did not mark "not a bite"
      expect(alarmCount(e), 'server alarm').toBe(e.source === 'alarm' && !isFalsePositive(stored) ? 1 : 0);
    });
  }

  it('an unconfirmed alarm still starts a streak count from the first entry, but never resets it', () => {
    const v = buildShareView([wire({ source: 'alarm', ts: NOW - 5 * 86400000 })], { now: NOW });
    expect(v.totals.last12Weeks).toBe(0);
    expect(v.streak).toEqual({ days: 5, since: 'first_entry' });
  });
});

describe('the server and the app agree on random events', () => {
  it('bites, alarms and urges, 3000 combinations', () => {
    let seed = 99;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pick = a => a[Math.floor(rand() * a.length)];
    for (let i = 0; i < 3000; i++) {
      const e = wire({
        source: pick(['alarm', 'manual']),
        ...pick([{}, { confirmed: true }, { confirmed: false }]),
        ...pick([{}, { falsePositive: true }, { falsePositive: false }]),
        ...pick([{}, { triggers: ['urge'] }, { triggers: ['stress'] }, { triggers: ['custom-ab12'] }, { triggers: ['stress', 'urge'] }]),
      });
      const stored = fromHabitEvent(e);
      expect(biteCount(e), JSON.stringify(e)).toBe(isBite(stored) ? 1 : 0);
      expect(isUrge(stored) && biteCount(e) === 1, JSON.stringify(e)).toBe(false);
      expect(alarmCount(e), JSON.stringify(e)).toBe(e.source === 'alarm' && !isFalsePositive(stored) ? 1 : 0);
    }
  });
});
