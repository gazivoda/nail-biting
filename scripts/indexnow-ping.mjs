// Submit changed sitemap URLs to IndexNow (Bing/Copilot, Seznam, Naver, Yandex).
//
//   npm run seo:indexnow          submit only URLs whose <lastmod> moved
//   npm run seo:indexnow -- --all resubmit every URL in the sitemap
//   npm run seo:indexnow -- --dry-run   print what would be sent, send nothing
//
// Run AFTER a deploy, from a checkout (the runtime container carries neither
// scripts/ nor public/). Nothing invokes this automatically — see README of
// intent in package.json: it is a deliberate manual/CI step.
//
// IndexNow asks publishers not to resubmit URLs that have not changed, so the
// previous run's <lastmod> per URL is kept in a small state file and only the
// difference is sent. First run on a machine has no state and submits
// everything, which is correct — the endpoint has never seen these URLs from us.
//
// The key file public/<KEY>.txt must stay deployed at the site root.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KEY = '21f3175251594edf918c599f5bdee19f';
const HOST = 'stopbiting.today';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const submitAll = args.has('--all');
const dryRun = args.has('--dry-run');

// DATA_DIR is the persistent volume the server already uses; falling back to
// ./data keeps a plain `git clone && npm run seo:indexnow` working.
const stateDir = process.env.DATA_DIR ?? join(root, 'data');
const statePath = join(stateDir, 'indexnow-state.json');

const sitemap = readFileSync(join(root, 'public', 'sitemap.xml'), 'utf8');
// <loc> and <lastmod> are emitted as a pair per <url> by scripts/sync-seo.mjs.
const current = new Map(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map(m => [m[1], m[2]]),
);
if (current.size === 0) throw new Error('No <loc>/<lastmod> pairs found in public/sitemap.xml');

let previous = {};
if (!submitAll) {
  try {
    previous = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    console.log(`IndexNow: no previous state at ${statePath} — treating every URL as new.`);
  }
}

const urls = [...current].filter(([loc, lastmod]) => previous[loc] !== lastmod).map(([loc]) => loc);

if (urls.length === 0) {
  console.log(`IndexNow: nothing to submit — all ${current.size} URLs unchanged since the last run.`);
  process.exit(0);
}

console.log(`IndexNow: ${urls.length} of ${current.size} URLs changed${dryRun ? ' (dry run)' : ''}:`);
for (const u of urls.slice(0, 10)) console.log(`  ${u}`);
if (urls.length > 10) console.log(`  … and ${urls.length - 10} more`);
if (dryRun) process.exit(0);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow: submitted ${urls.length} URLs — HTTP ${res.status}`);
if (!res.ok && res.status !== 202) process.exit(1);

// Only record what the endpoint accepted, so a failed run retries the same set.
mkdirSync(stateDir, { recursive: true });
writeFileSync(statePath, `${JSON.stringify(Object.fromEntries(current), null, 2)}\n`);
