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

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node >= 22.18 strips TypeScript types on import, so the .ts files load directly.
const { BLOG_POSTS } = await import('../src/data/blogPosts.ts');
const { PAGE_MAP } = await import('../src/data/comparePages.ts');
// Same function BlogPost.tsx renders from, so the crawler's "Related reading"
// links are exactly the ones a visitor sees.
const { getRelated } = await import('../src/data/related.ts');

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

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });
writeFileSync(
  join(DIST, 'seo-content.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), posts, comparePages }),
);
console.log(`generate-seo-content: seo-content.json — ${BLOG_POSTS.length} posts, ${Object.keys(comparePages).length} compare pages`);

// ─── dist/llms-full.txt — full article text for AI crawlers ──────────────────
// Cheap textual rendering of everything the SSR articles contain.
function tableToText(html) {
  return html
    .replace(/<\/t[hd]>/g, ' | ')
    .replace(/<\/tr>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\|/g, ' |')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
function stripTags(text) {
  return text.replace(/<[^>]+>/g, '');
}

const full = [];
full.push('# Stop Biting — full content for AI assistants');
full.push('');
full.push('> Generated from the same source the website renders. Canonical URLs are listed with each article. See also /llms.txt for the index.');
full.push('');

for (const [path, page] of Object.entries(comparePages)) {
  full.push(`## ${page.title}`);
  full.push(`URL: ${ORIGIN}${path}`);
  full.push('');
  full.push(stripTags(page.subtitle));
  full.push('');
  full.push(stripTags(page.intro));
  full.push('');
  for (const s of page.sections) {
    full.push(`### ${s.heading}`);
    full.push('');
    full.push(stripTags(s.body));
    if (s.html) {
      full.push('');
      full.push(tableToText(s.html));
    }
    full.push('');
  }
}

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
      full.push(tableToText(s.html));
    }
    full.push('');
  }
}

writeFileSync(join(DIST, 'llms-full.txt'), full.join('\n'));
console.log('generate-seo-content: llms-full.txt written');
