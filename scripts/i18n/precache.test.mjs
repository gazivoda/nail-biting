// Source-level guard (WS12b): translated text never rides into the service worker precache of an English visitor.
//
// The catalogs are chunks named locale-*.js and `globIgnores` keeps that name out of the precache. A module that both
// the app catalog (locale-<x>) and the marketing catalog (locale-site-<x>) import is shared by Rollup, and a shared
// chunk is named after one of its modules unless it is pinned: it was `reviewed-*.js` once, and it was precached.
// `node scripts/i18n/dom-probe/bundle-size.mjs <main dist> <this dist>` checks the built sw.js; this checks the config.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => readFileSync(join(root, f), 'utf8');

describe('translated text stays out of the service worker precache', () => {
  const config = read('vite.config.ts');

  it('the precache ignores every locale-* chunk', () => {
    expect(config).toMatch(/globIgnores:\s*\[[^\]]*'\*\*\/assets\/locale-\*\.js'/s);
  });

  it('a module shared by the app catalog and the marketing catalog is pinned to a chunk named locale-*', () => {
    expect(config).toMatch(/\(es\|de\|pt-BR\)[^\n]*\(\?:plans\|reviewed\)\\\.ts\$/);
    expect(config).toContain('return `locale-${lang[1]}-shared`');
  });

  it('what index.ts and site.ts of a language share is exactly plans (reviewed is shared through the two entry files)', () => {
    const imports = src => new Set([...src.matchAll(/from '\.\/([A-Za-z-]+)(?:\.ts)?'/g)].map(m => m[1]));
    for (const dir of ['es', 'de', 'pt-BR']) {
      const app = imports(read(`src/i18n/locales/${dir}/index.ts`));
      const site = imports(read(`src/i18n/locales/${dir}/site.ts`));
      const shared = [...site].filter(name => app.has(name)).sort();
      expect(shared, `${dir}: modules imported by both index.ts and site.ts`).toEqual(['plans']);
    }
  });
});
