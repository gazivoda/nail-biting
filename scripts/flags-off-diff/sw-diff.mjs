// usage: node scripts/flags-off-diff/sw-diff.mjs <swA.js> <swB.js>
// Splits two generated service workers into (1) the precache list and (2) everything else (routes, strategies,
// handlers) and shows what differs in each, hash-normalised. A precache entry's `revision` is the md5 of the
// file, so "rev=hash" only says "has a revision": a changed file shows up in dist-diff, not here.
import { readFileSync } from 'node:fs';
import { normHashes } from './lib.mjs';

const [a, b] = process.argv.slice(2);
const ENTRY = /\{url:"([^"]+)",revision:(null|"[^"]*")\}/g;
const parse = (path) => {
  const text = normHashes(readFileSync(path, 'utf8'));
  const entries = [...text.matchAll(ENTRY)].map((m) => `${m[1]} rev=${m[2] === 'null' ? 'null' : 'md5'}`);
  const rest = text.replace(/\{url:"[^"]+",revision:(null|"[^"]*")\},?/g, '');
  return { entries, rest };
};
const A = parse(a), B = parse(b);
const setA = new Set(A.entries), setB = new Set(B.entries);
console.log(`precache entries: ${A.entries.length} -> ${B.entries.length}`);
console.log('only in A:', A.entries.filter((e) => !setB.has(e)));
console.log('only in B:', B.entries.filter((e) => !setA.has(e)));
console.log('everything else equal:', A.rest === B.rest, `(${A.rest.length} vs ${B.rest.length} chars)`);
if (A.rest !== B.rest) {
  let i = 0;
  while (A.rest[i] === B.rest[i]) i++;
  console.log('first difference at', i);
  console.log('A:', A.rest.slice(Math.max(0, i - 150), i + 350));
  console.log('B:', B.rest.slice(Math.max(0, i - 150), i + 700));
}
