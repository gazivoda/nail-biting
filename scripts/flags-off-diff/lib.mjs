// Shared helpers for the flags-off sameness check (WS13). Node ESM, no dependencies.
//
// "Normalising hashes": Vite writes content hashes into asset names (`Settings-MxW8e8kW.js`) and into every
// file that refers to them (index.html, sw.js, the JS chunks themselves). Two builds of IDENTICAL source can
// still differ in those hashes when anything upstream of a chunk changed, so before two files are compared
// every `name-<8 chars>.<ext>` reference is rewritten to `name.<ext>` (and the workbox runtime file, which is
// named after a hash of its own content, to `workbox-X.js`).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ASSET_HASH = /-[A-Za-z0-9_-]{8}(\.(?:js|css|map|woff2?|png|svg|webp|jpg|wasm|json))/g;
export const WORKBOX = /workbox-[0-9a-f]{8}\.js/g;

/** Rewrites content-hashed asset names to their unhashed form. */
export function normHashes(text) {
  return text.replace(ASSET_HASH, '$1').replace(WORKBOX, 'workbox-X.js')
    // build timestamps: seo-content.json / seo-gated.json carry the moment they were written
    .replace(/"generatedAt":"[^"]*"/g, '"generatedAt":"T"');
}

/**
 * For minified ES-module chunks: drops the EXPORT names out of `import{n as x,...}from"..."` and `export{x as n,...}`.
 * The minifier names a chunk's exports by rank, so a chunk that merely imports from an entry that gained exports
 * is rewritten (`ad` becomes `aq`) with no change in what it does. Two chunks equal under this are the same code.
 */
export function aliasNorm(text) {
  return text
    .replace(/import\{([^}]*)\}from"/g, (_m, body) => `import{${body.split(',').map((s) => s.replace(/^.*\sas\s/, '')).join(',')}}from"`)
    .replace(/export\{([^}]*)\}/g, (_m, body) => `export{${body.split(',').map((s) => s.replace(/\sas\s.*$/, '')).join(',')}}`);
}

/**
 * Looser still: also renames the 1-2 character identifiers (the minifier's names) by order of first appearance, so
 * code that differs only in WHICH short name the minifier picked compares equal. Longer words (property names,
 * strings, keywords) are kept, so any change of text, number or structure still shows. Only used to label a chunk
 * "rename-only"; a chunk that is not even rename-only is real code.
 */
export function renameNorm(text) {
  const ids = new Map();
  return aliasNorm(text).replace(/(?<![\w$])[A-Za-z_$][\w$]?(?![\w$])/g, (name) => {
    if (/^(if|in|of|do|as|is)$/.test(name)) return name;
    if (!ids.has(name)) ids.set(name, `v${ids.size}`);
    return ids.get(name);
  });
}

export const sha = (buf) => createHash('sha256').update(buf).digest('hex');

export function walk(dir) {
  const out = [];
  (function rec(d) {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) rec(p); else out.push(relative(dir, p));
    }
  })(dir);
  return out;
}

export const TEXT_EXT = /\.(html|json|txt|xml|webmanifest|js|css|svg|map|md|mjs)$/;
export const isText = (path) => TEXT_EXT.test(path);

/** Reads a file; text files come back hash-normalised, binary files as-is. */
export function readNorm(root, path) {
  const buf = readFileSync(join(root, path));
  if (!isText(path)) return { text: null, hash: sha(buf), size: buf.length };
  const text = normHashes(buf.toString('utf8'));
  return { text, hash: sha(text), size: buf.length };
}

/** Unhashed name of an asset (`assets/Settings-MxW8e8kW.js` -> `assets/Settings.js`). */
export const unhash = (path) => path.replace(ASSET_HASH, '$1').replace(WORKBOX, 'workbox-X.js');

const cut = (s) => (s.length > 240 ? s.slice(0, 240) + `... (+${s.length - 240} chars)` : s);

/** A short line-level diff: how many lines exist on one side only, and the first few of each. */
export function lineDiff(a, b, max = 6) {
  const A = a.split('\n'), B = b.split('\n');
  const setA = new Set(A), setB = new Set(B);
  const removed = A.filter((l) => !setB.has(l)), added = B.filter((l) => !setA.has(l));
  return {
    removed: removed.length, added: added.length,
    removedSample: removed.slice(0, max).map(cut), addedSample: added.slice(0, max).map(cut),
  };
}
