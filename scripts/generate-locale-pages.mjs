#!/usr/bin/env node
// Writes dist/i18n/<locale>.json for the server (WS12b): the localized marketing pages of Spanish, German and
// Brazilian Portuguese, rendered to final text, plus each language's review marker.
//
//   node scripts/generate-locale-pages.mjs
//
// Runs at the end of every `vite build` (vite.config.ts, after generate-seo-content.mjs), so it also runs inside the
// Docker / Nixpacks image builds. server.js reads these files at start-up (server/marketing/localePages.js) and
// serves the localized pages only while the language's flag is on; the files are never served (server.js answers
// the branded 404 for /i18n/*).
//
// The single source of the text is src/i18n (scopes/ = English, locales/<x>/ = translations). The `reviewed` marker is
// src/i18n/locales/<x>/reviewed.ts and is copied into the file verbatim: the owner flips it there.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node >= 22.18 strips TypeScript types on import, so the .ts files load directly.
const { buildLocaleFile } = await import('../src/i18n/marketing/build.ts');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(DIST, 'i18n');

const LOCALES = [
  { locale: 'es', dir: 'es' },
  { locale: 'de', dir: 'de' },
  { locale: 'pt-BR', dir: 'pt-BR' },
];

let ledger = {};
try {
  ledger = JSON.parse(readFileSync(join(ROOT, 'src/data/pageUpdates.json'), 'utf8'));
} catch { /* no ledger yet: pages are served without a freshness date */ }

if (!existsSync(DIST)) {
  console.error('generate-locale-pages: dist/ does not exist; run it from a build.');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

for (const { locale, dir } of LOCALES) {
  const { catalog: site } = await import(`../src/i18n/locales/${dir}/site.ts`);
  const { catalog: meta } = await import(`../src/i18n/locales/${dir}/meta.ts`);
  const { reviewed } = await import(`../src/i18n/locales/${dir}/reviewed.ts`);
  const file = buildLocaleFile({ locale, ledger, site, meta, reviewed });
  writeFileSync(join(OUT, `${locale}.json`), JSON.stringify(file));
  console.log(`generate-locale-pages: i18n/${locale}.json - ${Object.keys(file.pages).join(', ')} (reviewed: ${reviewed})`);
}
