// What the home page must download and run before React can render, checked on the REAL build.
//
//   npm run build:web && npm test
//
// Every marketing page waits for the entry script and the files it imports statically. That was 180 KB gzipped (a
// vendor chunk that held recharts' dependencies, date-fns and the icons only the signed-in app draws, plus an entry
// that held the signed-in shell), 157 KB after lane H took recharts' dependencies out of vendor. It is now the entry and
// a `vendor` that is react-dom, react, scheduler and zustand. This pins that split so it cannot quietly grow back:
//   * the HTML names exactly one module script (the entry) and one modulepreload (vendor): a new chunk on that list
//     is a new request ahead of first paint and has to be a decision;
//   * nothing the signed-in app needs is in the static closure, and the lazy chunks that hold it exist;
//   * a size budget on the closure (gzip), with headroom over today's number, under the 157 KB it replaced.
// Skipped (not failed) when dist/ has not been built, so a bare `npm test` on a fresh checkout stays green.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const built = existsSync(join(DIST, 'index.html'));

// today: about 138 KB gzipped (entry + vendor, level 9); before this lane 157 KB (180 KB before lane H)
const BUDGET_GZIP_KB = 150;

const html = built ? readFileSync(join(DIST, 'index.html'), 'utf8') : '';
const assets = built ? readdirSync(join(DIST, 'assets')).filter(f => f.endsWith('.js')) : [];
const read = f => readFileSync(join(DIST, 'assets', f), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*type="module"[^>]*src="\/assets\/([^"]+)"/g)].map(m => m[1]);
const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="\/assets\/([^"]+)"/g)].map(m => m[1]);

// rollup writes static imports as `import{..}from"./x.js"` or `import"./x.js"`; a dynamic import("./x.js") is not matched
function staticImports(file) {
  const out = new Set();
  for (const m of read(file).matchAll(/(?:^|[;}\n])\s*(?:import|export)\s*(?:[^'"()]*?\bfrom\s*)?["']\.\/([^"']+\.js)["']/g)) out.add(m[1]);
  return [...out];
}
function closureOf(files) {
  const seen = new Set();
  const walk = f => { if (seen.has(f)) return; seen.add(f); staticImports(f).forEach(walk); };
  files.forEach(walk);
  return [...seen];
}
const named = prefix => assets.filter(f => f.startsWith(`${prefix}-`));

describe.skipIf(!built)('the JavaScript the home page waits for', () => {
  const closure = closureOf([...scripts, ...preloads]);

  it('is one entry script and one modulepreload, and the preload is vendor', () => {
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatch(/^index-[\w-]{8}\.js$/);
    expect(preloads).toHaveLength(1);
    expect(preloads[0]).toMatch(/^vendor-[\w-]{8}\.js$/);
  });

  it('statically imports nothing but the entry and vendor', () => {
    expect(closure.map(f => f.replace(/-[\w-]{8}\.js$/, '')).sort()).toEqual(['index', 'vendor']);
  });

  it('keeps the signed-in app and the libraries only it uses out of it, in chunks of their own', () => {
    for (const lazy of ['SignedInApp', 'charts', 'vendor-app', 'paddle', 'mediapipe']) {
      const files = named(lazy);
      expect(files.length, `a ${lazy}-*.js chunk exists`).toBeGreaterThan(0);
      for (const f of files) expect(closure, `${f} is not on the home page's critical path`).not.toContain(f);
    }
  });

  it('has none of the signed-in shell in its text', () => {
    const text = closure.map(read).join('\n');
    expect(text).not.toContain('history-tab');      // the tab bar (TabBar.tsx)
    expect(text).not.toContain('tour-title');       // the first-run tour (OnboardingTour.tsx)
    // ...and they are where they should be
    expect(named('SignedInApp').map(read).join('\n')).toContain('history-tab');
  });

  it(`stays under ${BUDGET_GZIP_KB} KB gzipped`, () => {
    const gz = closure.reduce((sum, f) => sum + gzipSync(readFileSync(join(DIST, 'assets', f)), { level: 9 }).length, 0);
    expect(gz / 1024).toBeLessThan(BUDGET_GZIP_KB);
  });
});
