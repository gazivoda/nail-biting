// Which comparison pages ship behind the `compare_competitors` feature flag.
//
// A path list and nothing else, so everything that needs to know a page is gated
// can import it cheaply: the client route (ComparePage.tsx, which must not pull
// in the gated copy for ordinary pages), scripts/sync-seo.mjs,
// scripts/generate-seo-content.mjs and scripts/generate-og-images.mjs (plain Node,
// which strips the types), and the tests. The server reads the same list out of
// dist/seo-gated.json, because the runtime image carries no src/.
//
// The page copy lives in src/data/competitorPages.ts.
//
// Gating means, while the flag is off: the server answers 404 (the branded,
// noindex 404 page), the client route renders its 404, the URL is absent from
// sitemap.xml, llms.txt, llms-full.txt and the noscript site navigation, and the
// copy is not in dist/seo-content.json. It is NOT a way to hide pages that are
// already published: never add a path that is in the sitemap today.

export const GATED_COMPARE_FLAG = 'compare_competitors';

export const GATED_COMPARE_PATHS = [
  '/compare/hands-off',
  '/compare/habitaware-keen',
];

export function isGatedComparePath(path: string): boolean {
  return GATED_COMPARE_PATHS.includes(path);
}
