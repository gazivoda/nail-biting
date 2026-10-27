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

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { RULES } from '../shared/flagCopy.js';
import { TRIAL_HYPHEN } from '../shared/plans.js';
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

// The links to the open pages: the data block the server writes into the head (src/features/gatedLinks.ts reads it) and
// the list at the end of the crawler article. Absent, not empty, while no page is open.
const GATED_LINKS_ID = 'sb-gated-links';
const gatedLinksText = html => html.match(new RegExp(`<script type="application/json" id="${GATED_LINKS_ID}">([\\s\\S]*?)</script>`))?.[1] ?? null;
const gatedLinksOf = html => { const text = gatedLinksText(html); return text === null ? null : JSON.parse(text); };
const gatedHrefsIn = html => PATHS.filter(path => html.includes(`href="${path}"`));
// What a page is called in a footer: its title up to the first colon (the pages' titles are "Name: what it is").
const footerLabel = title => title.split(':')[0].trim();
// Pages of every kind that carry the site chrome and the crawler article.
const KINDS = ['/', '/pricing', '/about', '/how-it-works', '/blog', '/blog/how-to-stop-nail-biting', '/compare/ai-detection-apps', '/solutions/for-adhd', '/privacy'];

// The React footer from the data block a server wrote. There is no DOM here: the page is a stub with the one method the
// reader calls, and the render is the real component (react-dom/server).
async function renderWithPage(load, blockText, props = {}) {
  const [{ createElement }, { renderToStaticMarkup }, Component] = await Promise.all([import('react'), import('react-dom/server'), load()]);
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'document');
  const before = globalThis.document;
  globalThis.document = { querySelector: () => null, getElementById: id => (id === GATED_LINKS_ID && blockText !== null ? { textContent: blockText } : null) };
  try { return renderToStaticMarkup(createElement(Component, props)); } finally {
    if (had) globalThis.document = before; else delete globalThis.document;
  }
}
const FOOTER_ONLY = async () => (await import('../src/components/site/SiteFooter.tsx')).SiteFooter;
const WHOLE_PAGES = {
  '/': async () => (await import('../src/pages/Landing.tsx')).Landing,
  '/pricing': async () => (await import('../src/pages/PricingPage.tsx')).PricingPage,
  '/about': async () => (await import('../src/pages/About.tsx')).About,
  '/how-it-works': async () => (await import('../src/pages/HowItWorks.tsx')).HowItWorks,
};
const footerOf = html => html.match(/<footer[\s\S]*<\/footer>/)?.[0] ?? '';

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
      big((await get(srv, page)).text, page).notToContain(GATED_LINKS_ID);
    }
  });

  it('links to none of them, on any kind of page: no data block, no list in the crawler article, no anchor', async () => {
    for (const page of KINDS) {
      const { status, text } = await get(srv, page);
      expect(status, page).toBe(200);
      big(text, page).notToContain(GATED_LINKS_ID);
      big(articleOf(text), `${page} article`).notToContain('aria-label="More from Stop Biting"');
      expect(gatedHrefsIn(text), `${page} links`).toEqual([]);
    }
    big((await get(srv, '/this-does-not-exist')).text).notToContain(GATED_LINKS_ID);
  });

  it('the footer draws none of them for a visitor whose page carries no data block', async () => {
    for (const [path, load] of Object.entries(WHOLE_PAGES)) {
      const html = await renderWithPage(load, null);
      expect(footerOf(html), `${path} has a footer`).toMatch(/^<footer/);
      for (const gated of PATHS) big(html, path).notToContain(`href="${gated}"`);
    }
  });

  it('the browser bundle carries no address of a gated page: the footer learns them from the server, and only while they are open', () => {
    const files = readdirSync(join(ROOT, 'dist/assets')).filter(f => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const text = readFileSync(join(ROOT, 'dist/assets', file), 'utf8');
      for (const path of PATHS) expect(text.includes(path), `${file} contains ${path}`).toBe(false);
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

  // The page is linked from the site chrome while its flag is on, for readers who run the page and for crawlers who do
  // not, from one source: the data block in the head and the list at the end of the crawler article are the same pairs.
  it.each(PAGES)('%s is linked on every kind of page while %s is on, in the data block and in the crawler article, and no other page is', async (path, flag) => {
    const srv = servers.get(flag);
    const label = footerLabel(JSON.parse((await get(srv, `/page-data${path}.json`)).text).title);
    expect(label.length).toBeGreaterThan(3);
    for (const page of [...KINDS, path]) {
      const { status, text } = await get(srv, page);
      expect(status, page).toBe(200);
      expect(gatedLinksOf(text), `${page} data block`).toEqual([[path, label]]);
      expect(text.indexOf(GATED_LINKS_ID), `${page}: the block is in the head`).toBeLessThan(text.indexOf('</head>'));
      const article = articleOf(text);
      expect(article, `${page} article`).toContain(`<nav aria-label="More from Stop Biting"><ul><li><a href="${path}">`);
      expect(textOf(article.match(/<nav aria-label="More from Stop Biting">[\s\S]*?<\/nav>/)[0]), `${page} article list`).toBe(label);
      // the noscript site navigation, the data block and the article name the same page, and no other gated page appears anywhere:
      // not in the chrome, and not in the open page's own "Related reading" either (a link to a closed page is a link to the 404)
      expect(gatedHrefsIn(text), `${page} anchors`).toEqual([path]);
      for (const other of PATHS.filter(p => p !== path)) big(text, page).notToContain(other);
    }
    for (const other of PATHS.filter(p => p !== path)) {
      big((await get(srv, `/page-data${path}.json`)).text, `${path} data`).notToContain(other);
    }
    // a page that is not a marketing page, or not found, carries nothing
    big((await get(srv, '/this-does-not-exist')).text).notToContain(GATED_LINKS_ID);
  });

  it.each(PAGES)('%s: the footer React draws from that data block links it, in the style of the other footer links, and links no other', async (path, flag) => {
    const srv = servers.get(flag);
    const label = footerLabel(JSON.parse((await get(srv, `/page-data${path}.json`)).text).title);
    const home = (await get(srv, '/')).text;
    const block = gatedLinksText(home);
    expect(block, 'the home page carries the block').not.toBeNull();
    const anchor = `<a href="${path}" class="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">${label}</a>`;

    const footer = await renderWithPage(FOOTER_ONLY, block, { cta: false });
    expect(footer).toContain(anchor);
    expect(footer.indexOf(anchor), 'after the legal links').toBeGreaterThan(footer.indexOf('href="/refund-policy"'));
    expect(gatedHrefsIn(footer)).toEqual([path]);
    // the same styling as an ordinary footer link, so the 44px target and the hover colour come with it
    expect(footer).toContain('href="/blog" class="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]"');

    // the whole page, not only the footer, for each page the footer is drawn into without a request
    for (const [pagePath, load] of Object.entries(WHOLE_PAGES)) {
      const html = await renderWithPage(load, gatedLinksText((await get(srv, pagePath)).text));
      expect(footerOf(html), `${pagePath} footer`).toContain(anchor);
      expect(gatedHrefsIn(html), `${pagePath} anchors`).toEqual([path]);
    }
    // and the same page without the block (the cached app shell) shows none
    expect(gatedHrefsIn(await renderWithPage(WHOLE_PAGES['/pricing'], null))).toEqual([]);
  });

  it('the footer React draws never requests the flags: the data block is the only source', async () => {
    const calls = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (...args) => { calls.push(String(args[0])); return realFetch(...args); };
    try {
      const srv = servers.get('phone_companion');
      await renderWithPage(FOOTER_ONLY, gatedLinksText((await get(srv, '/')).text), { cta: false });
      await new Promise(r => setTimeout(r, 50));
    } finally { globalThis.fetch = realFetch; }
    expect(calls.filter(url => /\/api\//.test(url))).toEqual([]);
  });

  it('the unpublished copy file is still not served', async () => {
    for (const srv of servers.values()) expect((await get(srv, '/seo-gated.json')).status).toBe(404);
  });
});

describe.skipIf(!built)('links to open pages when several flags are on', () => {
  it('lists every open page once, in the order of the build, and not the pages whose flags are off', async () => {
    const srv = await startServer('phone_companion,detection_behaviors,referrals');
    try {
      const home = (await get(srv, '/')).text;
      const links = gatedLinksOf(home);
      expect(links.map(([href]) => href)).toEqual(PATHS.filter(p => ['phone_companion', 'detection_behaviors', 'referrals'].includes(FEATURE_PAGE_FLAGS[p])));
      expect(new Set(links.map(([href]) => href)).size).toBe(links.length);
      for (const [href] of links) expect((await get(srv, href)).status, `${href} exists`).toBe(200);
      expect(gatedHrefsIn(home).sort()).toEqual(links.map(([href]) => href).sort());
      const footer = await renderWithPage(FOOTER_ONLY, gatedLinksText(home), { cta: false });
      expect(gatedHrefsIn(footer).sort()).toEqual(links.map(([href]) => href).sort());
    } finally { await srv.stop(); }
  }, 30000);

  it('a flag that is not a page\'s own opens no link to it (the sync flag opens none)', async () => {
    const srv = await startServer('event_sync,urge_timer,share_links');
    try {
      const home = (await get(srv, '/')).text;
      const path = '/features/share-with-therapist';
      const title = JSON.parse((await get(srv, `/page-data${path}.json`)).text).title;
      expect(gatedLinksOf(home)).toEqual([[path, footerLabel(title)]]);
    } finally { await srv.stop(); }
  }, 30000);
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
  // the Lifetime plan: the words follow the flag AND the server's price id (the card needs the build's, the same product)
  { name: 'Lifetime plan on and configured', flags: 'lifetime_plan', env: { PADDLE_PRICE_ID_LIFETIME: 'pri_test_lifetime' }, on: ['lifetime_plan'] },
  { name: 'Lifetime flag on but no price id', flags: 'lifetime_plan', env: { PADDLE_PRICE_ID_LIFETIME: '', VITE_PADDLE_PRICE_ID_LIFETIME: '' }, on: [] },
  { name: 'Lifetime plan, sync and phone on', flags: 'lifetime_plan,event_sync,phone_companion', env: { PADDLE_PRICE_ID_LIFETIME: 'pri_test_lifetime' }, on: ['lifetime_plan', 'event_sync', 'phone_companion'] },
];

describe.skipIf(!built)('existing copy follows the flags, identically for readers and crawlers', () => {
  let flagsModule;
  let providersModule;
  let kvModule;
  beforeAll(async () => {
    // The production build has the Lifetime price id (the card needs it); the words of a page served without a marker need it too.
    vi.stubEnv('VITE_PADDLE_PRICE_ID_LIFETIME', 'pri_test_build');
    flagsModule = await import('../src/features/flags.ts');
    providersModule = await import('../src/auth/providers.ts');
    kvModule = (await import('../src/storage/kv.ts')).kv;
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    kvModule?.remove('flags', 'last-known');
    kvModule?.remove('auth', 'providers');
    flagsModule?.resetFlagsForTests();
    providersModule?.resetProvidersForTests();
  });

  // `on`: the flags the app last heard (its cached /api/features answer) and the providers it can use.
  // `marker`: the content of the <meta name="sb-copy-flags"> the server wrote into the page, or null for a page without one
  // (a visitor served the cached app shell); when there is one it wins over what the app last heard.
  async function renderPage(path, on, { marker = null } = {}) {
    const [{ createElement }, { renderToStaticMarkup }] = await Promise.all([import('react'), import('react-dom/server')]);
    const load = {
      '/': async () => (await import('../src/pages/Landing.tsx')).Landing,
      '/about': async () => (await import('../src/pages/About.tsx')).About,
      '/how-it-works': async () => (await import('../src/pages/HowItWorks.tsx')).HowItWorks,
      '/pricing': async () => (await import('../src/pages/PricingPage.tsx')).PricingPage,
    }[path];
    const flags = Object.fromEntries(on.map(name => [name, true]));
    kvModule.set('flags', 'last-known', { at: Date.now(), flags });
    kvModule.set('auth', 'providers', {
      at: Date.now(),
      value: { magic_link: on.includes('signin_magic_link'), apple: on.includes('signin_apple'), microsoft: on.includes('signin_microsoft') },
    });
    flagsModule.resetFlagsForTests();
    providersModule.resetProvidersForTests();
    const Page = await load();
    if (marker !== null) {
      globalThis.document = { querySelector: selector => (selector === 'meta[name="sb-copy-flags"]' ? { getAttribute: () => marker } : null) };
    }
    try { return renderToStaticMarkup(createElement(Page)); } finally { if (marker !== null) delete globalThis.document; }
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

    it(`${state.name}: the pricing FAQ is one text in the page, the article and the FAQPage data`, async () => {
      const srv = await startServer(state.flags, state.env);
      try {
        const html = (await get(srv, '/pricing')).text;
        const faq = jsonLd(html).find(b => b['@type'] === 'FAQPage');
        const schema = faq.mainEntity.map(q => [textOf(q.name), textOf(q.acceptedAnswer.text)]);
        const rendered = await renderPage('/pricing', state.on);
        const visible = [...rendered.matchAll(/<details[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/details>/g)]
          .map(m => [textOf(m[1]), textOf(m[2])]);
        expect(schema).toHaveLength(4);
        expect(schema).toEqual(visible);
        const article = textOf(articleOf(html));
        for (const [q, a] of schema) { big(article, q).toContain(q); big(article, q).toContain(a); }
        // and the plans it names are the ones this state sells: Lifetime in all three or in none
        const lifetime = state.on.includes('lifetime_plan');
        for (const [name, text] of [['page', JSON.stringify(visible)], ['data', JSON.stringify(schema)], ['article', article]]) {
          expect(/pick the monthly, yearly or Lifetime plan/.test(text), `${state.name}: ${name}`).toBe(lifetime);
          expect(/pick the monthly or yearly plan to keep going/.test(text), `${state.name}: ${name}`).toBe(!lifetime);
        }
      } finally { await srv.stop(); }
    }, 30000);

    it(`${state.name}: every sentence a rule changes reads the same in the page and in the crawler article`, async () => {
      const srv = await startServer(state.flags, state.env);
      const isOn = name => state.on.includes(name);
      try {
        for (const path of ['/', '/about', '/how-it-works', '/pricing']) {
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
      big((await get(both, '/features/habit-reversal-coaching')).text).toContain('<meta name="sb-copy-flags" content="event_sync phone_companion">');
      for (const page of ['/', '/about', '/pricing', '/compare/ai-detection-apps', '/blog/how-to-stop-nail-biting']) {
        big((await get(both, page)).text, page).toContain('<meta name="sb-copy-flags" content="event_sync phone_companion">');
        big((await get(one, page)).text, page).toContain('<meta name="sb-copy-flags" content="phone_companion">');
        big((await get(other, page)).text, page).notToContain('sb-copy-flags');
      }
      big((await get(both, '/this-does-not-exist')).text).notToContain('sb-copy-flags');
      // the marker names no flag but the three that change copy, so it tells a crawler nothing about unreleased features
      big((await get(both, '/')).text).notToMatch(/sb-copy-flags" content="[^"]*hrt_coaching/);
    } finally { await both.stop(); await one.stop(); await other.stop(); }
  }, 30000);

  it('a page served with the marker takes the Lifetime flag from it, not from what the app last heard', async () => {
    const pickPlan = text => (/pick the monthly, yearly or Lifetime plan/.test(text) ? 'lifetime' : /pick the monthly or yearly plan to keep going/.test(text) ? 'two plans' : 'missing');
    // the server judged the plan on (flag AND price id), though the app's cached answer has not heard of it
    expect(pickPlan(textOf(await renderPage('/pricing', [], { marker: 'lifetime_plan' })))).toBe('lifetime');
    expect(pickPlan(textOf(await renderPage('/pricing', ['event_sync'], { marker: 'event_sync lifetime_plan' })))).toBe('lifetime');
    // the server judged it off (flag on, no price id: the marker lists other flags only), though the app's answer says the flag is on
    expect(pickPlan(textOf(await renderPage('/pricing', ['lifetime_plan'], { marker: 'event_sync' })))).toBe('two plans');
    // no marker (the cached shell): the app's own last answer, as for every other copy flag
    expect(pickPlan(textOf(await renderPage('/pricing', ['lifetime_plan'])))).toBe('lifetime');
    expect(pickPlan(textOf(await renderPage('/pricing', [])))).toBe('two plans');
    // the homepage answers follow the marker too
    const home = textOf(await renderPage('/', [], { marker: 'lifetime_plan' }));
    expect(home).toContain(`It costs $2.99 a month, $29 a year or a one-time Lifetime payment after a ${TRIAL_HYPHEN} free trial with no card.`);
    expect(home).toContain('A monthly or yearly plan can be cancelled anytime from the app settings, and you keep access until the end of the paid period.');
  });

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
