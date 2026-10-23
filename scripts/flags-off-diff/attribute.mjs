// usage: node scripts/flags-off-diff/attribute.mjs <snapDir> [--json out.json]
// Four snapshots from snapshot-all.mjs say WHO changed each URL:
//   A = the swarm's last push (ffbf29a)      S = what is live (A + the SEO session, 46a484c)
//   B = this tree (A + the rest of the swarm) M = B merged with S (what the next push would produce)
// A URL's "fingerprint" is its status + headers + normalised body. Then
//   A=S=B=M                      identical
//   A=S, B=M, A!=B               swarm only          (this tree changed it)
//   A=B, S=M, A!=S               SEO session only    (the tree behind origin/main lacks it)
//   all four differ in some way  both touched it     (merge result M is checked against "S + swarm change")
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha } from './lib.mjs';

const args = process.argv.slice(2);
const ji = args.indexOf('--json');
const jsonOut = ji >= 0 ? args.splice(ji, 2)[1] : null;
const [dir] = args;
const load = (l) => JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8'));
const snaps = Object.fromEntries(['A', 'S', 'B', 'M'].map((l) => [l, load(l)]));
const key = (r) => `${r.method} ${r.path}${r.how === 'auth' ? ' [signed in]' : ''}`;
const fp = (r) => (r ? sha(JSON.stringify([r.status, r.headers, r.bodyHash])) : 'absent');
const table = {};
for (const [l, s] of Object.entries(snaps)) for (const r of s.rows) (table[key(r)] ??= {})[l] = fp(r);

const out = { identical: [], 'swarm-only': [], 'seo-only': [], both: [], other: [] };
for (const [url, f] of Object.entries(table)) {
  if (f.A === f.S && f.S === f.B && f.B === f.M) out.identical.push(url);
  else if (f.A === f.S && f.B === f.M) out['swarm-only'].push(url);
  else if (f.A === f.B && f.S === f.M) out['seo-only'].push(url);
  else if (f.A !== f.S && f.A !== f.B) out.both.push(url);
  else out.other.push(url);
}
for (const [cls, urls] of Object.entries(out)) {
  console.log(`\n${cls}: ${urls.length}`);
  if (cls !== 'identical') for (const u of urls) console.log('  ' + u);
}
// For the URLs both sessions touched: do the two edits commute? On text pages that means the merged page M has
// exactly the lines of S, minus the lines the swarm removed (A -> B) and plus the lines the swarm added.
const row = (l, url) => snaps[l].rows.find((r) => key(r) === url);
const lines = (l, url) => { const r = row(l, url); return r?.file ? readFileSync(join(dir, r.file), 'utf8').split('\n') : null; };
const count = (xs) => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return m; };
console.log('\nDo the swarm edit and the SEO edit commute? (M == S - (A->B removed) + (A->B added), headers: A==B and S==M)');
out.commute = {};
for (const url of out.both) {
  const [a, s, b, m] = ['A', 'S', 'B', 'M'].map((l) => lines(l, url));
  if (!a || !s || !b || !m) { console.log(`  ${url}: not a text page (checked in the dist diff instead)`); continue; }
  const ca = count(a), cb = count(b), cs = count(s), cm = count(m);
  const expected = new Map(cs);
  for (const k of new Set([...ca.keys(), ...cb.keys()])) expected.set(k, (expected.get(k) ?? 0) + (cb.get(k) ?? 0) - (ca.get(k) ?? 0));
  const bad = [...new Set([...expected.keys(), ...cm.keys()])].filter((k) => (expected.get(k) ?? 0) !== (cm.get(k) ?? 0));
  const hdr = (l) => JSON.stringify(row(l, url).headers);
  const ok = bad.length === 0 && hdr('A') === hdr('B') && hdr('S') === hdr('M') && row('A', url).status === row('B', url).status && row('S', url).status === row('M', url).status;
  out.commute[url] = ok;
  console.log(`  ${ok ? 'ok ' : 'NOT'} ${url}${ok ? '' : `  (${bad.length} lines disagree)`}`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 1));
