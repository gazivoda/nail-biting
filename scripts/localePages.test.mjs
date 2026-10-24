// End-to-end checks of the localized marketing pages (WS12b), against the REAL server.js and the REAL build.
//
//   npm run build:web && npm test
//
// Boots `node server.js` on free ports with a scratch DATA_DIR and throwaway credentials, once per state, and reads what
// a crawler reads: the raw HTML. Skipped (not failed) when dist/ has not been built.
//
// The three states of a language (server/marketing/localePages.js) and what each must do:
//   off    (flag off, production today)   branded 404, absent from the sitemap, named by no hreflang, no switcher; the
//                                         English pages are what they were
//   draft  (flag on, reviewed = false)    200 for QA; noindex in the page AND in X-Robots-Tag; not in the sitemap; named
//                                         by no hreflang; the English page gains only the switcher marker
//   live   (flag on, reviewed = true)     indexable; self canonical; the same hreflang set on the English page and on every
//                                         localized page (reciprocal); sitemap entries with alternates; localized JSON-LD
//
// "reviewed = true" is produced WITHOUT a switch in the server: the test writes copies of dist/i18n/*.json with the marker
// flipped and points SB_I18N_DIR at them. The committed marker (src/i18n/locales/<x>/reviewed.ts) is untouched.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const built = existsSync(join(ROOT, 'dist/index.html')) && existsSync(join(ROOT, 'dist/i18n/es.json'));

const LOCALES = ['es', 'de', 'pt-BR'];
const FLAG = { es: 'locale_es', de: 'locale_de', 'pt-BR': 'locale_pt_br' };
const ENGLISH = { home: '/', how: '/how-it-works', pricing: '/pricing', about: '/about' };
const ORIGIN = 'https://stopbiting.today';

const fileOf = locale => JSON.parse(readFileSync(join(ROOT, 'dist/i18n', `${locale}.json`), 'utf8'));
const FILES = built ? Object.fromEntries(LOCALES.map(l => [l, fileOf(l)])) : {};
const PAGES = built ? Object.keys(FILES.es.paths) : [];

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

/** A folder of copies of dist/i18n/*.json with the review marker set as asked (the committed marker is not touched). */
function reviewedDir(reviewed) {
  const dir = mkdtempSync(join(tmpdir(), 'sb-i18n-'));
  for (const l of LOCALES) writeFileSync(join(dir, `${l}.json`), JSON.stringify({ ...FILES[l], reviewed: reviewed.includes(l) }));
  return dir;
}

async function startServer({ flags = [], reviewed = null }) {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'sb-locale-'));
  const i18nDir = reviewed ? reviewedDir(reviewed) : null;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      DATA_DIR: dataDir,
      GOOGLE_CLIENT_ID: 'x',
      GOOGLE_CLIENT_SECRET: 'x',
      JWT_SECRET: 'test-secret-test-secret-test-secret-0123',
      FEATURE_FLAGS: flags.join(','),
      ...(i18nDir ? { SB_I18N_DIR: i18nDir } : {}),
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
      if (i18nDir) rmSync(i18nDir, { recursive: true, force: true });
    },
  };
}

const get = async (srv, path) => {
  const res = await fetch(srv.url + path, { redirect: 'manual' });
  return { status: res.status, headers: res.headers, text: await res.text() };
};

// vitest prints the whole received string when a string assertion fails, and these are 100 KB pages.
const has = (text, needle, label = '') => expect(text.includes(needle), `${label} should contain ${needle}`).toBe(true);
const lacks = (text, needle, label = '') => expect(text.includes(needle), `${label} should not contain ${needle}`).toBe(false);
const matches = (text, re, label = '') => expect(re.test(text), `${label} should match ${re}`).toBe(true);

const decode = s => s.replace(/&#x27;|&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// Inline tags (a link, a highlighted word) vanish; every other tag is a break between words.
const textOf = html => decode(html.replace(/<\/?(?:a|strong|em|b|i|mark)\b[^>]*>/g, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const metaContent = (html, selector) => html.match(new RegExp(`<meta ${selector}[^>]*content="([^"]*)"`))?.[1];
const canonicalOf = html => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
const articleOf = html => html.match(/<article id="ssr-page-content">([\s\S]*?)<\/article>/)?.[1] ?? '';
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
/** The alternate-language annotations of a page: <link rel="alternate" hreflang>. */
const hreflangs = html => [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)">/g)].map(m => [m[1], m[2]]);
const robotsMeta = html => [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map(m => m[1]);
const urlOf = path => `${ORIGIN}${path}`;

/** The English page with what a served language adds taken out again: the switcher marker and the hreflang links. */
const withoutLocaleAdditions = html => html
  .replace(/<meta name="sb-locales" content="[^"]*">/, '')
  .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g, '');

describe.skipIf(!built)('localized pages, every flag off (production today)', () => {
  let srv;
  const english = {};
  beforeAll(async () => {
    srv = await startServer({});
    for (const page of PAGES) english[page] = (await get(srv, ENGLISH[page])).text;
  }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('every localized address is the branded 404, byte for byte the page any unknown address gets', async () => {
    const unknown = await get(srv, '/this-page-does-not-exist');
    expect(unknown.status).toBe(404);
    for (const l of LOCALES) {
      const prefix = FILES[l].prefix;
      for (const path of [`/${prefix}`, `/${prefix}/`, `/${prefix}/anything`, ...PAGES.map(p => FILES[l].paths[p])]) {
        const r = await get(srv, path);
        // `/es/` redirects to `/es` (the canonicalising 301) and that is a 404; either way the end is the 404 page
        if (r.status === 301) continue;
        expect(r.status, path).toBe(404);
        expect(r.text === unknown.text, `${path} is the same body as an unknown address`).toBe(true);
      }
    }
  });

  it('the review files are never served, and answer like any address that does not exist', async () => {
    const unknown = await get(srv, '/this-page-does-not-exist');
    for (const l of LOCALES) {
      const r = await get(srv, `/i18n/${l}.json`);
      expect(r.status).toBe(404);
      expect(r.text === unknown.text).toBe(true);
    }
    expect((await get(srv, '/i18n')).status).toBe(404);
  });

  it('the English pages carry no marker, no hreflang and no switcher', () => {
    for (const page of PAGES) {
      lacks(english[page], 'sb-locales', page);
      lacks(english[page], 'hreflang', page);
      lacks(english[page], 'og:locale:alternate', page);
      matches(english[page], /<html lang="en">/, page);
    }
  });

  it('sitemap.xml is the generated file, byte for byte, with no localized address and no xhtml namespace', async () => {
    const { text } = await get(srv, '/sitemap.xml');
    expect(text === readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf8')).toBe(true);
    lacks(text, 'xhtml');
    for (const l of LOCALES) lacks(text, `/${FILES[l].prefix}`);
  });

  it('no log line announces a served language', () => {
    lacks(srv.log(), '[locale] served');
  });
});

describe.skipIf(!built)('localized pages, flag on but not reviewed (draft)', () => {
  let srv;
  const page = {};
  const baseline = {};
  beforeAll(async () => {
    const off = await startServer({});
    for (const p of PAGES) baseline[p] = (await get(off, ENGLISH[p])).text;
    baseline.sitemap = (await get(off, '/sitemap.xml')).text;
    await off.stop();
    srv = await startServer({ flags: LOCALES.map(l => FLAG[l]) });
    for (const l of LOCALES) for (const p of PAGES) page[`${l}:${p}`] = await get(srv, FILES[l].paths[p]);
  }, 60000);
  afterAll(async () => { await srv?.stop(); });

  it.each(LOCALES)('%s: every page answers 200 in its language, with its own canonical', l => {
    for (const p of PAGES) {
      const r = page[`${l}:${p}`];
      expect(r.status, `${l} ${p}`).toBe(200);
      matches(r.text, new RegExp(`<html lang="${FILES[l].htmlLang}">`), `${l} ${p}`);
      expect(canonicalOf(r.text), `${l} ${p}`).toBe(urlOf(FILES[l].paths[p]));
      expect(metaContent(r.text, 'property="og:locale"'), `${l} ${p}`).toBe(FILES[l].ogLocale);
      expect(textOf(articleOf(r.text)).length, `${l} ${p} has crawler copy`).toBeGreaterThan(500);
    }
  });

  it.each(LOCALES)('%s: noindex in the page and in X-Robots-Tag, exactly one robots meta', l => {
    for (const p of PAGES) {
      const r = page[`${l}:${p}`];
      expect(robotsMeta(r.text), `${l} ${p}`).toEqual(['noindex,follow']);
      expect(r.headers.get('x-robots-tag'), `${l} ${p}`).toMatch(/noindex/);
    }
  });

  it('no page names any localized address in a hreflang, and the sitemap is the generated file', async () => {
    for (const key of Object.keys(page)) lacks(page[key].text, 'hreflang', key);
    for (const p of PAGES) lacks((await get(srv, ENGLISH[p])).text, 'hreflang', p);
    const sitemap = (await get(srv, '/sitemap.xml')).text;
    expect(sitemap === baseline.sitemap, 'sitemap.xml is the generated file').toBe(true);
    expect(sitemap === readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf8')).toBe(true);
  });

  it('the English pages gain only the switcher marker', async () => {
    for (const p of PAGES) {
      const html = (await get(srv, ENGLISH[p])).text;
      expect(metaContent(html, 'name="sb-locales"'), p).toBe('es de pt-BR');
      expect(withoutLocaleAdditions(html) === baseline[p], `${p} is the English page, plus the marker`).toBe(true);
    }
  });

  it('a localized page lists the languages on offer in its marker and has no other language marker', () => {
    for (const l of LOCALES) for (const p of PAGES) expect(metaContent(page[`${l}:${p}`].text, 'name="sb-locales"')).toBe('es de pt-BR');
  });

  it.each(LOCALES)('%s: an unknown address under the prefix is that language\'s 404', async l => {
    const r = await get(srv, `/${FILES[l].prefix}/no-such-page`);
    expect(r.status).toBe(404);
    matches(r.text, new RegExp(`<html lang="${FILES[l].htmlLang}">`));
    matches(r.text, /<meta name="robots" content="noindex">/);
    lacks(r.text, 'rel="canonical"');
    has(r.text, FILES[l].notFound.h1);
  });

  it('the log says which language is served and in which state', () => {
    has(srv.log(), '[locale] served: es (draft), de (draft), pt-BR (draft)');
  });
});

describe.skipIf(!built)('localized pages, flag on and reviewed (live)', () => {
  let srv;
  const page = {};
  const baseline = {};
  beforeAll(async () => {
    const off = await startServer({});
    for (const p of PAGES) baseline[p] = (await get(off, ENGLISH[p])).text;
    await off.stop();
    srv = await startServer({ flags: LOCALES.map(l => FLAG[l]), reviewed: LOCALES });
    for (const l of LOCALES) for (const p of PAGES) page[`${l}:${p}`] = await get(srv, FILES[l].paths[p]);
    for (const p of PAGES) page[`en:${p}`] = await get(srv, ENGLISH[p]);
  }, 60000);
  afterAll(async () => { await srv?.stop(); });

  const expectedSet = p => [
    ['en', urlOf(ENGLISH[p])],
    ...LOCALES.map(l => [FILES[l].hreflang, urlOf(FILES[l].paths[p])]),
    ['x-default', urlOf(ENGLISH[p])],
  ];

  it.each(LOCALES)('%s: indexable, with a self canonical', l => {
    for (const p of PAGES) {
      const r = page[`${l}:${p}`];
      expect(r.status).toBe(200);
      expect(canonicalOf(r.text)).toBe(urlOf(FILES[l].paths[p]));
      expect(robotsMeta(r.text)[0], `${l} ${p}`).toMatch(/^index, follow/);
      expect(robotsMeta(r.text)).toHaveLength(1);
      expect(r.headers.get('x-robots-tag')).toBeNull();
      expect(metaContent(r.text, 'property="og:url"')).toBe(urlOf(FILES[l].paths[p]));
      expect(metaContent(r.text, 'name="twitter:title"')).toBe(metaContent(r.text, 'property="og:title"'));
      expect(metaContent(r.text, 'property="og:locale"')).toBe(FILES[l].ogLocale);
      expect(r.text.match(/<meta property="og:locale:alternate" content="([^"]*)"/g)?.length).toBe(LOCALES.length);   // en_US + the two others
    }
  });

  it('hreflang: every page of a set names the same members, so each points back at the others', () => {
    for (const p of PAGES) {
      const want = expectedSet(p);
      expect(hreflangs(page[`en:${p}`].text), `English ${p}`).toEqual(want);
      for (const l of LOCALES) expect(hreflangs(page[`${l}:${p}`].text), `${l} ${p}`).toEqual(want);
    }
  });

  it('hreflang targets exist and are indexable (a set never points at a 404 or a noindex page)', async () => {
    for (const p of PAGES) {
      for (const [, href] of expectedSet(p)) {
        const r = await get(srv, href.replace(ORIGIN, ''));
        expect(r.status, href).toBe(200);
        expect(robotsMeta(r.text)[0], href).toMatch(/^index/);
      }
    }
  });

  it('the English pages are the same as before, plus the marker and the hreflang links', () => {
    for (const p of PAGES) {
      const html = page[`en:${p}`].text;
      expect(metaContent(html, 'name="sb-locales"'), p).toBe('es de pt-BR');
      expect(withoutLocaleAdditions(html) === baseline[p], `${p} is the English page, plus the marker and the links`).toBe(true);
    }
  });

  it('sitemap.xml lists every localized page with xhtml alternates, and gives the English page the same set', async () => {
    const { text, headers } = await get(srv, '/sitemap.xml');
    expect(headers.get('content-type')).toMatch(/xml/);
    has(text, 'xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    const original = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf8');
    expect((text.match(/<url>/g) ?? []).length).toBe((original.match(/<url>/g) ?? []).length + LOCALES.length * PAGES.length);
    for (const p of PAGES) {
      const want = expectedSet(p);
      const entry = loc => text.match(new RegExp(`<url>\\n    <loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>[\\s\\S]*?</url>`))?.[0] ?? '';
      for (const loc of [urlOf(ENGLISH[p]), ...LOCALES.map(l => urlOf(FILES[l].paths[p]))]) {
        const block = entry(loc);
        expect(block.length, `${loc} is in the sitemap`).toBeGreaterThan(0);
        const links = [...block.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]*)" href="([^"]*)"\/>/g)].map(m => [m[1], m[2]]);
        expect(links, `${loc} alternates`).toEqual(want);
      }
    }
    // the generated pages are all still there
    for (const loc of original.matchAll(/<loc>([^<]*)<\/loc>/g)) has(text, `<loc>${loc[1]}</loc>`);
  });

  it.each(LOCALES)('%s: structured data is in the language and equals the visible page', l => {
    for (const p of PAGES) {
      const html = page[`${l}:${p}`].text;
      const blocks = jsonLd(html);
      const types = blocks.map(b => b['@type']);
      expect(types, `${l} ${p}`).toContain('SoftwareApplication');
      expect(types, `${l} ${p}`).toContain('BreadcrumbList');
      expect(types).not.toContain('MedicalCondition');
      const app = blocks.find(b => b['@type'] === 'SoftwareApplication');
      expect(app['@id']).toBe(`${ORIGIN}/#app`);
      expect(app.inLanguage).toBe(FILES[l].app.inLanguage);
      expect(app.description).toBe(FILES[l].app.description);
      expect(app.offers.map(o => [o.price, o.priceCurrency])).toEqual([['0', 'USD'], ['2.99', 'USD'], ['29.00', 'USD']]);   // the prices are the English prices
      expect(app.offers.map(o => o.name)).toEqual(FILES[l].app.offers.map(o => o.name));
      const webPage = blocks.find(b => ['WebPage', 'AboutPage', 'FAQPage'].includes(b['@type']) && b['@id'] === urlOf(FILES[l].paths[p]));
      expect(webPage, `${l} ${p} has its page node`).toBeTruthy();
      expect(webPage.inLanguage ?? blocks.find(b => b['@type'] === 'WebPage')?.inLanguage).toBe(FILES[l].hreflang);
      const crumb = blocks.find(b => b['@type'] === 'BreadcrumbList');
      expect(crumb.itemListElement.at(-1).item).toBe(urlOf(FILES[l].paths[p]));
      const faq = blocks.find(b => b['@type'] === 'FAQPage');
      if (faq) {
        const visible = textOf(articleOf(html));
        for (const q of faq.mainEntity) {
          has(visible, textOf(q.name), `${l} ${p} question`);
          has(visible, textOf(q.acceptedAnswer.text), `${l} ${p} answer`);
        }
        // and no English FAQPage rides in from the shell
        expect(blocks.filter(b => b['@type'] === 'FAQPage')).toHaveLength(1);
      }
    }
  });

  it.each(LOCALES)('%s: the crawler copy is the translation, not English', l => {
    for (const p of PAGES) {
      const text = textOf(articleOf(page[`${l}:${p}`].text));
      const h1 = textOf(page[`${l}:${p}`].text.match(/<article id="ssr-page-content"><h1>([\s\S]*?)<\/h1>/)[1]);
      has(text, h1);
      lacks(text, 'No camera data is sent while it runs');
      lacks(text, 'Detection runs on your device');
    }
  });

  it('the localized 404 is live too, indexable-neutral (noindex) and in its language', async () => {
    const r = await get(srv, '/de/no-such-page');
    expect(r.status).toBe(404);
    matches(r.text, /<html lang="de">/);
    has(r.text, FILES.de.notFound.h1);
  });

  it('the log says every language is live', () => {
    has(srv.log(), '[locale] served: es (live), de (live), pt-BR (live)');
  });
});

describe.skipIf(!built)('localized pages, mixed states', () => {
  let srv;
  beforeAll(async () => {
    // Spanish live, German a draft, Portuguese off
    srv = await startServer({ flags: ['locale_es', 'locale_de'], reviewed: ['es'] });
  }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('the English page names only the live language in hreflang and offers both served ones in the switcher', async () => {
    for (const p of PAGES) {
      const html = (await get(srv, ENGLISH[p])).text;
      expect(hreflangs(html), p).toEqual([['en', urlOf(ENGLISH[p])], ['es', urlOf(FILES.es.paths[p])], ['x-default', urlOf(ENGLISH[p])]]);
      expect(metaContent(html, 'name="sb-locales"'), p).toBe('es de');
    }
  });

  it('Spanish is indexable, German is noindex and unnamed, Portuguese is the 404', async () => {
    for (const p of PAGES) {
      const es = await get(srv, FILES.es.paths[p]);
      expect(es.status).toBe(200);
      expect(robotsMeta(es.text)[0]).toMatch(/^index/);
      expect(hreflangs(es.text)).toEqual([['en', urlOf(ENGLISH[p])], ['es', urlOf(FILES.es.paths[p])], ['x-default', urlOf(ENGLISH[p])]]);
      const de = await get(srv, FILES.de.paths[p]);
      expect(de.status).toBe(200);
      expect(robotsMeta(de.text)).toEqual(['noindex,follow']);
      expect(de.headers.get('x-robots-tag')).toMatch(/noindex/);
      lacks(de.text, 'hreflang=');
      expect((await get(srv, FILES['pt-BR'].paths[p])).status).toBe(404);
    }
  });

  it('the sitemap lists Spanish only', async () => {
    const { text } = await get(srv, '/sitemap.xml');
    for (const p of PAGES) has(text, `<loc>${urlOf(FILES.es.paths[p])}</loc>`);
    lacks(text, '/de/');
    lacks(text, '/pt-br');
    lacks(text, 'hreflang="de"');
  });
});
