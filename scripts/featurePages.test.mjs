// End-to-end checks of the feature pages and of the copy that follows the feature flags (WS11b),
// against the REAL server.js and the REAL build.
//
//   npm run build:web && npm test
//
// Boots `node server.js` many times on free ports (scratch DATA_DIR, throwaway credentials), once with no
// flags, once per page with only that page's flag, and with the flags that change existing copy. Skipped
// (not failed) when dist/ has not been built.
//
// What it pins:
//   · flags off: the six pages are 404 + noindex, and absent from the sitemap, llms.txt, llms-full.txt, the
//     noscript nav, seo-content.json and the social cards; the built files are served byte for byte;
//   · one flag opens one page and no other; the page is indexable, self-canonical, has Article, breadcrumb and
//     FAQPage data equal to its visible text, and is in the sitemap, the llms files and the nav;
//   · the copy a flag changes is the same in the crawler article, the FAQPage data and the React page, in
//     every flag state, and is the original text with every flag off.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { RULES } from '../shared/flagCopy.js';
import { FEATURE_PAGE_FLAGS } from '../src/data/featurePagePaths.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const built = existsSync(join(ROOT, 'dist/index.html')) && existsSync(join(ROOT, 'dist/seo-gated.json'));
const PAGES = Object.entries(FEATURE_PAGE_FLAGS);   // [path, flag]
const PATHS = PAGES.map(([path]) => path);

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

async function startServer(featureFlags, extraEnv = {}) {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'sb-features-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      DATA_DIR: dataDir,
      GOOGLE_CLIENT_ID: 'x',
      GOOGLE_CLIENT_SECRET: 'x',
      JWT_SECRET: 'test-secret-test-secret-test-secret-0123',
      FEATURE_FLAGS: featureFlags,
      RESEND_API_KEY: '',
      PADDLE_API_KEY: '',
      PADDLE_WEBHOOK_SECRET: '',
      ELECTRON_PROTOCOL: '',
      ...extraEnv,
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
    log: () => log,
    async stop() {
      child.kill();
      await new Promise(r => child.once('exit', r));
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

const get = async (srv, path) => {
  const res = await fetch(srv.url + path, { redirect: 'manual' });
  return { status: res.status, headers: res.headers, text: await res.text() };
};

const decode = s => s
  .replace(/&#x27;|&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');
const textOf = html => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const metaContent = (html, selector) => html.match(new RegExp(`<meta ${selector}[^>]*content="([^"]*)"`))?.[1];
const big = (text, label = '') => ({
  toContain: needle => expect(text.includes(needle), `${label} should contain ${needle}`).toBe(true),
  notToContain: needle => expect(text.includes(needle), `${label} should not contain ${needle}`).toBe(false),
  toMatch: re => expect(re.test(text), `${label} should match ${re}`).toBe(true),
  notToMatch: re => expect(re.test(text), `${label} should not match ${re}`).toBe(false),
});
const articleOf = html => html.match(/<article id="ssr-page-content">([\s\S]*?)<\/article>/)?.[1] ?? '';
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const pageDataOf = html => JSON.parse(html.match(/<script type="application\/json" id="sb-page-data">([\s\S]*?)<\/script>/)[1]);
const dist = file => readFileSync(join(ROOT, 'dist', file), 'utf8');

describe.skipIf(!built)('feature pages, every flag off', () => {
  let srv;
  beforeAll(async () => { srv = await startServer(''); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it.each(PATHS)('%s is the branded 404: noindex, no canonical, none of its copy', async path => {
    const { status, text, headers } = await get(srv, path);
    expect(status).toBe(404);
    expect(headers.get('content-type')).toMatch(/text\/html/);
    big(text).toMatch(/<meta name="robots" content="noindex">/);
    big(text).notToMatch(/rel="canonical"/);
    big(text).notToContain('sb-page-data');
    big(text).notToMatch(/competing response|phone companion|read-only link|bonus access|menu bar|cuticle/i);
  });

  it.each(PATHS)('%s has no data file and no social card', async path => {
    const data = await get(srv, `/page-data${path}.json`);
    expect(data.status).toBe(404);
    expect(data.headers.get('content-type')).toMatch(/text\/html/);
    const card = await get(srv, `/og/${path.replace(/^\//, '').replace(/\//g, '-')}.png`);
    expect(card.status).toBe(404);
    expect(card.headers.get('content-type')).toMatch(/text\/html/);
  });

  it('sitemap.xml, llms.txt and llms-full.txt are the built files, byte for byte', async () => {
    for (const file of ['sitemap.xml', 'llms.txt', 'llms-full.txt']) {
      const { text } = await get(srv, `/${file}`);
      expect(text === dist(file), `${file} equals dist/${file}`).toBe(true);
      for (const path of PATHS) big(text, file).notToContain(path);
    }
    const content = (await get(srv, '/seo-content.json')).text;
    expect(content === dist('seo-content.json'), 'seo-content.json equals the built file').toBe(true);
    for (const path of PATHS) big(content).notToContain(`"${path}"`);
  });

  it('the unpublished copy and the page data routes do not exist', async () => {
    expect((await get(srv, '/seo-gated.json')).status).toBe(404);
    expect((await get(srv, '/page-data/features/anything.json')).status).toBe(404);
  });

  it('the noscript nav, the home page, About and How it works carry none of them', async () => {
    for (const page of ['/', '/about', '/how-it-works', '/pricing']) {
      const { status, text } = await get(srv, page);
      expect(status, page).toBe(200);
      for (const path of PATHS) big(text, page).notToContain(`href="${path}"`);
    }
  });

  it('adds no marker, and makes no request for flags: the pages are the built pages', async () => {
    for (const page of ['/', '/about', '/how-it-works', '/pricing', '/compare/ai-detection-apps', '/this-does-not-exist']) {
      big((await get(srv, page)).text, page).notToContain('sb-copy-flags');
    }
  });

  it('says what it always said about history, sign-in and phones', async () => {
    const home = (await get(srv, '/')).text;
    big(home).toContain('Your history is stored in this browser, so it doesn');
    big(home).toContain('Accounts are created through Google sign-in');
    big(home).toContain('use the Email me the link button');
    big(home).notToMatch(/turn on sync|emailed link|Apple/);
    const faq = jsonLd(home).find(b => b['@type'] === 'FAQPage');
    expect(JSON.stringify(faq)).toContain('Accounts are created through Google sign-in');
    big((await get(srv, '/how-it-works')).text).toContain('timestamped log stored locally — never transmitted');
    big((await get(srv, '/about')).text).toContain('Your alarm and bite log is stored in your browser.');
  });
});

describe.skipIf(!built)('feature pages, one flag at a time', () => {
  const servers = new Map();
  beforeAll(async () => {
    for (const [, flag] of PAGES) {
      if (!servers.has(flag)) servers.set(flag, await startServer(flag));
    }
  }, 90000);
  afterAll(async () => { for (const srv of servers.values()) await srv.stop(); });

  it.each(PAGES)('%s opens with %s and with no other flag', async (path, flag) => {
    const srv = servers.get(flag);
    for (const [other] of PAGES) {
      const { status } = await get(srv, other);
      expect(status, `${other} with only ${flag}`).toBe(other === path ? 200 : 404);
      expect((await get(srv, `/page-data${other}.json`)).status, `data of ${other}`).toBe(other === path ? 200 : 404);
    }
  });

  it.each(PAGES)('%s is indexable, self-canonical, dated, and described by schema that equals its visible text', async (path, flag) => {
    const srv = servers.get(flag);
    const { text } = await get(srv, path);
    const canonical = `https://stopbiting.today${path}`;
    big(text).toContain(`<link rel="canonical" href="${canonical}"`);
    big(text).notToMatch(/<meta name="robots" content="noindex/);
    expect(metaContent(text, 'name="robots"')).toMatch(/^index, follow/);
    expect(metaContent(text, 'property="og:image"')).toMatch(/^https:\/\/stopbiting\.today\/og\/[\w-]+\.png$/);
    expect(metaContent(text, 'name="description"').length).toBeGreaterThan(60);
    expect(metaContent(text, 'name="description"').length).toBeLessThanOrEqual(160);
    big(text).notToMatch(/<meta name="keywords"/i);

    const blocks = jsonLd(text);
    const article = blocks.find(b => b['@type'] === 'Article');
    expect(article.mainEntityOfPage['@id']).toBe(canonical);
    expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(article.dateModified >= article.datePublished).toBe(true);
    expect(blocks.find(b => b['@type'] === 'BreadcrumbList').itemListElement.at(-1).item).toBe(canonical);
    big(JSON.stringify(blocks)).notToMatch(/aggregateRating|"Review"|ratingValue|SearchAction/);

    const visible = textOf(articleOf(text));
    expect(articleOf(text)).toMatch(/^<h1>/);
    const faq = blocks.find(b => b['@type'] === 'FAQPage');
    expect(faq, 'FAQPage').toBeTruthy();
    for (const q of faq.mainEntity) {
      big(visible, q.name).toContain(textOf(q.name));
      big(visible, q.name).toContain(textOf(q.acceptedAnswer.text));
    }
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
  });

  it.each(PAGES)('%s: the page renders from the copy the server embedded, which is the copy it serves as JSON and as the article', async (path, flag) => {
    const srv = servers.get(flag);
    const { text } = await get(srv, path);
    const embedded = pageDataOf(text);
    expect(embedded.path).toBe(path);
    const served = await get(srv, `/page-data${path}.json`);
    expect(served.headers.get('content-type')).toMatch(/application\/json/);
    expect(served.headers.get('x-robots-tag')).toBe('noindex');
    expect(JSON.parse(served.text)).toEqual(embedded.page);
    const visible = textOf(articleOf(text));
    big(visible).toContain(textOf(embedded.page.title));
    big(visible).toContain(textOf(embedded.page.intro));
    for (const s of embedded.page.sections) big(visible, s.heading).toContain(textOf(s.heading));
    // Resolved: no marker and no placeholder left anywhere a reader or a crawler can see.
    big(text, path).notToMatch(/\{\{/);
    big(served.text, path).notToMatch(/\{\{/);
  });

  it.each(PAGES)('%s is in the sitemap, llms.txt, llms-full.txt and the noscript nav, and nothing else is', async (path, flag) => {
    const srv = servers.get(flag);
    const base = dist('sitemap.xml');
    const sitemap = (await get(srv, '/sitemap.xml')).text;
    expect(sitemap.match(/<url>/g).length).toBe(base.match(/<url>/g).length + 1);
    big(sitemap).toMatch(new RegExp(`<loc>https://stopbiting\\.today${path}</loc>\\s*<lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`));
    expect(srv.log()).not.toMatch(/has no freshness date/);
    const llms = (await get(srv, '/llms.txt')).text;
    big(llms).toContain(`](https://stopbiting.today${path}):`);
    expect(llms.startsWith(dist('llms.txt').trimEnd())).toBe(true);
    const full = (await get(srv, '/llms-full.txt')).text;
    big(full).toContain(`URL: https://stopbiting.today${path}`);
    big(full).notToMatch(/\{\{/);
    expect(full.startsWith(dist('llms-full.txt').trimEnd())).toBe(true);
    for (const page of ['/', '/pricing', path]) big((await get(srv, page)).text, page).toContain(`<a href="${path}">`);
    for (const [other] of PAGES.filter(([p]) => p !== path)) {
      big(sitemap).notToContain(`stopbiting.today${other}<`);
      big(llms).notToContain(other);
      big(full).notToContain(`URL: https://stopbiting.today${other}`);
    }
  });

  it('the unpublished copy file is still not served', async () => {
    for (const srv of servers.values()) expect((await get(srv, '/seo-gated.json')).status).toBe(404);
  });
});

describe.skipIf(!built)('page copy that depends on other flags', () => {
  it('the coaching page mentions the urge timer, and the phone and sharing pages mention sync, only when those flags are on', async () => {
    const a = await startServer('hrt_coaching');
    const b = await startServer('hrt_coaching,urge_timer,event_sync');
    try {
      const without = articleOf((await get(a, '/features/habit-reversal-coaching')).text);
      const withBoth = articleOf((await get(b, '/features/habit-reversal-coaching')).text);
      big(without).notToMatch(/urge timer|I feel an urge/i);
      big(withBoth).toContain('What is the urge timer?');
      big(withBoth).toContain('If you turn on sync');
      big(without).notToContain('If you turn on sync');
    } finally { await a.stop(); await b.stop(); }

    const c = await startServer('phone_companion');
    const d = await startServer('phone_companion,event_sync,urge_timer');
    try {
      const off = textOf(articleOf((await get(c, '/features/phone-companion')).text));
      const on = textOf(articleOf((await get(d, '/features/phone-companion')).text));
      big(off).toContain('Entries stay on the phone.');
      big(off).notToContain('turn on sync');
      big(on).toContain('Entries stay on the phone unless you turn on sync');
      big(on).toContain('breathing timer');
      big(off).notToContain('breathing timer');
    } finally { await c.stop(); await d.stop(); }
  }, 60000);

  it('the referral page uses the reward the environment sets, never a number of its own', async () => {
    const a = await startServer('referrals');
    const b = await startServer('referrals', { REFERRAL_CREDIT_DAYS: '14' });
    try {
      const defaults = textOf(articleOf((await get(a, '/features/referral-program')).text));
      const custom = textOf(articleOf((await get(b, '/features/referral-program')).text));
      big(defaults).toContain('you both get one month of bonus access');
      big(custom).toContain('you both get 14 days of bonus access');
      big(custom).notToContain('one month');
      const faq = jsonLd((await get(b, '/features/referral-program')).text).find(x => x['@type'] === 'FAQPage');
      big(JSON.stringify(faq)).notToContain('{{');
      big((await get(b, '/page-data/features/referral-program.json')).text).toContain('14 days');
    } finally { await a.stop(); await b.stop(); }
  }, 60000);

  it('the desktop page describes no Windows build, links no download and never says signed', async () => {
    const srv = await startServer('desktop_app');
    try {
      const { text } = await get(srv, '/features/desktop-app');
      const article = articleOf(text);
      big(article).notToMatch(/\/downloads\/|\.dmg|\.exe|notariz|signed/i);
      big(article).toContain('There is no Windows version yet');
    } finally { await srv.stop(); }
  }, 30000);
});

// ── Copy that already exists, in every flag state ───────────────────────────────────────────
// The text a reader sees (the React page), the crawler article and the FAQPage data must be the
// same in each state, and with every flag off the original sentences.
const STATES = [
  { name: 'sync on', flags: 'event_sync', env: {}, on: ['event_sync'] },
  { name: 'phone on', flags: 'phone_companion', env: {}, on: ['phone_companion'] },
  { name: 'sync and phone on', flags: 'event_sync,phone_companion', env: {}, on: ['event_sync', 'phone_companion'] },
  { name: 'Microsoft sign-in on and configured', flags: 'signin_microsoft', env: { MICROSOFT_CLIENT_ID: 'id', MICROSOFT_CLIENT_SECRET: 'secret' }, on: ['signin_microsoft'] },
  { name: 'Microsoft flag on but not configured', flags: 'signin_microsoft', env: {}, on: [] },
];

describe.skipIf(!built)('existing copy follows the flags, identically for readers and crawlers', () => {
  let flagsModule;
  let providersModule;
  let kvModule;
  beforeAll(async () => {
    flagsModule = await import('../src/features/flags.ts');
    providersModule = await import('../src/auth/providers.ts');
    kvModule = (await import('../src/storage/kv.ts')).kv;
  });
  afterAll(() => {
    kvModule?.remove('flags', 'last-known');
    kvModule?.remove('auth', 'providers');
    flagsModule?.resetFlagsForTests();
    providersModule?.resetProvidersForTests();
  });

  async function renderPage(path, on) {
    const [{ createElement }, { renderToStaticMarkup }] = await Promise.all([import('react'), import('react-dom/server')]);
    const load = {
      '/': async () => (await import('../src/pages/Landing.tsx')).Landing,
      '/about': async () => (await import('../src/pages/About.tsx')).About,
      '/how-it-works': async () => (await import('../src/pages/HowItWorks.tsx')).HowItWorks,
    }[path];
    const flags = Object.fromEntries(on.map(name => [name, true]));
    kvModule.set('flags', 'last-known', { at: Date.now(), flags });
    kvModule.set('auth', 'providers', {
      at: Date.now(),
      value: { magic_link: on.includes('signin_magic_link'), apple: on.includes('signin_apple'), microsoft: on.includes('signin_microsoft') },
    });
    flagsModule.resetFlagsForTests();
    providersModule.resetProvidersForTests();
    return renderToStaticMarkup(createElement(await load()));
  }

  for (const state of STATES) {
    it(`${state.name}: the home FAQ is one text in the page, the article and the FAQPage data`, async () => {
      const srv = await startServer(state.flags, state.env);
      try {
        const html = (await get(srv, '/')).text;
        const faq = jsonLd(html).find(b => b['@type'] === 'FAQPage');
        const schema = faq.mainEntity.map(q => [textOf(q.name), textOf(q.acceptedAnswer.text)]);
        const rendered = await renderPage('/', state.on);
        const visible = [...rendered.matchAll(/<details[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/details>/g)]
          .map(m => [textOf(m[1]), textOf(m[2])]);
        expect(schema).toEqual(visible);
        const article = textOf(articleOf(html));
        for (const [q, a] of schema) { big(article, q).toContain(q); big(article, q).toContain(a); }
      } finally { await srv.stop(); }
    }, 30000);

    it(`${state.name}: every sentence a rule changes reads the same in the page and in the crawler article`, async () => {
      const srv = await startServer(state.flags, state.env);
      const isOn = name => state.on.includes(name);
      try {
        for (const path of ['/', '/about', '/how-it-works']) {
          const article = textOf(articleOf((await get(srv, path)).text));
          const page = textOf(await renderPage(path, state.on));
          for (const rule of RULES) {
            // Only where the page says the sentence at all (it is in the page with every flag off).
            const base = textOf(await renderPage(path, []));
            if (!base.includes(rule.off)) continue;
            const wanted = rule.on(isOn) ?? rule.off;
            big(page, `${path} page, ${rule.id}`).toContain(wanted);
            if (article.includes(rule.off) || article.includes(wanted)) big(article, `${path} article, ${rule.id}`).toContain(wanted);
            if (rule.on(isOn) !== null) {
              big(page, `${path} page, ${rule.id}`).notToContain(rule.off);
              big(article, `${path} article, ${rule.id}`).notToContain(rule.off);
            }
          }
        }
      } finally { await srv.stop(); }
    }, 60000);
  }

  it('the marker lists the copy flags that are on, in every 200 page and in no error page, and only then', async () => {
    const both = await startServer('event_sync,phone_companion,hrt_coaching');
    const one = await startServer('phone_companion');
    const other = await startServer('hrt_coaching,share_links');
    try {
      for (const page of ['/', '/about', '/pricing', '/compare/ai-detection-apps', '/blog/how-to-stop-nail-biting', '/features/habit-reversal-coaching']) {
        big((await get(both, page)).text, page).toContain('<meta name="sb-copy-flags" content="event_sync phone_companion">');
        big((await get(one, page)).text, page).toContain('<meta name="sb-copy-flags" content="phone_companion">');
        big((await get(other, page)).text, page).notToContain('sb-copy-flags');
      }
      big((await get(both, '/this-does-not-exist')).text).notToContain('sb-copy-flags');
      // the marker names no flag but the two that change copy, so it tells a crawler nothing about unreleased features
      big((await get(both, '/')).text).notToMatch(/sb-copy-flags" content="[^"]*hrt_coaching/);
    } finally { await both.stop(); await one.stop(); await other.stop(); }
  }, 30000);

  it('the NailBiteMenu comparison follows the sign-in methods, in the page, the article and the FAQPage data', async () => {
    const srv = await startServer('signin_microsoft', { MICROSOFT_CLIENT_ID: 'id', MICROSOFT_CLIENT_SECRET: 'secret' });
    const off = await startServer('');
    try {
      const path = '/compare/stop-biting-vs-nailbitemenu';
      const on = (await get(srv, path)).text;
      const base = (await get(off, path)).text;
      big(base).toContain('requires a Google sign-in');
      big(on).notToContain('requires a Google sign-in');
      big(on).toContain('requires a sign-in (Google or Microsoft)');
      big(on).toContain('Sign-in required (Google or Microsoft)');
      const faq = jsonLd(on).find(b => b['@type'] === 'FAQPage');
      big(JSON.stringify(faq)).toContain('requires a sign-in (Google or Microsoft)');
      big(JSON.stringify(faq)).notToContain('requires a Google sign-in');
      const posts = await get(srv, '/posts/how-ai-can-help-stop-nail-biting.json');
      expect(posts.status).toBe(200);
      expect(posts.headers.get('x-robots-tag')).toBe('noindex');
    } finally { await srv.stop(); await off.stop(); }
  }, 30000);

  it('blog posts and the JSON files the page reads follow the sync flag, and are the built files with it off', async () => {
    const off = await startServer('');
    const on = await startServer('event_sync');
    try {
      const file = '/posts/how-ai-can-help-stop-nail-biting.json';
      expect((await get(off, file)).text === readFileSync(join(ROOT, 'dist', file), 'utf8')).toBe(true);
      for (const slug of ['how-ai-can-help-stop-nail-biting', 'stop-biting-app-review']) {
        const offPost = (await get(off, `/posts/${slug}.json`)).text;
        const onPost = (await get(on, `/posts/${slug}.json`)).text;
        const ssrOn = textOf(articleOf((await get(on, `/blog/${slug}`)).text));
        // whatever the rules change in the post JSON, the article says too
        for (const rule of RULES.filter(r => r.flags.includes('event_sync'))) {
          if (offPost.includes(rule.off)) {
            big(onPost, slug).notToContain(rule.off);
            big(ssrOn, slug).toContain(rule.on(name => name === 'event_sync'));
          }
        }
      }
    } finally { await on.stop(); await off.stop(); }
  }, 30000);
});
