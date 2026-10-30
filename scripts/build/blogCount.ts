// The value of the `__BLOG_COUNT__` constant (src/blogCount.ts) for both vite.config.ts and vitest.config.ts:
// the length of src/data/blogIndex.ts, read here at config time so the bundle never imports the array for it.
import { BLOG_INDEX } from '../../src/data/blogIndex';

export const BLOG_COUNT_DEFINE = { __BLOG_COUNT__: JSON.stringify(BLOG_INDEX.length) };
