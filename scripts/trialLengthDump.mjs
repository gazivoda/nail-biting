// Helper for scripts/trialLength.test.mjs (not a test itself). Prints, as JSON, every leaf string of the
// page content the site is built from, under whatever TRIAL_DAYS the process was started with:
//   TRIAL_DAYS=7 node scripts/trialLengthDump.mjs
// The copy modules are imported the way the build scripts import them (Node strips the types).

const { BLOG_POSTS } = await import('../src/data/blogPosts.ts');
const { PAGE_MAP } = await import('../src/data/comparePages.ts');
const { GATED_PAGE_MAP } = await import('../src/data/competitorPages.ts');

const out = {};
const walk = (path, value) => {
  if (typeof value === 'string') out[path] = value;
  else if (Array.isArray(value)) value.forEach((v, i) => walk(`${path}[${i}]`, v));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(`${path}.${k}`, v);
};

for (const post of BLOG_POSTS) walk(`blog:${post.slug}`, post);
for (const [route, page] of Object.entries({ ...PAGE_MAP, ...GATED_PAGE_MAP })) walk(`page:${route}`, page());

console.log(JSON.stringify(out));
