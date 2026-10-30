// How many guides the blog has, for the home page's "See all N guides" link.
//
// The home page only needs this one number, but src/data/blogIndex.ts is 188 posts of title, description and dates
// (about 18 KB gzipped), and importing the array for its `.length` put all of it in the file every marketing page
// waits for. The number is worked out when the bundle is built, from that same file, and written in here:
// vite.config.ts and vitest.config.ts both set `__BLOG_COUNT__` from scripts/build/blogCount.ts. A test
// (blogCount.test.ts) compares it with the array, so it cannot drift and cannot go missing from either config.
declare const __BLOG_COUNT__: number;

export const BLOG_COUNT: number = __BLOG_COUNT__;
