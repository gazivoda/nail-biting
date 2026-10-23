// Pure helpers for marketing pages that ship behind a feature flag: the two competitor
// profile pages behind `compare_competitors` (WS11a) and the feature pages of WS11b, each
// behind the flag of the feature it describes.
//
// server.js owns the wiring (reading dist/seo-gated.json, the routes, the flags); the
// decisions live here so they are unit-tested without booting a server:
//
//   isGateOpen(flags, meta)        a COMPARE_META entry with a `flag` is served
//                                  only while that flag is on
//   openGatedPages(...)            the gated pages whose own flag is on (WS11b: each page
//                                  names its flag in seo-gated.json, so turning one feature
//                                  on opens that page and no other)
//   resolveGatedPage(...)          the page copy for the flags and numbers of this process
//   gatedNavLinks(content)         the [href, label] pairs the noscript site nav
//                                  adds for the OPEN pages
//   gatedSitemapEntries(...)       <url> data for the open pages that have a
//                                  freshness date
//   withGatedSitemapEntries(...)   splices those into the generated sitemap.xml
//   withGatedLlmsTxt / withGatedLlmsFull   the same for llms.txt and llms-full.txt
//   gatedOgFile / isClosedGatedFile        which /og card belongs to which page
//
// The sitemap and llms files that scripts/sync-seo.mjs and the build write NEVER list a
// gated page; they are added here, at serve time, only while the page's flag is on. With
// every gated flag off server.js registers none of the handlers that use these helpers,
// and express.static serves the files exactly as it always did, byte for byte.

import { dropEmptySections, fillCopyTokensDeep, flagAwareDeep } from '../../shared/flagCopy.js';

/** The flag every page in seo-gated.json had before pages named their own (the competitor profiles). */
export const LEGACY_GATED_FLAG = 'compare_competitors';

/** Flag of a gated page, from the map the build writes into seo-gated.json. */
export function gatedFlagOf(gatedFlags, path) {
  return gatedFlags?.[path] ?? LEGACY_GATED_FLAG;
}

/** The subset of the gated pages whose own flag is on: { path: content }. */
export function openGatedPages(gatedContent, gatedFlags, flags) {
  const out = {};
  for (const [path, page] of Object.entries(gatedContent ?? {})) {
    if (flags.isOn(gatedFlagOf(gatedFlags, path))) out[path] = page;
  }
  return out;
}

/**
 * A page's copy as this process shows it: {{TOKEN}} placeholders filled from the
 * environment, {{if flag}} markers and site-wide copy rules resolved with `isOn`, and
 * any section a marker emptied dropped. The same function serves the crawler copy, the
 * schema and the JSON the page renders from, so the three cannot disagree.
 */
export function resolveGatedPage(page, { isOn, tokens = {} }) {
  return dropEmptySections(flagAwareDeep(fillCopyTokensDeep(page, tokens), isOn));
}

/** Whether a COMPARE_META entry may be served right now. Entries without a `flag` are always open. */
export function isGateOpen(flags, meta) {
  return !meta?.flag || flags.isOn(meta.flag);
}

/** [href, label] for the noscript site navigation, in the order the content file lists them. */
export function gatedNavLinks(gatedContent) {
  return Object.entries(gatedContent ?? {}).map(([path, page]) => [path, page.title]);
}

/**
 * Sitemap rows for gated pages. A page with no `lastmod` in the freshness ledger
 * is skipped (and reported through `warn`) rather than given an invented date:
 * a wrong lastmod is worse than a missing URL (see scripts/sync-seo.mjs).
 */
export function gatedSitemapEntries(gatedContent, lastmodOf, { origin = 'https://stopbiting.today', warn = () => {} } = {}) {
  const out = [];
  for (const path of Object.keys(gatedContent ?? {})) {
    const lastmod = lastmodOf(path);
    if (!lastmod) {
      warn(`[sitemap] ${path} has no freshness date; left out of sitemap.xml`);
      continue;
    }
    out.push({ loc: `${origin}${path}`, lastmod, changefreq: 'monthly', priority: '0.8' });
  }
  return out;
}

/** Inserts the entries before </urlset>, in the same shape sync-seo.mjs writes. */
export function withGatedSitemapEntries(xml, entries) {
  if (!entries.length) return xml;
  const block = entries.flatMap(e => [
    '  <url>',
    `    <loc>${e.loc}</loc>`,
    `    <lastmod>${e.lastmod}</lastmod>`,
    `    <changefreq>${e.changefreq}</changefreq>`,
    `    <priority>${e.priority}</priority>`,
    '  </url>',
    '',
  ]).join('\n');
  const at = xml.lastIndexOf('</urlset>');
  if (at < 0) return xml;
  return `${xml.slice(0, at)}${block}\n${xml.slice(at)}`;
}

/** The text llms-full.txt gains: each open page's block, in file order. '' when there are none. */
export function gatedLlmsFullText(openContent, llmsFull, resolveText = text => text) {
  const blocks = Object.keys(openContent ?? {})
    .map(path => llmsFull?.[path])
    .filter(Boolean)
    .map(resolveText);
  return blocks.length ? `${blocks.join('\n')}\n` : '';
}

/** llms-full.txt with the open pages' blocks appended (unchanged when there are none). */
export function withGatedLlmsFull(text, addition) {
  if (!addition) return text;
  return `${text}${text.endsWith('\n') ? '' : '\n'}\n${addition}`;
}

/** "- [title](url): description" lines for llms.txt, one per open page that has a description. */
export function gatedLlmsTxtLines(openContent, metaOf, { origin = 'https://stopbiting.today' } = {}) {
  const lines = [];
  for (const [path, page] of Object.entries(openContent ?? {})) {
    const description = metaOf(path)?.description;
    if (!description) continue;
    lines.push(`- [${page.title}](${origin}${path}): ${description}`);
  }
  return lines;
}

/** llms.txt with a section for the open pages appended (unchanged when there are no lines). */
export function withGatedLlmsTxt(text, lines) {
  if (!lines.length) return text;
  return `${text}${text.endsWith('\n') ? '' : '\n'}\n## Features and newer pages\n\n${lines.join('\n')}\n`;
}

/** The /og file name of a page, the way scripts/generate-og-images.mjs names it. */
export function gatedOgFile(path) {
  return `${path.replace(/^\//, '').replace(/\//g, '-')}.png`;
}

/**
 * Whether `file` (the part of the address after /og/) is the card of a gated page whose
 * flag is off. A card for a closed page must answer exactly like any file that does not
 * exist, or the existence of an unreleased page (its title is on the card) would show.
 */
export function isClosedGatedFile(file, gatedFlags, flags) {
  for (const path of Object.keys(gatedFlags ?? {})) {
    if (gatedOgFile(path) === file && !flags.isOn(gatedFlagOf(gatedFlags, path))) return true;
  }
  return false;
}

/** The address of the JSON a feature page renders from. */
export const pageDataPath = path => `/page-data${path}.json`;

/** The inverse of pageDataPath: the page path for a request path, or null. */
export function pathOfPageData(requestPath) {
  const m = /^\/page-data(\/[a-z0-9/-]+)\.json$/.exec(requestPath);
  return m ? m[1] : null;
}

/** JSON that can sit inside a <script type="application/json"> block without ending it early. */
export function jsonForScript(value) {
  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(lineSeparator).join('\\u2028')
    .split(paragraphSeparator).join('\\u2029');
}
