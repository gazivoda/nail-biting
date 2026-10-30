// The home page's guide count is a build-time constant (src/blogCount.ts), not `BLOG_INDEX.length`, so that the
// 188-post index stays out of the home page's JavaScript. This is what keeps the constant honest: the number the
// page says is the number of guides there are, and the test configuration defines it at all.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BLOG_COUNT } from './blogCount';
import { BLOG_INDEX } from './data/blogIndex';

describe('BLOG_COUNT', () => {
  it('is the number of guides in the blog index', () => {
    expect(BLOG_COUNT).toBe(BLOG_INDEX.length);
    expect(BLOG_COUNT).toBeGreaterThan(100);
  });

  it('is the only thing the home page takes from the blog index (the index itself is not imported there)', () => {
    const landing = readFileSync(new URL('./pages/Landing.tsx', import.meta.url), 'utf8');
    expect(landing).not.toMatch(/data\/blogIndex/);
    expect(landing).toMatch(/BLOG_COUNT/);
  });

  it('leaves the index to the blog page, which App.tsx loads lazily', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(app).not.toMatch(/^import .* from '\.\/pages\/BlogIndex';/m);
    expect(app).toMatch(/lazy\(\(\) => import\('\.\/pages\/BlogIndex'\)/);
  });
});
