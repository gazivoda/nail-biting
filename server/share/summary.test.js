// The share summary is the only thing a link can reveal, so these tests are the privacy
// contract: exact key sets, definitions (what counts as a bite, an urge, an alarm), time
// zones, and a property test that no field of an event can reach the output.

import { describe, expect, it } from 'vitest';
import { coachingStats } from '../../src/utils/coachingStats.ts';
import {
  DAILY_DAYS, TRIGGER_KEYS, WEEKLY_WEEKS, WINDOW_DAYS, analyse, buildShareView, normalizeTimezone,
} from './summary.js';

const DAY = 86400000;
const HOUR = 3600000;
const NOW = Date.UTC(2026, 9, 21, 12, 0, 0); // Wed 21 Oct 2026, 12:00 UTC

const manual = (id, ts, extra = {}) => ({ id, ts, source: 'manual', behavior: 'nail_biting', updatedAt: ts, ...extra });
const alarm = (id, ts, extra = {}) => ({ id, ts, source: 'alarm', behavior: 'nail_biting', updatedAt: ts, ...extra });
const view = (events, opts = {}) => buildShareView(events, { now: NOW, timezone: 'UTC', ...opts });

// ── The exact shape ──────────────────────────────────────────────────────────

const BASE_KEYS = [
  'version', 'detailed', 'hasData', 'window', 'streak', 'totals', 'daily', 'weekly', 'triggers', 'competingResponse',
];

/** Every key path in an object, arrays collapsed to `[]`, sorted. Independent of the implementation. */
function keyPaths(value, prefix = '') {
  if (Array.isArray(value)) {
    const inner = value.flatMap(v => (v !== null && typeof v === 'object' ? keyPaths(v, `${prefix}[]`) : []));
    return [prefix + '[]', ...inner];
  }
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).flatMap(k => [`${prefix}.${k}`, ...keyPaths(value[k], `${prefix}.${k}`)]);
  }
  return [];
}
const shapeOf = v => [...new Set(keyPaths(v))].sort();

const SHAPE_NOT_DETAILED = [
  '.competingResponse', '.competingResponse.alarms', '.competingResponse.completed', '.competingResponse.ratePercent',
  '.daily', '.daily[]', '.detailed', '.hasData', '.streak', '.streak.days', '.streak.since',
  '.totals', '.totals.last12Weeks', '.totals.last7Days', '.totals.previous7Days',
  '.triggers', '.triggers[]', '.triggers[].count', '.triggers[].key',
  '.version', '.weekly', '.weekly[]', '.window', '.window.dailyDays', '.window.weeklyWeeks',
].sort();

const SHAPE_DETAILED = [
  ...SHAPE_NOT_DETAILED, '.detail', '.detail.byHour', '.detail.byHour[]', '.detail.lastBiteDate', '.detail.today',
].sort();

// Several states share one shape, except `streak` which is null when there is no history.
const sample = [
  manual('m1', NOW - 2 * HOUR, { triggers: ['stress'] }),
  alarm('a1', NOW - DAY, { confirmed: true, competingResponse: { done: true, durationSec: 20 } }),
];

describe('the public shape', () => {
  it('has exactly these keys when detailed is off', () => {
    expect(Object.keys(view(sample)).sort()).toEqual([...BASE_KEYS].sort());
    expect(shapeOf(view(sample))).toEqual(SHAPE_NOT_DETAILED);
  });

  it('has exactly these keys when detailed is on (base plus detail)', () => {
    const v = view(sample, { detailed: true });
    expect(Object.keys(v).sort()).toEqual([...BASE_KEYS, 'detail'].sort());
    expect(Object.keys(v.detail).sort()).toEqual(['byHour', 'lastBiteDate', 'today']);
    expect(shapeOf(v)).toEqual(SHAPE_DETAILED);
  });

  it('keeps the same keys with no history at all (arrays zero, streak null)', () => {
    const v = view([]);
    expect(Object.keys(v).sort()).toEqual([...BASE_KEYS].sort());
    expect(v.hasData).toBe(false);
    expect(v.streak).toBeNull();
    expect(v.daily).toEqual(Array(DAILY_DAYS).fill(0));
    expect(v.weekly).toEqual(Array(WEEKLY_WEEKS).fill(0));
    expect(v.competingResponse).toEqual({ alarms: 0, completed: 0, ratePercent: null });
    const d = view([], { detailed: true });
    expect(d.detail.lastBiteDate).toBeNull();
    expect(d.detail.byHour).toEqual(Array(24).fill(0));
  });

  it('only treats the literal true as detailed', () => {
    for (const x of ['true', 1, {}, [], 'yes']) expect(view(sample, { detailed: x }).detail).toBeUndefined();
    expect(view(sample, { detailed: true }).detail).toBeDefined();
  });

  it('does not contain dates or hours unless detailed', () => {
    const text = JSON.stringify(view(sample));
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toContain('byHour');
    expect(JSON.stringify(view(sample, { detailed: true }))).toMatch(/2026-10-21/);
  });
});

// ── Definitions ──────────────────────────────────────────────────────────────

describe('what counts as a bite', () => {
  const count = events => view(events).totals.last12Weeks;

  it('counts a manual entry', () => expect(count([manual('1', NOW - HOUR)])).toBe(1));
  it('counts a confirmed alarm', () => expect(count([alarm('1', NOW - HOUR, { confirmed: true })])).toBe(1));
  it('does not count an alarm nobody confirmed (awaiting review)', () => {
    expect(count([alarm('1', NOW - HOUR)])).toBe(0);
    expect(count([alarm('1', NOW - HOUR, { confirmed: false })])).toBe(0);
  });
  it('does not count an urge (a manual entry whose first trigger is urge)', () => {
    expect(count([manual('1', NOW - HOUR, { triggers: ['urge'] })])).toBe(0);
  });
  it('counts a confirmed alarm even if urge is its tag: only manual entries are urges (app rule)', () => {
    expect(count([alarm('1', NOW - HOUR, { confirmed: true, triggers: ['urge'] })])).toBe(1);
  });
  it('counts a manual entry that merely has urge as a LATER trigger', () => {
    expect(count([manual('1', NOW - HOUR, { triggers: ['stress', 'urge'] })])).toBe(1);
  });
  it('does not count a false positive, even a confirmed one', () => {
    expect(count([manual('1', NOW - HOUR, { falsePositive: true }), alarm('2', NOW - HOUR, { confirmed: true, falsePositive: true })])).toBe(0);
  });
  it('does not count a deleted entry', () => {
    expect(count([manual('1', NOW - HOUR, { deleted: true })])).toBe(0);
  });
  it('counts every behavior together (the scope is counts, not behaviors)', () => {
    expect(count([manual('1', NOW - HOUR, { behavior: 'nose_picking' }), manual('2', NOW - HOUR, { behavior: 'hair_pulling' })])).toBe(2);
  });
});

describe('the streak', () => {
  it('is whole days since the newest bite', () => {
    const v = view([manual('1', NOW - 10 * DAY), manual('2', NOW - 3 * DAY - 5 * HOUR)]);
    expect(v.streak).toEqual({ days: 3, since: 'last_bite' });
  });

  it('is 0 under 24 hours and is not negative for an entry dated in the future', () => {
    expect(view([manual('1', NOW - 23 * HOUR)]).streak.days).toBe(0);
    expect(view([manual('1', NOW + 5 * DAY)]).streak).toEqual({ days: 0, since: 'last_bite' });
  });

  it('ignores urges, unconfirmed alarms, false positives and deleted entries', () => {
    const v = view([
      manual('bite', NOW - 9 * DAY),
      manual('u', NOW - HOUR, { triggers: ['urge'] }),
      alarm('a', NOW - HOUR),
      manual('fp', NOW - HOUR, { falsePositive: true }),
      manual('del', NOW - HOUR, { deleted: true }),
    ]);
    expect(v.streak).toEqual({ days: 9, since: 'last_bite' });
  });

  it('with no bite at all runs from the first synced entry of any kind', () => {
    const v = view([alarm('a', NOW - 6 * DAY - HOUR), manual('u', NOW - 2 * DAY, { triggers: ['urge'] })]);
    expect(v.streak).toEqual({ days: 6, since: 'first_entry' });
    expect(v.hasData).toBe(true);
  });

  it('is null (and hasData false) when every entry is deleted', () => {
    const v = view([manual('1', NOW - DAY, { deleted: true })]);
    expect(v.streak).toBeNull();
    expect(v.hasData).toBe(false);
  });

  it('uses bites older than the chart window', () => {
    expect(view([manual('1', NOW - 400 * DAY)]).streak).toEqual({ days: 400, since: 'last_bite' });
  });
});

describe('buckets', () => {
  const atAgo = (days, hours = 0) => NOW - days * DAY - hours * HOUR;

  it('puts today in the last daily slot and the last weekly slot', () => {
    const v = view([manual('1', NOW - HOUR)]);
    expect(v.daily[DAILY_DAYS - 1]).toBe(1);
    expect(v.weekly[WEEKLY_WEEKS - 1]).toBe(1);
  });

  it('places the edges of the daily and weekly windows exactly', () => {
    const v = view([
      manual('d27', atAgo(27)),   // oldest daily slot
      manual('d28', atAgo(28)),   // just outside daily, inside week block 4
      manual('d6', atAgo(6)),     // last block still
      manual('d7', atAgo(7)),     // the block before
      manual('d83', atAgo(83)),   // oldest weekly slot
      manual('d84', atAgo(84)),   // outside everything
    ]);
    expect(v.daily[0]).toBe(1);
    expect(v.daily.reduce((a, b) => a + b, 0)).toBe(3); // d27, d6, d7 are inside 28 days
    expect(v.weekly[WEEKLY_WEEKS - 1]).toBe(1); // d6
    expect(v.weekly[WEEKLY_WEEKS - 2]).toBe(1); // d7
    expect(v.weekly[0]).toBe(1);                // d83
    expect(v.totals.last12Weeks).toBe(5);       // d84 is out
    expect(WINDOW_DAYS).toBe(84);
  });

  it('keeps the totals consistent with the series', () => {
    const events = Array.from({ length: 40 }, (_, i) => manual(`m${i}`, NOW - i * 17 * HOUR));
    const v = view(events);
    expect(v.totals.last7Days).toBe(v.daily.slice(-7).reduce((a, b) => a + b, 0));
    expect(v.totals.previous7Days).toBe(v.daily.slice(-14, -7).reduce((a, b) => a + b, 0));
    expect(v.totals.last12Weeks).toBe(v.weekly.reduce((a, b) => a + b, 0));
    expect(v.triggers.reduce((s, t) => s + t.count, 0)).toBe(v.totals.last12Weeks);
  });

  it('does not put entries from the future into any bucket', () => {
    const v = view([manual('1', NOW + 3 * DAY)]);
    expect(v.totals.last12Weeks).toBe(0);
  });

  it('counts days and hours in the OWNER time zone', () => {
    // 05:00 UTC on 21 Oct. In Auckland (UTC+13 then) that is 18:00 on 21 Oct, and "now" is 01:00 on 22 Oct.
    const early = manual('1', Date.UTC(2026, 9, 21, 5, 0, 0));
    const utc = view([early], { detailed: true });
    const nz = view([early], { detailed: true, timezone: 'Pacific/Auckland' });
    expect(utc.daily[DAILY_DAYS - 1]).toBe(1);
    expect(utc.detail.byHour[5]).toBe(1);
    expect(nz.daily[DAILY_DAYS - 2]).toBe(1);   // yesterday there
    expect(nz.detail.byHour[18]).toBe(1);
    expect(nz.detail.today).toBe('2026-10-22');
    expect(utc.detail.today).toBe('2026-10-21');
  });

  it('survives a daylight-saving change (a clock-change night is still one day)', () => {
    // US clocks went back on 1 Nov 2026. Entries at 23:30 local on 31 Oct and 00:30 on 1 Nov are different days.
    const tz = 'America/New_York';
    const now = Date.UTC(2026, 10, 2, 17, 0, 0);
    const a = manual('a', Date.UTC(2026, 10, 1, 3, 30, 0)); // 23:30 EDT, 31 Oct
    const b = manual('b', Date.UTC(2026, 10, 1, 4, 30, 0)); // 00:30 EDT, 1 Nov
    const v = buildShareView([a, b], { now, timezone: tz, detailed: true });
    expect(v.detail.today).toBe('2026-11-02');
    expect(v.daily[DAILY_DAYS - 2]).toBe(1); // 1 Nov
    expect(v.daily[DAILY_DAYS - 3]).toBe(1); // 31 Oct
  });

  it('falls back to UTC for a zone it does not know, and never throws', () => {
    for (const tz of ['Mars/Olympus', '', 5, null, undefined, 'x'.repeat(500), '<script>']) {
      expect(() => view(sample, { timezone: tz })).not.toThrow();
    }
    expect(normalizeTimezone('Mars/Olympus')).toBe('UTC');
    expect(normalizeTimezone('Europe/Belgrade')).toBe('Europe/Belgrade');
  });
});

describe('the trigger breakdown only ever uses the fixed keys', () => {
  const triggers = events => Object.fromEntries(view(events).triggers.map(t => [t.key, t.count]));

  it('lists the five fixed keys, in order, always', () => {
    expect(view([]).triggers.map(t => t.key)).toEqual(['stress', 'focus', 'boredom', 'unknown', 'other']);
    expect(TRIGGER_KEYS).toEqual(['stress', 'focus', 'boredom', 'unknown', 'other']);
  });

  it('groups by the first trigger and folds everything that is not a preset into other', () => {
    expect(triggers([
      manual('1', NOW - HOUR, { triggers: ['stress'] }),
      manual('2', NOW - HOUR, { triggers: ['focus'] }),
      manual('3', NOW - HOUR, { triggers: ['boredom'] }),
      manual('4', NOW - HOUR, { triggers: ['unknown'] }),
      manual('5', NOW - HOUR, {}),                                   // no trigger: not sure
      alarm('6', NOW - HOUR, { confirmed: true, triggers: ['auto-detected'] }), // unlabelled alarm: not sure
      manual('7', NOW - HOUR, { triggers: ['custom-3fa9c1d2'] }),    // a reason the person made up
      manual('8', NOW - HOUR, { triggers: ['my boss LEAK'] }),       // free text can never be echoed
      manual('9', NOW - HOUR, { triggers: ['__proto__'] }),
      manual('10', NOW - HOUR, { triggers: [''] }),
    ])).toEqual({ stress: 1, focus: 1, boredom: 1, unknown: 3, other: 4 });
  });

  it('counts only the first trigger of an entry', () => {
    expect(triggers([manual('1', NOW - HOUR, { triggers: ['stress', 'boredom', 'focus'] })])).toEqual({ stress: 1, focus: 0, boredom: 0, unknown: 0, other: 0 });
  });
});

describe('the competing-response rate (WS2 semantics)', () => {
  it('window opens at the first alarm that carried a prompt; the rate is completed over all alarms since', () => {
    const v = view([
      alarm('old', NOW - 20 * DAY),                                           // before the feature was used: not counted
      alarm('p1', NOW - 10 * DAY, { competingResponse: { done: true, durationSec: 30 } }),
      alarm('p2', NOW - 9 * DAY, { competingResponse: { done: false, durationSec: 4 } }),
      alarm('np', NOW - 8 * DAY),                                             // not prompted (e.g. once an hour): still counts
      alarm('p3', NOW - 7 * DAY, { competingResponse: { done: true, durationSec: 30 } }),
    ]);
    expect(v.competingResponse).toEqual({ alarms: 4, completed: 2, ratePercent: 50 });
  });

  it('is null, not 0, when no alarm ever carried a prompt', () => {
    expect(view([alarm('a', NOW - DAY), alarm('b', NOW - 2 * DAY)]).competingResponse).toEqual({ alarms: 0, completed: 0, ratePercent: null });
  });

  it('leaves out false positives, deleted alarms and manual entries (including urges)', () => {
    const v = view([
      alarm('p', NOW - DAY, { competingResponse: { done: true } }),
      alarm('fp', NOW - DAY, { falsePositive: true, competingResponse: { done: true } }),
      alarm('del', NOW - DAY, { deleted: true, competingResponse: { done: true } }),
      manual('u', NOW - DAY, { triggers: ['urge'], competingResponse: { done: true } }),
    ]);
    expect(v.competingResponse).toEqual({ alarms: 1, completed: 1, ratePercent: 100 });
  });

  it('agrees with coachingStats (src/utils/coachingStats.ts) on random events', () => {
    const rand = mulberry32(7);
    for (let round = 0; round < 200; round++) {
      const events = [];
      const n = Math.floor(rand() * 40);
      for (let i = 0; i < n; i++) {
        const prompted = rand() < 0.5;
        const e = {
          id: `x${i}`,
          ts: NOW - Math.floor(rand() * 83 * DAY) - 1000, // inside the 84-day window
          source: rand() < 0.7 ? 'alarm' : 'manual',
          behavior: 'nail_biting',
          updatedAt: 1,
        };
        if (prompted) e.competingResponse = { done: rand() < 0.5, durationSec: 10 };
        if (rand() < 0.15) e.falsePositive = true;
        if (rand() < 0.1) e.deleted = true;
        events.push(e);
      }
      const ts = coachingStats(events);
      const mine = view(events).competingResponse;
      expect({ alarms: mine.alarms, completed: mine.completed }, `round ${round}`).toEqual({ alarms: ts.alarms, completed: ts.completed });
      expect(mine.ratePercent).toBe(ts.rate === null ? null : Math.round(ts.rate * 100));
    }
  });
});

// ── Nothing leaks ────────────────────────────────────────────────────────────

describe('no field of an event reaches the output', () => {
  const secrets = {
    id: 'LEAK-ID-1234', deviceId: 'LEAK-DEVICE-9', hand: 'LEAK-HAND', behavior: 'LEAK-BEHAVIOR',
    triggers: ['LEAK-TRIGGER-A', 'LEAK-TRIGGER-B'],
    note: 'LEAK-NOTE I was angry at my boss', notes: ['LEAK-NOTES'], tag: 'LEAK-TAG', customTag: 'LEAK-CUSTOM',
    email: 'leak@example.com', name: 'LEAK Person', userId: 'LEAK-USER', user_id: 'LEAK-USER2',
    photo: 'data:image/png;base64,LEAKPHOTO', landmarks: [[0.1, 0.2]], frame: 'LEAKFRAME',
    competingResponse: { done: true, durationSec: 20, label: 'LEAK-CR-LABEL' },
  };

  it('does not echo any string from an entry that carries every field plus unknown extras', () => {
    const events = [
      { ...secrets, ts: NOW - HOUR, source: 'manual', updatedAt: NOW, confirmed: true },
      { ...secrets, id: 'LEAK-ID-2', ts: NOW - 2 * DAY, source: 'alarm', confirmed: true, updatedAt: NOW },
    ];
    for (const detailed of [false, true]) {
      const text = JSON.stringify(buildShareView(events, { detailed, now: NOW, timezone: 'UTC' }));
      expect(text).not.toMatch(/LEAK|leak@|@example|data:image|base64|photo|landmark|frame|note|boss/i);
    }
  });

  it('gives the same output however the free-text fields are spelled (they are never read into the result)', () => {
    const a = [{ ...secrets, ts: NOW - HOUR, source: 'manual', updatedAt: 1 }];
    const b = [{
      ...secrets, id: 'other', deviceId: 'other', hand: 'other', behavior: 'other', note: 'other', notes: [], tag: 'x',
      customTag: 'y', email: 'q', name: 'q', photo: 'q', ts: NOW - HOUR, source: 'manual', updatedAt: 999,
      triggers: ['different custom reason'],
    }];
    for (const detailed of [false, true]) {
      expect(buildShareView(a, { detailed, now: NOW })).toEqual(buildShareView(b, { detailed, now: NOW }));
    }
  });

  it('never mutates its input', () => {
    const events = deepFreeze(sample.map(e => ({ ...e, triggers: e.triggers ? [...e.triggers] : undefined })));
    expect(() => view(events, { detailed: true })).not.toThrow();
  });

  it('property: random hostile events never leak and always produce the exact shape', () => {
    const rand = mulberry32(2026);
    const STRINGS = ['stress', 'focus', 'boredom', 'unknown', 'urge', 'auto-detected', '__proto__', 'constructor', 'toString', 'hasOwnProperty', ''];
    const pick = arr => arr[Math.floor(rand() * arr.length)];
    const leak = kind => `LEAK_${kind}_${Math.floor(rand() * 1e9).toString(36)}`;
    const maybe = (p, f) => (rand() < p ? f() : undefined);
    const oneOf = (...fs) => pick(fs)();

    const randomEvent = () => {
      const e = {
        id: leak('id'),
        ts: oneOf(
          () => NOW - Math.floor(rand() * 130 * DAY) + Math.floor(rand() * 3 * DAY),
          () => NOW - Math.floor(rand() * 130 * DAY),
          () => pick([NaN, Infinity, -1, 0, 8.64e15, 1.5, '12', null, undefined, {}, []]),
        ),
        source: pick(['alarm', 'manual', 'manual', 'alarm', 'weird', undefined, 5, null]),
        behavior: leak('behavior'),
        updatedAt: Math.floor(rand() * NOW),
      };
      const optional = {
        hand: () => pick(['left', 'right', leak('hand')]),
        triggers: () => oneOf(
          () => [pick(STRINGS)],
          () => [leak('trigger'), pick(STRINGS)],
          () => [pick(STRINGS), leak('trigger')],
          () => pick(['not-an-array', null, 5, [], [5], [null], [{ x: leak('obj') }]]),
        ),
        falsePositive: () => pick([true, false, 'true', 1, null]),
        confirmed: () => pick([true, false, 'true', 1, null]),
        deleted: () => pick([true, false, 'true', 1]),
        deviceId: () => leak('device'),
        competingResponse: () => oneOf(
          () => ({ done: rand() < 0.5, durationSec: Math.floor(rand() * 60) }),
          () => ({ done: pick([true, false, 'true', 1]), [leak('key')]: leak('val') }),
          () => pick([null, 'x', 5, [], { done: leak('done') }]),
        ),
        // not part of the event type at all
        note: () => leak('note'),
        email: () => `${leak('email')}@example.com`,
        name: () => leak('name'),
        photo: () => `data:image/png;base64,${leak('photo')}`,
        landmarks: () => [[rand(), rand()], leak('lm')],
        [leak('unknownKey')]: () => leak('unknownVal'),
      };
      for (const [k, f] of Object.entries(optional)) {
        const v = maybe(0.45, f);
        if (v !== undefined) e[k] = v;
      }
      return e;
    };

    for (let round = 0; round < 400; round++) {
      const events = Array.from({ length: Math.floor(rand() * 60) }, randomEvent);
      // a few entries that are not objects at all
      if (rand() < 0.3) events.push(null, 5, 'LEAK_string_entry', [], undefined);
      for (const detailed of [false, true]) {
        const timezone = pick(['UTC', 'Europe/Belgrade', 'Pacific/Auckland', 'America/Los_Angeles', 'bogus']);
        const out = buildShareView(events, { detailed, timezone, now: NOW });
        const text = JSON.stringify(out);

        expect(text, `round ${round}`).not.toMatch(/LEAK|example\.com|data:image|base64/);
        const expected = (detailed ? SHAPE_DETAILED : SHAPE_NOT_DETAILED)
          .filter(path => out.streak !== null || !path.startsWith('.streak.')); // no history: streak is null
        expect(shapeOf(out), `round ${round}`).toEqual(expected);
        assertLeaves(out, detailed);
      }
    }
  });
});

/** Every leaf of the output is a number, boolean, null, or one of a few fixed strings. */
function assertLeaves(out, detailed) {
  const walk = (v, path) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (v !== null && typeof v === 'object') return Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
    if (typeof v === 'number') {
      expect(Number.isSafeInteger(v) && v >= 0, `${path}=${v}`).toBe(true);
    } else if (typeof v === 'boolean' || v === null) {
      // fine
    } else if (typeof v === 'string') {
      if (path === '.streak.since') expect(['last_bite', 'first_entry']).toContain(v);
      else if (/^\.triggers\[\d\]\.key$/.test(path)) expect(TRIGGER_KEYS).toContain(v);
      else if (path === '.detail.today' || path === '.detail.lastBiteDate') expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else throw new Error(`unexpected string at ${path}: ${v}`);
    } else {
      throw new Error(`unexpected ${typeof v} at ${path}`);
    }
  };
  walk(out, '');
  expect(out.daily).toHaveLength(DAILY_DAYS);
  expect(out.weekly).toHaveLength(WEEKLY_WEEKS);
  expect(out.triggers).toHaveLength(TRIGGER_KEYS.length);
  expect(out.detail !== undefined).toBe(detailed);
  if (detailed) expect(out.detail.byHour).toHaveLength(24);
  expect(out.totals.last12Weeks).toBe(out.weekly.reduce((a, b) => a + b, 0));
  expect(out.triggers.reduce((s, t) => s + t.count, 0)).toBe(out.totals.last12Weeks);
  if (detailed) expect(out.detail.byHour.reduce((a, b) => a + b, 0)).toBe(out.totals.last12Weeks);
}

// ── Cost ─────────────────────────────────────────────────────────────────────

describe('cost', () => {
  it('summarises 50,000 events (the per-account cap) quickly', () => {
    const rand = mulberry32(1);
    const events = Array.from({ length: 50000 }, (_, i) => manual(`m${i}`, NOW - Math.floor(rand() * 400 * DAY), { triggers: ['stress'] }));
    const t0 = performance.now();
    view(events, { detailed: true, timezone: 'Europe/Belgrade' });
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(2000);
  });

  it('analyse returns numbers and fixed-size arrays only', () => {
    const a = analyse(sample, { now: NOW, timezone: 'UTC' });
    expect(Object.keys(a).sort()).toEqual([
      'alarms', 'byHour', 'daily', 'firstEntryTs', 'lastBiteDayNum', 'lastBiteTs', 'live', 'response', 'streak', 'todayNum', 'triggers', 'weekly',
    ]);
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deepFreeze(o) {
  if (o !== null && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}
