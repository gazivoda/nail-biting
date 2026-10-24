// "No hardcoded strings remain" (WS12 acceptance), as a test. `npm run lint` has pre-existing errors in files that
// are not ours, so this runs the project's real ESLint config on every in-scope file and fails on any finding of the
// two local-i18n rules. The exemptions are scripts/i18n/scope.mjs (each with a reason).

import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXCLUDED, isExcluded, isInScope } from './scope.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('no English text in the code of the app', () => {
  it('has zero local-i18n findings in the in-scope files', async () => {
    const eslint = new ESLint({ cwd: root });
    const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
    const found = results.flatMap(r => {
      const file = relative(root, r.filePath).replace(/\\/g, '/');
      return r.messages
        .filter(m => m.ruleId && m.ruleId.startsWith('local-i18n/'))
        .map(m => `${file}:${m.line} ${m.ruleId}`);
    });
    expect(found.length, `${found.length} findings, first ones:\n${found.slice(0, 25).join('\n')}`).toBe(0);
  }, 120_000);

  it('runs both rules as errors', async () => {
    const eslint = new ESLint({ cwd: root });
    const config = await eslint.calculateConfigForFile(join(root, 'src/pages/Log.tsx'));
    expect(config.rules['local-i18n/no-hardcoded-text'][0]).toBe(2);
    expect(config.rules['local-i18n/no-english-literals'][0]).toBe(2);
  });

  it('every exemption has a reason and points at something that exists', async () => {
    const { existsSync } = await import('node:fs');
    for (const { pattern, reason } of EXCLUDED) {
      expect(reason.length, pattern).toBeGreaterThanOrEqual(15);
      expect(existsSync(join(root, pattern.replace(/\/\*\*$/, ''))), `${pattern} does not exist`).toBe(true);
    }
  });

  it('knows which files are in scope', () => {
    expect(isInScope('src/pages/Log.tsx')).toBe(true);
    expect(isInScope('src/pages/Settings.tsx')).toBe(true);
    expect(isInScope('src/pages/Landing.tsx')).toBe(false);
    expect(isInScope('src/data/blogPosts.ts')).toBe(false);
    // WS12b: the site chrome and the pricing page are translated, so they are checked; the blog and the legal pages are not
    expect(isInScope('src/components/site/SiteHeader.tsx')).toBe(true);
    expect(isInScope('src/pages/PricingPage.tsx')).toBe(true);
    expect(isInScope('src/components/PricingSection.tsx')).toBe(true);
    expect(isInScope('src/components/site/BlogMidCta.tsx')).toBe(false);
    expect(isInScope('src/pages/BlogIndex.tsx')).toBe(false);
    expect(isInScope('src/pages/PrivacyPage.tsx')).toBe(false);
    expect(isInScope('src/components/demo/HeroDemo.tsx')).toBe(false);
    expect(isExcluded('src/pages/Log.test.tsx')).toBe(true);
    expect(isInScope('server/routes/phone.js')).toBe(false);
  });
});
