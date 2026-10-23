// usage: node scripts/flags-off-diff/http-snapshot.mjs <label> <checkoutRoot> <port> <outDir> [flags]
//
// Boots the REAL server.js of <checkoutRoot> (its own server/, shared/ and built dist/, FEATURE_FLAGS empty unless
// you pass flags) and fetches every URL in URLS: status, headers, hash-normalised body. Writes
// <outDir>/<label>.json (the table) and <outDir>/<label>/<n>.txt (the bodies, for diffing).
// Compare two snapshots with http-diff.mjs. Needs a built dist/ in <checkoutRoot> (npm run build:web).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normHashes, sha, unhash } from './lib.mjs';
import { startRigFrom } from './rig.mjs';

const [label, root, portArg, outDir, flags = ''] = process.argv.slice(2);
const port = Number(portArg);

const BLOG = 'how-to-stop-nail-biting';
// [method, path, how] how: 'anon' | 'auth' (minted session cookie) | 'body' (POST with a JSON body, anonymous)
export const URLS = [
  // marketing pages
  ['GET', '/'], ['GET', '/how-it-works'], ['GET', '/pricing'], ['GET', '/about'], ['GET', '/blog'], ['GET', `/blog/${BLOG}`],
  ['GET', '/blog/does-not-exist'], ['GET', '/editorial-policy'], ['GET', '/privacy'], ['GET', '/terms-and-conditions'],
  ['GET', '/refund-policy'], ['GET', '/terms'], ['GET', '/refund'], ['GET', '/faq'], ['GET', '/signin'], ['GET', '/share/abc123xyz'],
  ['GET', '/share/abc123xyz/data.json'], ['GET', '/redeem'], ['GET', '/some/unknown/page'],
  ['GET', '/tools/nail-biting-cost-calculator'], ['GET', '/tools/nail-growth-timeline-calculator'], ['GET', '/tools/nail-biting-tracker-printable'],
  // comparison / solution pages: published ones, and the pages that must not exist while their flag is off
  ['GET', '/compare/ai-detection-apps'], ['GET', '/compare/bitter-polish-alternative'], ['GET', '/compare/stop-biting-vs-hands-off'],
  ['GET', '/compare/stop-biting-vs-habitaware'], ['GET', '/compare/hands-off'], ['GET', '/compare/habitaware-keen'],
  ['GET', '/solutions/for-desk-workers'], ['GET', '/solutions/for-adhd'], ['GET', '/solutions/cuticle-biting'],
  // feature pages (WS11b), all flag-gated
  ['GET', '/features/habit-reversal-coaching'], ['GET', '/features/phone-companion'], ['GET', '/features/share-with-therapist'],
  ['GET', '/features/referral-program'], ['GET', '/features/desktop-app'], ['GET', '/features'], ['GET', '/page-data/features/phone-companion.json'],
  ['GET', '/page-data/compare/hands-off.json'],
  // generated / static files
  ['GET', '/sitemap.xml'], ['GET', '/llms.txt'], ['GET', '/llms-full.txt'], ['GET', '/robots.txt'], ['GET', '/manifest.webmanifest'],
  ['GET', '/sw.js'], ['GET', '/seo-content.json'], ['GET', '/seo-gated.json'], ['GET', `/posts/${BLOG}.json`],
  ['GET', '/.well-known/apple-developer-domain-association.txt'], ['GET', '/21f3175251594edf918c599f5bdee19f.txt'],
  ['GET', '/og/bfrb-guide.png'], ['GET', '/og/features-phone-companion.png'], ['GET', '/og/solutions-cuticle-biting.png'],
  ['GET', '/icons/apple-touch-icon-152x152.png'], ['GET', '/icons/shortcut-bite-96x96.png'], ['GET', '/icons/icon-192x192.png'],
  ['GET', '/favicon.ico'], ['GET', '/logo.svg'], ['GET', '/fonts/geist-latin.woff2'], ['GET', '/downloads/nothing.dmg'],
  // API, anonymous
  ['GET', '/health'], ['GET', '/api/features'], ['GET', '/api/user/me'], ['POST', '/api/events/sync', 'body'], ['GET', '/api/events/status'],
  ['POST', '/api/auth/magic-link/request', 'body'], ['POST', '/api/auth/magic-link/verify', 'body'], ['GET', '/api/auth/apple'],
  ['GET', '/api/auth/microsoft'], ['GET', '/api/auth/google'], ['POST', '/api/auth/signout'],
  ['GET', '/api/phone/ping'], ['GET', '/api/share/links'], ['POST', '/api/share/links', 'body'], ['GET', '/api/email/weekly'],
  ['GET', '/api/email/unsubscribe/not-a-real-token'], ['POST', '/api/email/unsubscribe/not-a-real-token', 'body'],
  ['GET', '/api/referrals/me'], ['GET', '/api/billing/gift-info'], ['POST', '/api/billing/verify-transaction', 'body'],
  // API, signed in as the rig user (a minted nh_session cookie)
  ['GET', '/api/user/me', 'auth'], ['GET', '/api/features', 'auth'], ['GET', '/api/events/status', 'auth'], ['POST', '/api/events/sync', 'auth'],
  ['GET', '/api/email/weekly', 'auth'], ['GET', '/api/referrals/me', 'auth'], ['GET', '/api/share/links', 'auth'],
  ['POST', '/api/share/links', 'auth'], ['GET', '/api/billing/gift-info', 'auth'], ['POST', '/api/auth/signout', 'auth'],
];

// headers that legitimately differ run to run; everything else is compared
const IGNORE = new Set(['date', 'etag', 'content-length', 'connection', 'keep-alive', 'transfer-encoding', 'ratelimit-remaining',
  'ratelimit-reset', 'ratelimit-policy', 'ratelimit', 'x-ratelimit-remaining', 'x-ratelimit-reset']);

const norm = (text) => normHashes(text)
  .replaceAll(`localhost:${port}`, 'localhost:PORT').replaceAll(`127.0.0.1:${port}`, '127.0.0.1:PORT')
  .replace(/state=[0-9a-f]{16,}/g, 'state=RANDOM').replace(/nonce=[0-9a-f]{16,}/g, 'nonce=RANDOM');

async function fetchOne(rig, [method, path, how], extra = {}) {
  const headers = { 'accept-encoding': 'identity', ...extra };
  if (how === 'auth') headers.cookie = `nh_session=${rig.token}`;
  if (method === 'POST') headers['content-type'] = 'application/json';
  const shown = unhash(path);   // the entry bundle and the workbox runtime are fetched under their hashed names
  const res = await fetch(rig.url + path, { method, headers, redirect: 'manual', body: method === 'POST' ? '{}' : undefined });
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') ?? '';
  const textual = /text|json|xml|javascript|svg|manifest/.test(type);
  const hs = {};
  for (const [k, v] of res.headers) {
    if (IGNORE.has(k)) continue;
    hs[k] = k === 'set-cookie' ? v.replace(/=[^;]*/, '=VALUE').replace(/;\s*Expires=[^;]*/i, '') : norm(v);
  }
  const body = textual ? norm(buf.toString('utf8')) : null;
  return {
    method, path: shown, how: how ?? 'anon', status: res.status, headers: hs,
    bodyHash: textual ? sha(body) : sha(buf), bodyLength: textual ? body.length : buf.length, textual, body,
  };
}

mkdirSync(join(outDir, label), { recursive: true });
const rig = await startRigFrom({ root, port, flags });
const rows = [];
try {
  // the workbox runtime file is named after a hash: find it through sw.js so it is fetched under its real name
  const sw = readFileSync(join(rig.dir, 'dist', 'sw.js'), 'utf8');
  const wb = sw.match(/workbox-[0-9a-f]{8}\.js/)?.[0];
  const index = readFileSync(join(rig.dir, 'dist', 'index.html'), 'utf8');
  const entry = index.match(/\/assets\/index-[A-Za-z0-9_-]{8}\.js/)?.[0];
  const extraUrls = [...(wb ? [['GET', `/${wb}`]] : []), ...(entry ? [['GET', entry]] : [])];
  const all = [...URLS, ...extraUrls];
  // /api/auth/* is rate limited to 10 a minute; space those out
  let n = 0;
  for (const spec of all) {
    if (spec[1].startsWith('/api/auth/') && ++n > 8) await new Promise((r) => setTimeout(r, 7000));
    const row = await fetchOne(rig, spec);
    if (!/^\/api\//.test(spec[1])) {   // determinism check: the same URL again must give the same bytes
      const again = await fetchOne(rig, spec);
      row.stable = again.bodyHash === row.bodyHash && again.status === row.status;
    }
    rows.push(row);
  }
  rows.forEach((r, i) => { if (r.body != null && r.body.length <= 3_000_000) writeFileSync(join(outDir, label, `${i}.txt`), r.body); r.file = `${label}/${i}.txt`; delete r.body; });
  writeFileSync(join(outDir, `${label}.json`), JSON.stringify({ label, root, flags, flagsApi: rows.find((r) => r.path === '/api/features' && r.how === 'anon')?.bodyHash, rows }, null, 1));
  console.log(`${label}: ${rows.length} URLs; unstable between two fetches: ${rows.filter((r) => r.stable === false).map((r) => r.path).join(', ') || 'none'}`);
} finally {
  const tail = rig.log().split('\n').filter((l) => /warn|error|flag|marketing/i.test(l)).slice(0, 8).join('\n');
  if (tail) console.log('server log (filtered):\n' + tail);
  rig.stop();
}
