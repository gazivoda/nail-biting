// Pure helpers for marketing pages that ship behind a feature flag (today: the
// two competitor profile pages behind `compare_competitors`).
//
// server.js owns the wiring (reading dist/seo-gated.json, the routes, the flag);
// the decisions live here so they are unit-tested without booting a server:
//
//   isGateOpen(flags, meta)        a COMPARE_META entry with a `flag` is served
//                                  only while that flag is on
//   gatedNavLinks(content)         the [href, label] pairs the noscript site nav
//                                  adds while the flag is on
//   gatedSitemapEntries(...)       <url> data for the pages that have a
//                                  freshness date
//   withGatedSitemapEntries(...)   splices those into the generated sitemap.xml
//
// The sitemap that scripts/sync-seo.mjs writes NEVER lists a gated page; they
// are added here, at serve time, only while the flag is on. Flag off: server.js
// does not touch /sitemap.xml and express.static serves the file as it always
// did, byte for byte.

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
