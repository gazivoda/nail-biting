// Numbers, dates, times, money and "how long ago" in the active locale. Built on Intl, so no
// locale data is downloaded.
//
// While English shows, the helpers do what the app did before localisation, so nothing changes
// for a person who never picks a language:
//   * formatDate / formatTime pass `undefined` to Intl (the browser's own formats), as the old
//     toLocaleDateString([], ...) calls did;
//   * formatDatePattern keeps the date-fns pattern the screen used ("MMM d"), which is English
//     whatever the browser's language;
//   * formatNumber uses 'en' (what `toLocaleString('en')` did).
// Once a language is picked every helper switches to it together.
//
// Call these at render or event time, never at module level (the locale can change).

import { format as dfFormat, formatDistance as dfFormatDistance } from 'date-fns';
import { intlLocaleArg, intlTag, getLocale } from './core';

type DateInput = Date | number | string;
const toDate = (d: DateInput): Date => (d instanceof Date ? d : new Date(d));

const cache = new Map<string, Intl.NumberFormat | Intl.RelativeTimeFormat | Intl.ListFormat>();
function memo<T extends Intl.NumberFormat | Intl.RelativeTimeFormat | Intl.ListFormat>(key: string, make: () => T): T {
  let v = cache.get(key) as T | undefined;
  if (!v) cache.set(key, (v = make()));
  return v;
}

/** 1234.5 -> "1,234.5" (en), "1.234,5" (de). */
export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(n)) return String(n);
  const tag = intlTag();
  return memo(`n|${tag}|${JSON.stringify(options ?? {})}`, () => new Intl.NumberFormat(tag, options)).format(n);
}

/** 0.256 -> "26%" . */
export function formatPercent(fraction: number, options?: Intl.NumberFormatOptions): string {
  return formatNumber(fraction, { style: 'percent', maximumFractionDigits: 0, ...options });
}

/**
 * Money. Prices in the app are in the currency the checkout charges; this only writes them.
 * "$2.99" (en), "2,99 $" (de). A whole amount drops the cents unless `keepCents` is set ("$29").
 */
export function formatCurrency(amount: number, currency = 'USD', options?: { keepCents?: boolean } & Intl.NumberFormatOptions): string {
  const { keepCents, ...rest } = options ?? {};
  const whole = Number.isInteger(amount) && !keepCents;
  return formatNumber(amount, {
    style: 'currency',
    currency,
    ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    ...rest,
  });
}

/** The date part, like `d.toLocaleDateString(undefined, options)` did. */
export function formatDate(date: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return toDate(date).toLocaleDateString(intlLocaleArg(), options);
}

/** The time part, like `d.toLocaleTimeString([], options)` did: "3:45 PM" in en-US, "15:45" in de. */
export function formatTime(date: DateInput, options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }): string {
  return toDate(date).toLocaleTimeString(intlLocaleArg(), options);
}

/** Date and time together. */
export function formatDateTime(date: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return toDate(date).toLocaleString(intlLocaleArg(), options);
}

/**
 * For screens that used date-fns `format(date, pattern)`. English keeps the exact pattern; any other
 * language gets the same fields in its own order and words ("23. Okt.", "23 oct").
 */
export function formatDatePattern(date: DateInput, enPattern: string, intlOptions: Intl.DateTimeFormatOptions): string {
  const d = toDate(date);
  if (getLocale() === 'en') return dfFormat(d, enPattern);
  return d.toLocaleString(intlTag(), intlOptions);
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600 * 1000],
  ['month', 30 * 24 * 3600 * 1000],
  ['week', 7 * 24 * 3600 * 1000],
  ['day', 24 * 3600 * 1000],
  ['hour', 3600 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

/** "5 minutes ago", "in 2 hours", "hace 5 minutos". Uses the largest unit that fits. */
export function formatRelativeTime(ts: DateInput, now: DateInput = Date.now(), options?: Intl.RelativeTimeFormatOptions): string {
  const diff = toDate(ts).getTime() - toDate(now).getTime();
  const tag = intlTag();
  const rtf = memo(`r|${tag}|${JSON.stringify(options ?? {})}`, () => new Intl.RelativeTimeFormat(tag, { numeric: 'auto', ...options }));
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === 'second') return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(0, 'second');
}

/**
 * The words for the gap between two moments. English keeps date-fns' wording ("in about 2 minutes",
 * "less than a minute ago"); other languages use Intl's relative-time phrases.
 */
export function formatDistance(a: DateInput, b: DateInput, options?: { addSuffix?: boolean }): string {
  if (getLocale() === 'en') return dfFormatDistance(toDate(a), toDate(b), options);
  return formatRelativeTime(a, b);
}

/** "A, B and C" / "A, B und C". */
export function formatList(items: string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  const tag = intlTag();
  return memo(`l|${tag}|${type}`, () => new Intl.ListFormat(tag, { style: 'long', type })).format(items);
}

/** Weekday name for a day index (0 = Sunday), in the active language. */
export function weekdayName(day: number, width: 'long' | 'short' | 'narrow' = 'short'): string {
  return formatDate(new Date(2024, 0, 7 + day), { weekday: width }); // 7 Jan 2024 is a Sunday
}
