// The links the site footer draws to pages that exist only while their feature flag is on, and where the footer learns them.
//
// A flag-gated page (src/data/featurePagePaths.ts) answers the branded 404 while its flag is off, so a link to it may exist
// only while it is on. The browser bundle does not carry those addresses (they would show an unreleased page to anyone who reads
// the script), and a marketing page must not make a request of its own to learn the flags (./copyFlags.ts). So the server, which
// knows which pages it is serving, writes the list into the page it sends:
//
//   <script type="application/json" id="sb-gated-links">[["/features/phone-companion","Log nail biting from your phone in two taps"]]</script>
//
// in the head of every page while at least one page is open (server/marketing/gatedPages.js, `gatedLinksMarkerTag`), and the
// footer reads it on its first render. With every page closed there is no block and the footer is what it always was. A visitor
// whose service worker serves the cached app shell gets no block either, and no link: unknown means no link, never a dead one.
//
// No React and no DOM at import time, so the reader is tested in node. It touches no storage and asks the server for nothing.

export const GATED_LINKS_ID = 'sb-gated-links';

export interface GatedLink {
  href: string;
  label: string;
}

// An address on this site: one leading slash, then plain path segments. No scheme, no host, no query, no fragment.
const SITE_PATH = /^\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;
const MAX_LINKS = 12;
const MAX_LABEL = 120;

/** The [href, label] pairs the server wrote; anything that is not that (absent, empty, junk) is no links. */
export function parseGatedLinks(text: string | null | undefined): GatedLink[] {
  if (typeof text !== 'string' || text.trim() === '') return [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: GatedLink[] = [];
  for (const item of data) {
    if (!Array.isArray(item) || typeof item[0] !== 'string' || typeof item[1] !== 'string') continue;
    const label = item[1].trim();
    if (!SITE_PATH.test(item[0]) || label === '' || label.length > MAX_LABEL) continue;
    out.push({ href: item[0], label });
    if (out.length === MAX_LINKS) break;
  }
  return out;
}

/** Reads the block out of the page, if there is a page. */
export function readGatedLinks(
  doc: Pick<Document, 'getElementById'> | undefined = typeof document === 'undefined' ? undefined : document,
): GatedLink[] {
  try {
    return parseGatedLinks(doc?.getElementById(GATED_LINKS_ID)?.textContent);
  } catch {
    return [];
  }
}
