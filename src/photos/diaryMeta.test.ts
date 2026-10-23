import { describe, it, expect } from 'vitest';
import {
  DUE_AFTER_MS, SNOOZE_MS, MAX_SIDE, defaultComparePair, describeAge, fitWithin, formatBytes, isDue,
  parseMeta, serializeMeta, sortNewestFirst, totalBytes, type PhotoMeta,
} from './diaryMeta';

const DAY = 24 * 60 * 60 * 1000;
const photo = (id: string, takenAt: number, over: Partial<PhotoMeta> = {}): PhotoMeta => ({ id, takenAt, width: 1280, height: 720, bytes: 200_000, ...over });
const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);

describe('isDue: the weekly reminder', () => {
  it('is never due for an empty diary (the empty state invites, it does not nag)', () => {
    expect(isDue([], NOW)).toBe(false);
  });

  it('is not due at 6 days 23 hours, and is due at exactly 7 days', () => {
    expect(isDue([photo('a', NOW - 7 * DAY + 60_000)], NOW)).toBe(false);
    expect(isDue([photo('a', NOW - 7 * DAY)], NOW)).toBe(true);
    expect(isDue([photo('a', NOW - 7 * DAY - 1)], NOW)).toBe(true);
    expect(DUE_AFTER_MS).toBe(7 * DAY);
  });

  it('looks at the NEWEST photo, whatever the list order', () => {
    const list = [photo('old', NOW - 30 * DAY), photo('new', NOW - 2 * DAY)];
    expect(isDue(list, NOW)).toBe(false);
    expect(isDue([...list].reverse(), NOW)).toBe(false);
  });

  it('a newest photo dated in the future (clock set back) is not due', () => {
    expect(isDue([photo('a', NOW + 3 * DAY)], NOW)).toBe(false);
  });

  it('"Not now" keeps it quiet for a day, then it is back', () => {
    const list = [photo('a', NOW - 9 * DAY)];
    const snoozedUntil = NOW + SNOOZE_MS;
    expect(isDue(list, NOW, snoozedUntil)).toBe(false);
    expect(isDue(list, NOW + SNOOZE_MS - 1, snoozedUntil)).toBe(false);
    expect(isDue(list, NOW + SNOOZE_MS, snoozedUntil)).toBe(true);
  });

  it('a snooze set far into the future (clock was set back after snoozing) does not silence it for months', () => {
    const list = [photo('a', NOW - 9 * DAY)];
    expect(isDue(list, NOW, NOW + 60 * DAY)).toBe(true);
    expect(isDue(list, NOW, NOW + SNOOZE_MS + 1)).toBe(true);
  });

  it('a snooze in the past changes nothing', () => {
    expect(isDue([photo('a', NOW - 9 * DAY)], NOW, NOW - 1)).toBe(true);
  });
});

describe('parseMeta: kv holds whatever it holds', () => {
  it('reads the stored form and a bare array, newest first', () => {
    const list = [photo('a', 1000), photo('b', 3000), photo('c', 2000)];
    expect(parseMeta(serializeMeta(list)).map(p => p.id)).toEqual(['b', 'c', 'a']);
    expect(parseMeta(list).map(p => p.id)).toEqual(['b', 'c', 'a']);
  });

  it.each([null, undefined, 7, 'x', {}, { photos: 'no' }, []])('gives an empty list for %j', raw => {
    expect(parseMeta(raw)).toEqual([]);
  });

  it('drops unusable entries and duplicates, never repairs them', () => {
    const raw = [
      photo('ok', 5000),
      photo('ok', 9000), // duplicate id: the first one stays
      { id: '', takenAt: 1, width: 1, height: 1, bytes: 1 },
      { id: 'no-time', width: 1, height: 1, bytes: 1 },
      { id: 'bad-size', takenAt: 1, width: 0, height: 1, bytes: 1 },
      { id: 'nan', takenAt: NaN, width: 1, height: 1, bytes: 1 },
      'string', null, 4,
    ];
    expect(parseMeta(raw).map(p => p.id)).toEqual(['ok']);
    expect(parseMeta(raw)[0].takenAt).toBe(5000);
  });

  it('keeps only the known fields (an extra field in kv does not travel)', () => {
    const [p] = parseMeta([{ ...photo('a', 1), secret: 'x', dataUrl: 'data:image/jpeg;base64,AAAA' }]);
    expect(Object.keys(p).sort()).toEqual(['bytes', 'height', 'id', 'takenAt', 'width']);
  });

  it('treats a missing byte count as 0', () => {
    expect(parseMeta([{ id: 'a', takenAt: 1, width: 2, height: 2 }])[0].bytes).toBe(0);
  });
});

describe('small helpers', () => {
  it('sorts newest first and breaks ties by id, without changing the input', () => {
    const input = [photo('b', 1), photo('a', 1), photo('c', 2)];
    expect(sortNewestFirst(input).map(p => p.id)).toEqual(['c', 'a', 'b']);
    expect(input.map(p => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('defaultComparePair: oldest against newest, null below two photos', () => {
    expect(defaultComparePair([])).toBeNull();
    expect(defaultComparePair([photo('a', 1)])).toBeNull();
    expect(defaultComparePair([photo('mid', 2), photo('new', 3), photo('old', 1)])).toEqual({ beforeId: 'old', afterId: 'new' });
  });

  it('fitWithin never scales up and caps the longest side', () => {
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
    expect(fitWithin(1920, 1080)).toEqual({ width: MAX_SIDE, height: 720 });
    expect(fitWithin(1080, 1920)).toEqual({ width: 720, height: MAX_SIDE });
    expect(fitWithin(MAX_SIDE, 10)).toEqual({ width: MAX_SIDE, height: 10 });
    expect(fitWithin(5000, 1)).toEqual({ width: MAX_SIDE, height: 1 });
  });

  it('describes ages and sizes in plain words', () => {
    expect(describeAge(NOW, NOW)).toBe('today');
    expect(describeAge(NOW - DAY, NOW)).toBe('1 day ago');
    expect(describeAge(NOW - 9 * DAY - 1000, NOW)).toBe('9 days ago');
    expect(describeAge(NOW + DAY, NOW)).toBe('today'); // clock skew never prints a negative
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(1)).toBe('1 KB');
    expect(formatBytes(180 * 1024)).toBe('180 KB');
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4 MB');
    expect(totalBytes([photo('a', 1, { bytes: 10 }), photo('b', 2, { bytes: 32 })])).toBe(42);
  });
});
