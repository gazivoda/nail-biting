// End-to-end checks of the marketing site, against the REAL server.js and the REAL build.
//
//   npm run build:web && npm test
//
// Boots `node server.js` twice on free ports, with a scratch DATA_DIR and throwaway
// credentials, once with no flags and once with FEATURE_FLAGS=compare_competitors, and
// reads what a crawler reads: the raw HTML. Skipped (not failed) when dist/ has not been
// built, so a bare `npm test` on a fresh checkout stays green.
//
// What it pins:
//   · the two competitor pages are 404 + noindex and in no sitemap / nav / llms file while
//     the flag is off, and present (200, indexable, in the sitemap and nav) when it is on;
//   · no testimonial markup while the data file is empty;
//   · one description per page, no meta keywords, one theme-color, how-it-works' social card;
//   · retired privacy phrases at zero in what is served;
//   · JSON-LD parses and has its required fields, FAQPage text equals the visible FAQ text
//     (the crawler copy AND the rendered React page), SoftwareApplication carries offers,
//     and there are no ratings, reviews or SearchAction.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { heroShotPreloadTag, HERO_SHOT } from '../shared/heroShot.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const built = existsSync(join(ROOT, 'dist/index.html')) && existsSync(join(ROOT, 'dist/seo-gated.json'));
const GATED = ['/compare/hands-off', '/compare/habitaware-keen'];

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

async function startServer(featureFlags) {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'sb-marketing-'));
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
      // Set (empty) so a developer's real .env cannot fill them in: no mail, no Paddle, no desktop switch.
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
// vitest prints the whole received string when a string assertion fails, and these are
// 100 KB pages. Assert on booleans so a failure says what was missing, not the page.
const big = (text, label = '') => ({
  toContain: needle => expect(text.includes(needle), `${label} should contain ${needle}`).toBe(true),
  notToContain: needle => expect(text.includes(needle), `${label} should not contain ${needle}`).toBe(false),
  toMatch: re => expect(re.test(text), `${label} should match ${re}`).toBe(true),
  notToMatch: re => expect(re.test(text), `${label} should not match ${re}`).toBe(false),
});
const withoutComments = html => html.replace(/<!--[\s\S]*?-->/g, '');
const articleOf = html => html.match(/<article id="ssr-page-content">([\s\S]*?)<\/article>/)?.[1] ?? '';
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

describe.skipIf(!built)('marketing site, flags off', () => {
  let srv;
  beforeAll(async () => { srv = await startServer(''); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it.each(GATED)('%s is a 404 with noindex, no canonical, and none of its copy', async path => {
    const { status, text, headers } = await get(srv, path);
    expect(status).toBe(404);
    expect(headers.get('content-type')).toMatch(/text\/html/);
    big(text).toMatch(/<meta name="robots" content="noindex">/);
    big(text).notToMatch(/rel="canonical"/);
    big(text).notToMatch(/Hands Off|HabitAware|Keen3/);
  });

  it('the unpublished copy file is not served', async () => {
    expect((await get(srv, '/seo-gated.json')).status).toBe(404);
    const content = (await get(srv, '/seo-content.json')).text;
    for (const path of GATED) big(content).notToContain(`"${path}"`);
    big(content).notToContain('Keen3');
  });

  it('sitemap.xml is the generated file, byte for byte, with no gated URL', async () => {
    const { text } = await get(srv, '/sitemap.xml');
    expect(text === readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf8'), 'served sitemap equals dist/sitemap.xml').toBe(true);
    for (const path of GATED) big(text).notToContain(`stopbiting.today${path}<`);
  });

  it('llms.txt, llms-full.txt and the noscript site nav do not mention them', async () => {
    for (const file of ['/llms.txt', '/llms-full.txt']) {
      const { text } = await get(srv, file);
      for (const path of GATED) big(text).notToContain(path);
      big(text).notToContain('Keen3');
    }
    for (const page of ['/', '/pricing', '/how-it-works', '/compare/ai-detection-apps']) {
      const { text } = await get(srv, page);
      for (const path of GATED) big(text).notToContain(`href="${path}"`);
    }
  });

  it('the published Hands Off and HabitAware pages are untouched by the flag', async () => {
    for (const path of ['/compare/stop-biting-vs-hands-off', '/compare/stop-biting-vs-habitaware']) {
      const { status, text } = await get(srv, path);
      expect(status).toBe(200);
      big(text).toContain(`<link rel="canonical" href="https://stopbiting.today${path}"`);
      big(text).notToMatch(/<meta name="robots" content="noindex/);
    }
    expect((await get(srv, '/sitemap.xml')).text).toContain('/compare/stop-biting-vs-hands-off<');
  });

  it('no testimonial section reaches the HTML while the data file is empty', async () => {
    for (const page of ['/', '/pricing']) {
      const { text } = await get(srv, page);
      big(text).notToMatch(/In their own words|testimonials-heading|<blockquote/);
    }
  });

  it('no page carries meta keywords, and every page has a description of its own', async () => {
    const pages = ['/', '/blog', '/about', '/pricing', '/how-it-works', '/privacy', '/terms-and-conditions', '/refund-policy',
      '/editorial-policy', '/tools/nail-biting-cost-calculator', '/tools/nail-biting-tracker-printable',
      '/tools/nail-growth-timeline-calculator', '/compare/ai-detection-apps', '/compare/stop-biting-vs-hands-off',
      '/solutions/for-adhd', '/blog/habit-reversal-training-guide'];
    const descriptions = new Map();
    for (const page of pages) {
      const { status, text } = await get(srv, page);
      expect(status, page).toBe(200);
      big(text, page).notToMatch(/<meta name="keywords"/i);
      const d = metaContent(text, 'name="description"');
      expect(d?.length ?? 0, `${page} description`).toBeGreaterThan(60);
      expect(d.length, `${page} description`).toBeLessThanOrEqual(175);
      descriptions.set(page, d);
    }
    expect(new Set(descriptions.values()).size).toBe(pages.length);
  });

  it('/how-it-works uses the site card and the one theme-color', async () => {
    for (const page of ['/', '/how-it-works', '/pricing', '/about']) {
      const { text } = await get(srv, page);
      expect(metaContent(text, 'name="theme-color"'), page).toBe('#F7F7F1');
      expect(metaContent(text, 'property="og:image"'), page).toBe('https://stopbiting.today/og/site.png');
      expect(metaContent(text, 'name="twitter:image"'), page).toBe('https://stopbiting.today/og/site.png');
      big(withoutComments(text), page).notToContain('/og-image.png');
    }
  });

  // The home page's LCP element is the hero screenshot, which React only draws after the bundle has run. The HTML preloads it
  // so it is already on its way, with the candidates and `sizes` of the <img> (shared/heroShot.js), and nothing else.
  it('`/` preloads the hero screenshot once, with the shared candidates, and every candidate is served as an image', async () => {
    const { text } = await get(srv, '/');
    const preloads = text.match(/<link rel="preload" as="image"[^>]*>/g) ?? [];
    expect(preloads).toEqual([heroShotPreloadTag()]);
    for (const candidate of HERO_SHOT.srcSet.split(',').map(c => c.trim().split(/\s+/)[0])) {
      const res = await fetch(srv.url + candidate);
      expect(res.status, candidate).toBe(200);
      expect(res.headers.get('content-type'), candidate).toMatch(/image\/webp/);
      await res.arrayBuffer();
    }
    // The other marketing pages do not carry it: it is the home page's picture.
    for (const page of ['/pricing', '/how-it-works', '/about']) big((await get(srv, page)).text, page).notToContain('rel="preload" as="image"');
  });

  it('serves none of the retired privacy phrases (Stop Biting\'s own claims)', async () => {
    const RETIRED = [/100% private/i, /no cloud, no server/i, /zero network requests/i, /zero camera-related/i, /nothing leaves your device/i,
      /everything stays on your device/i, /100% on-device/i, /nothing is transmitted/i, /no server endpoint/i, /no cloud dependency/i,
      /works? fully offline/i, /runs offline thereafter/i, /watching never does/i, /no network access/i, /zero bytes/i];
    const pages = ['/', '/how-it-works', '/pricing', '/about', '/privacy', '/compare/ai-detection-apps', '/compare/stop-biting-vs-hands-off',
      '/solutions/for-desk-workers', '/blog/webcam-privacy-nail-biting-app', '/blog/how-ai-can-help-stop-nail-biting',
      '/blog/mediapipe-ai-detection-explained', '/blog/stop-biting-app-review', '/llms.txt', '/llms-full.txt', '/seo-content.json'];
    const hits = [];
    for (const page of pages) {
      const { text } = await get(srv, page);
      for (const re of RETIRED) if (re.test(text)) hits.push(`${page}: ${re}`);
    }
    expect(hits).toEqual([]);
  }, 30000);
});

describe.skipIf(!built)('marketing site, compare_competitors on', () => {
  let srv;
  beforeAll(async () => { srv = await startServer('compare_competitors'); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it.each(GATED)('%s is a 200, indexable, self-canonical page with its own card or the site card', async path => {
    const { status, text } = await get(srv, path);
    expect(status).toBe(200);
    big(text).toContain(`<link rel="canonical" href="https://stopbiting.today${path}"`);
    big(text).notToMatch(/<meta name="robots" content="noindex/);
    expect(metaContent(text, 'name="robots"')).toMatch(/^index, follow/);
    expect(metaContent(text, 'property="og:image"')).toMatch(/^https:\/\/stopbiting\.today\/og\/[\w-]+\.png$/);
    expect(articleOf(text)).toMatch(/<h1>/);
    big(text).notToMatch(/<meta name="keywords"/i);
  });

  it('sitemap.xml gains exactly the two pages, with the dates from the freshness ledger', async () => {
    const base = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf8');
    const { text, headers } = await get(srv, '/sitemap.xml');
    expect(headers.get('content-type')).toMatch(/application\/xml/);
    expect(text.match(/<url>/g).length).toBe(base.match(/<url>/g).length + 2);
    for (const path of GATED) {
      big(text).toMatch(new RegExp(`<loc>https://stopbiting\\.today${path}</loc>\\s*<lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`));
    }
    // Everything that was in the file is still in it, in order.
    expect(text.startsWith(base.slice(0, base.lastIndexOf('</urlset>')))).toBe(true);
    expect(srv.log()).not.toMatch(/has no freshness date/);
  });

  it('the noscript site nav lists them, on every page that has the nav', async () => {
    for (const page of ['/', '/pricing', '/how-it-works', ...GATED]) {
      const { text } = await get(srv, page);
      for (const path of GATED) big(text, page).toContain(`<a href="${path}">`);
    }
  });

  it('llms.txt and llms-full.txt list them while the flag is on (WS11b adds them at serve time; the built files never do)', async () => {
    for (const file of ['/llms.txt', '/llms-full.txt']) {
      const { text } = await get(srv, file);
      for (const path of GATED) big(text, file).toContain(`https://stopbiting.today${path}`);
      expect(text.length, file).toBeGreaterThan(readFileSync(join(ROOT, `dist${file}`), 'utf8').length);
    }
  });

  it('the copy file is still not served', async () => {
    expect((await get(srv, '/seo-gated.json')).status).toBe(404);
  });

  it('the crawler copy of each page carries its dated verification section and source links', async () => {
    for (const [path, host] of [['/compare/hands-off', 'handsoffapp.com'], ['/compare/habitaware-keen', 'habitaware.com']]) {
      const { text } = await get(srv, path);
      const article = articleOf(text);
      big(article).toContain('How we verified this page');
      big(article).toContain('23 October 2026');
      big(article).toContain(`href="https://${host}`);
      big(article).notToMatch(/<img/);
    }
  });
});

describe.skipIf(!built)('structured data', () => {
  let srv;
  beforeAll(async () => { srv = await startServer('compare_competitors'); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  const PAGES = ['/', '/pricing', '/how-it-works', '/about', '/blog', '/privacy', '/compare/ai-detection-apps', ...GATED];
  const needsFaq = new Set(['/', '/pricing', '/how-it-works', ...GATED]);

  it.each(PAGES)('%s: JSON-LD parses, nothing invented, required fields present', async path => {
    const { text } = await get(srv, path);
    const blocks = jsonLd(text);
    expect(blocks.length).toBeGreaterThanOrEqual(3);

    const everything = JSON.stringify(blocks);
    big(everything, path).notToMatch(/aggregateRating|"Review"|reviewRating|ratingValue|SearchAction|potentialAction/);

    // SoftwareApplication, with offers, on every route (the shell carries it).
    const app = blocks.find(b => b['@type'] === 'SoftwareApplication');
    expect(app, 'SoftwareApplication').toBeTruthy();
    expect(app.name).toBe('Stop Biting');
    expect(app.applicationCategory).toBeTruthy();
    expect(app.operatingSystem).toBeTruthy();
    expect(app.offers.length).toBeGreaterThanOrEqual(3);
    for (const offer of app.offers) {
      expect(offer['@type']).toBe('Offer');
      expect(offer.price).toMatch(/^\d+(\.\d+)?$/);
      expect(offer.priceCurrency).toBe('USD');
      expect(offer.name).toBeTruthy();
    }
    expect(app.offers.map(o => o.price)).toEqual(expect.arrayContaining(['0', '2.99', '29.00']));

    if (path !== '/') {
      const crumbs = blocks.find(b => b['@type'] === 'BreadcrumbList');
      expect(crumbs, 'BreadcrumbList').toBeTruthy();
      expect(crumbs.itemListElement.map(i => i.position)).toEqual(crumbs.itemListElement.map((_, i) => i + 1));
      for (const item of crumbs.itemListElement) expect(item.item).toMatch(/^https:\/\/stopbiting\.today\//);
    }

    const faq = blocks.find(b => b['@type'] === 'FAQPage');
    if (needsFaq.has(path)) expect(faq, 'FAQPage').toBeTruthy();
    if (faq) {
      expect(faq.mainEntity.length).toBeGreaterThan(0);
      // The crawler copy shows every question and answer the schema carries, word for word.
      const visible = textOf(articleOf(text));
      for (const q of faq.mainEntity) {
        expect(q['@type']).toBe('Question');
        expect(q.name).toBeTruthy();
        expect(q.acceptedAnswer['@type']).toBe('Answer');
        big(visible, `${path}: ${q.name}`).toContain(textOf(q.name));
        big(visible, `${path}: answer to ${q.name}`).toContain(textOf(q.acceptedAnswer.text));
      }
    }

    if (path.startsWith('/compare/')) {
      const article = blocks.find(b => b['@type'] === 'Article');
      expect(article, 'Article').toBeTruthy();
      expect(article.headline).toBeTruthy();
      expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.dateModified >= article.datePublished).toBe(true);
      expect(article.author.name).toBeTruthy();
      expect(article.publisher.name).toBeTruthy();
      expect(article.image.url).toMatch(/^https:\/\/stopbiting\.today\/og\//);
      expect(article.mainEntityOfPage['@id']).toBe(`https://stopbiting.today${path}`);
    }
    if (path === '/how-it-works') {
      const howTo = blocks.find(b => b['@type'] === 'HowTo');
      expect(howTo.step.length).toBeGreaterThanOrEqual(3);
    }
  });

  // The schema must describe what a visitor sees. A JS-rendering crawler sees the React page,
  // not the crawler copy, so render the React page and compare its FAQ with the schema.
  it.each([
    ['/', async () => (await import('../src/pages/Landing.tsx')).Landing],
    ['/pricing', async () => (await import('../src/pages/PricingPage.tsx')).PricingPage],
    ['/how-it-works', async () => (await import('../src/pages/HowItWorks.tsx')).HowItWorks],
  ])('%s: FAQPage equals the FAQ the React page renders, question for question', async (path, load) => {
    const [{ createElement }, { renderToStaticMarkup }, Page] = await Promise.all([
      import('react'), import('react-dom/server'), load(),
    ]);
    const html = renderToStaticMarkup(createElement(Page));
    const visible = [...html.matchAll(/<details[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/details>/g)]
      .map(m => [textOf(m[1]), textOf(m[2])]);
    expect(visible.length).toBeGreaterThan(1);

    const faq = jsonLd((await get(srv, path)).text).find(b => b['@type'] === 'FAQPage');
    const schema = faq.mainEntity.map(q => [textOf(q.name), textOf(q.acceptedAnswer.text)]);
    expect(schema).toEqual(visible);
  });
});
