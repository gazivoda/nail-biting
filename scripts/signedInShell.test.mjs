// The signed-in shell (tab bar, tour, install guide, hosts and the lazy pages) is not part of the download of a visitor
// who is not signed in. Read from the source, so it is checked without a build; scripts/homeBundle.test.mjs checks the
// same thing on the built files.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
const appStaticImports = [...app.matchAll(/^import\s[^;]*?from\s+'([^']+)';?$/gm)].map(m => m[1]);

describe('App.tsx and the signed-in shell', () => {
  it('imports none of the shell statically: the tab bar, the tour, the install guide and the hosts live in SignedInApp', () => {
    for (const shell of ['TabBar', 'OnboardingTour', 'PWAGuideModal', 'ProgramHost', 'SyncHost', 'BillingHost', 'BackgroundHost', 'MilestoneHost', 'LocaleHost']) {
      expect(appStaticImports.filter(i => i.includes(shell)), shell).toEqual([]);
    }
    expect(appStaticImports.filter(i => i.includes('SignedInApp') && !app.includes("import type { Tab } from './SignedInApp'"))).toEqual([]);
    expect(app).toMatch(/lazy\(loadSignedInApp\)/);
    expect(app).toMatch(/const loadSignedInApp = \(\) => import\('\.\/SignedInApp'\)/);
  });

  it('starts loading the shell next to the session lookup for a returning visitor, and only then', () => {
    expect(app).toMatch(/if \(accessStatus === 'loading'\) void loadSignedInApp\(\);/);
    // an anonymous visitor has no session marker, so AuthProvider starts them as no_auth and Landing renders at once
    const auth = readFileSync(join(ROOT, 'src/contexts/AuthContext.tsx'), 'utf8');
    expect(auth).toMatch(/localStorage\.getItem\(SESSION_FLAG\) \? 'loading' : 'no_auth'/);
  });

  it('keeps one Suspense boundary with the loading screen around the shell, where the two branches had theirs', () => {
    expect(app).toMatch(/<Suspense fallback=\{<AppLoading \/>\}>\s*<SignedInApp/);
  });
});
