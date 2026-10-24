// The localized marketing routes (WS12b), in ONE place. Pure TypeScript: no React, no DOM, no storage.
// The browser (App.tsx, the language switcher), the build (scripts/generate-locale-pages.mjs, which writes the
// copy of this table into dist/i18n/<locale>.json for the server) and the tests all read this file.
//
// URL scheme. The four core pages exist in each language under a lower-case prefix, with the English slug:
//
//     /            /how-it-works   /pricing   /about          English (unchanged)
//     /es          /es/how-it-works  /es/pricing  /es/about    Spanish
//     /de ...      /pt-br ...                                  German, Brazilian Portuguese
//
// Why English slugs: one table, an alternate address that is computed (never looked up), nothing to 404
// when somebody guesses the English slug, and the page a person lands on is identified by the same word in
// every language. The home page is `/es` and not `/es/`: the server's canonicalising 301 strips the trailing
// slash, so the slashless form is the canonical one. The prefix is `pt-br` (lower case) because that same
// 301 lower-cases every path; the locale CODE stays `pt-BR` (BCP 47), which is what hreflang and <html lang> use.
//
// Blog posts, comparison and solution pages, tools and the legal pages are English only and have no
// localized address, so they never get hreflang alternates and the language switcher is not drawn on them.

import type { Locale } from '../core.ts';

export type SiteLocale = Exclude<Locale, 'en'>;
export const SITE_LOCALES: readonly SiteLocale[] = ['es', 'de', 'pt-BR'];

export const SITE_PAGES = ['home', 'how', 'pricing', 'about'] as const;
export type SitePage = (typeof SITE_PAGES)[number];

/**
 * The pages that exist in the other languages. A page is added here when its text is translated, its server-rendered
 * copy follows it section by section and its tests pass; until then it has no localized address, no hreflang and no
 * language switcher. (The other core pages are English only.)
 */
export const LOCALIZED_PAGES: readonly SitePage[] = ['pricing', 'about'];

/** The English address of each localized page. */
export const ENGLISH_PATHS: Readonly<Record<SitePage, string>> = {
  home: '/',
  how: '/how-it-works',
  pricing: '/pricing',
  about: '/about',
};

/** The first path segment of a locale. Lower case: see the header. */
export const URL_PREFIX: Readonly<Record<SiteLocale, string>> = { es: 'es', de: 'de', 'pt-BR': 'pt-br' };

/** The value of hreflang and of <html lang>. */
export const HREFLANG: Readonly<Record<Locale, string>> = { en: 'en', es: 'es', de: 'de', 'pt-BR': 'pt-BR' };

/**
 * og:locale. Spanish is written for a general (Latin American leaning: "computadora") audience, so es_LA, the
 * code Facebook and LinkedIn list for "Spanish"; es_ES would claim Spain. German de_DE, Portuguese pt_BR.
 */
export const OG_LOCALE: Readonly<Record<Locale, string>> = { en: 'en_US', es: 'es_LA', de: 'de_DE', 'pt-BR': 'pt_BR' };

/** The feature flag that lets a locale's pages exist. */
export const SITE_FLAG: Readonly<Record<SiteLocale, 'locale_es' | 'locale_de' | 'locale_pt_br'>> = {
  es: 'locale_es',
  de: 'locale_de',
  'pt-BR': 'locale_pt_br',
};

export const ORIGIN = 'https://stopbiting.today';

/** The address of a page in a language: `/`, `/pricing`, `/es`, `/es/pricing`. */
export function pagePath(locale: Locale, page: SitePage): string {
  if (locale === 'en') return ENGLISH_PATHS[page];
  const prefix = `/${URL_PREFIX[locale]}`;
  return page === 'home' ? prefix : `${prefix}${ENGLISH_PATHS[page]}`;
}

/** The absolute URL (canonical, hreflang, sitemap) of a page in a language. */
export function pageUrl(locale: Locale, page: SitePage): string {
  return `${ORIGIN}${pagePath(locale, page)}`;
}

const BY_PATH = new Map<string, { locale: Locale; page: SitePage }>();
for (const locale of ['en', ...SITE_LOCALES] as Locale[]) {
  for (const page of SITE_PAGES) {
    if (locale === 'en' || LOCALIZED_PAGES.includes(page)) BY_PATH.set(pagePath(locale, page), { locale, page });
  }
}

/**
 * Which page and language an address is, or null when it is not one of the localized pages (or their English
 * originals). A trailing slash is ignored. The address is matched as written: it is lower case already
 * because the server redirects every other spelling.
 */
export function parseSitePath(pathname: string): { locale: Locale; page: SitePage } | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return BY_PATH.get(path) ?? null;
}

/** Whether an address belongs to the localized part of the site (a language prefix), whether or not the page exists. */
export function hasLocalePrefix(pathname: string): boolean {
  return /^\/(?:es|de|pt-br)(?:\/|$)/.test(pathname);
}

/** The locale named by the prefix of an address (`/pt-br/about` -> 'pt-BR'), or null. */
export function localeOfPrefix(pathname: string): SiteLocale | null {
  const m = /^\/(es|de|pt-br)(?:\/|$)/.exec(pathname);
  if (!m) return null;
  return SITE_LOCALES.find(l => URL_PREFIX[l] === m[1]) ?? null;
}

/** The same page in another language, or null when this address has no equivalent (blog, compare, tools, legal). */
export function alternatePath(pathname: string, to: Locale): string | null {
  const here = parseSitePath(pathname);
  return here && isLocalizedPage(here.page) ? pagePath(to, here.page) : null;
}

/** Whether a core page has localized versions yet. */
export function isLocalizedPage(page: SitePage): boolean {
  return LOCALIZED_PAGES.includes(page);
}

/**
 * Every language version of a page that is live, as hreflang pairs, English first, then x-default. `live` is the
 * set of locales that are indexable (flag on AND reviewed). Empty when no locale is live: a page with nothing
 * to point at has no alternates at all.
 */
export function hreflangSet(page: SitePage, live: readonly SiteLocale[]): Array<{ hreflang: string; href: string }> {
  if (live.length === 0) return [];
  return [
    { hreflang: HREFLANG.en, href: pageUrl('en', page) },
    ...SITE_LOCALES.filter(l => live.includes(l)).map(l => ({ hreflang: HREFLANG[l], href: pageUrl(l, page) })),
    { hreflang: 'x-default', href: pageUrl('en', page) },
  ];
}
