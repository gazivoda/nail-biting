// What a blog article's header says, written once for both views of the post: the one a visitor reads (src/pages/BlogPost.tsx)
// and the one a crawler reads in the served HTML (server.js, blogArticleHtml). Each used to carry its own copy and they differed.

// The line under the byline: what the author is, short enough to sit beside the name. The same claim as AUTHOR_BIO.bio in
// src/data/editorialPolicy.ts. It lives here and not there on purpose: scripts/sync-seo.mjs fingerprints that whole file as the
// text of /editorial-policy, so a line that page does not show would move its lastmod without anything on the page changing.
export const AUTHOR_DISCLOSURE = 'A software developer who bit his nails for over 20 years, not a clinician.';

// How an article's date is written: "19 October 2026".
//
// Post dates are YYYY-MM-DD strings, and `new Date('2026-10-19')` is midnight UTC. Without `timeZone: 'UTC'` a browser west
// of Greenwich prints "18 October 2026", a day that is neither the date the post carries nor the `datePublished` /
// `dateModified` in its JSON-LD; pinning UTC prints the date as written wherever it runs (shared/postHeader.test.js).
export function formatPostDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
