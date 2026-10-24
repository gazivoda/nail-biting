// Turns the catalogs of one language into the file the server reads (WS12b): dist/i18n/<locale>.json.
//
// The runtime image has no src/ folder and no message formatter, so every message is rendered HERE, at build time, with
// the same code the tests use. What the server receives is final text: the page's title, description, crawler copy,
// the data its JSON-LD is made of, the 404 page, and the review marker. Only the choices a build cannot make are left
// in the text, as markers the server resolves at start-up with its own flags (see translate.ts).
//
// scripts/generate-locale-pages.mjs is the only caller in production; the tests call it directly.

import { LOCALE_INFO } from '../core.ts';
import { siteBag } from './bag.ts';
import { buildAbout, buildHow, buildPricing, type PageFile } from './articles.ts';
import { createTranslator, mergeCatalogs, type CatalogLike } from './translate.ts';
import {
  HREFLANG, LOCALIZED_PAGES, OG_LOCALE, SITE_FLAG, URL_PREFIX, pagePath, type SiteLocale, type SitePage,
} from './routes.ts';
import { SITE_SCOPES, META_SCOPES } from '../scopes/site.ts';

/** What the server reads from dist/i18n/<locale>.json. */
export interface LocaleFile {
  /** Bumped when the shape changes, so a server never reads a file it does not understand. */
  version: 1;
  locale: SiteLocale;
  htmlLang: string;
  ogLocale: string;
  hreflang: string;
  /** First path segment: `es`, `de`, `pt-br`. */
  prefix: string;
  /** The feature flag that lets the pages exist. */
  flag: string;
  /** The review marker (src/i18n/locales/<x>/reviewed.ts): false until a native speaker has read the translation. */
  reviewed: boolean;
  /** The pages that exist in this language, with their addresses. */
  paths: Partial<Record<SitePage, string>>;
  pages: Partial<Record<SitePage, PageFile>>;
  /** Freshness date (YYYY-MM-DD) of each page, from the ledger src/data/pageUpdates.json; absent until `npm run seo:sync` has dated it. */
  lastmod: Partial<Record<SitePage, string>>;
  /** The localized pieces of the SoftwareApplication block (the rest comes from the shell). */
  app: {
    description: string;
    operatingSystem: string;
    inLanguage: string;
    offers: Array<{ name: string; description: string }>;
    featureList: string[];
  };
  /** The noscript site navigation: [path, label] for the pages that exist in this language. */
  nav: Array<[string, string]>;
  /** aria-label of that navigation. */
  navLabel: string;
  /** Image caption in structured data. */
  imageCaption: string;
  notFound: { title: string; h1: string; p: string; home: string; blog: string };
}

const englishMessages = (): CatalogLike => {
  const out: Record<string, Record<string, string>> = {};
  for (const [scope, mod] of Object.entries({ ...SITE_SCOPES, ...META_SCOPES })) out[scope] = mod.messages as Record<string, string>;
  return out;
};

export interface BuildInput {
  locale: SiteLocale;
  /** The freshness ledger (src/data/pageUpdates.json), if any. */
  ledger?: Record<string, { lastmod?: string }>;
  /** locales/<x>/site.ts `catalog` */
  site: CatalogLike;
  /** locales/<x>/meta.ts `catalog` */
  meta: CatalogLike;
  /** locales/<x>/reviewed.ts `reviewed` */
  reviewed: boolean;
  /** Trial length in days; defaults to this process's TRIAL_DAYS. */
  trialDays?: number;
}

export function buildLocaleFile({ locale, ledger = {}, site, meta, reviewed, trialDays }: BuildInput): LocaleFile {
  const tr = createTranslator({
    locale,
    catalog: mergeCatalogs(site, meta),
    english: englishMessages(),
    // sync and phone are decided per message by the translator (markers); the sign-in methods are a token the server fills in.
    bag: siteBag({ locale, methods: '{{SIGNIN_METHODS}}', trialDays }),
  });
  const m = (key: string) => tr.text('marketing-meta', key);

  const builders: Partial<Record<SitePage, () => PageFile>> = {
    pricing: () => buildPricing(tr, locale),
    about: () => buildAbout(tr, locale),
    how: () => buildHow(tr, locale),
  };
  const pages: Partial<Record<SitePage, PageFile>> = {};
  const paths: Partial<Record<SitePage, string>> = {};
  for (const page of LOCALIZED_PAGES) {
    const build = builders[page];
    if (!build) throw new Error(`LOCALIZED_PAGES lists "${page}" but no builder writes it`);
    pages[page] = build();
    paths[page] = pagePath(locale, page);
  }

  return {
    version: 1,
    locale,
    htmlLang: HREFLANG[locale],
    ogLocale: OG_LOCALE[locale],
    hreflang: HREFLANG[locale],
    prefix: URL_PREFIX[locale],
    flag: SITE_FLAG[locale],
    reviewed,
    paths,
    pages,
    lastmod: Object.fromEntries(
      LOCALIZED_PAGES.map(page => [page, ledger[pagePath(locale, page)]?.lastmod]).filter(([, d]) => typeof d === 'string'),
    ) as LocaleFile['lastmod'],
    app: {
      description: m('app.description'),
      operatingSystem: m('app.os'),
      inLanguage: LOCALE_INFO[locale].tag,
      offers: [
        { name: m('app.offer.trial.name'), description: m('app.offer.trial.description') },
        { name: m('app.offer.monthly.name'), description: m('app.offer.monthly.description') },
        { name: m('app.offer.yearly.name'), description: m('app.offer.yearly.description') },
      ],
      featureList: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => m(`app.feature.${n}`)),
    },
    nav: LOCALIZED_PAGES.map(page => [pagePath(locale, page), m(`nav.${page}`)] as [string, string]),
    navLabel: tr.text('marketing-chrome', 'nav.label'),
    imageCaption: m('image.caption'),
    notFound: {
      title: m('notfound.title'),
      h1: m('notfound.h1'),
      p: m('notfound.p'),
      home: m('notfound.home'),
      blog: m('notfound.blog'),
    },
  };
}
