import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { format as dfFormat, formatDistance as dfFormatDistance } from 'date-fns';
import { useMemoryStorage, resetStorage } from '../../test-utils/memoryStorage';
import { installCatalogForTests, resetLocaleForTests, setAllowedLocales, setLocale } from './core';
import {
  formatNumber, formatPercent, formatCurrency, formatDate, formatTime, formatDateTime, formatDatePattern,
  formatRelativeTime, formatDistance, formatList, weekdayName,
} from './format';

const NOON = new Date(2026, 9, 23, 15, 45, 0); // Fri 23 Oct 2026, 15:45 local

function pick(locale: 'de' | 'es' | 'pt-BR') {
  installCatalogForTests(locale, { reviewed: false, catalog: {} });
  setLocale(locale);
  setAllowedLocales([locale]);
}

describe('formatting while English shows (nothing may change for people who never pick a language)', () => {
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); });
  afterEach(() => { resetStorage(); resetLocaleForTests(); });

  it('formatDatePattern is date-fns with the same pattern, for every pattern the app used', () => {
    for (const [pattern, intl] of [
      ['d MMM yyyy', { day: 'numeric', month: 'short', year: 'numeric' }],
      ['PP p', { dateStyle: 'medium', timeStyle: 'short' }],
      ['PP', { dateStyle: 'medium' }],
      ['EEE', { weekday: 'short' }],
      ['EEEE', { weekday: 'long' }],
      ['d MMM yyyy, HH:mm', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }],
    ] as const) {
      expect(formatDatePattern(NOON, pattern, intl), pattern).toBe(dfFormat(NOON, pattern));
    }
  });

  it('formatDate and formatTime are what toLocale*String(undefined) gave', () => {
    const opts = { weekday: 'short', month: 'short', day: 'numeric' } as const;
    expect(formatDate(NOON, opts)).toBe(NOON.toLocaleDateString(undefined, opts));
    expect(formatTime(NOON, { hour: '2-digit', minute: '2-digit' })).toBe(NOON.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    expect(formatTime(NOON)).toBe(NOON.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    expect(formatDateTime(NOON)).toBe(NOON.toLocaleString(undefined));
    expect(formatDate(NOON.getTime(), opts)).toBe(formatDate(NOON, opts)); // a timestamp works too
  });

  it('formatDistance is date-fns', () => {
    const base = Date.now();
    expect(formatDistance(base + 130_000, base, { addSuffix: true })).toBe(dfFormatDistance(base + 130_000, base, { addSuffix: true }));
    expect(formatDistance(base + 130_000, base, { addSuffix: true })).toBe('in 2 minutes');
  });

  it('formatNumber matches toLocaleString("en")', () => {
    expect(formatNumber(1234567.891)).toBe((1234567.891).toLocaleString('en'));
    expect(formatNumber(5000)).toBe('5,000');
    expect(formatNumber(Number.NaN)).toBe('NaN');
  });

  it('writes money, percent and lists in English', () => {
    expect(formatCurrency(2.99)).toBe('$2.99');
    expect(formatCurrency(29)).toBe('$29');
    expect(formatCurrency(29, 'USD', { keepCents: true })).toBe('$29.00');
    expect(formatCurrency(2.99, 'EUR')).toBe('€2.99');
    expect(formatPercent(0.256)).toBe('26%');
    expect(formatList(['a', 'b', 'c'])).toBe('a, b, and c');
  });

  it('relative time uses the largest unit that fits', () => {
    const now = 1_700_000_000_000;
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(formatRelativeTime(now + 2 * 3600_000, now)).toBe('in 2 hours');
    expect(formatRelativeTime(now - 86_400_000, now)).toBe('yesterday');
    expect(formatRelativeTime(now - 30_000, now)).toBe('30 seconds ago');
  });
});

describe('formatting in another language', () => {
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); });
  afterEach(() => { resetStorage(); resetLocaleForTests(); });

  it('German: day-first dates, 24 hour time, comma decimals, euro after the number', () => {
    pick('de');
    expect(formatDatePattern(NOON, 'd MMM yyyy', { day: 'numeric', month: 'short', year: 'numeric' })).toMatch(/^23\. Okt\.? 2026$/);
    expect(formatTime(NOON)).toBe('15:45');
    expect(formatNumber(1234.5)).toBe('1.234,5');
    expect(formatCurrency(2.99, 'EUR')).toMatch(/^2,99\s€$/);
    expect(formatPercent(0.256)).toMatch(/^26\s%$/);
    expect(weekdayName(1, 'long')).toBe('Montag');
    expect(weekdayName(0, 'short')).toMatch(/^So/);
    expect(formatList(['a', 'b', 'c'])).toBe('a, b und c');
  });

  it('Spanish and Brazilian Portuguese: their own words for relative time', () => {
    const now = 1_700_000_000_000;
    pick('es');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('hace 5 minutos');
    expect(formatDistance(now + 130_000, now)).toBe('dentro de 2 minutos');
    resetLocaleForTests();
    pick('pt-BR');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('há 5 minutos');
    expect(formatCurrency(2.99, 'BRL')).toMatch(/^R\$\s2,99$/);
    expect(weekdayName(2, 'long')).toBe('terça-feira');
  });

  it('flips back to the browser formats when the language goes away', () => {
    pick('de');
    expect(formatTime(NOON)).toBe('15:45');
    setAllowedLocales([]);
    expect(formatTime(NOON)).toBe(NOON.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  });
});
