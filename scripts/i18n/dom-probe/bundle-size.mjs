// usage: node scripts/i18n/dom-probe/bundle-size.mjs <distMain> <distThis>
//
// "English users must not download the catalogs and the English-only bundle growth must stay small." Compares the JS and CSS
// chunks of two builds by chunk name (hash stripped): raw and gzip bytes, per chunk and in total, with the locale chunks
// (assets/locale-*.js) listed separately because only a person who picks that language ever fetches them. Also lists what the
// service worker precaches, to show the locale chunks are not in it.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [distMain, distThis] = process.argv.slice(2);

function sizes(dist) {
  const out = new Map();
  const dir = join(dist, 'assets');
  for (const f of readdirSync(dir)) {
    if (!/\.(js|css)$/.test(f)) continue;
    const buf = readFileSync(join(dir, f));
    const name = f.replace(/-[A-Za-z0-9_-]{8}(\.(js|css))$/, '$1');
    out.set(name, { raw: buf.length, gz: gzipSync(buf).length, file: f });
  }
  return out;
}
const precache = dist => {
  const sw = join(dist, 'sw.js');
  if (!existsSync(sw)) return [];
  return [...readFileSync(sw, 'utf8').matchAll(/assets\/([A-Za-z0-9_.-]+\.(?:js|css))/g)].map(m => m[1]);
};

const a = sizes(distMain);
const b = sizes(distThis);
const isLocale = n => /^locale-/.test(n);
const kb = n => (n / 1024).toFixed(2);

let rows = [];
for (const name of new Set([...a.keys(), ...b.keys()])) {
  const x = a.get(name), y = b.get(name);
  rows.push({ name, rawA: x?.raw ?? 0, rawB: y?.raw ?? 0, gzA: x?.gz ?? 0, gzB: y?.gz ?? 0 });
}
rows.sort((p, q) => (q.gzB - q.gzA) - (p.gzB - p.gzA));
console.log('chunk'.padEnd(34), 'raw main'.padStart(10), 'raw this'.padStart(10), 'gz main'.padStart(9), 'gz this'.padStart(9), 'gz diff'.padStart(9));
for (const r of rows) {
  if (r.rawA === r.rawB && r.gzA === r.gzB) continue;
  console.log(r.name.padEnd(34), kb(r.rawA).padStart(10), kb(r.rawB).padStart(10), kb(r.gzA).padStart(9), kb(r.gzB).padStart(9), ((r.gzB - r.gzA) / 1024).toFixed(2).padStart(9));
}
const sum = (pick, locale) => rows.filter(r => isLocale(r.name) === locale).reduce((n, r) => n + r[pick], 0);
console.log('\nEverything an English visitor can download (all chunks except locale-*):');
console.log(`  raw  main ${kb(sum('rawA', false))} KB   this ${kb(sum('rawB', false))} KB   diff ${kb(sum('rawB', false) - sum('rawA', false))} KB`);
console.log(`  gzip main ${kb(sum('gzA', false))} KB   this ${kb(sum('gzB', false))} KB   diff ${kb(sum('gzB', false) - sum('gzA', false))} KB`);
const entry = rows.find(r => r.name === 'index.js');
if (entry) console.log(`Main entry chunk (index.js, every page): gzip main ${kb(entry.gzA)} KB -> this ${kb(entry.gzB)} KB (diff ${kb(entry.gzB - entry.gzA)} KB), raw ${kb(entry.rawA)} -> ${kb(entry.rawB)} KB`);
console.log('\nLocale chunks (fetched only after a person picks that language):');
for (const r of rows.filter(r => isLocale(r.name))) console.log(' ', r.name.padEnd(20), `raw ${kb(r.rawB)} KB  gzip ${kb(r.gzB)} KB`);
const pre = precache(distThis);
console.log(`\nService worker precache of this build: ${pre.length} asset entries; locale chunks in it: ${pre.filter(f => /^locale-/.test(f)).length}`);
