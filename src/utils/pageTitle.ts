// Google renders roughly 600px of title text, about 60 characters.
//
// This mirrors buildPageTitle in server.js. The two cannot share a module —
// the Docker image copies only server.js and email.js, so the server has no
// access to src/ at runtime — so if you change the rules here, change them
// there too. The tests in pageTitle.test.ts pin the behaviour.
//
// Keeping them in step matters: the server puts a budgeted title in the HTML,
// and BlogPost then sets document.title on mount. Google indexes the rendered
// title, so a client that ignores the budget silently undoes the server's work.
const TITLE_BUDGET = 60;
const BRAND_SUFFIX = ' | Stop Biting';

export function buildPageTitle(rawTitle: string): string {
  const title = (rawTitle || '').trim();
  if (title.length + BRAND_SUFFIX.length <= TITLE_BUDGET) return title + BRAND_SUFFIX;
  if (title.length <= TITLE_BUDGET) return title;

  const clipped = title.slice(0, TITLE_BUDGET - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  // Only honour the word boundary if it still leaves a meaningful title.
  const trimmed = lastSpace > 30 ? clipped.slice(0, lastSpace) : clipped;
  return trimmed.replace(/[\s,;:.\-–—]+$/, '') + '…';
}
