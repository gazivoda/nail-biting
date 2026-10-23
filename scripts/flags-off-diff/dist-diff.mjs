// usage: node scripts/flags-off-diff/dist-diff.mjs <label=distDir> <label=distDir> [...] [--json out.json] [--max 6]
//
// File-level diff of built dist/ folders, hash-normalised (see lib.mjs). For every PAIR of labels it lists the
// files that are identical, changed (with a short line diff for text files), added or removed. The first label
// is the reference; every other label is compared to it, and so is every pair named with --pair a,b.
//   node dist-diff.mjs A=/x/prod-ffbf29a/dist B=dist S=/x/prod-46a484c/dist M=/x/merged/dist --pair S,M --json out.json
//
// JS/CSS chunks are paired by their un-hashed name; where several chunks share a name (actions.js x3) identical
// contents are paired first and the rest by size, so a renamed hash never shows up as "added + removed".
import { writeFileSync } from 'node:fs';
import { aliasNorm, lineDiff, readNorm, renameNorm, unhash, walk } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const jsonOut = opt('--json', null);
const max = Number(opt('--max', 6));
const pairArgs = [];
for (let i; (i = args.indexOf('--pair')) >= 0;) { pairArgs.push(args[i + 1].split(',')); args.splice(i, 2); }
const trees = Object.fromEntries(args.map((a) => { const [label, ...rest] = a.split('='); return [label, rest.join('=')]; }));
const labels = Object.keys(trees);

function index(root) {
  const byKey = new Map();
  for (const path of walk(root)) {
    const key = unhash(path);
    const f = { path, ...readNorm(root, path) };
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(f);
  }
  return byKey;
}
const idx = Object.fromEntries(labels.map((l) => [l, index(trees[l])]));

// A minified stylesheet as a list of top-level rules; what a build ADDED or REMOVED, and whether the rules both
// have kept their relative order (the cascade is order-sensitive).
function cssRules(text) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) { out.push(text.slice(start, i + 1)); start = i + 1; }
  }
  return out;
}
function cssRuleDiff(a, b) {
  const ra = cssRules(a), rb = cssRules(b), sa = new Set(ra), sb = new Set(rb);
  const common = ra.filter((r) => sb.has(r)), commonB = rb.filter((r) => sa.has(r));
  return {
    removed: ra.filter((r) => !sb.has(r)).map((r) => r.slice(0, 160)),
    added: rb.filter((r) => !sa.has(r)).map((r) => r.slice(0, 160)),
    sameOrder: JSON.stringify(common) === JSON.stringify(commonB),
  };
}

function pairUp(xs = [], ys = []) {
  const pairs = [];
  const restX = [...xs], restY = [...ys];
  for (let i = restX.length - 1; i >= 0; i--) {   // identical contents first
    const j = restY.findIndex((y) => y.hash === restX[i].hash);
    if (j >= 0) { pairs.push([restX[i], restY[j]]); restX.splice(i, 1); restY.splice(j, 1); }
  }
  restX.sort((a, b) => a.size - b.size); restY.sort((a, b) => a.size - b.size);
  while (restX.length && restY.length) pairs.push([restX.shift(), restY.shift()]);
  for (const x of restX) pairs.push([x, null]);
  for (const y of restY) pairs.push([null, y]);
  return pairs;
}

export function comparePair(a, b) {
  const rows = [];
  for (const key of [...new Set([...idx[a].keys(), ...idx[b].keys()])].sort()) {
    const ps = pairUp(idx[a].get(key), idx[b].get(key));
    ps.forEach(([x, y], n) => {
      const name = ps.length > 1 ? `${key}#${n + 1}` : key;
      if (x && !y) return rows.push({ key: name, status: 'removed', size: [x.size, null], path: [x.path, null] });
      if (!x && y) return rows.push({ key: name, status: 'added', size: [null, y.size], path: [null, y.path] });
      if (x.hash === y.hash) return rows.push({ key: name, status: 'same', size: [x.size, y.size], path: [x.path, y.path] });
      const row = { key: name, status: 'changed', size: [x.size, y.size], path: [x.path, y.path] };
      if (x.text != null && y.text != null && !/^assets\/.*\.(js|css)$/.test(key)) row.diff = lineDiff(x.text, y.text, max);
      // a minified chunk that differs only in the names its imports/exports are given is the same code
      if (x.text != null && y.text != null && /^assets\/.*\.css$/.test(key)) row.cssRules = cssRuleDiff(x.text, y.text);
      if (x.text != null && y.text != null && /^assets\/.*\.js$/.test(key)) {
        if (aliasNorm(x.text) === aliasNorm(y.text)) row.status = 'alias-only';
        else if (renameNorm(x.text) === renameNorm(y.text)) row.status = 'rename-only';
        else {   // the smallest differing middle, after the minifier's names are made canonical
          const p = renameNorm(x.text), q = renameNorm(y.text);
          let i = 0; while (i < p.length && p[i] === q[i]) i++;
          let j = 0; while (j < p.length - i && j < q.length - i && p[p.length - 1 - j] === q[q.length - 1 - j]) j++;
          row.middle = { a: p.slice(i, p.length - j).slice(0, 400), b: q.slice(i, q.length - j).slice(0, 400) };
        }
      }
      rows.push(row);
    });
  }
  return rows;
}

const pairs = [];
for (const l of labels.slice(1)) pairs.push([labels[0], l]);
for (const p of pairArgs) pairs.push(p);
const report = {};
for (const [a, b] of pairs) {
  const rows = comparePair(a, b);
  const count = (s) => rows.filter((r) => r.status === s).length;
  report[`${a}->${b}`] = rows;
  console.log(`\n=== ${a} (${trees[a]}) -> ${b} (${trees[b]}) ===`);
  console.log(`files: ${rows.length}  same ${count('same')}  alias-only ${count('alias-only')}  rename-only ${count('rename-only')}  changed ${count('changed')}  added ${count('added')}  removed ${count('removed')}`);
  for (const r of rows.filter((x) => x.status !== 'same')) {
    const d = r.size[1] == null || r.size[0] == null ? '' : ` (${r.size[1] - r.size[0] >= 0 ? '+' : ''}${r.size[1] - r.size[0]} B)`;
    console.log(`${r.status.toUpperCase().padEnd(8)} ${r.key}${d}`);
    if (r.cssRules) console.log(`           css rules: -${r.cssRules.removed.length} +${r.cssRules.added.length}, shared rules keep their order: ${r.cssRules.sameOrder}`);
    if (r.middle && process.env.MIDDLE) console.log(`           A: ${r.middle.a}\n           B: ${r.middle.b}`);
    if (r.diff) {
      console.log(`           lines -${r.diff.removed} +${r.diff.added}`);
      for (const l of r.diff.removedSample) console.log(`           - ${l}`);
      for (const l of r.diff.addedSample) console.log(`           + ${l}`);
    }
  }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
