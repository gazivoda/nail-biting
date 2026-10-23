// Finds English that did not come through t(), in rendered HTML.
//
// The pseudo-locale tests (src/i18n/coverage/*.test.tsx) render a screen with the German catalog and a
// transform that wraps every string t() returns in ⟦ ⟧. Whatever is left outside the marks was not produced
// by t(): hardcoded text, or text built by a helper that forgot to ask the catalog. This scans the HTML for it:
// every text node and the user-facing attributes (aria-label, title, placeholder, alt, ...).
//
// A leak is a word of two or more letters outside the marks that is not on the allow list (product and
// provider names, units, the month and day names Intl writes in German, and anything a test lists for its own
// fixtures, such as a tag a person typed). Numbers and punctuation are never leaks.

export const OPEN = '⟦';
export const CLOSE = '⟧';

/** What the output transform does to a string: marks it as "came from the catalog". */
export const mark = (s: string): string => (s ? `${OPEN}${s}${CLOSE}` : s);

/** Attributes whose value a person reads or hears. */
export const TEXT_ATTRS = ['aria-label', 'aria-description', 'aria-roledescription', 'aria-placeholder', 'aria-valuetext', 'title', 'placeholder', 'alt'];

const BASE_ALLOW = [
  'Stop', 'Biting', 'Google', 'Apple', 'Microsoft', 'Paddle', 'PWA', 'iOS', 'Android', 'macOS', 'Windows', 'Chrome', 'Safari',
  'Firefox', 'Edge', 'Electron', 'MediaPipe', 'AM', 'PM', 'min', 'ms', 'px', 'USD', 'EUR', 'BRL', 'URL',
  // the language names, written in their own language and never translated
  'English', 'Español', 'Deutsch', 'Português', 'Brasil',
];

/** The words Intl writes for months and days in German (and a few time words). */
export function germanDateWords(): string[] {
  const out = new Set<string>(['Uhr']);
  for (const width of ['long', 'short', 'narrow'] as const) {
    for (let m = 0; m < 12; m += 1) {
      const d = new Date(2024, m, 15);
      for (const w of d.toLocaleDateString('de', { month: width }).split(/[\s.]+/)) if (w) out.add(w);
    }
    for (let day = 0; day < 7; day += 1) {
      const d = new Date(2024, 0, 7 + day);
      for (const w of d.toLocaleDateString('de', { weekday: width }).split(/[\s.]+/)) if (w) out.add(w);
    }
  }
  return [...out];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', middot: '·' };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export interface Leak { word: string; in: string; where: 'text' | 'attribute' }

export interface ScanOptions {
  /** Extra words that are allowed outside the marks (fixture data, a name a person typed). */
  allow?: Array<string | RegExp>;
}

function leaksIn(raw: string, where: Leak['where'], allowed: (w: string) => boolean): Leak[] {
  const text = decode(raw);
  const unmarked = text.replace(new RegExp(`${OPEN}[^${CLOSE}]*${CLOSE}`, 'g'), ' ');
  const leaks: Leak[] = [];
  for (const m of unmarked.matchAll(/[\p{L}][\p{L}'’-]*/gu)) {
    const word = m[0].replace(/^[-'’]+|[-'’]+$/g, '');
    if (word.length < 2 || allowed(word)) continue;
    leaks.push({ word, in: text.trim().slice(0, 100), where });
  }
  return leaks;
}

/** Leaks in the rendered HTML: text nodes first, then the text attributes. Empty means every word came from t(). */
export function findUnmarkedEnglish(html: string, options: ScanOptions = {}): Leak[] {
  const allowWords = new Set([...BASE_ALLOW, ...germanDateWords()]);
  const patterns = (options.allow ?? []).filter((a): a is RegExp => a instanceof RegExp);
  for (const a of options.allow ?? []) if (typeof a === 'string') allowWords.add(a);
  const allowed = (w: string) => allowWords.has(w) || patterns.some(p => p.test(w));

  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const leaks: Leak[] = [];
  const attrRe = new RegExp(`\\s(${TEXT_ATTRS.join('|')})="([^"]*)"`, 'g');
  const pieces = cleaned.split(/(<[^>]*>)/);
  for (const piece of pieces) {
    if (piece.startsWith('<') && piece.endsWith('>')) {
      for (const m of piece.matchAll(attrRe)) leaks.push(...leaksIn(m[2], 'attribute', allowed));
    } else if (piece.trim()) {
      leaks.push(...leaksIn(piece, 'text', allowed));
    }
  }
  return leaks;
}

/** A readable summary for a failing assertion. */
export function describeLeaks(leaks: Leak[]): string {
  if (leaks.length === 0) return 'no unmarked English';
  const byWord = new Map<string, Leak>();
  for (const l of leaks) if (!byWord.has(l.word)) byWord.set(l.word, l);
  return [...byWord.values()].slice(0, 12).map(l => `"${l.word}" (${l.where}: ${l.in})`).join('; ');
}
