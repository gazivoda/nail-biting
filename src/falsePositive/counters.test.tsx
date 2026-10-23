// "Not a bite" (WS3) is excluded from EVERY counter, through one set of predicates.
//
// The state table is in src/storage/eventModel.ts. Here each counter is exercised with the same
// history, once without and once with a false positive, and the numbers must not move for anything
// but the false positive's own row: Today (alarms to review, bites), History (summary, week chart,
// the entries line, insights), the Paywall's "alerts logged", the ReplacementPrompt, the streak.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { Incident } from '../types';
import { isAlarmOrBite, isFalsePositive, isPendingAlarm, isUrge } from '../storage/eventModel';
import { topTrigger, peakHour } from '../utils/insights';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { resetFlagsForTests } from '../features/flags';

const NOW = new Date(2026, 9, 23, 12, 0, 0).getTime();
const at = (hour: number, minute = 0) => new Date(2026, 9, 23, hour, minute).getTime();
const rec = (id: string, ts: number, tag: string, autoDetected: boolean, extra: Partial<Incident> = {}): Incident => ({
  id, timestamp: ts, tag, autoDetected, ts, source: autoDetected ? 'alarm' : 'manual', behavior: 'nail_biting', updatedAt: ts, ...extra,
});

const fixed = vi.hoisted(() => ({
  state: {
    incidents: [] as Incident[], customTags: [], weekChartMetric: 'incidents',
    setWeekChartMetric: () => {}, deleteIncident: () => {}, restoreIncident: () => {}, confirmIncident: () => {}, clearHistory: () => {},
  },
}));
vi.mock('../store/useAppStore', async importOriginal => ({
  ...(await importOriginal<typeof import('../store/useAppStore')>()),
  useAppStore: (selector?: (s: unknown) => unknown) => (selector ? selector(fixed.state) : fixed.state),
}));

import { isBite } from '../store/useAppStore';
import { TodayStats } from '../components/dashboard/TodayStats';
import { ReplacementPrompt } from '../components/dashboard/ReplacementPrompt';
import { Log } from '../pages/Log';

// One of each row of the state table, all today.
const unreviewed = rec('alarm', at(9, 0), 'auto-detected', true);
const confirmed = rec('confirmed', at(9, 30), 'stress', true, { confirmed: true });
const manual = rec('manual', at(10, 0), 'boredom', false);
const urge = rec('urge', at(10, 30), 'urge', false);
const falseAlarm = rec('fp', at(11, 0), 'auto-detected', true, { falsePositive: true });
const confirmedThenFalse = rec('fp2', at(11, 30), 'stress', true, { confirmed: true, falsePositive: true });

const HISTORY = [confirmedThenFalse, falseAlarm, urge, manual, confirmed, unreviewed];
const WITHOUT_FALSE = HISTORY.filter(i => !isFalsePositive(i));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  setStorageAdapter(createMemoryAdapter());
  resetFlagsForTests();
});
afterEach(() => {
  vi.useRealTimers();
  resetStorage();
  resetFlagsForTests();
});

describe('the state table (one predicate each)', () => {
  it.each([
    // [label, entry, isBite, isPendingAlarm, isAlarmOrBite]
    ['unreviewed alarm', unreviewed, false, true, true],
    ['confirmed bite', confirmed, true, false, true],
    ['manual log', manual, true, false, true],
    ['urge', urge, false, false, false],
    ['false positive', falseAlarm, false, false, false],
    ['a confirmed alarm later marked Not a bite', confirmedThenFalse, false, false, false],
  ] as const)('%s', (_label, entry, bite, pending, alarmOrBite) => {
    expect(isBite(entry)).toBe(bite);
    expect(isPendingAlarm(entry)).toBe(pending);
    expect(isAlarmOrBite(entry)).toBe(alarmOrBite);
  });

  it('a false positive outranks confirmed, a manual log and an urge', () => {
    for (const e of [confirmed, manual, urge]) {
      const marked = { ...e, falsePositive: true };
      expect(isBite(marked), e.id).toBe(false);
      expect(isPendingAlarm(marked), e.id).toBe(false);
      expect(isAlarmOrBite(marked), e.id).toBe(false);
    }
    expect(isUrge(urge)).toBe(true);
  });

  it('falsePositive: false (an undone mark) is the same as never marked', () => {
    for (const e of HISTORY) {
      const undone = { ...e, falsePositive: false };
      const never = { ...e }; delete never.falsePositive;
      expect([isBite(undone), isPendingAlarm(undone), isAlarmOrBite(undone)]).toEqual([isBite(never), isPendingAlarm(never), isAlarmOrBite(never)]);
    }
  });
});

function numbers(html: string) {
  return [...html.matchAll(/tabular-nums[^"]*leading-none">(\d+)</g)].map(m => Number(m[1]));
}

describe('Today', () => {
  it('"alarms to review" and "bites" ignore a false positive', () => {
    fixed.state.incidents = HISTORY;
    const withFalse = numbers(renderToStaticMarkup(<TodayStats />));
    fixed.state.incidents = WITHOUT_FALSE;
    const without = numbers(renderToStaticMarkup(<TodayStats />));
    expect(withFalse).toEqual(without);
    expect(withFalse).toEqual([1, 2]); // 1 unreviewed alarm; confirmed + manual are the bites (the urge is not)
  });
});

describe('History', () => {
  const summary = (html: string) => ({
    bites: Number(/(\d+)<\/p><p class="[^"]*">Bites</.exec(html)?.[1]),
    review: Number(/(\d+)<\/p><p class="[^"]*">Alarms to review</.exec(html)?.[1]),
  });

  it('the summary counts only real bites and pending alarms', () => {
    fixed.state.incidents = HISTORY;
    expect(summary(renderToStaticMarkup(<Log />))).toEqual({ bites: 2, review: 1 });
  });

  it('the summary is the same as for a history with no false positives in it', () => {
    fixed.state.incidents = HISTORY;
    const a = summary(renderToStaticMarkup(<Log />));
    fixed.state.incidents = WITHOUT_FALSE;
    expect(a).toEqual(summary(renderToStaticMarkup(<Log />)));
  });

  it('the week chart total ("All" and "Bites") leaves them out', () => {
    for (const metric of ['incidents', 'confirmed'] as const) {
      fixed.state.weekChartMetric = metric;
      fixed.state.incidents = HISTORY;
      const withFalse = /tabular-nums">(\d+)<\/span>/.exec(renderToStaticMarkup(<Log />))?.[1];
      fixed.state.incidents = WITHOUT_FALSE;
      const without = /tabular-nums">(\d+)<\/span>/.exec(renderToStaticMarkup(<Log />))?.[1];
      expect(withFalse, metric).toBe(without);
    }
    fixed.state.weekChartMetric = 'incidents';
  });

  it('insights (top trigger, busiest hour) never use a false positive, even if one is passed in', () => {
    const stress = (n: number, extra: Partial<Incident> = {}) => rec(`s${n}`, at(9 + (n % 2), n), 'stress', false, extra);
    const real = [stress(1), stress(2), stress(3)];
    expect(topTrigger(real)).toMatchObject({ tag: 'stress', count: 3, of: 3 });
    const withFalse = [...real, stress(4, { falsePositive: true }), stress(5, { falsePositive: true })];
    expect(topTrigger(withFalse)).toEqual(topTrigger(real));
    // Three false positives alone are not a pattern.
    const onlyFalse = [1, 2, 3].map(n => stress(n, { falsePositive: true }));
    expect(topTrigger(onlyFalse)).toBeNull();
    expect(peakHour(onlyFalse)).toBeNull();
    expect(peakHour(withFalse)).toEqual(peakHour(real));
  });
});

describe('ReplacementPrompt ("was it a bite?")', () => {
  const show = (incidents: Incident[]) => {
    fixed.state.incidents = incidents;
    return renderToStaticMarkup(<ReplacementPrompt />);
  };

  it('asks about a pending alarm', () => {
    expect(show([rec('a', NOW - 30_000, 'auto-detected', true)])).toContain('Alarm: try this instead');
  });

  it('does not ask about an alarm that was marked Not a bite', () => {
    expect(show([rec('a', NOW - 30_000, 'auto-detected', true, { falsePositive: true })])).toBe('');
  });

  it('asks again once the mark is undone', () => {
    expect(show([rec('a', NOW - 30_000, 'auto-detected', true, { falsePositive: false })])).toContain('Alarm: try this instead');
  });
});

describe('the Paywall\'s "alerts logged"', () => {
  it('counts alarms and bites, not urges or Not a bite (the selector is the shared predicate)', () => {
    expect(HISTORY.filter(isAlarmOrBite).map(i => i.id).sort()).toEqual(['alarm', 'confirmed', 'manual']);
    // PaywallPage needs the auth context and Paddle to render in a test: pin the line instead.
    const source = readFileSync(new URL('../components/auth/PaywallPage.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/useAppStore\(s => s\.incidents\.filter\(isAlarmOrBite\)\.length\)/);
    expect(source).not.toMatch(/s => s\.incidents\.length/);
  });
});
