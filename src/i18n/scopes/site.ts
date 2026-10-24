// Every MARKETING scope (WS12b), for the compiler (the locale files must cover each English key), for the build
// script that writes dist/i18n/<locale>.json, and for the tests. Kept apart from ./index.ts, which lists the signed-in
// app's scopes: the app's lazy catalog must not carry the marketing text, and the marketing catalog (the chunk a
// visitor fetches on /es/pricing) must not carry the app's. Import this only from tests and tooling.
//
// Two groups:
//   SITE_SCOPES  the text of the pages, fetched by the browser (src/i18n/locale-site-<x>.ts);
//   META_SCOPES  <title>, descriptions, structured data and the 404 page: read only by the build, which renders them
//                into dist/i18n/<locale>.json for the server. The browser never loads them.
//
// `plans` is the one app scope the marketing chunk shares (the lifetime and gift bands on /pricing draw it); its
// translation file is the app's own, imported by locales/<x>/site.ts, so there is one translation of it.
//
// (Imports carry their .ts extension: the build script loads this file with Node, which needs it.)
import * as plans from './plans.ts';
import * as chrome from './marketing-chrome.ts';
import * as pricing from './marketing-pricing.ts';
import * as about from './marketing-about.ts';
import * as how from './marketing-how.ts';
import * as home from './marketing-home.ts';
import * as demo from './marketing-demo.ts';
import * as meta from './marketing-meta.ts';

export const SITE_SCOPES = {
  plans,
  'marketing-chrome': chrome,
  'marketing-pricing': pricing,
  'marketing-about': about,
  'marketing-how': how,
  'marketing-home': home,
  'marketing-demo': demo,
} as const;

export const META_SCOPES = {
  'marketing-meta': meta,
} as const;

export type SiteScopeName = keyof typeof SITE_SCOPES;
export type SiteEnglishCatalog = { [S in SiteScopeName]: (typeof SITE_SCOPES)[S]['messages'] };
/** A translation covers every key of every marketing scope. */
export type SiteCatalog = { [S in SiteScopeName]: { [K in keyof SiteEnglishCatalog[S]]: string } };

export type MetaScopeName = keyof typeof META_SCOPES;
export type MetaEnglishCatalog = { [S in MetaScopeName]: (typeof META_SCOPES)[S]['messages'] };
export type MetaCatalog = { [S in MetaScopeName]: { [K in keyof MetaEnglishCatalog[S]]: string } };
