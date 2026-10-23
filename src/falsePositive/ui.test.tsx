// The screens of "Not a bite" (WS3), rendered in node: the toast and the minimized window's button, the
// Settings > Detection card, and History with the flag on and off.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Incident } from '../types';
import { NotABiteSeam, PipButton, ToastBody } from './NotABiteSeam';
import type { NotABiteState } from './controller';
import { resetFlagsForTests } from '../features/flags';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { clearCalibration, resetEverything, writeCalibration, writeSettings } from './poseStore';
import { falsePositiveRates, describeFalsePositiveRate } from './stats';

const NOW = new Date(2026, 9, 23, 12, 0, 0).getTime();
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
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

import { Log } from '../pages/Log';
import { DetectionSettings } from './DetectionSettings';

const flagsOn = (...names: string[]) => {
  kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(names.map(n => [n, true])) });
  resetFlagsForTests();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  setStorageAdapter(createMemoryAdapter());
  resetFlagsForTests();
  fixed.state.incidents = [];
  fixed.state.weekChartMetric = 'incidents';
});
afterEach(() => {
  vi.useRealTimers();
  resetStorage();
  resetFlagsForTests();
});

const offered: NotABiteState = { armed: true, offer: { eventId: 'a', phase: 'offered' } };
const marked: NotABiteState = { armed: true, offer: { eventId: 'a', phase: 'marked' } };

describe('the toast', () => {
  it('the seam renders nothing in a page that never armed it (the landing demo, the flag-off app)', () => {
    expect(renderToStaticMarkup(<NotABiteSeam surface="main" />)).toBe('');
    expect(renderToStaticMarkup(<NotABiteSeam surface="pip" />)).toBe('');
  });

  it('offers "Not a bite" in plain words, with a close button, and takes no focus', () => {
    const html = renderToStaticMarkup(<ToastBody state={offered} />);
    expect(html).toContain('Not a bite');
    expect(html).toContain('Only resting your hand?');
    expect(html).toContain('aria-label="Close"');
    expect(html).not.toMatch(/autofocus|tabindex|aria-modal|role="dialog"/i);
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"[^>]*>Alarm\. If it was a false alarm, press Not a bite\./);
  });

  it('after the mark it says so and offers Undo', () => {
    const html = renderToStaticMarkup(<ToastBody state={marked} />);
    expect(html).toContain('Marked as not a bite. It is not counted.');
    expect(html).toContain('>Undo<');
    expect(html).not.toContain('>Not a bite<');
  });

  it('suggests the calibration only when told to, as a button, never as an order', () => {
    const plain = renderToStaticMarkup(<ToastBody state={marked} />);
    expect(plain).not.toContain('Calibrate');
    const html = renderToStaticMarkup(<ToastBody state={{ armed: true, offer: { eventId: 'a', phase: 'marked', suggestCalibration: true } }} />);
    expect(html).toContain('Want to teach it how you rest your chin? It takes a minute.');
    expect(html).toContain('>Calibrate<');
  });

  it('renders nothing visible when armed with no offer (only the quiet live region)', () => {
    const html = renderToStaticMarkup(<ToastBody state={{ armed: true, offer: null }} />);
    expect(html).toBe('<p role="status" aria-live="polite" class="sr-only"></p>');
  });

  it('every control is a button of at least 44 px, and there is no picture', () => {
    const html = renderToStaticMarkup(<ToastBody state={offered} />);
    expect(html).not.toMatch(/<img|<svg|<canvas|<video/);
    for (const button of html.match(/<button[^>]*>/g) ?? []) expect(button, button).toMatch(/min-h-11|h-11/);
  });

  it('in the minimized window it is one small text button, then Undo', () => {
    expect(renderToStaticMarkup(<PipButton state={offered} />)).toMatch(/>Not a bite<\/button>/);
    expect(renderToStaticMarkup(<PipButton state={marked} />)).toMatch(/>Undo<\/button>/);
    expect(renderToStaticMarkup(<PipButton state={{ armed: true, offer: null }} />)).toBe('');
  });
});

describe('Settings > Detection', () => {
  it('shows the hand filter with both hands chosen, the chin-rest rule on, and says nothing is learned yet', () => {
    const html = renderToStaticMarkup(<DetectionSettings />);
    expect(html).toContain('Which hand');
    expect(html).toMatch(/aria-checked="true"[^>]*>Both</);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
    expect(html).toContain('Nothing yet.');
    expect(html).toContain('Optional, about a minute');
    expect(html).not.toContain('Delete calibration');
  });

  it('reflects the stored hand and rule', () => {
    writeSettings({ handFilter: 'right', chinRest: false });
    const html = renderToStaticMarkup(<DetectionSettings />);
    expect(html).toMatch(/aria-checked="true"[^>]*>Right</);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
  });

  it('shows what it has learned and a calibration, with one click to delete it', () => {
    kv.set('falsePositive', 'learned', [{ at: NOW - 1000, v: [2, 0.24, 0.05, 6, 0.65, 0.3], eventId: 'a' }, { at: NOW - 2000, v: [2, 0.24, 0.05, 6, 0.65, 0.3], eventId: 'b' }]);
    writeCalibration({ at: NOW - 86_400_000, chinRegionFw: 0.3, tipGuardFw: 0.12, rest: [], real: [], restFrames: 30, realFrames: 30 });
    const html = renderToStaticMarkup(<DetectionSettings />);
    expect(html).toContain('2 poses remembered.');
    expect(html).toContain('Calibrated on');
    expect(html).toContain('Delete calibration');
    expect(html).toContain('Calibrate again');
    clearCalibration();
    resetEverything();
  });

  it('is plain: no picture, and it says what is kept and that it stays on the device', () => {
    const html = renderToStaticMarkup(<DetectionSettings />);
    expect(html).not.toMatch(/<img|<canvas|<video/);
    expect(html).toContain('No picture, no video.');
    expect(html).toContain('are not synced and are not uploaded');
    expect(html).not.toMatch(/100% private|nothing leaves your device|no cloud|zero network/i);
  });

  it('shows the false-alarm rate once the flag is on and there are alarms', () => {
    flagsOn('false_positive_controls');
    fixed.state.incidents = [
      rec('a', NOW - 3_600_000, 'auto-detected', true, { falsePositive: true }),
      rec('b', NOW - 7_200_000, 'auto-detected', true),
      rec('c', NOW - 10_800_000, 'auto-detected', true, { falsePositive: true }),
    ];
    expect(renderToStaticMarkup(<DetectionSettings />)).toContain('2 of 3 alarms in the last 7 days marked not a bite (67%).');
  });
});

describe('History', () => {
  const alarms = [
    rec('pending', at(23, 9, 0), 'auto-detected', true),
    rec('confirmed', at(23, 9, 30), 'stress', true, { confirmed: true }),
    rec('manual', at(23, 10, 0), 'boredom', false),
    rec('fp', at(22, 11, 0), 'auto-detected', true, { falsePositive: true }),
  ];
  const render = (incidents: Incident[]) => { fixed.state.incidents = incidents; return renderToStaticMarkup(<Log />); };

  it('with the flag off there is no Not a bite button, and no false-alarm line', () => {
    const html = render(alarms.filter(a => a.id !== 'fp'));
    expect(html).not.toContain('as not a bite');
    expect(html).not.toContain('marked not a bite');
  });

  it('with the flag on, each alarm gets a Not a bite button; a manual log does not', () => {
    flagsOn('false_positive_controls');
    const html = render(alarms.filter(a => a.id !== 'fp'));
    expect(html.match(/Mark the alarm at [^"]* as not a bite/g)).toHaveLength(2); // the pending and the confirmed alarm
  });

  it('a marked alarm shows a quiet "Not a bite" label and an Undo, with the flag on OR off', () => {
    for (const flags of [[], ['false_positive_controls']]) {
      flagsOn(...flags);
      const html = render(alarms);
      expect(html, flags.join()).toContain('>Not a bite</span>');
      expect(html, flags.join()).toMatch(/Undo: count the alarm at [^"]*again/);
    }
  });

  it('the entries line counts what counts, and says how many are marked', () => {
    flagsOn('false_positive_controls');
    expect(render(alarms)).toContain('3 entries, 1 marked not a bite');
    expect(render(alarms.filter(a => a.id !== 'fp'))).toContain('3 entries');
  });

  it('without any marked alarm the History markup is the same with the flag on as with it off, apart from the Not a bite buttons and the rate line', () => {
    const clean = alarms.filter(a => a.id !== 'fp');
    flagsOn();
    const off = render(clean);
    flagsOn('false_positive_controls');
    const on = render(clean);
    const strip = (html: string) => html
      .replace(/<button[^>]*as not a bite[^>]*>[\s\S]*?<\/button>/g, '')
      .replace(/<p class="mt-4 border-t[^>]*>[^<]*alarms? in the last 7 days[^<]*<\/p>/g, '');
    expect(strip(on)).toBe(off);
  });
});

describe('the false-alarm rate in words', () => {
  const entry = (daysAgo: number, falsePositive = false) => ({ timestamp: NOW - daysAgo * 86_400_000, autoDetected: true, falsePositive });

  it('says nothing without alarms this week', () => {
    expect(describeFalsePositiveRate(falsePositiveRates([], NOW))).toBeNull();
    expect(describeFalsePositiveRate(falsePositiveRates([entry(10, true)], NOW))).toBeNull();
  });

  it('counts only alarms, in two rolling weeks, and not a manual log', () => {
    const rates = falsePositiveRates([entry(1, true), entry(2), entry(6.9), entry(8, true), entry(9), entry(20, true), { timestamp: NOW - 1000, autoDetected: false, falsePositive: false }], NOW);
    expect(rates.thisWeek).toEqual({ alarms: 3, falsePositives: 1 });
    expect(rates.lastWeek).toEqual({ alarms: 2, falsePositives: 1 });
  });

  it('compares with the week before only when both weeks have enough alarms', () => {
    const small = falsePositiveRates([entry(1, true), entry(2), entry(8, true), entry(9)], NOW);
    expect(describeFalsePositiveRate(small)).toBe('1 of 2 alarms in the last 7 days marked not a bite (50%).');
    const better = falsePositiveRates([entry(1, true), entry(2), entry(3), entry(4), entry(8, true), entry(9, true), entry(10), entry(11)], NOW);
    expect(describeFalsePositiveRate(better)).toBe('1 of 4 alarms in the last 7 days marked not a bite (25%), down from 2 of 4 (50%) the 7 days before.');
    const worse = falsePositiveRates([entry(1, true), entry(2, true), entry(3), entry(8, true), entry(9), entry(10), entry(11), entry(12)], NOW);
    expect(describeFalsePositiveRate(worse)).toMatch(/up from/);
    const same = falsePositiveRates([entry(1, true), entry(2), entry(3), entry(8, true), entry(9), entry(10)], NOW);
    expect(describeFalsePositiveRate(same)).toMatch(/about the same as/);
  });
});
