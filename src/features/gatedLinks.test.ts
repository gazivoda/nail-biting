import { describe, it, expect } from 'vitest';
import { GATED_LINKS_ID, parseGatedLinks, readGatedLinks } from './gatedLinks';

const block = (value: unknown) => JSON.stringify(value);

describe('parseGatedLinks', () => {
  it('reads the [href, label] pairs the server wrote', () => {
    expect(parseGatedLinks(block([['/features/phone-companion', 'Log nail biting from your phone in two taps'], ['/solutions/cuticle-biting', 'Cuticle and skin biting']]))).toEqual([
      { href: '/features/phone-companion', label: 'Log nail biting from your phone in two taps' },
      { href: '/solutions/cuticle-biting', label: 'Cuticle and skin biting' },
    ]);
  });

  it('is empty for no block, an empty block and anything that is not that shape', () => {
    for (const bad of [null, undefined, '', '  ', 'not json', '{}', '"x"', '[1]', '[["/a"]]', '[[1, "x"]]', '[["/a", 1]]', '[["/a", ""]]', '[["/a", "  "]]']) {
      expect(parseGatedLinks(bad as string | null | undefined), String(bad)).toEqual([]);
    }
  });

  it('keeps only addresses on this site: one leading slash, plain path characters, no scheme, no query', () => {
    const wanted = [['/features/phone-companion', 'a']];
    for (const href of ['//evil.example/x', 'https://evil.example/x', 'javascript:alert(1)', '/a?b=1', '/a#b', '/a b', 'features/a', '/', '/../x', '/a//b']) {
      expect(parseGatedLinks(block([[href, 'x'], ...wanted])), href).toEqual([{ href: '/features/phone-companion', label: 'a' }]);
    }
  });

  it('keeps a bounded number of links and a bounded label', () => {
    const many = Array.from({ length: 40 }, (_, i) => [`/features/p${i}`, `Page ${i}`]);
    expect(parseGatedLinks(block(many)).length).toBeLessThanOrEqual(12);
    expect(parseGatedLinks(block([['/features/a', 'x'.repeat(500)]]))).toEqual([]);
  });
});

describe('readGatedLinks', () => {
  it('reads the data block out of the page', () => {
    const doc = { getElementById: (id: string) => (id === GATED_LINKS_ID ? { textContent: block([['/features/a', 'A']]) } : null) };
    expect(readGatedLinks(doc as unknown as Pick<Document, 'getElementById'>)).toEqual([{ href: '/features/a', label: 'A' }]);
  });

  it('is empty with no block, with no page, and when reading the page throws', () => {
    expect(readGatedLinks({ getElementById: () => null })).toEqual([]);
    expect(readGatedLinks(undefined)).toEqual([]);
    expect(readGatedLinks({ getElementById: () => { throw new Error('nope'); } })).toEqual([]);
  });

  it('does not ask the server for anything: no network code in the module', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./gatedLinks.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/fetch\(|\/api\/|useFeature|ensureFlags|refreshFlags/);
  });
});
