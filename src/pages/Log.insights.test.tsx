// History's second view (WS5): the History | Insights switch exists only while `insights` or `photo_diary` is on.
// With both off the page is the markup it always was; with one on, the ONLY difference is the switch.
// Same harness as Log.behaviorFilter.test.tsx: the store is replaced by fixed data because zustand renders its
// initial state on the server, and flags come from the kv cache.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Incident } from '../types';
import { resetFlagsForTests } from '../features/flags';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';

const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).getTime();
const rec = (id: string, ts: number, tag: string, autoDetected: boolean): Incident => ({
  id, timestamp: ts, tag, autoDetected, ts, source: autoDetected ? 'alarm' : 'manual', behavior: 'nail_biting', updatedAt: ts,
});

const fixed = vi.hoisted(() => ({
  state: { incidents: [] as Incident[], customTags: [], weekChartMetric: 'incidents',
    setWeekChartMetric: () => {}, deleteIncident: () => {}, restoreIncident: () => {}, confirmIncident: () => {}, clearHistory: () => {} },
}));
vi.mock('../store/useAppStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../store/useAppStore')>()),
  useAppStore: () => fixed.state,
}));

import { Log } from './Log';

const HISTORY = [rec('a1', at(23, 9, 5), 'auto-detected', true), rec('a2', at(23, 9, 40), 'stress', false), rec('a3', at(22, 15, 5), 'boredom', false)];

function render(flags: string[], incidents: Incident[] = HISTORY) {
  kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(flags.map(f => [f, true])) });
  resetFlagsForTests();
  fixed.state.incidents = incidents;
  return renderToStaticMarkup(<Log onGoToWatch={() => {}} />);
}

/** The switch, cut out of the markup so the rest can be compared. */
function withoutSwitch(html: string): string {
  const start = html.indexOf('<div class="-mt-2 mb-6"><div role="radiogroup" aria-label="History view"');
  expect(start, 'the switch is in the page').toBeGreaterThan(-1);
  const end = html.indexOf('</button></div></div>', start) + '</button></div></div>'.length;
  return html.slice(0, start) + html.slice(end);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 23, 12, 0, 0));
  setStorageAdapter(createMemoryAdapter());
  resetFlagsForTests();
});
afterEach(() => {
  vi.useRealTimers();
  resetStorage();
  resetFlagsForTests();
});

describe('History with the insights flags', () => {
  it('has no switch, no reminder and no mention of insights with every flag off', () => {
    const html = render([]);
    expect(html).not.toContain('History view');
    expect(html).not.toContain('Insights');
    expect(html).not.toContain('Photo diary');
  });

  it('adds the switch, and nothing else, with `insights` on', () => {
    const off = render([]);
    const on = render(['insights']);
    expect(on).toContain('aria-label="History view"');
    expect(on).toContain('Insights');
    expect(withoutSwitch(on)).toBe(off);
  });

  it('adds the switch, and nothing else, with only `photo_diary` on, and calls the view "Photos"', () => {
    const off = render([]);
    const on = render(['photo_diary']);
    expect(on).toMatch(/aria-checked="false"[^>]*>Photos</);
    expect(withoutSwitch(on)).toBe(off);
  });

  it('starts on History, with the list as before', () => {
    const html = render(['insights']);
    expect(html).toMatch(/aria-checked="true"[^>]*>History</);
    expect(html).toContain('3 entries');
  });

  it('an empty history still shows the first-visit card, with the switch above it', () => {
    const html = render(['insights'], []);
    expect(html).toContain('No history yet');
    expect(html).toContain('aria-label="History view"');
  });
});
