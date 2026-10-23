// Guards the rule "no direct localStorage / sessionStorage / indexedDB outside
// src/storage" (docs/agents/ARCHITECTURE.md, "Storage module"). It runs the
// project's real ESLint config, so the allowlist lives in exactly one place
// (eslint.config.js). `npm run lint` has pre-existing errors, which is why this
// is also a test: `npm test` is what actually gets run.

import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STORAGE_ALLOWLIST } from '../eslint.config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const eslint = new ESLint({ cwd: root });

const RULES = new Set(['no-restricted-globals', 'no-restricted-properties']);
const storageMessages = results =>
  results.flatMap(r => r.messages.filter(m => RULES.has(m.ruleId)).map(m => ({ file: r.filePath.replace(`${root}/`, ''), rule: m.ruleId, text: m.message })));

async function lintSnippet(code, filePath) {
  return storageMessages(await eslint.lintText(code, { filePath: join(root, filePath) }));
}

describe('the lint rule', () => {
  it.each([
    ['a bare localStorage call', "localStorage.setItem('k', '1');"],
    ['sessionStorage', "const v = sessionStorage.getItem('k');"],
    ['indexedDB', "const req = indexedDB.open('db');"],
    ['window.localStorage', "window.localStorage.getItem('k');"],
    ['globalThis.indexedDB', "globalThis.indexedDB.open('db');"],
    ['self.sessionStorage', "self.sessionStorage.clear();"],
  ])('flags %s in ordinary app code', async (_name, code) => {
    const found = await lintSnippet(code, 'src/pages/Example.tsx');
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].text).toMatch(/src\/storage/);
  });

  it('does not flag comments, strings or unrelated names', async () => {
    const code = [
      '// localStorage is mentioned in a comment',
      "const label = 'localStorage';",
      'const kv = { localStorage: 1 };',
      'export const x = kv.localStorage;',
    ].join('\n');
    expect(await lintSnippet(code, 'src/pages/Example.tsx')).toEqual([]);
  });

  it('allows the storage module itself', async () => {
    expect(await lintSnippet("localStorage.getItem('k');", 'src/storage/adapter.ts')).toEqual([]);
    expect(await lintSnippet("indexedDB.open('db');", 'src/storage/blobs.ts')).toEqual([]);
  });

  it('allows exactly the listed legacy files', async () => {
    expect(STORAGE_ALLOWLIST.length).toBeGreaterThan(0);
    for (const file of STORAGE_ALLOWLIST) {
      expect(await lintSnippet("localStorage.getItem('k');", file), file).toEqual([]);
    }
    // The next file over is not exempt.
    expect((await lintSnippet("localStorage.getItem('k');", 'src/hooks/usePWAOther.ts')).length).toBeGreaterThan(0);
  });

  it('the allowlist only names files that exist', async () => {
    const { existsSync } = await import('node:fs');
    for (const file of STORAGE_ALLOWLIST) expect(existsSync(join(root, file)), file).toBe(true);
  });
});

describe('the app source', () => {
  it('has no direct storage access outside src/storage and the allowlist', async () => {
    // Blog data is huge generated copy with no code in it; skip it to keep this fast.
    const guard = new ESLint({ cwd: root, overrideConfig: [{ ignores: ['src/data/**'] }] });
    const results = await guard.lintFiles(['src/**/*.{ts,tsx}']);
    expect(storageMessages(results)).toEqual([]);
  }, 60_000);
});
