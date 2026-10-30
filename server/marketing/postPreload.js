// The resource hint on /blog/<slug>.
//
// A post page fetches its article from /posts/<slug>.json (src/hooks/usePost.ts). Left alone, the browser only learns
// about that file after the entry bundle has been downloaded, parsed and run and React has committed its first render,
// so the request starts at the very end of the load, a whole round trip before the first paint of the article.
//
// The server knows the URL when it builds the HTML, so it says so in the head and the browser asks for the file while
// it is still downloading the bundle. `crossorigin` is required, even though the file is same-origin: fetch() defaults
// to CORS mode with same-origin credentials, which is what the attribute asks for. Without it Chrome discards the
// preload and fetches the file a second time (test: scripts/blogPostPreload.test.mjs asks for exactly one request).
//
// Nothing else about the page changes: title, description, canonical, robots and the JSON-LD are untouched, and the
// JSON itself keeps its `X-Robots-Tag: noindex` (a preload hint is not a link a crawler follows or indexes).

// The alphabet the build enforces on slugs (scripts/generate-seo-content.mjs, src/hooks/usePost.ts).
const SLUG = /^[a-z0-9-]+$/;

/** The tag to add before </head> of a post's page, indented like its neighbours. '' for a slug that is not a safe path segment. */
export function postPreloadTag(slug) {
  if (!SLUG.test(slug)) return '';
  return `    <link rel="preload" as="fetch" crossorigin href="/posts/${slug}.json" />\n`;
}
