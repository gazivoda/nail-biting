// History's behaviour filter (WS1): shown only with the `detection_behaviors` flag on AND more than
// one behaviour in the history; with the flag off, or with one behaviour, the page is exactly what it
// was before. The store is replaced by fixed data because zustand renders its initial state on the server.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Incident } from '../types';
import { resetFlagsForTests } from '../features/flags';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';

const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).getTime();
const rec = (id: string, ts: number, tag: string, autoDetected: boolean, behavior: Incident['behavior'] = 'nail_biting'): Incident => ({
  id, timestamp: ts, tag, autoDetected, ts, source: autoDetected ? 'alarm' : 'manual', behavior, updatedAt: ts,
});

const fixed = vi.hoisted(() => ({
  state: { incidents: [] as Incident[], customTags: [], weekChartMetric: 'incidents',
    setWeekChartMetric: () => {}, deleteIncident: () => {}, restoreIncident: () => {}, confirmIncident: () => {}, clearHistory: () => {} },
}));
vi.mock('../store/useAppStore', () => ({ useAppStore: () => fixed.state }));

import { Log } from './Log';

const NAIL_ONLY = [
  rec('a1', at(23, 9, 5), 'auto-detected', true),
  rec('a2', at(23, 9, 40), 'stress', false),
  rec('a3', at(22, 15, 5), 'boredom', false),
];
const MIXED = [
  ...NAIL_ONLY,
  rec('b1', at(23, 10, 5), 'auto-detected', true, 'nose_picking'),
  rec('b2', at(22, 16, 5), 'stress', false, 'cuticle_skin_biting'),
];

function render(incidents: Incident[], flags: string[]) {
  kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(flags.map(f => [f, true])) });
  resetFlagsForTests();
  fixed.state.incidents = incidents;
  return renderToStaticMarkup(<Log />);
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

const FILTER = 'aria-label="Show behavior"';

describe('History behaviour filter', () => {
  it('is absent with the flag off, even when several behaviours are in the history', () => {
    expect(render(MIXED, [])).not.toContain(FILTER);
  });

  it('is absent with the flag on while only one behaviour is in the history', () => {
    expect(render(NAIL_ONLY, ['detection_behaviors'])).not.toContain(FILTER);
  });

  it('with one behaviour, the page is the same markup with the flag on as with it off', () => {
    expect(render(NAIL_ONLY, ['detection_behaviors'])).toBe(render(NAIL_ONLY, []));
  });

  it('with the flag off, a mixed history renders as the same page whatever the behaviours are', () => {
    // Every entry is shown, none hidden, and nothing mentions a behaviour.
    const html = render(MIXED, []);
    expect(html).toContain('5 entries');
    expect(html).not.toMatch(/Cuticles|Nose|Nails/);
  });

  it('appears with the flag on and more than one behaviour, offering All plus only the behaviours present', () => {
    const html = render(MIXED, ['detection_behaviors']);
    expect(html).toContain(FILTER);
    const labels = [...html.matchAll(/role="radio"[^>]*>([A-Za-z ]+)</g)].map(m => m[1]);
    // Radios on the page: this filter (All + three behaviours) then the chart's All / Bites control.
    expect(labels.slice(0, 4)).toEqual(['All', 'Nails', 'Cuticles', 'Nose']);
    expect(html).toContain('5 entries');
  });
});
