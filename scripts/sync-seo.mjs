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
//   src/data/pageUpdates.json — core-page freshness ledger (see PAGE SOURCES)
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
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Node >= 22.18 strips TypeScript types on import, so blogPosts.ts loads directly.
const { BLOG_POSTS } = await import('../src/data/blogPosts.ts');
// Only the route list is used here — the /compare/* and /solutions/* paths that
// need a freshness entry. Their bodies are fingerprinted from source text.
const { PAGE_MAP } = await import('../src/data/comparePages.ts');

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
  { path: '/compare/ai-detection-apps',         changefreq: 'monthly', priority: '0.8' },
  { path: '/compare/stop-biting-vs-hands-off',  changefreq: 'monthly', priority: '0.8' },
  { path: '/compare/stop-biting-vs-nailed',     changefreq: 'monthly', priority: '0.8' },
  { path: '/compare/stop-biting-vs-smartbehavior', changefreq: 'monthly', priority: '0.8' },
  { path: '/solutions/for-desk-workers',        changefreq: 'monthly', priority: '0.7' },
  { path: '/solutions/for-adhd',                changefreq: 'monthly', priority: '0.7' },
  { path: '/solutions/for-gamers',              changefreq: 'monthly', priority: '0.7' },
  { path: '/privacy',                           changefreq: 'yearly',  priority: '0.3' },
  { path: '/terms-and-conditions',              changefreq: 'yearly',  priority: '0.3' },
  { path: '/refund-policy',                     changefreq: 'yearly',  priority: '0.3' },
];

// ─── Core-page freshness ledger — src/data/pageUpdates.json ──────────────────
// Blog posts carry a hand-maintained `dateModified` in blogPosts.ts and that is
// accurate. Core pages had no equivalent: every one of them fell through to a
// hardcoded `'2026-04-28'`, which was provably false — /pricing did not exist as
// a 200 page until 2026-08-11, and /about, /how-it-works and /solutions/* went
// from zero prose to full SSR bodies on the same day. Google discards `lastmod`
// SITEWIDE once it catches one that is not verifiably accurate, so those 11
// entries put the 143 blog entries (where it IS accurate) at risk.
//
// The replacement never guesses and never stamps "now" on an unchanged page:
//
//   1. Fingerprint each core page from the source that produces its
//      crawler-visible content (PAGE_SOURCES below).
//   2. Fingerprint unchanged since the ledger was written → reuse the recorded
//      date, unchanged, forever. This is the normal path and needs no git.
//   3. Fingerprint changed → re-derive the date from git: walk the commits that
//      touched those sources, newest first, and take the date of the oldest
//      commit that still carries the current fingerprint. That is literally
//      "when this content first appeared".
//   4. Only if the content is in no commit at all (an uncommitted edit) does it
//      fall back to today — which is true: it changed today.
//
// The ledger is the single source the sitemap, the JSON-LD `dateModified` and
// the `Last-Modified` response header all read (server.js reads it through
// dist/seo-content.json), so the three cannot disagree.
//
// A page with no resolvable date is a hard failure of `npm run seo:check` — a
// silent fallback is what produced the false dates in the first place.
const LEDGER_PATH = join(ROOT, 'src/data/pageUpdates.json');
const SERVER = 'server.js';
const COMPARE = 'src/data/comparePages.ts';
const SHELL = 'index.html';

const reEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The route handler for `path`, from `app.get('<path>'` to the `});` that closes
// it at the same indent. Every nested close is indented deeper, so this is exact.
const route = path => [SERVER, src =>
  src.match(new RegExp(`\\n  app\\.get\\('${reEscape(path)}',[\\s\\S]*?\\n  \\}\\);\\n`))?.[0]];
const serverFn = name => [SERVER, src =>
  src.match(new RegExp(`\\n  function ${reEscape(name)}\\([\\s\\S]*?\\n  \\}\\n`))?.[0]];
const shellBlock = label => [SHELL, src =>
  src.match(new RegExp(`<!-- Structured Data: ${reEscape(label)}[\\s\\S]*?<\\/script>`))?.[0]];
const wholeFile = file => [file, src => src];
// One /compare/* or /solutions/* page: the getter PAGE_MAP points at, plus any
// shared const it renders (the medical disclaimer section), so an edit to shared
// copy still moves the pages that show it.
const comparePage = path => [COMPARE, src => {
  const name = src.match(new RegExp(`'${reEscape(path)}':\\s*(\\w+)`))?.[1];
  if (!name) return undefined;
  let slice = src.match(new RegExp(`\\nfunction ${name}\\([\\s\\S]*?\\n\\}\\n`))?.[0];
  if (!slice) return undefined;
  for (const m of src.matchAll(/\nconst (\w+) = [\s\S]*?\n\};\n/g)) {
    if (slice.includes(m[1])) slice += m[0];
  }
  return slice;
}];

const PAGE_SOURCES = {
  // The homepage article is assembled from its handler, homeArticleHtml(), and
  // the FAQ answers server.js parses out of the shell's FAQPage block.
  '/':                       [route('/'), serverFn('homeArticleHtml'), shellBlock('FAQPage')],
  '/how-it-works':           [route('/how-it-works')],
  '/pricing':                [route('/pricing')],
  '/about':                  [route('/about')],
  // Legal pages ship meta only server-side; their body is the React component.
  '/privacy':                [route('/privacy'), wholeFile('src/pages/PrivacyPage.tsx')],
  '/terms-and-conditions':   [route('/terms-and-conditions'), wholeFile('src/pages/TermsPage.tsx')],
  '/refund-policy':          [route('/refund-policy'), wholeFile('src/pages/RefundPage.tsx')],
};
for (const p of Object.keys(PAGE_MAP)) PAGE_SOURCES[p] = [comparePage(p)];

const readWorkTree = file => safeRead(join(ROOT, file));
function fingerprint(read, path) {
  const parts = [];
  for (const [file, pick] of PAGE_SOURCES[path]) {
    const src = read(file);
    if (src == null) return null;
    const slice = pick(src);
    if (slice == null) return null;
    parts.push(slice);
  }
  return createHash('sha256').update(parts.join(' ')).digest('hex').slice(0, 16);
}

const blobCache = new Map();
function readAtCommit(sha) {
  return file => {
    const key = `${sha}:${file}`;
    if (!blobCache.has(key)) blobCache.set(key, git(['show', `${sha}:${file}`]));
    return blobCache.get(key);
  };
}
function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}
// Date of the oldest commit in the newest unbroken run that still carries `fp`.
// null when HEAD already differs — i.e. the content is not committed yet.
function gitDateOfFingerprint(path, fp) {
  const files = [...new Set(PAGE_SOURCES[path].map(s => s[0]))];
  const log = git(['log', '--format=%H %cs', '--', ...files]);
  if (!log) return null;
  let found = null;
  for (const line of log.trim().split('\n').filter(Boolean)) {
    const [sha, date] = line.split(' ');
    if (fingerprint(readAtCommit(sha), path) !== fp) break;
    found = date;
  }
  return found;
}

const TODAY = new Date().toISOString().slice(0, 10);
// /blog is the one core page whose content genuinely IS the article list — it
// renders all 143 titles and descriptions in flow — so it inherits the newest
// article date instead of a fingerprint.
const NEWEST_POST = BLOG_POSTS.reduce((max, p) => (p.dateModified > max ? p.dateModified : max), '2026-01-01');
const ledger = JSON.parse(safeRead(LEDGER_PATH) ?? '{}');
const nextLedger = {};
for (const { path } of CORE_PAGES) {
  if (path === '/blog') {
    nextLedger[path] = { lastmod: NEWEST_POST, source: 'newest article dateModified' };
    continue;
  }
  const fp = fingerprint(readWorkTree, path);
  if (!fp) {
    problems.push(`pageUpdates: cannot fingerprint ${path} — PAGE_SOURCES in scripts/sync-seo.mjs no longer matches the code that renders it`);
    if (ledger[path]) nextLedger[path] = ledger[path];
    continue;
  }
  const lastmod = ledger[path]?.fingerprint === fp
    ? ledger[path].lastmod
    : (gitDateOfFingerprint(path, fp) ?? TODAY);
  nextLedger[path] = { lastmod, fingerprint: fp };
}
writeIfChanged(
  LEDGER_PATH,
  `${JSON.stringify(nextLedger, null, 2)}\n`,
  `pageUpdates.json (${Object.keys(nextLedger).length} core pages)`,
);

function requireLastmod(path) {
  const entry = nextLedger[path];
  if (!entry?.lastmod) {
    problems.push(`no freshness entry for ${path} — sitemap would have to invent a lastmod`);
    return TODAY;
  }
  return entry.lastmod;
}

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
  const newest = NEWEST_POST;

  const urls = [
    ...CORE_PAGES.map(p => ({
      loc: `${ORIGIN}${p.path}`,
      // /blog renders every article's title and description in flow, so it does
      // genuinely change whenever an article does. Nothing else does: the rest
      // come from the freshness ledger, and a page with no entry there is a
      // hard failure rather than a fabricated date.
      lastmod: p.path === '/blog' ? newest : requireLastmod(p.path),
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
