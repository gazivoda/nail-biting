// The localized marketing pages (WS12b): /es, /es/pricing, /de/..., /pt-br/... in Spanish, German and Brazilian Portuguese.
//
// server.js owns the wiring (the helpers it passes in, the dist folder); the decisions live here so they are unit-tested
// without booting a server, and so server.js carries one named block instead of 800 lines.
//
// THE THREE STATES of a language (the whole policy, one function: localeState):
//
//   off    the language's flag (locale_es, locale_de, locale_pt_br) is off. Production today. Nothing is registered:
//          the addresses are the branded 404 like any unknown address, they are in no sitemap, no page names them in a
//          hreflang, no language switcher is drawn. The site is byte for byte what it was without this module.
//   draft  the flag is ON but the language's `reviewed` marker (src/i18n/locales/<x>/reviewed.ts) is still false:
//          nobody has had a native speaker read the machine translation. The pages answer 200 so the owner and the
//          translator can QA them, with <meta name="robots" content="noindex,follow"> and X-Robots-Tag, NOT in the
//          sitemap, NOT in any hreflang. The English pages gain only the language switcher.
//   live   flag on AND reviewed: fully indexable. Self canonical, hreflang for every live language plus x-default
//          (the same set on the English page and on every localized page, so it is reciprocal), sitemap entries with
//          xhtml:link alternates, localized structured data.
//
// The text comes from dist/i18n/<locale>.json (scripts/generate-locale-pages.mjs renders it from src/i18n at build
// time, so the runtime image needs no catalogs and no message formatter). Those files are never served.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flagAwareDeep, fillCopyTokensDeep } from '../../shared/flagCopy.js';

export const ORIGIN = 'https://stopbiting.today';
export const LOCALE_CODES = ['es', 'de', 'pt-BR'];
export const PAGES = ['home', 'how', 'pricing', 'about'];
/** The English address of each page the localized pages mirror. */
export const ENGLISH_PATHS = { home: '/', how: '/how-it-works', pricing: '/pricing', about: '/about' };

const pageOfEnglishPath = Object.fromEntries(Object.entries(ENGLISH_PATHS).map(([page, path]) => [path, page]));

// ── Reading the files ────────────────────────────────────────────────────────

/**
 * dist/i18n/<locale>.json for each language, or null where the file is missing or not understood. A language with no
 * usable file is simply "off": the server never serves half a translation.
 */
export function loadLocaleFiles(dir, { warn = console.error } = {}) {
  const out = {};
  for (const locale of LOCALE_CODES) {
    const file = join(dir, `${locale}.json`);
    out[locale] = null;
    if (!existsSync(file)) continue;
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      if (data?.version !== 1 || data.locale !== locale || typeof data.flag !== 'string' || !data.pages || !data.paths) {
        warn(`[locale] ${file} is not a version 1 file for ${locale}; ${locale} stays off.`);
        continue;
      }
      out[locale] = data;
    } catch (err) {
      warn(`[locale] ${file} is invalid JSON; ${locale} stays off.`, err);
    }
  }
  return out;
}

// ── The three states ─────────────────────────────────────────────────────────

/** 'off' | 'draft' | 'live' for one language. The only place the rule is written down. */
export function localeState(flags, data) {
  if (!data || !flags.isOn(data.flag)) return 'off';
  return data.reviewed === true ? 'live' : 'draft';
}

export function localeStates(flags, files) {
  return Object.fromEntries(LOCALE_CODES.map(locale => [locale, localeState(flags, files[locale])]));
}

const withState = (states, ...wanted) => LOCALE_CODES.filter(l => wanted.includes(states[l]));
/** Languages that are served at all (draft and live). */
export const servedLocales = states => withState(states, 'draft', 'live');
/** Languages that are indexable. */
export const liveLocales = states => withState(states, 'live');

// ── hreflang ─────────────────────────────────────────────────────────────────

/** The address of a page in a language: the English one for 'en'. */
function hrefOf(locale, page, files) {
  return `${ORIGIN}${locale === 'en' ? ENGLISH_PATHS[page] : files[locale].paths[page]}`;
}

/**
 * The hreflang set of a page: English, every LIVE language that has the page, and x-default (English). Empty when no
 * language is live. The same set goes on the English page and on every localized version, which is what makes the
 * annotations reciprocal.
 */
export function hreflangSet(page, states, files) {
  const live = liveLocales(states).filter(l => files[l]?.paths[page]);
  if (live.length === 0) return [];
  return [
    { hreflang: 'en', href: hrefOf('en', page, files) },
    ...live.map(l => ({ hreflang: files[l].hreflang, href: hrefOf(l, page, files) })),
    { hreflang: 'x-default', href: hrefOf('en', page, files) },
  ];
}

export function hreflangLinkTags(set) {
  return set.map(h => `<link rel="alternate" hreflang="${h.hreflang}" href="${h.href}">`).join('\n    ');
}

/**
 * The English page gains the language switcher's marker (any served language, draft included) and, for live languages,
 * the hreflang links. Everything else is returned untouched, and the page is returned as it came while no language is
 * served: with every flag off a request never reaches the rewrite below the first `if`.
 */
export function decorateEnglishHtml(html, requestPath, { states, files }) {
  const page = pageOfEnglishPath[requestPath];
  if (!page) return html;
  const offered = servedLocales(states).filter(l => files[l]?.paths[page]);
  if (offered.length === 0) return html;
  const marker = `<meta name="sb-locales" content="${offered.join(' ')}">`;
  // Appended with no whitespace of their own, so taking the marker and the links out again gives back the page as it was.
  const links = hreflangSet(page, states, files).map(h => `<link rel="alternate" hreflang="${h.hreflang}" href="${h.href}">`).join('');
  return html.replace('</head>', () => `${marker}${links}</head>`);
}

// ── sitemap ──────────────────────────────────────────────────────────────────

const XHTML_NS = 'xmlns:xhtml="http://www.w3.org/1999/xhtml"';

function alternateLines(set) {
  return set.map(h => `    <xhtml:link rel="alternate" hreflang="${h.hreflang}" href="${h.href}"/>`);
}

/**
 * sitemap.xml with the live languages in it: the English page of each localized page gains its xhtml:link alternates and
 * each live language gets its own <url> entry carrying the same alternates. Unchanged when nothing is live. A localized
 * page with no freshness date is listed without a <lastmod> (a wrong date is worse than none).
 */
export function withLocaleAlternates(xml, { states, files }) {
  const live = liveLocales(states);
  if (live.length === 0) return xml;
  let out = xml.includes('xmlns:xhtml=') ? xml : xml.replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"', m => `${m} ${XHTML_NS}`);
  const added = [];
  for (const page of PAGES) {
    const set = hreflangSet(page, states, files);
    if (set.length === 0) continue;
    const englishLoc = hrefOf('en', page, files);
    const block = new RegExp(`(  <url>\\n    <loc>${englishLoc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>[\\s\\S]*?)(  </url>)`);
    const m = block.exec(out);
    if (!m) continue;   // the English page is not in the sitemap: nothing to hang alternates on
    const changefreq = /<changefreq>([^<]*)<\/changefreq>/.exec(m[1])?.[1] ?? 'monthly';
    const priority = /<priority>([^<]*)<\/priority>/.exec(m[1])?.[1] ?? '0.8';
    out = out.replace(block, (_all, head, tail) => `${head}${alternateLines(set).join('\n')}\n${tail}`);
    for (const l of live) {
      if (!files[l]?.paths[page]) continue;
      added.push([
        '  <url>',
        `    <loc>${hrefOf(l, page, files)}</loc>`,
        ...(files[l].lastmod?.[page] ? [`    <lastmod>${files[l].lastmod[page]}</lastmod>`] : []),
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        ...alternateLines(set),
        '  </url>',
        '',
      ].join('\n'));
    }
  }
  const at = out.lastIndexOf('</urlset>');
  return at < 0 || added.length === 0 ? out : `${out.slice(0, at)}${added.join('\n')}\n${out.slice(at)}`;
}

// ── the localized 404 page ───────────────────────────────────────────────────

const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The branded 404 page in a language, made from the English one by swapping its text. Returns null when the English
 * template no longer has the pieces this knows about (the caller then serves the English page rather than a broken one).
 */
export function localizedNotFound(englishHtml, data) {
  const home = data.paths.home ?? `/${data.prefix}`;
  const swaps = [
    ['<html lang="en">', `<html lang="${escapeHtml(data.htmlLang)}">`],
    ['<title>Page not found | Stop Biting</title>', `<title>${escapeHtml(data.notFound.title)}</title>`],
    ['<h1>This page doesn\'t exist.</h1>', `<h1>${escapeHtml(data.notFound.h1)}</h1>`],
    ['<p>The link may be broken or the page may have moved. The app, the guides and everything else are where they were.</p>', `<p>${escapeHtml(data.notFound.p)}</p>`],
    ['<a class="btn btn-solid" href="/">Go to the homepage</a>', `<a class="btn btn-solid" href="${home}">${escapeHtml(data.notFound.home)}</a>`],
    ['<a class="btn btn-line" href="/blog">Read the guides</a>', `<a class="btn btn-line" href="/blog">${escapeHtml(data.notFound.blog)}</a>`],
    ['<a class="brand" href="/">', `<a class="brand" href="${home}">`],
  ];
  let out = englishHtml;
  for (const [from, to] of swaps) {
    if (!out.includes(from)) return null;
    out = out.replace(from, () => to);
  }
  return out;
}

// ── the noscript site navigation ─────────────────────────────────────────────

/**
 * The <noscript> site navigation in a language: the pages that exist in it first, then the English-only pages (blog,
 * tools, comparisons, legal) with their English labels, marked as English. `englishItems` is server.js's SITE_NAV (plus
 * the open gated pages); the English version of a page this language has is left out.
 */
export function localizedNoscriptNav(html, data, englishItems, escape = escapeHtml) {
  const covered = new Set(Object.keys(data.paths).map(page => ENGLISH_PATHS[page]));
  const own = data.nav.map(([href, label]) => `<li><a href="${escape(href)}">${escape(label)}</a></li>`);
  const english = englishItems
    .filter(([href]) => !covered.has(href))
    .map(([href, label]) => `<li><a href="${escape(href)}" lang="en">${escape(label)}</a></li>`);
  const nav = `<noscript><nav aria-label="${escape(data.navLabel)}"><h2>Stop Biting</h2><ul>${[...own, ...english].join('')}</ul></nav></noscript>`;
  return html.replace('</body>', () => `    ${nav}\n  </body>`);
}

// ── the product, as structured data ──────────────────────────────────────────

/** The shell's SoftwareApplication block with this language's words; the structure and every non-text field stay the shell's. */
export function localizeSoftwareApplication(shellHtml, data) {
  const re = /<!-- Structured Data: SoftwareApplication[\s\S]*?-->\s*<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
  const m = re.exec(shellHtml);
  if (!m) return shellHtml;
  let app;
  try { app = JSON.parse(m[1]); } catch { return shellHtml; }
  const localized = {
    ...app,
    description: data.app.description,
    operatingSystem: data.app.operatingSystem,
    inLanguage: data.app.inLanguage,
    offers: (app.offers ?? []).map((offer, i) => ({ ...offer, ...(data.app.offers[i] ?? {}) })),
    featureList: data.app.featureList,
  };
  return shellHtml.replace(re, () => `<script type="application/ld+json">${JSON.stringify(localized)}</script>`);
}

// ── structured data ──────────────────────────────────────────────────────────

/**
 * The JSON-LD nodes of one localized page, in the language of the page. They describe what the page shows: the FAQPage
 * pairs are the visible FAQ (content.faq), the Breadcrumb is the trail, the WebPage carries `inLanguage`.
 *
 * `k` is what server.js owns: { WEBSITE_ID, ORG_ID, APP_ID, PERSON_ID, SCHEMA_AUTHOR, SCHEMA_SPEAKABLE, PERSON_KNOWS_ABOUT,
 * breadcrumbSchema, faqPageSchema }.
 */
export function schemaNodes(page, data, content, canonical, k) {
  const lastmod = data.lastmod?.[page];
  const dated = lastmod ? { dateModified: lastmod } : {};
  const inLanguage = data.hreflang;
  const image = {
    '@type': 'ImageObject',
    url: `${ORIGIN}/shots/app-watch-1280.webp`,
    width: 2560,
    height: 1584,
    caption: data.imageCaption,
  };
  const breadcrumb = k.breadcrumbSchema(content.breadcrumb);
  const faq = content.faq?.length ? { ...k.faqPageSchema(canonical, content.faqName, content.faq), inLanguage } : null;
  switch (page) {
    case 'pricing':
      return [{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': canonical,
        name: content.name,
        url: canonical,
        description: content.schemaDescription,
        isPartOf: { '@id': k.WEBSITE_ID },
        mainEntity: { '@id': k.APP_ID },
        speakable: k.SCHEMA_SPEAKABLE,
        inLanguage,
        about: { '@id': k.APP_ID },
        author: k.SCHEMA_AUTHOR,
        primaryImageOfPage: image,
        ...dated,
      }, faq, breadcrumb].filter(Boolean);
    default:
      return [breadcrumb];
  }
}

// ── resolving a file against this process's flags ────────────────────────────

/**
 * A language's file with the {{if flag}} markers and {{TOKENS}} resolved for this process. Done once at start-up
 * (flags change only on a restart), so a request does no work of its own.
 */
export function resolveLocaleFile(data, { isOn, tokens }) {
  return flagAwareDeep(fillCopyTokensDeep(data, tokens), isOn);
}

// ── routes ───────────────────────────────────────────────────────────────────

/**
 * Registers the localized pages of every served language. A language that is off registers nothing at all.
 *
 * `h` is the bundle of helpers server.js already has (they close over its constants):
 *   app, files, states, shell (the index.html with FAQPage and MedicalCondition stripped), notFoundHtml,
 *   sendHtml, injectMeta, injectSsrArticle, schemaTag, noscriptNav(html, data), copyIsOn, tokens(locale),
 *   k: the structured-data constants and builders (see schemaNodes)
 */
export function registerLocalePages(h) {
  const served = servedLocales(h.states);
  const notices = [];
  for (const locale of served) {
    const raw = h.files[locale];
    const state = h.states[locale];
    const data = resolveLocaleFile(raw, { isOn: h.copyIsOn, tokens: h.tokens(locale) });
    const shell = localizeSoftwareApplication(h.shell, data);
    const notFound = localizedNotFound(h.notFoundHtml, data) ?? h.notFoundHtml;
    if (notFound === h.notFoundHtml) notices.push(`${locale}: 404 template not recognised, using English`);

    for (const page of Object.keys(data.paths)) {
      const path = data.paths[page];
      const content = data.pages[page];
      if (!content) continue;
      h.app.get(path, (_req, res) => {
        const canonical = `${ORIGIN}${path}`;
        let html = shell.replace('<html lang="en">', () => `<html lang="${data.htmlLang}">`);
        html = h.injectMeta(html, {
          title: content.title,
          description: content.description,
          canonical,
          // The shell's default card (the same file the English page uses); passing it makes the alt text the title.
          ogImage: `${ORIGIN}/og/site.png`,
        });
        const alternates = h.states
          ? LOCALE_CODES.filter(l => l !== locale && servedLocales(h.states).includes(l) && h.states[l] === 'live' && h.files[l]?.paths[page])
          : [];
        // og:locale, and the other live languages as og:locale:alternate
        const ogTags = [`<meta property="og:locale" content="${data.ogLocale}" />`]
          .concat(state === 'live' ? ['en_US', ...alternates.map(l => h.files[l].ogLocale)].map(v => `<meta property="og:locale:alternate" content="${v}" />`) : []);
        html = html.replace(/<meta property="og:locale" content="[^"]*" \/>/, () => ogTags.join('\n    '));
        if (state === 'draft') {
          // Nobody has read the translation yet: it is there to be checked, not to be found.
          html = html.replace(/<meta name="robots" content="[^"]*" \/>/, () => '<meta name="robots" content="noindex,follow" />');
        }
        const set = hreflangSet(page, h.states, h.files);
        const marker = `<meta name="sb-locales" content="${servedLocales(h.states).filter(l => h.files[l]?.paths[page]).join(' ')}">`;
        const head = [
          ...(state === 'live' && set.length ? [hreflangLinkTags(set)] : []),
          marker,
          ...schemaNodes(page, data, content, canonical, h.k).map(obj => h.schemaTag(obj)),
        ].join('\n    ');
        html = html.replace('</head>', () => `    ${head}\n  </head>`);
        html = h.injectSsrArticle(html, content.article);
        html = h.noscriptNav(html, data);
        if (state === 'draft') res.set('X-Robots-Tag', 'noindex, follow');
        h.sendHtml(res, html, 200, data.lastmod?.[page] ?? null);
      });
    }
    // Anything else under the prefix is this language's 404 (the English 404 for a language that is off).
    h.app.get(`/${data.prefix}/{*rest}`, (_req, res) => h.sendHtml(res, notFound, 404));
  }
  return { served, notices };
}
