// "Switching locale covers 100% of the app screens" has to be proven, not hoped. This test is the inventory:
//
//   * every in-scope source file that uses the i18n API (it imports from src/i18n) is either rendered / called by a
//     pseudo-locale coverage test (src/i18n/coverage/*.coverage.test.tsx lists it in COVERS) or carries a line
//         // NOT-RENDERED src/path/File.tsx: why it cannot be rendered in node and where its text is covered instead
//   * every coverage test really uses the pseudo-locale and the leak scan (so an empty file cannot "cover" anything)
//   * every in-scope file that does NOT use i18n is clean for the lint rules (scripts/i18nGuard.test.mjs), which is
//     what makes "no English left in the code" a fact for those files
//
// The coverage tests themselves run under `npm test` and fail on any English outside t().

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isInScope } from './scope.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const all = walk(join(root, 'src')).map(p => relative(root, p).replace(/\\/g, '/'));
const inScope = all.filter(isInScope);
const usesI18n = f => /from\s+['"][^'"]*\/i18n\/(?:scopes\/|format|hooks|core|LocaleHost)[^'"]*['"]|from\s+['"][^'"]*\/i18n['"]/.test(readFileSync(join(root, f), 'utf8'));

const coverageFiles = all.filter(f => /^src\/i18n\/coverage\/.*\.coverage\.test\.tsx?$/.test(f));
const coverageText = coverageFiles.map(f => readFileSync(join(root, f), 'utf8')).join('\n');

// A path counts as rendered only when it is in a `COVERS = [...]` list (a path inside a readFileSync call is not a claim).
const coversPaths = new Set(
  [...coverageText.matchAll(/COVERS\s*=\s*\[([\s\S]*?)\]/g)].flatMap(block => [...block[1].matchAll(/['"](src\/[A-Za-z0-9_./-]+\.tsx?)['"]/g)].map(m => m[1])),
);
const covered = f => coversPaths.has(f);
const notRendered = new Map(
  [...coverageText.matchAll(/\/\/\s*NOT-RENDERED\s+(src\/\S+?):\s*(.+)/g)].map(m => [m[1], m[2].trim()]),
);

describe('pseudo-locale coverage inventory', () => {
  const needing = inScope.filter(f => !f.startsWith('src/i18n/') && /\.(ts|tsx)$/.test(f) && usesI18n(f));

  it('finds the files that use the i18n API', () => {
    // a sanity check that the regex above sees real imports: the language card is one
    expect(needing).toContain('src/pages/settings/LanguageSettings.tsx');
  });

  it('every file that uses t() is rendered by a coverage test or explained', () => {
    const missing = needing.filter(f => !covered(f) && !notRendered.has(f));
    expect(missing, `add these to COVERS in a src/i18n/coverage/*.coverage.test.tsx (render them under the pseudo-locale), or add a "// NOT-RENDERED <path>: <reason>" line:\n${missing.join('\n')}`).toEqual([]);
  });

  it('every NOT-RENDERED line names a real file, gives a reason, and is not also claimed as covered', () => {
    for (const [file, reason] of notRendered) {
      expect(existsSync(join(root, file)), `${file} does not exist`).toBe(true);
      expect(reason.length, `${file}: give a real reason`).toBeGreaterThanOrEqual(15);
      // it must not ALSO be listed as rendered: pick one
      expect(covered(file), `${file} is both listed in COVERS and declared NOT-RENDERED`).toBe(false);
    }
  });

  it('every COVERS path exists', () => {
    for (const m of coverageText.matchAll(/['"](src\/[A-Za-z0-9_./-]+\.tsx?)['"]/g)) {
      expect(existsSync(join(root, m[1])), `${m[1]} is listed in a coverage test but does not exist`).toBe(true);
    }
  });

  it('every coverage test uses the pseudo-locale and the leak scan', () => {
    expect(coverageFiles.length).toBeGreaterThan(0);
    for (const f of coverageFiles) {
      const text = readFileSync(join(root, f), 'utf8');
      expect(text, `${f} must call usePseudoLocale() (or usePseudoSiteLocale() for the marketing pages)`).toMatch(/usePseudo(?:Site)?Locale\(/);
      expect(text, `${f} must assert with expectAllTranslated(...)`).toMatch(/expectAllTranslated\(/);
    }
  });

  it('prints the totals (informational)', () => {
    const rendered = needing.filter(covered).length;
    console.log(`i18n coverage: ${needing.length} files use t(); ${rendered} rendered by coverage tests; ${notRendered.size} explained as not rendered`);
    expect(rendered + notRendered.size).toBeGreaterThanOrEqual(0);
  });
});
