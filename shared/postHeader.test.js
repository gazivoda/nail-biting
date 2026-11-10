// shared/postHeader.js: what a blog article's header says, for visitors (src/pages/BlogPost.tsx) and for crawlers (server.js,
// blogArticleHtml). The two views are compared end to end in src/utils/serverSchema.test.ts; these pin the shared pieces.

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AUTHOR_DISCLOSURE, formatPostDate } from './postHeader.js';

const TZ = process.env.TZ;
afterEach(() => {
  if (TZ === undefined) delete process.env.TZ; else process.env.TZ = TZ;
});

describe('formatPostDate', () => {
  it('writes the day, the month in full and the year, day first', () => {
    expect(formatPostDate('2026-10-19')).toBe('19 October 2026');
    expect(formatPostDate('2026-10-01')).toBe('1 October 2026');
    expect(formatPostDate('2026-09-30')).toBe('30 September 2026');
  });

  // Dates are YYYY-MM-DD strings, `new Date('2026-10-19')` is midnight UTC, and a formatter that reads it in the reader's
  // time zone prints "18 October 2026" west of Greenwich: neither the page's date nor its JSON-LD date.
  it.each(['America/Los_Angeles', 'Pacific/Honolulu', 'UTC', 'Pacific/Kiritimati'])('prints the same day in %s', zone => {
    process.env.TZ = zone;
    expect(formatPostDate('2026-10-19')).toBe('19 October 2026');
    expect(formatPostDate('2026-01-01')).toBe('1 January 2026');
    expect(formatPostDate('2026-12-31')).toBe('31 December 2026');
  });
});

describe('AUTHOR_DISCLOSURE', () => {
  it('says what the author is, and that he is not a clinician', () => {
    expect(AUTHOR_DISCLOSURE).toBe('A software developer who bit his nails for over 20 years, not a clinician.');
  });

  // scripts/sync-seo.mjs fingerprints src/data/editorialPolicy.ts as the whole text of /editorial-policy: a line added to that
  // file that the page does not show would move the page's lastmod (and sitemap.xml) for nothing, and fail `npm run seo:check`.
  it('is not typed into src/data/editorialPolicy.ts', () => {
    const policy = readFileSync(fileURLToPath(new URL('../src/data/editorialPolicy.ts', import.meta.url)), 'utf8');
    expect(policy).not.toContain(AUTHOR_DISCLOSURE);
  });
});
