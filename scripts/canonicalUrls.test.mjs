// One URL per page, and no redirect loops, against the REAL server.js and the REAL build.
//
//   npm run build:web && npm test
//
// Boots `node server.js` on a free port (scratch DATA_DIR, throwaway credentials, no flags) and follows redirects by hand
// (a crawler gives up after a handful of hops). Skipped (not failed) when dist/ has not been built.
//
// What it pins:
//   · a directory prefix that is not a page (/shots/, /video/, /fonts/, /og/, /posts/) ends in ONE 301 and a branded 404.
//     /fonts/, /og/ and /posts/ used to loop forever: the canonicalising middleware strips the trailing slash and a
//     directory mount's default `redirect: true` puts it back (the 2026-10-30 delta audit found it live, after /shots and
//     /video had been fixed the same way on 2026-10-20);
//   · the files under those prefixes are still served, with the headers they had (long cache for fonts and cards,
//     noindex on the per-article JSON);
//   · the page variants a link or a typo produces (trailing slash, upper case, a doubled slash, /index.html) are one
//     301 to the clean URL with the query string kept, and a tracking query serves the clean page's own canonical.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const built = existsSync(join(ROOT, 'dist/index.html')) && existsSync(join(ROOT, 'dist/seo-gated.json'));

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

async function startServer() {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'sb-canonical-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      DATA_DIR: dataDir,
      GOOGLE_CLIENT_ID: 'x',
      GOOGLE_CLIENT_SECRET: 'x',
      JWT_SECRET: 'test-secret-test-secret-test-secret-0123',
      FEATURE_FLAGS: '',
      RESEND_API_KEY: '',
      PADDLE_API_KEY: '',
      PADDLE_WEBHOOK_SECRET: '',
      ELECTRON_PROTOCOL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server did not start:\n${log}`)), 20000);
    const poll = setInterval(() => {
      if (log.includes('Server running')) { clearTimeout(t); clearInterval(poll); resolve(); }
      if (child.exitCode !== null) { clearTimeout(t); clearInterval(poll); reject(new Error(`server exited:\n${log}`)); }
    }, 50);
  });
  return {
    url: `http://127.0.0.1:${port}`,
    async stop() {
      child.kill();
      await new Promise(r => child.once('exit', r));
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Follows redirects by hand, up to `max` hops. Returns every response on the way, so a loop is a long list, not a hang. */
async function chase(srv, path, { method = 'GET', max = 6 } = {}) {
  const hops = [];
  let next = path;
  for (let i = 0; i <= max; i++) {
    const res = await fetch(srv.url + next, { method, redirect: 'manual' });
    const text = method === 'HEAD' ? '' : await res.text();
    const location = res.headers.get('location');
    hops.push({ path: next, status: res.status, location, headers: res.headers, text });
    if (res.status < 300 || res.status >= 400 || !location) return hops;
    next = new URL(location, srv.url).pathname + new URL(location, srv.url).search;
  }
  return hops;
}

describe.skipIf(!built)('canonical URLs and directory paths', () => {
  let srv;
  beforeAll(async () => { srv = await startServer(); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it.each(['/shots/', '/video/', '/fonts/', '/og/', '/posts/'])('%s is one 301 to the bare path and a 404, never a loop', async path => {
    const hops = await chase(srv, path);
    expect(hops.map(h => h.status), `hops: ${hops.map(h => `${h.status} ${h.path}`).join(' > ')}`).toEqual([301, 404]);
    expect(hops[0].location).toBe(path.slice(0, -1));
    expect(hops[1].headers.get('content-type')).toMatch(/text\/html/);
    expect(hops[1].text.includes('<h1'), 'the branded 404 page').toBe(true);
  });

  it.each(['/shots', '/video', '/fonts', '/og', '/posts'])('%s (no slash) is a 404 with no redirect', async path => {
    const hops = await chase(srv, path);
    expect(hops.map(h => h.status)).toEqual([404]);
  });

  it.each([
    ['/shots/app-watch-1280.webp', /image\/webp/],
    ['/shots/app-history-390.webp', /image\/webp/],
    ['/video/stop-biting-poster.webp', /image\/webp/],
    ['/fonts/bricolage-latin.woff2', /font\/woff2|application\/font-woff2/],
    ['/og/best-apps-to-stop-nail-biting.png', /image\/png/],
    ['/posts/how-to-stop-nail-biting.json', /application\/json/],
  ])('%s is still served as a file', async (path, type) => {
    const hops = await chase(srv, path);
    expect(hops.map(h => h.status)).toEqual([200]);
    expect(hops[0].headers.get('content-type')).toMatch(type);
  });

  it('the video file is still served (HEAD, so the 4 MB body is not read)', async () => {
    const hops = await chase(srv, '/video/stop-biting.mp4', { method: 'HEAD' });
    expect(hops.map(h => h.status)).toEqual([200]);
    expect(hops[0].headers.get('content-type')).toMatch(/video\/mp4/);
  });

  it('keeps the headers the three directories had: a year of cache on fonts and cards, noindex on the article JSON', async () => {
    const font = (await chase(srv, '/fonts/bricolage-latin.woff2'))[0];
    expect(font.headers.get('cache-control')).toMatch(/max-age=31536000.*immutable/);
    const card = (await chase(srv, '/og/best-apps-to-stop-nail-biting.png'))[0];
    expect(card.headers.get('cache-control')).toMatch(/max-age=31536000.*immutable/);
    const json = (await chase(srv, '/posts/how-to-stop-nail-biting.json'))[0];
    expect(json.headers.get('x-robots-tag')).toBe('noindex');
    expect(json.headers.get('cache-control')).toMatch(/max-age=300/);
  });

  const PAGES = ['/pricing', '/blog', '/blog/how-to-stop-nail-biting', '/tools/nail-biting-cost-calculator', '/compare/stop-biting-vs-hands-off', '/solutions/for-adhd'];

  it.each(PAGES)('%s: trailing slash, upper case and a doubled slash are one 301 to the clean URL', async path => {
    for (const variant of [`${path}/`, path.toUpperCase(), `/${path}`, `${path.toUpperCase()}/`]) {
      const hops = await chase(srv, variant);
      expect(hops.map(h => h.status), `${variant}: ${hops.map(h => `${h.status} ${h.path}`).join(' > ')}`).toEqual([301, 200]);
      expect(hops[0].location).toBe(path);
    }
  });

  it('the query string rides along on the 301, and /index.html is the home page', async () => {
    const withQuery = await chase(srv, '/pricing/?utm_source=x&ref=y');
    expect(withQuery.map(h => h.status)).toEqual([301, 200]);
    expect(withQuery[0].location).toBe('/pricing?utm_source=x&ref=y');
    const index = await chase(srv, '/index.html');
    expect(index.map(h => h.status)).toEqual([301, 200]);
    expect(index[0].location).toBe('/');
  });

  it.each(PAGES)('%s with a tracking query serves the clean page and its own canonical (no redirect)', async path => {
    const hops = await chase(srv, `${path}?utm_source=x&fbclid=y`);
    expect(hops.map(h => h.status)).toEqual([200]);
    expect(hops[0].text.includes(`<link rel="canonical" href="https://stopbiting.today${path}"`), 'canonical is the clean URL').toBe(true);
  });
});
