// usage: node scripts/i18n/dom-probe/bundle-size.mjs <distMain> <distThis>
//
// "English users must not download the catalogs and the English-only bundle growth must stay small." Compares two builds:
//   * per chunk (hash stripped), raw and gzip bytes, only the chunks that changed;
//   * what a visitor actually downloads for a page: the closure of chunks reachable from a root (static and dynamic
//     imports), for the home page entry, the home-page demo, and each signed-in screen, in raw and gzip bytes;
//   * the locale chunks (assets/locale-*.js), which only a person who picks that language ever fetches, and whether the
//     service worker precaches any of them (it must not).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [distMain, distThis] = process.argv.slice(2);
const kb = n => (n / 1024).toFixed(2);

function load(dist) {
  const dir = join(dist, 'assets');
  const chunks = new Map(); // file -> { raw, gz, refs:Set<file> }
  for (const f of readdirSync(dir)) {
    if (!/\.(js|css)$/.test(f)) continue;
    const buf = readFileSync(join(dir, f));
    chunks.set(f, { raw: buf.length, gz: gzipSync(buf).length, text: f.endsWith('.js') ? buf.toString('utf8') : '' });
  }
  for (const [f, c] of chunks) {
    c.refs = new Set();
    for (const m of c.text.matchAll(/["'`](?:\.\/|\/assets\/|assets\/)?([A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.(?:js|css))["'`]/g)) if (chunks.has(m[1]) && m[1] !== f) c.refs.add(m[1]);
  }
  const base = f => f.replace(/-[A-Za-z0-9_-]{8}(\.(?:js|css))$/, '$1');
  const byName = new Map();
  for (const f of chunks.keys()) { const n = base(f); byName.set(n, [...(byName.get(n) ?? []), f]); }
  const html = existsSync(join(dist, 'index.html')) ? readFileSync(join(dist, 'index.html'), 'utf8') : '';
  const entryFiles = [...html.matchAll(/assets\/([A-Za-z0-9_.-]+\.(?:js|css))/g)].map(m => m[1]).filter(f => chunks.has(f));
  return { chunks, base, byName, entryFiles, dist };
}

function closure(b, roots, { dynamic = true } = {}) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !b.chunks.has(f) || /^locale-/.test(f)) continue; // a person who picked a language fetches those; not part of any page's English download
    seen.add(f);
    const c = b.chunks.get(f);
    if (!dynamic) {
      // static imports only: `import ... from "./x.js"` and `import "./x.js"` forms, plus css
      const statics = new Set([...c.text.matchAll(/(?:from|import)\s*["'](?:\.\/)?([A-Za-z0-9_.-]+\.js)["']/g)].map(m => m[1]));
      for (const r of c.refs) if (statics.has(r) || r.endsWith('.css')) stack.push(r);
    } else {
      for (const r of c.refs) stack.push(r);
    }
  }
  const files = [...seen];
  return { files, raw: files.reduce((n, f) => n + b.chunks.get(f).raw, 0), gz: files.reduce((n, f) => n + b.chunks.get(f).gz, 0) };
}

const A = load(distMain);
const B = load(distThis);
const isLocale = f => /^locale-/.test(f);

// per-chunk table
const names = new Set([...A.byName.keys(), ...B.byName.keys()]);
const rows = [];
for (const n of names) {
  const sum = (b, pick) => (b.byName.get(n) ?? []).reduce((s, f) => s + b.chunks.get(f)[pick], 0);
  rows.push({ n, rawA: sum(A, 'raw'), rawB: sum(B, 'raw'), gzA: sum(A, 'gz'), gzB: sum(B, 'gz') });
}
rows.sort((p, q) => (q.gzB - q.gzA) - (p.gzB - p.gzA));
console.log('chunk'.padEnd(30), 'raw main'.padStart(10), 'raw this'.padStart(10), 'gz main'.padStart(9), 'gz this'.padStart(9), 'gz diff'.padStart(9));
for (const r of rows) {
  if (Math.abs(r.gzB - r.gzA) < 200 && !isLocale(r.n)) continue;
  console.log(r.n.padEnd(30), kb(r.rawA).padStart(10), kb(r.rawB).padStart(10), kb(r.gzA).padStart(9), kb(r.gzB).padStart(9), ((r.gzB - r.gzA) / 1024).toFixed(2).padStart(9));
}

// what a visitor downloads, by page
const pick = (b, name) => (b.byName.get(name) ?? []);
const PAGES = [
  ['home page, first load (entry + what index.html preloads)', b => closure(b, b.entryFiles, { dynamic: false })],
  ['home page + the live demo (HeroDemo, all it needs)', b => closure(b, [...b.entryFiles, ...pick(b, 'HeroDemo.js')], { dynamic: false })],
  ['signed-in: Watch (Dashboard)', b => closure(b, [...b.entryFiles, ...pick(b, 'Dashboard.js')])],
  ['signed-in: History (Log)', b => closure(b, [...b.entryFiles, ...pick(b, 'Log.js')], { dynamic: false })],
  ['signed-in: Settings', b => closure(b, [...b.entryFiles, ...pick(b, 'Settings.js')], { dynamic: false })],
  ['paywall', b => closure(b, [...b.entryFiles, ...pick(b, 'PaywallPage.js')], { dynamic: false })],
  ['sign-in page', b => closure(b, [...b.entryFiles, ...pick(b, 'SignIn.js')], { dynamic: false })],
];
console.log('\nDownload by page (JS+CSS closure, gzip KB; static imports unless noted):');
console.log('page'.padEnd(62), 'main'.padStart(8), 'this'.padStart(8), 'diff'.padStart(7), ' raw diff');
for (const [label, fn] of PAGES) {
  const a = fn(A), b = fn(B);
  console.log(label.padEnd(62), kb(a.gz).padStart(8), kb(b.gz).padStart(8), ((b.gz - a.gz) / 1024).toFixed(2).padStart(7), ' ', kb(b.raw - a.raw));
}
const entryA = closure(A, A.entryFiles, { dynamic: false }), entryB = closure(B, B.entryFiles, { dynamic: false });
console.log(`\nEntry files: main ${A.entryFiles.join(', ')} | this ${B.entryFiles.join(', ')}`);
console.log(`Entry closure gzip: ${kb(entryA.gz)} -> ${kb(entryB.gz)} KB`);

// totals
const tot = (b, pickKey) => [...b.chunks.entries()].filter(([f]) => !isLocale(f)).reduce((n, [, c]) => n + c[pickKey], 0);
console.log(`\nAll chunks except locale-* (everything an English visitor could ever download): raw ${kb(tot(A, 'raw'))} -> ${kb(tot(B, 'raw'))} KB, gzip ${kb(tot(A, 'gz'))} -> ${kb(tot(B, 'gz'))} KB (diff ${kb(tot(B, 'gz') - tot(A, 'gz'))} KB gzip)`);
console.log('\nLocale chunks (fetched only after a person picks that language):');
for (const [f, c] of B.chunks) if (isLocale(f)) console.log(' ', f.padEnd(26), `raw ${kb(c.raw)} KB  gzip ${kb(c.gz)} KB`);
const sw = join(distThis, 'sw.js');
if (existsSync(sw)) {
  const pre = [...readFileSync(sw, 'utf8').matchAll(/assets\/([A-Za-z0-9_.-]+\.(?:js|css))/g)].map(m => m[1]);
  console.log(`\nService worker precache of this build: ${pre.length} asset entries; locale chunks in it: ${pre.filter(f => /^locale-/.test(f)).length}`);
  // A chunk that only a language catalog imports is translated text too, whatever Rollup named it (WS12b: a shared chunk was
  // once named reviewed-*.js and was precached for every English visitor). Flag any precached chunk reachable only that way.
  // The entry's `__vite__mapDeps` list names every file a dynamic import may preload, so it is taken out before looking for who imports whom.
  const withoutDepList = t => t.replace(/__vite__mapDeps=\(i,m=__vite__mapDeps,d=\(m\.f\|\|\(m\.f=\[[^\]]*\]\)\)\)=>i\.map\(i=>d\[i\]\)/g, '');
  const referrers = new Map();
  for (const [f, c] of B.chunks) {
    for (const m of withoutDepList(c.text).matchAll(/["'`](?:\.\/|\/assets\/|assets\/)?([A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.(?:js|css))["'`]/g)) {
      if (B.chunks.has(m[1]) && m[1] !== f) referrers.set(m[1], [...new Set([...(referrers.get(m[1]) ?? []), f])]);
    }
  }
  const viaCatalogOnly = [...new Set(pre)].filter(f => !/^locale-/.test(f) && (referrers.get(f) ?? []).length > 0 && (referrers.get(f) ?? []).every(r => /^locale-/.test(r)));
  console.log(`precached chunks imported only by a language catalog: ${viaCatalogOnly.length}${viaCatalogOnly.length ? ' (' + viaCatalogOnly.join(', ') + ') <- these must be pinned to a locale-* chunk in vite.config.ts' : ''}`);
}
