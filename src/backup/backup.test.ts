import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { events, type HabitEventWire } from '../storage';
import { MAX_INCIDENTS, useAppStore } from '../store/useAppStore';
import { eventsToCsv, csvCell, CSV_COLUMNS } from './csv';
import { MAX_IMPORT_BYTES, applyImport, isNoop, planImport, type ImportPlan } from './importPlan';
import { resetStorage, useMemoryStorage } from '../../test-utils/memoryStorage';

// The store is one global instance in this file; every test starts from an empty history.
function wipe() {
  useAppStore.getState().clearAllData();
}

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 5, 1, 9, 0, 0);

/** A history that uses every feature of the record: every field, every kind of event, deletions. */
function seedRichHistory() {
  const s = useAppStore.getState();
  events.add({ id: 'bite-1', source: 'manual', ts: T0, triggers: ['stress'], hand: 'left' });
  events.add({ id: 'bite-2', source: 'manual', ts: T0 + 1 * DAY, triggers: ['boredom', 'focus'], behavior: 'cuticle_skin_biting' });
  events.add({ id: 'alarm-confirmed', source: 'alarm', ts: T0 + 2 * DAY, confirmed: true, triggers: ['focus'], hand: 'right', competingResponse: { done: true, durationSec: 17.5 } });
  events.add({ id: 'alarm-open', source: 'alarm', ts: T0 + 3 * DAY, confirmed: false });
  events.add({ id: 'alarm-unreviewed', source: 'alarm', ts: T0 + 3 * DAY + 60_000 });
  events.add({ id: 'false-alarm', source: 'alarm', ts: T0 + 4 * DAY, falsePositive: true, competingResponse: { done: false } });
  events.add({ id: 'custom-tag', source: 'manual', ts: T0 + 5 * DAY, triggers: ['custom-ab12cd34'] });
  events.add({ id: 'urge', source: 'manual', ts: T0 + 6 * DAY, triggers: ['urge'], competingResponse: { done: true, durationSec: 60 } });
  events.add({ id: 'nose', source: 'alarm', ts: T0 + 7 * DAY, behavior: 'nose_picking', confirmed: true, hand: 'unknown' });
  events.add({ id: 'to-delete', source: 'manual', ts: T0 + 8 * DAY, triggers: ['stress'] });
  events.add({ id: 'to-delete-2', source: 'alarm', ts: T0 + 9 * DAY, confirmed: true });
  events.softDelete('to-delete');
  events.softDelete('to-delete-2');
  s.addCustomTag('Tea break', '🍵');
}

/** Everything about the history that must come back, in one comparable object. */
function state() {
  const s = useAppStore.getState();
  // exportedAt and deviceId legitimately differ between two exports of the same history.
  const rest = { ...events.exportAll(), exportedAt: 0, deviceId: '' };
  return {
    export: rest,
    everything: events.list({ includeDeleted: true, order: 'oldest' }),
    v1: s.incidents.map(i => ({ id: i.id, timestamp: i.timestamp, tag: i.tag, autoDetected: i.autoDetected, confirmed: i.confirmed })),
    streak: {
      lastBiteTime: s.lastBiteTime, bestStreakMs: s.bestStreakMs, firstOpenTime: s.firstOpenTime,
      historyStartTime: s.historyStartTime, bestStreakFloorMs: s.bestStreakFloorMs,
    },
    tombstones: s.tombstones,
  };
}

// Only Date is faked: updatedAt comes from Date.now(), and these tests need "later" to be really later.
const NOW0 = Date.UTC(2026, 9, 1, 12, 0, 0);
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW0); useMemoryStorage(); wipe(); });
afterEach(() => { wipe(); resetStorage(); vi.useRealTimers(); });
const later = (ms = 60_000) => vi.setSystemTime(Date.now() + ms);

describe('export, wipe, import: the history comes back exactly', () => {
  it('every field of every event, the deletions, and the streaks', () => {
    seedRichHistory();
    const before = state();
    expect(before.everything.length).toBe(11); // 9 live + 2 deleted
    expect(before.streak.lastBiteTime).not.toBeNull();

    const file = JSON.stringify(events.exportAll());

    wipe();
    expect(events.list({ includeDeleted: true })).toEqual([]);
    expect(useAppStore.getState().lastBiteTime).toBeNull();

    const plan = planImport(file, events.list({ includeDeleted: true }));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.restoresWhole).toBe(true);
    const result = applyImport(plan, events);
    expect(result.skipped).toBe(0);

    const after = state();
    expect(after.everything).toEqual(before.everything);   // ids, ts, source, behavior, hand, triggers, falsePositive, competingResponse, confirmed, deviceId, updatedAt, deleted
    expect(after.v1).toEqual(before.v1);                    // what the existing screens read
    expect(after.streak).toEqual(before.streak);            // streak and best streak
    expect(after.tombstones).toEqual(before.tombstones);
    expect(after.export).toEqual(before.export);
  });

  it('through a real file: JSON text out, the same text parsed back in', () => {
    seedRichHistory();
    const before = state();
    const text = JSON.stringify(events.exportAll(), null, 2); // the pretty-printed file the button writes
    wipe();
    const plan = planImport(text, []);
    if (!plan.ok) throw new Error(plan.message);
    applyImport(plan, events);
    expect(state()).toEqual(before);
  });

  it('a history that was pruned (its best streak banked) comes back with the same best streak', () => {
    const s = useAppStore.getState();
    // More than the app keeps: the oldest are pruned and their best streak is banked in bestStreakFloorMs.
    for (let i = 0; i < MAX_INCIDENTS + 40; i++) {
      events.add({ id: `e${i}`, source: 'manual', ts: T0 + i * 3_600_000, triggers: ['stress'] });
    }
    expect(s.incidents.length).toBeLessThanOrEqual(MAX_INCIDENTS);
    const before = state();
    expect(useAppStore.getState().bestStreakFloorMs).toBeGreaterThan(0); // pruning really banked something
    expect(useAppStore.getState().historyStartTime).toBeGreaterThan(T0); // and moved the start of history
    const text = JSON.stringify(events.exportAll());
    wipe();
    const plan = planImport(text, []);
    if (!plan.ok) throw new Error(plan.message);
    applyImport(plan, events);
    const after = state();
    expect(after.everything).toEqual(before.everything);
    expect(after.streak).toEqual(before.streak);
  });

  it('an empty history exports and restores as empty', () => {
    const text = JSON.stringify(events.exportAll());
    const plan = planImport(text, []);
    expect(plan.ok).toBe(false); // nothing to import is said so, not silently "done"
    if (!plan.ok) expect(plan.reason).toBe('nothing_valid');
  });
});

describe('importing into a device that already has history', () => {
  it('adds what is missing, skips what is the same, never overwrites newer local records', () => {
    seedRichHistory();
    const file = JSON.stringify(events.exportAll());

    // Later, on this device: one event edited (newer than the file's copy), one deleted, one new.
    later();
    events.update('bite-1', { triggers: ['edited-after-export'] });
    events.softDelete('bite-2');
    events.add({ id: 'new-after-export', source: 'manual', ts: T0 + 20 * DAY, triggers: ['focus'] });
    const mine = state();

    const plan = planImport(file, events.list({ includeDeleted: true }));
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.restoresWhole).toBe(false);
    expect(plan.added).toBe(0);
    expect(plan.keptNewer).toBe(2);          // bite-1 (edited) and bite-2 (deleted) are newer here
    expect(plan.updated).toBe(0);
    expect(isNoop(plan)).toBe(true);

    applyImport(plan, events);
    const after = state();
    expect(after.everything).toEqual(mine.everything);
    expect(events.get('bite-1')?.triggers).toEqual(['edited-after-export']);
    expect(events.get('bite-2')).toBeUndefined();
  });

  it('restores a deleted-here event only if the file has a newer version of it', () => {
    events.add({ id: 'x', source: 'manual', ts: T0, triggers: ['stress'] });
    const older = JSON.stringify(events.exportAll()); // x is live, updatedAt = now
    later();
    events.softDelete('x');                            // deleted here, later than the file
    const plan = planImport(older, events.list({ includeDeleted: true }));
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.keptNewer).toBe(1);
    applyImport(plan, events);
    expect(events.get('x')).toBeUndefined();
  });

  it('importing the same file twice changes nothing the second time', () => {
    seedRichHistory();
    const file = JSON.stringify(events.exportAll());
    wipe();
    events.add({ id: 'unrelated', source: 'manual', ts: T0 - DAY, triggers: ['focus'] });

    const first = planImport(file, events.list({ includeDeleted: true }));
    if (!first.ok) throw new Error(first.message);
    expect(first.restoresWhole).toBe(false); // there is history here, so merge
    expect(first.added).toBe(9);
    applyImport(first, events);
    const afterFirst = state();

    const second = planImport(file, events.list({ includeDeleted: true }));
    if (!second.ok) throw new Error(second.message);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(11);
    expect(isNoop(second)).toBe(true);
    applyImport(second, events);
    expect(state()).toEqual(afterFirst);
  });

  it('the preview predicts what the merge then reports', () => {
    seedRichHistory();
    const file = JSON.stringify(events.exportAll());
    // Make the file differ from the device in every way.
    later();
    events.update('bite-1', { triggers: ['newer-here'] });
    events.softDelete('bite-2');
    events.add({ id: 'only-here', source: 'manual', ts: T0 + 30 * DAY });
    const file2 = JSON.parse(file) as { events: HabitEventWire[] };
    file2.events.push({ id: 'only-in-file', ts: T0 - 5 * DAY, source: 'manual', behavior: 'nail_biting', updatedAt: T0 - 5 * DAY, triggers: ['boredom'] });
    file2.events.find(e => e.id === 'alarm-open')!.updatedAt += 10 * DAY; // a newer version in the file
    file2.events.find(e => e.id === 'alarm-open')!.confirmed = true;

    const plan = planImport(JSON.stringify(file2), events.list({ includeDeleted: true }));
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.added).toBe(1);
    expect(plan.updated).toBe(1);
    const applied = applyImport(plan, events);
    expect(applied.applied).toBe(plan.toApply.length);
    expect(plan.toApply.length).toBe(plan.added + plan.updated + plan.deletions);
    expect(events.get('only-in-file')?.triggers).toEqual(['boredom']);
    expect(events.get('alarm-open')?.confirmed).toBe(true);
  });

  it('lists what was added so the person can recognise it', () => {
    seedRichHistory();
    const file = JSON.stringify(events.exportAll());
    wipe();
    events.add({ id: 'here', source: 'manual', ts: T0 });
    const plan = planImport(file, events.list({ includeDeleted: true }));
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.sample).toHaveLength(5);
    expect(plan.sample[0].ts).toBeGreaterThan(plan.sample[4].ts); // newest first
    expect(plan.addedRange).toEqual({ from: T0, to: T0 + 7 * DAY });
  });
});

describe('a file that is not a history', () => {
  const local: HabitEventWire[] = [];
  const refusal = (text: string) => {
    const p = planImport(text, local);
    if (p.ok) throw new Error('expected a refusal');
    return p;
  };

  it('is refused whole, with a reason, and changes nothing', () => {
    seedRichHistory();
    const before = state();
    expect(refusal('this is not json').reason).toBe('not_json');
    expect(refusal('{"hello":"world"}').reason).toBe('not_history');
    expect(refusal('"a string"').reason).toBe('not_history');
    expect(refusal('42').reason).toBe('not_history');
    expect(refusal('null').reason).toBe('not_history');
    expect(refusal('[]').reason).toBe('nothing_valid');
    expect(refusal('[1,2,3]').reason).toBe('nothing_valid');
    expect(refusal(JSON.stringify({ format: 'something-else', events: [] })).reason).toBe('not_history');
    expect(state()).toEqual(before);
  });

  it('refuses a file over the size limit before parsing it', () => {
    const huge = '['.padEnd(MAX_IMPORT_BYTES + 10, ' ');
    expect(refusal(huge).reason).toBe('too_big');
  });

  it('skips single bad entries, counts them, and imports the rest', () => {
    const good = { id: 'ok', ts: T0, source: 'manual', behavior: 'nail_biting', updatedAt: T0, triggers: ['stress'] };
    const text = JSON.stringify([
      good,
      { ...good, id: '', ts: T0 },
      { ...good, id: 'bad-source', source: 'robot' },
      { ...good, id: 'bad-behavior', behavior: 'teeth' },
      { ...good, id: 'bad-ts', ts: 'yesterday' },
      'not an object',
      null,
      { ...good, id: 'ok2' },
    ]);
    const plan = planImport(text, local);
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.total).toBe(8);
    expect(plan.invalid).toBe(6);
    expect(plan.added).toBe(2);
    applyImport(plan, events);
    expect(events.list().map(e => e.id).sort()).toEqual(['ok', 'ok2']);
  });

  it('counts an event listed twice once, keeping the newer listing', () => {
    const a = { id: 'dup', ts: T0, source: 'manual', behavior: 'nail_biting', updatedAt: T0 + 5, triggers: ['new'] };
    const b = { ...a, updatedAt: T0 + 1, triggers: ['old'] };
    const plan = planImport(JSON.stringify([b, a]), local);
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.duplicatesInFile).toBe(1);
    expect(plan.added).toBe(1);
    applyImport(plan, events);
    expect(events.get('dup')?.triggers).toEqual(['new']);
  });

  it('keeps the data in a field it does not know out of the app (unknown keys are dropped)', () => {
    const text = JSON.stringify([{ id: 'x', ts: T0, source: 'manual', behavior: 'nail_biting', updatedAt: T0, landmarks: [[1, 2]], frame: 'data:image/png;base64,AAAA', triggers: ['stress'] }]);
    const plan = planImport(text, local);
    if (!plan.ok) throw new Error(plan.message);
    applyImport(plan, events);
    const rec = JSON.stringify(useAppStore.getState().incidents);
    expect(rec).not.toMatch(/landmarks|data:image/);
  });

  it('flags a result that would pass the 5,000 event limit', () => {
    const many = Array.from({ length: MAX_INCIDENTS + 5 }, (_, i) => ({ id: `m${i}`, ts: T0 + i, source: 'manual', behavior: 'nail_biting', updatedAt: T0 + i }));
    const plan = planImport(JSON.stringify(many), local) as ImportPlan;
    expect(plan.ok).toBe(true);
    expect(plan.exceedsLimit).toBe(true);
  });
});

describe('CSV', () => {
  it('has a header, one row per live event, oldest first, deleted events left out', () => {
    seedRichHistory();
    const csv = eventsToCsv(events.list({ includeDeleted: true }));
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0].split(',')).toEqual([...CSV_COLUMNS]);
    expect(lines).toHaveLength(1 + 9);
    expect(lines.some(l => l.startsWith('to-delete'))).toBe(false);
    const times = lines.slice(1).map(l => Number(l.split(',')[2]));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('writes the fields in the right columns', () => {
    const csv = eventsToCsv([{
      id: 'a', ts: Date.UTC(2026, 0, 2, 3, 4, 5), source: 'alarm', behavior: 'nose_picking', hand: 'left', triggers: ['stress', 'focus'],
      confirmed: true, falsePositive: false, competingResponse: { done: true, durationSec: 12.5 }, deviceId: 'dev-1', updatedAt: Date.UTC(2026, 0, 2, 3, 5, 0),
    }]);
    expect(csv.split('\r\n')[1]).toBe('a,2026-01-02T03:04:05.000Z,1767323045000,alarm,nose_picking,left,stress; focus,true,false,true,12.5,dev-1,2026-01-02T03:05:00.000Z');
  });

  it('escapes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(false)).toBe('false');
    expect(csvCell(0)).toBe('0');
  });

  it('defuses cells a spreadsheet would run as a formula', () => {
    for (const evil of ['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '=HYPERLINK("http://x","y")']) {
      expect(csvCell(evil).replace(/^"/, '').startsWith("'"), evil).toBe(true);
    }
    const csv = eventsToCsv([{ id: 'a', ts: T0, source: 'manual', behavior: 'nail_biting', updatedAt: T0, triggers: ['=cmd|calc'] }]);
    expect(csv).toContain("'=cmd|calc");
    expect(csv).not.toMatch(/,=cmd/);
  });

  it('is just a header for an empty history', () => {
    expect(eventsToCsv([])).toBe(`${CSV_COLUMNS.join(',')}\r\n`);
  });
});
