#!/usr/bin/env node
// Regenerates the committed artifacts that mirror blog metadata, from the
// single source of truth in src/data/blogPosts.ts.
//
//   node scripts/sync-seo.mjs [--check]
//
// Targets:
//   public/sitemap.xml       — fully regenerated
//   public/llms.txt          — "## Blog articles" section: existing entries
//                              refreshed in place, missing entries appended
//   src/data/blogIndex.ts    — fully regenerated (metadata-only mirror)
//
// server.js no longer carries ANY content mirror: it reads
// dist/seo-content.json, which scripts/generate-seo-content.mjs regenerates
// from blogPosts.ts/comparePages.ts inside every vite build (see
// vite.config.ts), so the crawler HTML cannot drift from the rendered app.
//
// Run with --check to fail (exit 1) instead of writing — useful in CI.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node >= 22.18 strips TypeScript types on import, so blogPosts.ts loads directly.
const { BLOG_POSTS } = await import('../src/data/blogPosts.ts');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');
const ORIGIN = 'https://stopbiting.today';

const problems = [];
const changes = [];

// ─── Core (non-blog) pages ───────────────────────────────────────────────────
// Must stay in sync with KNOWN_ROUTES in server.js and the routes in src/App.tsx.
const CORE_PAGES = [
  { path: '/',                                  changefreq: 'weekly',  priority: '1.0' },
  { path: '/blog',                              changefreq: 'weekly',  priority: '0.9' },
  { path: '/how-it-works',                      changefreq: 'monthly', priority: '0.8' },
  { path: '/pricing',                           changefreq: 'monthly', priority: '0.8' },
  { path: '/about',                             changefreq: 'monthly', priority: '0.6' },
  { path: '/compare/bitter-polish-alternative', changefreq: 'monthly', priority: '0.8' },
  { path: '/compare/habit-tracking-apps',       changefreq: 'monthly', priority: '0.8' },
  // Competitor comparison pages — lastmod must match the `date` these pages
  // declare in COMPARE_META (server.js). Bump it when re-verifying facts.
  { path: '/compare/ai-detection-apps',         changefreq: 'monthly', priority: '0.8', lastmod: '2026-08-11' },
  { path: '/compare/stop-biting-vs-hands-off',  changefreq: 'monthly', priority: '0.8', lastmod: '2026-08-11' },
  { path: '/compare/stop-biting-vs-nailed',     changefreq: 'monthly', priority: '0.8', lastmod: '2026-08-11' },
  { path: '/compare/stop-biting-vs-smartbehavior', changefreq: 'monthly', priority: '0.8', lastmod: '2026-08-11' },
  { path: '/solutions/for-desk-workers',        changefreq: 'monthly', priority: '0.7' },
  { path: '/solutions/for-adhd',                changefreq: 'monthly', priority: '0.7' },
  { path: '/solutions/for-gamers',              changefreq: 'monthly', priority: '0.7' },
  { path: '/privacy',                           changefreq: 'yearly',  priority: '0.3' },
  { path: '/terms-and-conditions',              changefreq: 'yearly',  priority: '0.3' },
  { path: '/refund-policy',                     changefreq: 'yearly',  priority: '0.3' },
];

// ─── Validate the source data ────────────────────────────────────────────────
const seenSlugs = new Set();
for (const post of BLOG_POSTS) {
  if (seenSlugs.has(post.slug)) problems.push(`duplicate slug: ${post.slug}`);
  seenSlugs.add(post.slug);
  if (!/^[a-z0-9-]+$/.test(post.slug)) problems.push(`slug is not URL-safe: ${post.slug}`);
  if (post.dateModified < post.datePublished) {
    problems.push(`dateModified precedes datePublished: ${post.slug}`);
  }
  checkMetaLength(post);
}

// `description` doubles as the on-page standfirst and as the meta description
// the server injects. Only the latter has a length budget.
function checkMetaLength(post) {
  const title = post.seoTitle ?? post.title;
  if (post.description.length > 165) {
    problems.push(`meta description ${post.description.length} chars (>165, truncated in SERPs): ${post.slug}`);
  }
  // server.js keeps titles inside a 60-char budget, dropping the " | Stop Biting"
  // suffix before it will cut any words. Under 46 chars keeps the brand; over 60
  // still loses the tail, so flag that as worth an explicit seoTitle.
  if (title.length > 60) {
    problems.push(`meta title ${title.length} chars (>60, server trims the tail): ${post.slug} — set seoTitle`);
  }
}

// ─── public/sitemap.xml — full regeneration ──────────────────────────────────
{
  const newest = BLOG_POSTS.reduce((max, p) => (p.dateModified > max ? p.dateModified : max), '2026-01-01');

  const urls = [
    ...CORE_PAGES.map(p => ({
      loc: `${ORIGIN}${p.path}`,
      // Hub pages gain freshness whenever any article is updated.
      lastmod: p.path === '/' || p.path === '/blog' ? newest : (p.lastmod ?? '2026-04-28'),
      changefreq: p.changefreq,
      priority: p.priority,
    })),
    ...BLOG_POSTS.map(post => ({
      loc: `${ORIGIN}/blog/${post.slug}`,
      lastmod: post.dateModified,
      changefreq: 'monthly',
      priority: '0.7',
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Generated by scripts/sync-seo.mjs — do not edit by hand. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '',
    ...urls.flatMap(u => [
      '  <url>',
      `    <loc>${u.loc}</loc>`,
      `    <lastmod>${u.lastmod}</lastmod>`,
      `    <changefreq>${u.changefreq}</changefreq>`,
      `    <priority>${u.priority}</priority>`,
      '  </url>',
      '',
    ]),
    '</urlset>',
    '',
  ].join('\n');

  writeIfChanged(join(ROOT, 'public/sitemap.xml'), xml, `sitemap.xml (${urls.length} URLs)`);
}

// ─── src/data/blogIndex.ts — full regeneration ───────────────────────────────
// blogPosts.ts carries every article body — ~700KB of source. The landing page
// and the blog index only ever read titles, tags, descriptions and reading
// times, so they import this metadata-only mirror instead and never drag the
// bodies into their bundle chunk. Fully regenerated, so it cannot drift.
{
  const entries = BLOG_POSTS.map(p => [
    '  {',
    `    slug: ${js(p.slug)},`,
    `    title: ${js(p.title)},`,
    `    description: ${js(p.description)},`,
    `    tag: ${js(p.tag)},`,
    `    readingMinutes: ${p.readingMinutes},`,
    `    datePublished: ${js(p.datePublished)},`,
    `    dateModified: ${js(p.dateModified)},`,
    '  },',
  ].join('\n')).join('\n');

  const ts = [
    '// Generated by scripts/sync-seo.mjs — do not edit by hand.',
    '//',
    '// Metadata-only mirror of BLOG_POSTS. Import this rather than',
    '// ./blogPosts anywhere the article bodies are not actually rendered:',
    '// blogPosts.ts is one large array literal, so a bundler cannot tree-shake',
    '// the `sections` field away and any importer pays for every article body.',
    '',
    'export interface BlogPostMeta {',
    '  slug: string;',
    '  title: string;',
    '  description: string;',
    '  tag: string;',
    '  readingMinutes: number;',
    '  datePublished: string;',
    '  dateModified: string;',
    '}',
    '',
    'export const BLOG_INDEX: BlogPostMeta[] = [',
    entries,
    '];',
    '',
  ].join('\n');

  writeIfChanged(
    join(ROOT, 'src/data/blogIndex.ts'),
    ts,
    `blogIndex.ts (${BLOG_POSTS.length} posts)`,
  );
}

// ─── public/llms.txt — refresh existing blog entries, append missing ─────────
// Only the "## Blog articles" section is touched: entries whose slug still
// exists in BLOG_POSTS are rewritten in place (title + first-sentence blurb,
// keeping their position), so blurbs track description rewrites instead of
// fossilising; posts not yet listed are appended. All other sections and any
// non-entry lines pass through untouched, so the run is idempotent.
{
  const llmsPath = join(ROOT, 'public/llms.txt');
  const llms = readFileSync(llmsPath, 'utf8');
  const lines = llms.split('\n');

  const start = lines.findIndex(l => l.trim() === '## Blog articles');
  if (start === -1) {
    problems.push('llms.txt: "## Blog articles" section not found — skipped');
  } else {
    let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
    if (end === -1) end = lines.length;

    const bySlug = new Map(BLOG_POSTS.map(p => [p.slug, p]));
    const entryLine = p => `- [${p.title}](${ORIGIN}/blog/${p.slug}): ${firstSentence(p.description)}`;

    const listed = new Set();
    let refreshed = 0;
    for (let i = start; i < end; i++) {
      const m = lines[i].match(/\/blog\/([a-z0-9-]+)\)/);
      if (!m) continue;
      listed.add(m[1]);
      const post = bySlug.get(m[1]);
      if (post && lines[i] !== entryLine(post)) {
        lines[i] = entryLine(post);
        refreshed++;
      }
    }

    const missing = BLOG_POSTS.filter(p => !listed.has(p.slug));
    if (missing.length) {
      // Trailing blank lines sit between the last entry and the next "## " heading.
      let insertAt = end;
      while (insertAt > start && lines[insertAt - 1].trim() === '') insertAt--;
      lines.splice(insertAt, 0, ...missing.map(entryLine));
    }

    if (refreshed || missing.length) {
      writeIfChanged(llmsPath, lines.join('\n'),
        `llms.txt (${refreshed} refreshed, +${missing.length} entries)`);
    }
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error('\nProblems found:');
  for (const p of problems) console.error(`  ! ${p}`);
}
if (!changes.length && !problems.length) {
  console.log(`SEO data in sync — ${BLOG_POSTS.length} posts, nothing to do.`);
}
if (CHECK_ONLY && (changes.length || problems.length)) {
  console.error('\n--check: SEO data is out of date. Run `node scripts/sync-seo.mjs`.');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// JS string literal. JSON.stringify is a valid subset of JS string syntax and
// escapes quotes, backslashes and newlines correctly.
function js(str) {
  return JSON.stringify(str);
}

function firstSentence(text) {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

function writeIfChanged(path, content, label) {
  const previous = safeRead(path);
  if (previous === content) return;
  changes.push(label);
  if (!CHECK_ONLY) writeFileSync(path, content);
  console.log(`${CHECK_ONLY ? 'stale' : 'wrote'}: ${label}`);
}

function safeRead(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
