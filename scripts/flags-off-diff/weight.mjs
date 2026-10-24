// usage: node scripts/flags-off-diff/weight.mjs <domDir> <labelA>=<distA> <labelB>=<distB>
// What a visitor downloads, A against B, with every flag off: (1) the script, stylesheet and modulepreload files
// named in dist/index.html (the landing page's first load), (2) for each dom-snap capture, the JS/CSS the browser
// actually requested (from the snapshot's request log), raw and gzipped, plus the entry bundle on its own.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [domDir, ...specs] = process.argv.slice(2);
const sides = specs.map((s) => { const [label, ...r] = s.split('='); return { label, dist: r.join('=') }; });

const size = (dist, file) => { const b = readFileSync(join(dist, 'assets', file)); return { raw: b.length, gz: gzipSync(b).length }; };
const sum = (xs) => xs.reduce((a, x) => ({ raw: a.raw + x.raw, gz: a.gz + x.gz }), { raw: 0, gz: 0 });

for (const s of sides) {
  const html = readFileSync(join(s.dist, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  s.initial = refs;
  s.initialSize = sum(refs.map((f) => size(s.dist, f)));
  s.entry = size(s.dist, html.match(/<script[^>]+src="\/assets\/(index-[^"]+\.js)"/)[1]);
  s.dom = JSON.parse(readFileSync(join(domDir, `${s.label}.json`), 'utf8')).entries;
}
const [a, b] = sides;
const fmt = (x) => `${x.raw} raw / ${x.gz} gz`;
console.log(`landing page, files named in index.html: ${a.label} ${a.initial.length} files ${fmt(a.initialSize)}  ->  ${b.label} ${b.initial.length} files ${fmt(b.initialSize)}  (delta ${b.initialSize.raw - a.initialSize.raw} raw / ${b.initialSize.gz - a.initialSize.gz} gz)`);
console.log(`entry bundle alone:                       ${a.label} ${fmt(a.entry)}  ->  ${b.label} ${fmt(b.entry)}  (delta ${b.entry.raw - a.entry.raw} raw / ${b.entry.gz - a.entry.gz} gz)`);
console.log('\nJS/CSS requested by the browser per capture (own origin, /assets only):');
for (const name of Object.keys(a.dom)) {
  const get = (s) => {
    const reqs = s.dom[name]?.rawRequests.filter((r) => /^GET \/assets\/.+\.(js|css)$/.test(r)).map((r) => r.slice('GET /assets/'.length)) ?? [];
    const sizes = reqs.map((f) => size(s.dist, f));
    return { n: reqs.length, ...sum(sizes) };
  };
  const x = get(a), y = get(b);
  console.log(`${name.padEnd(46)} ${a.label} ${String(x.n).padStart(2)} files ${String(x.gz).padStart(7)} gz   ${b.label} ${String(y.n).padStart(2)} files ${String(y.gz).padStart(7)} gz   delta ${y.gz - x.gz >= 0 ? '+' : ''}${y.gz - x.gz} gz (${y.n - x.n >= 0 ? '+' : ''}${y.n - x.n} files)`);
}
