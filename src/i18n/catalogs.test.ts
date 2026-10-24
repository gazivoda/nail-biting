// Catalog parity. English (src/i18n/scopes) is the source of truth; every locale must carry every key, with
// the same placeholders, the plural forms the language needs, and no empty strings. The compiler already
// refuses a missing key (LocaleCatalog); this checks what types cannot: placeholders, plural categories,
// whitespace at the edges, rich tags, the review header.

import { describe, it, expect } from 'vitest';
import { SCOPES, type ScopeName } from './scopes';
import { catalog as es, reviewed as esReviewed } from './locales/es';
import { catalog as de, reviewed as deReviewed } from './locales/de';
import { catalog as ptBR, reviewed as ptBRReviewed } from './locales/pt-BR';
import { LOCALE_INFO } from './core';
import { assertParses, inspectMessage, pluralCategoriesOf } from './message';

const LOCALES = [
  { code: 'es', catalog: es, reviewed: esReviewed },
  { code: 'de', catalog: de, reviewed: deReviewed },
  { code: 'pt-BR', catalog: ptBR, reviewed: ptBRReviewed },
] as const;

const scopeNames = Object.keys(SCOPES) as ScopeName[];
const english = (scope: ScopeName) => SCOPES[scope].messages as Record<string, string>;
const translated = (catalog: Record<string, Record<string, string>>, scope: ScopeName) => catalog[scope] ?? {};

const edgeSpace = (s: string) => [/^\s/.test(s), /\s$/.test(s)];

describe('English source', () => {
  it.each(scopeNames)('scope %s: no empty message, every message parses', scope => {
    for (const [key, text] of Object.entries(english(scope))) {
      expect(text.trim().length, `${scope}.${key} is empty`).toBeGreaterThan(0);
      expect(() => assertParses(text), `${scope}.${key}`).not.toThrow();
    }
  });

  it('has at least the strings the app needs (the extraction produced a catalog)', () => {
    const total = scopeNames.reduce((n, s) => n + Object.keys(english(s)).length, 0);
    expect(total).toBeGreaterThan(10);
  });

  it('uses only plural categories English has, with "other"', () => {
    for (const scope of scopeNames) {
      for (const [key, text] of Object.entries(english(scope))) {
        const { pluralKeys } = inspectMessage(text);
        if (pluralKeys.length === 0) continue;
        expect(pluralKeys, `${scope}.${key}`).toContain('other');
        for (const k of pluralKeys) expect(k === 'one' || k === 'other' || /^=\d+$/.test(k), `${scope}.${key} uses "${k}"`).toBe(true);
      }
    }
  });
});

describe.each(LOCALES)('locale $code', ({ code, catalog, reviewed }) => {
  const tag = LOCALE_INFO[code].tag;
  const valid = new Set(pluralCategoriesOf(tag));
  // "many" only matters for very large numbers (1,000,000) in Spanish and Portuguese; "other" covers it.
  const required = [...valid].filter(c => c !== 'many' && c !== 'other');

  it('has every scope', () => {
    expect(Object.keys(catalog).sort()).toEqual([...scopeNames].sort());
  });

  it.each(scopeNames)('scope %s: same keys as English, none empty', scope => {
    const en = english(scope);
    const tr = translated(catalog as Record<string, Record<string, string>>, scope);
    expect(Object.keys(tr).sort(), `keys of ${code}/${scope}`).toEqual(Object.keys(en).sort());
    for (const [key, text] of Object.entries(tr)) {
      expect(typeof text, `${scope}.${key}`).toBe('string');
      expect(text.trim().length, `${scope}.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it.each(scopeNames)('scope %s: placeholders, plural forms, tags and edges match English', scope => {
    const en = english(scope);
    const tr = translated(catalog as Record<string, Record<string, string>>, scope);
    for (const [key, enText] of Object.entries(en)) {
      const trText = tr[key];
      if (trText === undefined) continue; // reported by the keys test
      const where = `${code}/${scope}.${key}`;
      expect(() => assertParses(trText), `${where} does not parse: ${trText}`).not.toThrow();
      const a = inspectMessage(enText);
      const b = inspectMessage(trText);
      expect(b.placeholders, `${where} placeholders`).toEqual(a.placeholders);
      expect(b.tags, `${where} tags`).toEqual(a.tags);
      expect(b.selectKeys, `${where} select keys`).toEqual(a.selectKeys);
      if (a.pluralKeys.length > 0) {
        expect(b.pluralKeys, `${where} plural forms`).toContain('other');
        for (const k of b.pluralKeys) {
          expect(valid.has(k as never) || /^=\d+$/.test(k), `${where}: "${k}" is not a plural category of ${code} (${[...valid].join(', ')})`).toBe(true);
        }
        for (const c of required) expect(b.pluralKeys, `${where}: ${code} needs a "${c}" form`).toContain(c);
      } else {
        expect(b.pluralKeys, `${where} should not have plural forms`).toEqual([]);
      }
      expect(edgeSpace(trText), `${where} leading/trailing space`).toEqual(edgeSpace(enText));
    }
  });

  it('is mostly translated (not copied from English)', () => {
    let same = 0;
    let total = 0;
    const samples: string[] = [];
    for (const scope of scopeNames) {
      const tr = translated(catalog as Record<string, Record<string, string>>, scope);
      for (const [key, text] of Object.entries(english(scope))) {
        total += 1;
        if (tr[key] === text && /[A-Za-z]{4,}/.test(text)) { same += 1; if (samples.length < 8) samples.push(`${scope}.${key}`); }
      }
    }
    // Product names and a few shared words are identical in any language; copying English wholesale is not.
    if (total > 20) expect(same / total, `identical to English: ${samples.join(', ')}`).toBeLessThan(0.15);
  });

  it('is marked as a machine draft until a native speaker has reviewed it', () => {
    expect(typeof reviewed).toBe('boolean');
    expect(reviewed, `${code}: only flip reviewed to true after a native review`).toBe(false);
  });
});

describe('locale files carry the review header', () => {
  const raw = import.meta.glob('./locales/*/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

  it('every locale file starts with NEEDS NATIVE REVIEW', () => {
    const files = Object.keys(raw);
    expect(files.length).toBeGreaterThanOrEqual(3 * (scopeNames.length + 1));
    for (const file of files) expect(raw[file].split('\n')[0], file).toMatch(/NEEDS NATIVE REVIEW/);
  });

  it('the review marker of each locale (reviewed.ts, re-exported by the index; WS12b moved it so the marketing chunk can read it alone) is false', () => {
    for (const code of ['es', 'de', 'pt-BR']) {
      expect(raw[`./locales/${code}/reviewed.ts`], code).toMatch(/export const reviewed = false;/);
      expect(raw[`./locales/${code}/index.ts`], code).toMatch(/export \{ reviewed \} from '\.\/reviewed';/);
    }
  });
});
