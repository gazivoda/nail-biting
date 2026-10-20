import { describe, it, expect } from 'vitest';
import { BLOG_POSTS } from './blogPosts';

// readingMinutes feeds BlogPosting.timeRequired in the crawler JSON-LD, so it
// must not drift from the text. Same measure the SEO audit used: words in the
// body, list items and html (tags stripped), at 230 words a minute, and a post
// may be off by one minute but not more.
const words = (s: string) => (s.match(/\w+/g) ?? []).length;
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&#?\w+;/g, ' ');

describe('readingMinutes', () => {
  it('stays within one minute of the text length for every post', () => {
    const off: string[] = [];
    for (const p of BLOG_POSTS) {
      let w = 0;
      for (const sec of p.sections) {
        w += words(sec.body ?? '');
        for (const l of sec.list ?? []) w += words(l);
        w += words(stripHtml(sec.html ?? ''));
      }
      const computed = Math.max(1, Math.round(w / 230));
      if (Math.abs(p.readingMinutes - computed) > 1) off.push(`${p.slug}: ${p.readingMinutes} vs ${computed}`);
    }
    expect(off).toEqual([]);
  });
});
