// usage: node scripts/flags-off-diff/http-diff.mjs <snapDir> <labelA> <labelB> [--json out.json] [--max 5]
// Compares two http-snapshot.mjs results URL by URL: status, every header (minus the run-to-run ones), and the
// hash-normalised body. Prints only the URLs that differ, with a line diff of the body; the last line is the count.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lineDiff } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const jsonOut = opt('--json', null);
const max = Number(opt('--max', 5));
const [dir, la, lb] = args;
const load = (l) => JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8'));
const A = load(la), B = load(lb);
const key = (r) => `${r.method} ${r.path}${r.how === 'auth' ? ' [signed in]' : ''}`;
const byKey = (S) => new Map(S.rows.map((r) => [key(r), r]));
const ma = byKey(A), mb = byKey(B);
const body = (S, r) => (r.file ? readFileSync(join(dir, r.file), 'utf8') : null);

const out = [];
let same = 0;
for (const k of new Set([...ma.keys(), ...mb.keys()])) {
  const a = ma.get(k), b = mb.get(k);
  if (!a || !b) { out.push({ url: k, only: a ? la : lb }); continue; }
  const d = { url: k, status: a.status === b.status ? null : [a.status, b.status], headers: [], body: null };
  for (const h of new Set([...Object.keys(a.headers), ...Object.keys(b.headers)])) {
    if (a.headers[h] !== b.headers[h]) d.headers.push({ name: h, a: a.headers[h] ?? null, b: b.headers[h] ?? null });
  }
  if (a.bodyHash !== b.bodyHash) {
    d.body = { lengths: [a.bodyLength, b.bodyLength] };
    if (a.textual && b.textual && a.file && b.file) d.body.diff = lineDiff(body(A, a), body(B, b), max);
  }
  if (d.status || d.headers.length || d.body) out.push(d); else same++;
}
const cut = (s, n = 200) => (s && s.length > n ? s.slice(0, n) + '...' : s);
console.log(`${la} vs ${lb}: ${same} of ${same + out.length} URLs identical (status, headers, body)`);
for (const d of out) {
  if (d.only) { console.log(`\nONLY IN ${d.only}: ${d.url}`); continue; }
  console.log(`\nDIFFERS ${d.url}`);
  if (d.status) console.log(`  status ${d.status[0]} -> ${d.status[1]}`);
  for (const h of d.headers) console.log(`  header ${h.name}:\n    ${la}: ${cut(h.a)}\n    ${lb}: ${cut(h.b)}`);
  if (d.body) {
    console.log(`  body length ${d.body.lengths[0]} -> ${d.body.lengths[1]}${d.body.diff ? `  (lines -${d.body.diff.removed} +${d.body.diff.added})` : ''}`);
    for (const l of d.body.diff?.removedSample ?? []) console.log(`    - ${cut(l)}`);
    for (const l of d.body.diff?.addedSample ?? []) console.log(`    + ${cut(l)}`);
  }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ a: la, b: lb, same, differing: out }, null, 1));
