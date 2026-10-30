// /blog/<slug> tells the browser about its article JSON in the head, so the request starts while the bundle downloads.
//
//   npm run build:web && npm test
//
// Boots the REAL server.js on a free port (scratch DATA_DIR, throwaway credentials, no flags) against the REAL build.
// The integration half is skipped (not failed) when dist/ has not been built.
//
// What it pins:
//   · every post carries exactly one `<link rel="preload" as="fetch" crossorigin href="/posts/<slug>.json">`, inside the head;
//   · the URL it names is the URL the page fetches (usePost.ts), and `crossorigin` is there: without it Chrome discards the
//     preload and downloads the file twice (Lighthouse 13.6, 2026-10-30: two requests for the same JSON);
//   · nothing else about the head moved: title, description, canonical, robots and both JSON-LD blocks are still there,
//     and the article text is still in the HTML (crawlers do not run the bundle);
//   · the JSON itself is still `X-Robots-Tag: noindex`;
//   · no other page gets the hint (it would be a request for a file the page never reads).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { postPreloadTag } from '../server/marketing/postPreload.js';
import { loadPost } from '../src/hooks/usePost.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const built = existsSync(join(ROOT, 'dist/index.html')) && existsSync(join(ROOT, 'dist/seo-gated.json'));

describe('postPreloadTag', () => {
  it('is one preload link for the article JSON, with crossorigin', () => {
    expect(postPreloadTag('how-to-stop-nail-biting')).toBe(
      '    <link rel="preload" as="fetch" crossorigin href="/posts/how-to-stop-nail-biting.json" />\n');
  });

  it('names the file the page fetches', async () => {
    const asked = [];
    await loadPost('how-to-stop-nail-biting', async (url) => { asked.push(url); return { ok: false, status: 404, json: async () => null }; });
    const href = postPreloadTag('how-to-stop-nail-biting').match(/href="([^"]+)"/)[1];
    expect(asked).toEqual([href]);
  });

  it.each(['', '../x', 'a/b', 'A-B', 'a b', 'a"b', 'a.json', 'x\n'])('is empty for %j, which is not a safe path segment', (slug) => {
    expect(postPreloadTag(slug)).toBe('');
  });
});

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
  const dataDir = mkdtempSync(join(tmpdir(), 'sb-preload-'));
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

const POSTS = ['how-to-stop-nail-biting', 'nail-biting-health-risks'];
const head = (html) => html.slice(html.indexOf('<head'), html.indexOf('</head>') + 7);
const preloads = (html) => html.match(/<link\b[^>]*\brel="preload"[^>]*>/g) ?? [];

describe.skipIf(!built)('/blog/<slug> preload hint', () => {
  let srv;
  beforeAll(async () => { srv = await startServer(); }, 30000);
  afterAll(async () => { await srv?.stop(); });
  const page = async (path) => {
    const res = await fetch(srv.url + path);
    return { res, html: await res.text() };
  };

  it.each(POSTS)('%s has exactly one article preload, in the head', async (slug) => {
    const { res, html } = await page(`/blog/${slug}`);
    expect(res.status).toBe(200);
    const links = preloads(head(html));
    const fetches = links.filter(l => /\bas="fetch"/.test(l));
    expect(fetches).toEqual([`<link rel="preload" as="fetch" crossorigin href="/posts/${slug}.json" />`]);
    expect(preloads(html.slice(html.indexOf('</head>'))), 'none outside the head').toEqual([]);
    expect(links.filter(l => !/\bas="fetch"/.test(l)).every(l => /\bas="font"/.test(l)), 'the others are the shell\'s font preloads').toBe(true);
  });

  it.each(POSTS)('%s: the preloaded URL answers with this post, noindex, cacheable for the fetch that follows', async (slug) => {
    const { html } = await page(`/blog/${slug}`);
    const href = html.match(/<link rel="preload" as="fetch" crossorigin href="([^"]+)"/)[1];
    const res = await fetch(srv.url + href);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(res.headers.get('cache-control')).toMatch(/max-age=\d+/);   // a hit for the page's own fetch() if the preload were missed
    expect((await res.json()).slug).toBe(slug);
  });

  it.each(POSTS)('%s: title, description, canonical, robots and JSON-LD are all still in the head, the article is still in the HTML', async (slug) => {
    const { html } = await page(`/blog/${slug}`);
    const h = head(html);
    expect(h.match(/<title>[^<]+<\/title>/g)).toHaveLength(1);
    expect(h.match(/<meta name="description" content="[^"]+"/g)).toHaveLength(1);
    expect(h.match(/<link rel="canonical" href="[^"]+"/g)).toEqual([`<link rel="canonical" href="https://stopbiting.today/blog/${slug}"`]);
    expect(h.match(/<meta name="robots" content="[^"]+"/g)).toEqual(['<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"']);
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    const types = ld.flatMap(b => (b['@graph'] ?? [b]).map(n => n['@type']));
    expect(types).toContain('BlogPosting');
    expect(types).toContain('BreadcrumbList');
    expect(html).toMatch(/<article id="ssr-page-content">\s*<h1>/);
  });

  it.each(['/', '/pricing', '/blog', '/about', '/compare/stop-biting-vs-hands-off', '/blog/this-post-does-not-exist'])('%s has no article preload', async (path) => {
    const { html } = await page(path);
    expect(preloads(html).filter(l => /\bas="fetch"/.test(l))).toEqual([]);
  });
});
