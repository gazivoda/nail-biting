import { describe, it, expect } from 'vitest';
import { formatMessage, formatToParts, inspectMessage, parseRich, assertParses, pluralCategoriesOf } from './message';

const f = (tpl: string, params?: Record<string, string | number | boolean | null | undefined>, tag = 'en') => formatMessage(tpl, params, tag);

describe('formatMessage: plain text and placeholders', () => {
  it('returns plain text untouched, apostrophes and all', () => {
    expect(f("Don't worry, it's fine.")).toBe("Don't worry, it's fine.");
    expect(f('Issue #5 is open')).toBe('Issue #5 is open');
  });

  it('inserts named placeholders as written', () => {
    expect(f('Hello {name}!', { name: 'Ana' })).toBe('Hello Ana!');
    expect(f('{a} then {b} then {a}', { a: 1, b: 'two' })).toBe('1 then two then 1');
    expect(f('{n} entries', { n: 1234 })).toBe('1234 entries'); // raw: nothing is grouped unless asked
  });

  it('leaves a missing placeholder visible instead of an empty string', () => {
    expect(f('Hello {name}!', {})).toBe('Hello {name}!');
    expect(f('Hello {name}!')).toBe('Hello {name}!');
    expect(f('Hello {name}!', { name: null })).toBe('Hello {name}!');
  });

  it('does not re-interpret braces or tags that arrive inside a value', () => {
    expect(f('You wrote: {text}', { text: '{x} <b>y</b> #' })).toBe('You wrote: {x} <b>y</b> #');
  });

  it('formats numbers in the active locale on request', () => {
    expect(f('{n, number} entries', { n: 1234.5 }, 'en')).toBe('1,234.5 entries');
    expect(f('{n, number} Einträge', { n: 1234.5 }, 'de')).toBe('1.234,5 Einträge');
    expect(f('{n, number} entradas', { n: 1234.5 }, 'pt-BR')).toBe('1.234,5 entradas');
  });
});

describe('formatMessage: plurals', () => {
  const en = '{count, plural, =0 {No alerts} one {# alert} other {# alerts}}';

  it('follows the English rule and honours =0', () => {
    expect(f(en, { count: 0 })).toBe('No alerts');
    expect(f(en, { count: 1 })).toBe('1 alert');
    expect(f(en, { count: 2 })).toBe('2 alerts');
    expect(f(en, { count: 1000 })).toBe('1,000 alerts'); // "#" is the number in the locale's format
  });

  it('uses the plural rules of the locale, not the English ones', () => {
    // French/Portuguese treat 0 as "one"; German and English do not.
    const msg = '{n, plural, one {# dia} other {# dias}}';
    expect(f(msg, { n: 0 }, 'pt-BR')).toBe('0 dia');
    expect(f(msg, { n: 1 }, 'pt-BR')).toBe('1 dia');
    expect(f(msg, { n: 2 }, 'pt-BR')).toBe('2 dias');
    expect(f('{n, plural, one {# Tag} other {# Tage}}', { n: 0 }, 'de')).toBe('0 Tage');
    expect(f('{n, plural, one {# Tag} other {# Tage}}', { n: 1 }, 'de')).toBe('1 Tag');
  });

  it('falls back to "other" when the locale needs a category the message does not give', () => {
    // Spanish has a "many" category (1,000,000); a message with only one/other still reads.
    const msg = '{n, plural, one {# día} other {# días}}';
    expect(f(msg, { n: 1_000_000 }, 'es')).toBe('1.000.000 días');
    expect(f(msg, { n: 5 }, 'es')).toBe('5 días');
  });

  it('supports the categories of languages that have more of them', () => {
    const ru = '{n, plural, one {# день} few {# дня} many {# дней} other {# дня}}';
    expect(f(ru, { n: 1 }, 'ru')).toBe('1 день');
    expect(f(ru, { n: 3 }, 'ru')).toBe('3 дня');
    expect(f(ru, { n: 5 }, 'ru')).toBe('5 дней');
  });

  it('nests placeholders and selects inside a case, and "#" belongs to the nearest plural', () => {
    const msg = '{count, plural, one {{name} logged # bite} other {{name} logged # bites}}';
    expect(f(msg, { count: 1, name: 'Ana' })).toBe('Ana logged 1 bite');
    expect(f(msg, { count: 4, name: 'Ana' })).toBe('Ana logged 4 bites');
    const sel = '{who, select, you {You} other {{name}}} logged {n, plural, one {# bite} other {# bites}}';
    expect(f(sel, { who: 'you', n: 2 })).toBe('You logged 2 bites');
    expect(f(sel, { who: 'x', name: 'Bo', n: 1 })).toBe('Bo logged 1 bite');
  });

  it('shows the placeholder when the count is missing or not a number', () => {
    expect(f(en, {})).toBe('{count}');
    expect(f(en, { count: 'many' })).toBe('{count}');
  });
});

describe('formatMessage: select', () => {
  const msg = '{kind, select, low {Quiet} high {Loud} other {Normal}}';
  it('picks by value and falls back to other', () => {
    expect(f(msg, { kind: 'low' })).toBe('Quiet');
    expect(f(msg, { kind: 'high' })).toBe('Loud');
    expect(f(msg, { kind: 'whatever' })).toBe('Normal');
    expect(f(msg, {})).toBe('Normal');
  });
});

describe('malformed messages', () => {
  it.each([
    '{count, plural, one {# x}}', // no "other"
    '{n, plural, one {# x} other {# y}',
    'Hello {name',
    '{n, number, extra}',
    '{n, bogus, a {b} other {c}}',
    'stray } brace',
  ])('are rejected by assertParses and shown as written by formatMessage: %s', tpl => {
    expect(() => assertParses(tpl)).toThrow();
    expect(f(tpl, { count: 1, n: 1, name: 'x' })).toBe(tpl);
  });
});

describe('rich tags', () => {
  it('splits text and tags, keeping inserted values out of tag parsing', () => {
    const parts = formatToParts('Read the <link>privacy note, {who}</link>.', { who: '<b>x</b>' }, 'en');
    expect(parseRich(parts)).toEqual(['Read the ', { tag: 'link', children: ['privacy note, ', '<b>x</b>'] }, '.']);
  });

  it('nests', () => {
    expect(parseRich(formatToParts('<a>one <b>two</b></a>', {}, 'en'))).toEqual([{ tag: 'a', children: ['one ', { tag: 'b', children: ['two'] }] }]);
  });

  it('rejects mismatched or unclosed tags', () => {
    expect(() => parseRich(formatToParts('<a>x</b>', {}, 'en'))).toThrow();
    expect(() => parseRich(formatToParts('<a>x', {}, 'en'))).toThrow();
  });

  it('leaves a lone angle bracket alone', () => {
    expect(parseRich(formatToParts('Under 5 < 10 minutes', {}, 'en'))).toEqual(['Under 5 < 10 minutes']);
  });
});

describe('inspectMessage', () => {
  it('lists placeholders, how they are used, plural and select keys and tags', () => {
    const info = inspectMessage('{name} has {n, plural, =0 {none} one {# bite} other {# bites}}, {kind, select, a {<b>A</b>} other {B}}, {x, number}');
    expect(info.placeholders).toEqual({ name: 'arg', n: 'plural', kind: 'select', x: 'number' });
    expect(info.pluralKeys).toEqual(['=0', 'one', 'other']);
    expect(info.selectKeys).toEqual(['a', 'other']);
    expect(info.tags).toEqual(['b']);
  });
});

describe('pluralCategoriesOf', () => {
  it('reports what Intl says for the three target languages', () => {
    expect(pluralCategoriesOf('de').sort()).toEqual(['one', 'other']);
    expect(pluralCategoriesOf('es')).toContain('other');
    expect(pluralCategoriesOf('pt-BR')).toContain('one');
  });
});
