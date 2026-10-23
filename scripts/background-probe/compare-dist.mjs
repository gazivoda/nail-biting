// usage: node scripts/background-probe/compare-dist.mjs <distA> <distB>
// Compares the JS/CSS chunks of two builds by their un-hashed names: sizes (raw, gzip), added and removed chunks.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [a, b] = process.argv.slice(2);
function chunks(dir) {
  const out = new Map();
  for (const f of readdirSync(join(dir, 'assets')).sort()) {
    if (!/\.(js|css)$/.test(f)) continue;
    const name = f.replace(/-[A-Za-z0-9_-]{8}\.(js|css)$/, '.$1');
    const buf = readFileSync(join(dir, 'assets', f));
    // two chunks can share an un-hashed name: keep both (numbered by size, biggest first)
    let key = name, n = 1;
    while (out.has(key)) key = `${name}#${++n}`;
    out.set(key, { raw: buf.length, gz: gzipSync(buf).length });
  }
  return out;
}
const A = chunks(a), B = chunks(b);
const rows = [];
let totalA = 0, totalB = 0, gzA = 0, gzB = 0;
for (const name of new Set([...A.keys(), ...B.keys()])) {
  const x = A.get(name), y = B.get(name);
  totalA += x?.raw ?? 0; totalB += y?.raw ?? 0; gzA += x?.gz ?? 0; gzB += y?.gz ?? 0;
  if (!x || !y || x.raw !== y.raw) rows.push({ chunk: name, before: x?.raw ?? '-', after: y?.raw ?? '-', delta: (y?.raw ?? 0) - (x?.raw ?? 0), gzDelta: (y?.gz ?? 0) - (x?.gz ?? 0) });
}
console.table(rows);
console.log(`total raw ${totalA} -> ${totalB} (${totalB - totalA >= 0 ? '+' : ''}${totalB - totalA}), gzip ${gzA} -> ${gzB} (${gzB - gzA >= 0 ? '+' : ''}${gzB - gzA})`);
