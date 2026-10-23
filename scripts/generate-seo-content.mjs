#!/usr/bin/env node
// Generates dist/seo-content.json and dist/llms-full.txt from the single
// source of truth: src/data/blogPosts.ts and src/data/comparePages.ts.
//
//   node scripts/generate-seo-content.mjs
//
// This runs automatically at the end of every `vite build` (see the
// generate-seo-content plugin in vite.config.ts), so it also runs inside the
// Docker/Nixpacks image builds, which call `npx vite build` directly.
// server.js reads dist/seo-content.json at startup and derives ALL
// crawler-visible article HTML, meta titles/descriptions, and schema dates
// from it. The server carries no copy of any content, so the HTML served to
// crawlers can never drift from what React renders — the failure mode the old
// hand-synced BLOG_META / BLOG_SECTIONS_DATA mirrors made possible.
//
// Structural problems in the source data exit non-zero, which fails the build.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node >= 22.18 strips TypeScript types on import, so the .ts files load directly.
const { BLOG_POSTS } = await import('../src/data/blogPosts.ts');
const { PAGE_MAP } = await import('../src/data/comparePages.ts');
// Pages behind the compare_competitors flag. Kept OUT of seo-content.json and
// llms-full.txt, both of which are served to anyone: they go to dist/seo-gated.json,
// which server.js reads and never serves.
const { GATED_PAGE_MAP } = await import('../src/data/competitorPages.ts');
const { GATED_COMPARE_PATHS, GATED_COMPARE_FLAG } = await import('../src/data/gatedComparePaths.ts');
// WS11b: the pages for features that ship behind a flag each (src/data/featurePages.ts). Same
// treatment as the competitor pages: unpublished copy goes to dist/seo-gated.json, never to
// seo-content.json or llms-full.txt.
const { FEATURE_PAGE_MAP } = await import('../src/data/featurePages.ts');
const { FEATURE_PAGE_FLAGS } = await import('../src/data/featurePagePaths.ts');
// Same validator the Testimonials component renders through, so the crawler copy
// and the page cannot disagree about which entries are publishable.
const { parseTestimonials, testimonialDetail, TESTIMONIALS_HEADING } = await import('../src/components/site/testimonialsModel.ts');
// Same function BlogPost.tsx renders from, so the crawler's "Related reading"
// links are exactly the ones a visitor sees.
const { getRelated, PRODUCT_LINKS } = await import('../src/data/related.ts');
// The author box under every article and the /editorial-policy page body. Same
// module BlogPost.tsx / ComparePage.tsx / EditorialPolicyPage.tsx render from,
// so the crawler copy and the rendered copy are one string, not two.
const { AUTHOR_BIO, EDITORIAL_POLICY } = await import('../src/data/editorialPolicy.ts');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ORIGIN = 'https://stopbiting.today';

// ─── Validate the source data (build fails on structural problems) ───────────
const problems = [];
const seen = new Set();
for (const post of BLOG_POSTS) {
  if (seen.has(post.slug)) problems.push(`duplicate slug: ${post.slug}`);
  seen.add(post.slug);
  if (!/^[a-z0-9-]+$/.test(post.slug)) problems.push(`slug is not URL-safe: ${post.slug}`);
  if (post.dateModified < post.datePublished) {
    problems.push(`dateModified precedes datePublished: ${post.slug}`);
  }
  if (!post.sections?.length) problems.push(`post has no sections: ${post.slug}`);
  if (post.ogImage && !/^(\/|https?:\/\/)/.test(post.ogImage)) {
    problems.push(`ogImage must be a site-absolute path (or full URL): ${post.slug}`);
  }
}
if (problems.length) {
  console.error('generate-seo-content: structural problems in src/data/blogPosts.ts:');
  for (const p of problems) console.error(`  ! ${p}`);
  process.exit(1);
}

// ─── dist/seo-content.json ───────────────────────────────────────────────────
const posts = {};
for (const p of BLOG_POSTS) {
  posts[p.slug] = {
    title: p.title,
    ...(p.seoTitle ? { seoTitle: p.seoTitle } : {}),
    description: p.description,
    tag: p.tag,
    readingMinutes: p.readingMinutes,
    datePublished: p.datePublished,
    dateModified: p.dateModified,
    ...(p.ogImage ? { ogImage: p.ogImage } : {}),
    related: getRelated(BLOG_POSTS, p.slug),
    productLink: PRODUCT_LINKS[p.slug] ?? null,
    sections: p.sections.map(s => ({
      heading: s.heading,
      body: s.body,
      ...(s.list?.length ? { list: s.list } : {}),
      ...(s.html ? { html: s.html } : {}),
    })),
  };
}

const comparePages = {};
for (const [path, get] of Object.entries(PAGE_MAP)) {
  const page = get();
  if (!page?.title) problems.push(`compare page missing title: ${path}`);
  if (!page?.sections?.length) problems.push(`compare page has no sections: ${path}`);
  comparePages[path] = page;
}
if (problems.length) {
  console.error('generate-seo-content: structural problems in src/data/comparePages.ts:');
  for (const p of problems) console.error(`  ! ${p}`);
  process.exit(1);
}

const flaggedPages = {};
for (const [path, get] of Object.entries(GATED_PAGE_MAP)) {
  const page = get();
  if (!page?.title) problems.push(`flagged page missing title: ${path}`);
  if (!page?.sections?.length) problems.push(`flagged page has no sections: ${path}`);
  if (PAGE_MAP[path]) problems.push(`flagged page is also in PAGE_MAP (it would be published): ${path}`);
  flaggedPages[path] = page;
}
if (Object.keys(flaggedPages).sort().join(',') !== [...GATED_COMPARE_PATHS].sort().join(',')) {
  problems.push('GATED_PAGE_MAP (competitorPages.ts) and GATED_COMPARE_PATHS (gatedComparePaths.ts) list different paths');
}
const featurePages = {};
for (const [path, get] of Object.entries(FEATURE_PAGE_MAP)) {
  const page = get();
  if (!page?.title) problems.push(`feature page missing title: ${path}`);
  if (!page?.sections?.length) problems.push(`feature page has no sections: ${path}`);
  if (PAGE_MAP[path] || flaggedPages[path]) problems.push(`feature page is also a published or competitor page: ${path}`);
  if (!FEATURE_PAGE_FLAGS[path]) problems.push(`feature page has no flag in featurePagePaths.ts: ${path}`);
  featurePages[path] = page;
}
if (Object.keys(featurePages).sort().join(',') !== Object.keys(FEATURE_PAGE_FLAGS).sort().join(',')) {
  problems.push('FEATURE_PAGE_MAP (featurePages.ts) and FEATURE_PAGE_FLAGS (featurePagePaths.ts) list different paths');
}
if (problems.length) {
  console.error('generate-seo-content: structural problems in the flagged pages:');
  for (const p of problems) console.error(`  ! ${p}`);
  process.exit(1);
}
// Every gated page, with the flag that opens it. The server reads this map; it is the one place the
// path -> flag pairing is written down for the running site.
const gatedFlags = {
  ...Object.fromEntries(Object.keys(flaggedPages).map(path => [path, GATED_COMPARE_FLAG])),
  ...FEATURE_PAGE_FLAGS,
};
const allGatedPages = { ...flaggedPages, ...featurePages };

// The testimonial section's crawler copy (server.js testimonialsArticleHtml). Empty
// while src/data/testimonials.json is empty; the server renders nothing then.
const testimonials = {
  heading: TESTIMONIALS_HEADING,
  entries: parseTestimonials(JSON.parse(readFileSync(join(ROOT, 'src/data/testimonials.json'), 'utf8')))
    .map(t => ({
      quote: t.quote,
      firstName: t.firstName,
      detail: testimonialDetail(t),
      ...(t.beforeAfterPhoto ? { photo: t.beforeAfterPhoto } : {}),
    })),
};

// Core-page freshness ledger, maintained by scripts/sync-seo.mjs. It rides in
// seo-content.json because that is the one generated file the runtime image
// carries (src/ is not copied into it), and because the sitemap, the JSON-LD
// `dateModified` and the `Last-Modified` header must all read the same dates.
let pageUpdates = {};
try {
  pageUpdates = JSON.parse(readFileSync(join(ROOT, 'src/data/pageUpdates.json'), 'utf8'));
} catch {
  console.error('generate-seo-content: src/data/pageUpdates.json missing or invalid — run `npm run seo:sync`.');
  process.exit(1);
}

// The ledger rows of the flagged pages travel with their copy, not in seo-content.json.
const isFlaggedPath = path => path in gatedFlags;
const flaggedUpdates = Object.fromEntries(Object.entries(pageUpdates).filter(([path]) => isFlaggedPath(path)));
pageUpdates = Object.fromEntries(Object.entries(pageUpdates).filter(([path]) => !isFlaggedPath(path)));

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });
writeFileSync(
  join(DIST, 'seo-content.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    posts,
    comparePages,
    pageUpdates,
    authorBio: AUTHOR_BIO,
    editorialPolicy: EDITORIAL_POLICY,
    testimonials,
  }),
);
// dist/seo-gated.json is written at the end of this file, once the llms-full text of each page exists.
// ─── dist/posts/<slug>.json — one file per article, for the client ──────────
// BlogPost.tsx used to import src/data/blogPosts.ts, which put every article
// (~1 MB) in the BlogPost chunk of every reader and in the service worker's
// precache. It now fetches only the article it is showing, from here. The data
// is the same object seo-content.json carries for the crawler HTML (title,
// dates, sections, related links, product link), so there is still exactly one
// source of truth and a field added to a post reaches the client only if it is
// added to `posts` above. The slug set is checked against BLOG_POSTS so a post
// can never be present in the app and missing here.
const POSTS_DIR = join(DIST, 'posts');
rmSync(POSTS_DIR, { recursive: true, force: true });
mkdirSync(POSTS_DIR, { recursive: true });
for (const [slug, post] of Object.entries(posts)) {
  writeFileSync(join(POSTS_DIR, `${slug}.json`), JSON.stringify({ slug, ...post }));
}
const written = readdirSync(POSTS_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const expected = BLOG_POSTS.map(p => p.slug).sort();
if (written.length !== expected.length || written.some((slug, i) => slug !== expected[i])) {
  console.error('generate-seo-content: dist/posts/ does not match BLOG_POSTS (stale files or missing posts).');
  process.exit(1);
}
console.log(`generate-seo-content: posts/ — ${written.length} per-article files`);

console.log(`generate-seo-content: seo-content.json — ${BLOG_POSTS.length} posts, ${Object.keys(comparePages).length} compare pages, ${Object.keys(pageUpdates).length} core-page dates`);

// ─── dist/llms-full.txt — full article text for AI crawlers ──────────────────
// Textual rendering of everything the SSR articles contain. Two things this has
// to get right, because the file exists to be read by a machine that will quote
// it back to someone:
//
//   Block structure. Only `</tr>` used to end a line, so every `faqSection()`
//   block — `<h3>question</h3><p>answer</p>` repeated — arrived as one
//   unbroken run of text with the next question welded to the previous answer.
//   The question/answer pair is the unit an answer engine extracts, and it was
//   being destroyed on the way out. Every block-level close now ends a line.
//
//   Entities. `&amp;` is what a browser shows as "&". Left encoded, "Azrin,
//   Nunn &amp; Frantz" is not a citation anyone can match to a paper.
const ENTITIES = {
  '&amp;': '&', '&#39;': '\'', '&apos;': '\'', '&quot;': '"',
  '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–',
};
const decodeEntities = text => text.replace(/&(?:#\d+|#x[0-9a-f]+|\w+);/gi, m =>
  ENTITIES[m] ?? (/^&#x/i.test(m) ? String.fromCodePoint(parseInt(m.slice(3, -1), 16))
    : /^&#/.test(m) ? String.fromCodePoint(Number(m.slice(2, -1))) : m));

function htmlToText(html) {
  return decodeEntities(html
    .replace(/<\/t[hd]>/g, ' | ')
    .replace(/<li[^>]*>/g, '- ')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(?:tr|p|li|ul|ol|div|section|table|h[1-6])>/g, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+\|/g, ' |')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
// Section bodies are plain strings, but they are written next to markup and a
// stray tag or entity would otherwise ride through untouched.
const stripTags = text => htmlToText(text);

const full = [];
full.push('# Stop Biting — full content for AI assistants');
full.push('');
full.push('> Generated from the same source the website renders. Canonical URLs are listed with each article. See also /llms.txt for the index.');
full.push('');

// Who wrote everything below, and under what rules — first, because it frames
// every claim that follows.
full.push(`## ${EDITORIAL_POLICY.title}`);
full.push(`URL: ${ORIGIN}/editorial-policy`);
full.push(`Last updated: ${EDITORIAL_POLICY.lastUpdated}`);
full.push('');
full.push(EDITORIAL_POLICY.standfirst);
full.push('');
for (const s of EDITORIAL_POLICY.sections) {
  full.push(`### ${s.heading}`);
  full.push('');
  if (Array.isArray(s.content)) for (const item of s.content) full.push(`- ${item}`);
  else full.push(s.content);
  full.push('');
}
full.push(`### About the author`);
full.push('');
full.push(`${AUTHOR_BIO.name} — ${AUTHOR_BIO.role}. ${AUTHOR_BIO.bio}`);
full.push('');

// One /compare/*, /solutions/* or /features/* page, as the lines llms-full.txt carries for it.
function pageLines(path, page) {
  const lines = [];
  lines.push(`## ${page.title}`);
  lines.push(`URL: ${ORIGIN}${path}`);
  lines.push('');
  lines.push(stripTags(page.subtitle));
  lines.push('');
  lines.push(stripTags(page.intro));
  lines.push('');
  for (const s of page.sections) {
    lines.push(`### ${s.heading}`);
    lines.push('');
    lines.push(stripTags(s.body));
    if (s.html) {
      lines.push('');
      lines.push(htmlToText(s.html));
    }
    lines.push('');
  }
  return lines;
}

for (const [path, page] of Object.entries(comparePages)) full.push(...pageLines(path, page));

for (const p of BLOG_POSTS) {
  full.push(`## ${p.title}`);
  full.push(`URL: ${ORIGIN}/blog/${p.slug}`);
  full.push(`Published: ${p.datePublished} · Updated: ${p.dateModified} · ${p.readingMinutes} min read`);
  full.push('');
  full.push(stripTags(p.description));
  full.push('');
  for (const s of p.sections) {
    full.push(`### ${s.heading}`);
    full.push('');
    full.push(stripTags(s.body));
    if (s.list?.length) {
      full.push('');
      for (const item of s.list) full.push(`- ${stripTags(item)}`);
    }
    if (s.html) {
      full.push('');
      full.push(htmlToText(s.html));
    }
    full.push('');
  }
}

writeFileSync(join(DIST, 'llms-full.txt'), full.join('\n'));
console.log('generate-seo-content: llms-full.txt written');

// ─── dist/seo-gated.json — the unpublished pages, for the server only ───────
// Never served (server.js answers 404 for it). `flags` says which flag opens each page; `llmsFull` is the
// block each page adds to llms-full.txt, built by the same code as the published pages' blocks, which the
// server appends only while the page's flag is on. The copy may carry {{if flag}} markers and {{TOKEN}}
// placeholders: the server resolves both at start-up (shared/flagCopy.js).
const llmsFull = Object.fromEntries(Object.entries(allGatedPages).map(([path, page]) => [path, pageLines(path, page).join('\n')]));
writeFileSync(
  join(DIST, 'seo-gated.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    comparePages: allGatedPages,
    flags: gatedFlags,
    llmsFull,
    pageUpdates: flaggedUpdates,
  }),
);
console.log(`generate-seo-content: seo-gated.json — ${Object.keys(allGatedPages).length} flagged pages`);
