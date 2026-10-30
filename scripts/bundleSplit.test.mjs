// What a first visit downloads before anything runs, and what it must not.
//
//   npm run build:web && npm test
//
// Reads the REAL build (dist/index.html and the chunks it names). Skipped (not failed) when dist/ has not been built.
//
// What it pins (lane H, 2026-10-30; Lighthouse 13.6, mobile, throttled in Chrome: 3.49 s to 2.77 s LCP on a post):
//   · the files every page loads up front (the entry script, the modulepreloads, and what those import statically) do not
//     include the chart, checkout or camera chunks: recharts' own dependencies (redux toolkit, immer, reselect,
//     decimal.js-light, es-toolkit ...) used to match no manualChunks rule and ride in `vendor`, 26 KB gzipped of code that
//     only the signed-in app runs, on every marketing page and every post;
//   · the post page is not a lazy route. As one it cost a second request after the entry bundle had run and then React's
//     300 ms Suspense reveal throttle, before the first line of the article could paint. Its chunk was 10 KB since the
//     articles moved to /posts/<slug>.json, so there is nothing left to defer. If a BlogPost-*.js chunk comes back, the
//     route is lazy again.

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const built = existsSync(join(DIST, 'index.html')) && existsSync(join(DIST, 'assets'));

/** Static imports of a minified ES module: `from"./x.js"` and bare `import"./x.js"`. Dynamic import() is not followed. */
const staticImports = (code) => [...code.matchAll(/(?:\bfrom|\bimport)\s*"\.\/([A-Za-z0-9_.-]+\.js)"/g)].map(m => m[1]);

/** The files loaded before the first render: scripts and modulepreloads of index.html, plus everything they import statically. */
function firstLoad() {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const queue = [...html.matchAll(/<(?:script\b[^>]*\bsrc|link\b[^>]*\brel="modulepreload"[^>]*\bhref)="\/assets\/([^"]+\.js)"/g)].map(m => m[1]);
  const seen = new Set();
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(join(DIST, 'assets', file))) continue;
    seen.add(file);
    queue.push(...staticImports(readFileSync(join(DIST, 'assets', file), 'utf8')));
  }
  return [...seen];
}

describe('staticImports', () => {
  it('follows import-from and bare import, not import()', () => {
    const code = 'import{a as b}from"./vendor-Abc12345.js";import"./side-Zzz99999.js";const x=()=>import("./lazy-Qqq00000.js");';
    expect(staticImports(code)).toEqual(['vendor-Abc12345.js', 'side-Zzz99999.js']);
  });
});

describe.skipIf(!built)('first-load JavaScript', () => {
  const files = built ? firstLoad() : [];
  const names = files.map(f => f.replace(/-[A-Za-z0-9_-]{8}\.js$/, ''));

  it('is the entry and vendor, and only those', () => {
    expect(names.sort()).toEqual(expect.arrayContaining(['index', 'vendor']));
    expect(names.filter(n => !['index', 'vendor'].includes(n)), `loaded up front: ${files.join(', ')}`).toEqual([]);
  });

  it.each(['charts', 'paddle', 'mediapipe'])('does not include the %s chunk', (chunk) => {
    expect(names).not.toContain(chunk);
  });

  it('keeps recharts\' dependencies out of vendor (they sit in the charts chunk, which only lazy routes import)', () => {
    const assets = readdirSync(join(DIST, 'assets'));
    const charts = assets.find(f => /^charts-.*\.js$/.test(f));
    const vendor = assets.find(f => /^vendor-.*\.js$/.test(f));
    expect(charts).toBeTruthy();
    const vendorCode = readFileSync(join(DIST, 'assets', vendor), 'utf8');
    const chartsCode = readFileSync(join(DIST, 'assets', charts), 'utf8');
    // Strings that survive minification: redux toolkit's error prefix and decimal.js-light's error class.
    for (const marker of ['Minified Redux error', 'DecimalError']) {
      expect(chartsCode, `${marker} should be in charts`).toContain(marker);
      expect(vendorCode, `${marker} is back in vendor`).not.toContain(marker);
    }
    expect(staticImports(vendorCode), 'vendor must not import charts').not.toContain(charts);
  });
});

describe.skipIf(!built)('the post route', () => {
  it('has no chunk of its own: it is part of the entry, so a post paints without a second download', () => {
    expect(readdirSync(join(DIST, 'assets')).filter(f => /^BlogPost-/.test(f))).toEqual([]);
  });
});
