#!/usr/bin/env node
// Regenerates the committed artifacts that mirror blog metadata, from the
// single source of truth in src/data/blogPosts.ts.
//
//   node scripts/sync-seo.mjs [--check]
//
// Targets:
//   public/sitemap.xml       — fully regenerated
//   public/llms.txt          — every "## " link section fully regenerated from
//                              the copy the pages themselves render; the free
//                              prose above the first "## " is fact-checked
//                              against the site's own text (see LLMS.TXT below)
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
// need a freshness entry. Their bodies are read out of the file as text (see
// PAGE_SOURCES), which is also how they can be read at a historical commit.
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
  { path: '/editorial-policy',                  changefreq: 'yearly',  priority: '0.4' },
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
//   1. Fingerprint each core page from its RENDERED VISIBLE TEXT — what a
//      reader sees, tags and attributes stripped, whitespace collapsed
//      (PAGE_SOURCES below).
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

// ─── What the fingerprint is taken OF: the route's rendered visible text ─────
// A `dateModified` that moves when the page did not is a false freshness
// signal, and Google discards `lastmod` sitewide once it catches one. So the
// basis is the text a READER sees — never the source that produced it. Hashing
// handler source (the first attempt) meant a `speakable` property, a
// BreadcrumbList or a `class="article-summary"` attribute moved four dates
// while the rendered prose stayed byte-identical to the live site.
//
// Why not read dist/seo-content.json, which does hold the per-route SSR
// content: it is a build artifact — untracked, absent on a clean checkout, and
// written by `vite build`, which reads pageUpdates.json. Depending on it would
// make `seo:sync` depend on its own output, and step 3 above has to recompute
// the basis at arbitrary historical commits, where nothing but committed source
// exists. The basis is therefore derived from source — but by RENDERING it to
// text rather than hashing it.
//
// The reduction below is the same one the live-site comparison uses: take the
// markup the route emits, drop every tag (so attributes and structure go with
// them), decode entities, collapse whitespace. Sitewide chrome — the <noscript>
// nav, meta, JSON-LD — is deliberately out of the basis: Google asks that
// `lastmod` reflect the page's own content, not boilerplate.

// Escape sequences that survive into the rendered string. 'don\'t' and `don't`
// must reduce identically — otherwise re-quoting a literal reads as an edit.
const ESCAPES = { n: ' ', t: ' ', r: '' };

// Reads the string or template literal whose opening quote is at src[i].
// Returns [text, indexAfterClosingQuote]. `${…}` is handed to `resolve`, whose
// text lands at exactly that position in the sentence.
function readLiteral(src, i, resolve) {
  const quote = src[i];
  let text = '';
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { text += ESCAPES[src[j + 1]] ?? src[j + 1] ?? ''; j += 2; continue; }
    if (c === quote) return [text, j + 1];
    if (quote === '`' && c === '$' && src[j + 1] === '{') {
      const end = skipCode(src, j + 2);
      text += ` ${resolve(src.slice(j + 2, end - 1))} `;
      j = end;
      continue;
    }
    text += c;
    j++;
  }
  return [text, j];
}

// Index just past the `}` closing an interpolation that opened at `i`.
// Literals are skipped whole, so a `}` inside one does not close it.
function skipCode(src, i) {
  let depth = 1;
  let j = i;
  while (j < src.length) {
    const c = src[j];
    if (c === '\'' || c === '"' || c === '`') { j = readLiteral(src, j, () => '')[1]; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return j + 1;
    j++;
  }
  return j;
}

// A bare path, URL or fragment is a link TARGET, not text: `href` values sit in
// the source as their own literal, and nobody reads them off the page.
const LINK_ONLY = /^\s*(?:[./#][^\s]*|https?:\/\/\S+)\s*$/;
// A JSX presentation attribute. In HTML these vanish with the tag around them;
// in a .tsx page they are their own literal, and must vanish the same way — a
// `className` edit is not a content edit.
const ATTR_VALUE = /\b(?:className|class|style|id|key|ref|htmlFor|role|(?:aria|data)-[\w-]+)\s*=\s*\{?\s*$/;

// Walks a slice of JS/TS once and returns the contents of every string and
// template literal, in source order. Comments are skipped (a comment-only edit
// is invisible), as are object KEYS — `heading:` names a field, it is not copy —
// and the values of JSON-LD's `@`-prefixed keys, which are machine-only even
// where schema and page copy share a declaration (`'@type': 'HowToStep'`).
function literals(src, resolve = () => '') {
  const out = [];
  let atKey = false;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const [text, next] = readLiteral(src, i, resolve);
      if (/^\s*:/.test(src.slice(next, next + 8))) {
        atKey = text.startsWith('@');
      } else {
        const markup = atKey || LINK_ONLY.test(text) || ATTR_VALUE.test(src.slice(Math.max(0, i - 60), i));
        if (!markup) out.push(text);
        atKey = false;
      }
      i = next;
      continue;
    }
    // `@id: canonical` has no literal value — end the key's reach at the
    // property boundary so it cannot swallow the next property's copy.
    if (c === ',' || c === '}' || c === ']') atKey = false;
    i++;
  }
  return out.join(' ');
}

// The same slice with every literal and comment blanked to spaces, so the code
// around them can be scanned without seeing copy as identifiers.
function blankLiterals(src) {
  let out = '';
  let i = 0;
  const blank = n => ' '.repeat(n);
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i); const end = e < 0 ? src.length : e;
      out += blank(end - i); i = end; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2;
      out += blank(end - i); i = end; continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      const [, next] = readLiteral(src, i, () => '');
      out += blank(next - i); i = next; continue;
    }
    out += c;
    i++;
  }
  return out;
}

const ENTITIES = {
  '&#39;': '\'', '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>',
  '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–',
};
// Markup → text. `<p class="article-summary">x</p>` and `<p>x</p>` reduce to the
// same "x", which is the whole point: restructuring markup is not an edit.
function htmlToText(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#39;|&amp;|&quot;|&lt;|&gt;|&nbsp;|&mdash;|&ndash;/g, m => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim();
}

const visibleText = (src, resolve) => htmlToText(literals(src, resolve));

// ─── Following a route's copy to wherever it is declared ─────────────────────
// Copy does not all sit in one literal: an article interpolates `${stepsHtml}`,
// which maps over a const, which may itself name another. Resolving those in
// place (rather than appending them) is what makes a pure refactor invisible —
// moving three FAQ answers from inline literals into a mapped const reorders
// nothing a reader sees, and must not move the date.

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'new', 'typeof', 'await', 'async',
  'if', 'else', 'for', 'of', 'in', 'true', 'false', 'null', 'undefined', 'this',
]);
const MAX_DEPTH = 4;

// `const NAME = …;` (to a `;` that ends a line) or `function NAME(…) {…}` (to
// the `}` at the declaration's own indent — every nested close is deeper).
function declBody(scope, name) {
  const assigned = scope.match(new RegExp(`\\n\\s*(?:const|let|var) ${reEscape(name)} =([\\s\\S]*?);$`, 'm'));
  if (assigned) return assigned[1];
  return scope.match(new RegExp(`\\n(\\s*)function ${reEscape(name)}\\([\\s\\S]*?\\n\\1\\}`))?.[0] ?? null;
}

// One property of an object literal — `howToSchema.step` is the array the
// article renders; the schema fields beside it are not on the page.
function propBody(body, prop) {
  const m = body.match(new RegExp(`\\b${reEscape(prop)}:`));
  if (!m) return null;
  const code = blankLiterals(body);
  let depth = 0;
  let i = m.index + m[0].length;
  const start = i;
  for (; i < code.length; i++) {
    const c = code[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { if (depth === 0) break; depth--; }
    else if (c === ',' && depth === 0) break;
  }
  return body.slice(start, i);
}

// Identifiers a slice READS as content: a bare name (or `name.prop`), or a
// nullary call. A call WITH arguments is a transform — escapeHtml(), join(),
// map() never introduce copy of their own — and arrow parameters are locals.
function codeRefs(src) {
  const code = blankLiterals(src);
  const locals = new Set();
  for (const m of code.matchAll(/(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>/g)) {
    for (const p of (m[1] ?? m[2] ?? '').split(',')) {
      const n = p.trim().replace(/[:=].*$/s, '').trim();
      if (n) locals.add(n);
    }
  }
  const refs = [];
  for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*(\(\s*\))?\s*(?:\.([A-Za-z_$][\w$]*))?/g)) {
    const [, name, nullaryCall, prop] = m;
    const after = code.slice(m.index + m[0].length);
    if (KEYWORDS.has(name) || locals.has(name)) continue;
    if (/^\s*:/.test(after)) continue;               // an object key, not a read
    // `escapeHtml(x)` is a transform; `FAQS.map(f => …)` still READS FAQS, so
    // only a call directly on the bare name disqualifies it.
    if (!prop && !nullaryCall && /^\s*\(/.test(after)) continue;
    refs.push([name, prop]);
  }
  return refs;
}

// Visible text of a declaration, plus of everything it reads, depth-bounded and
// cycle-safe. `seen` doubles as the depth counter.
function declText(scope, name, prop, seen) {
  if (seen.size >= MAX_DEPTH || seen.has(name)) return '';
  const body = declBody(scope, name);
  if (body == null) return '';
  const next = new Set(seen).add(name);
  const slice = (prop && propBody(body, prop)) ?? body;
  const own = literals(slice, code => refsText(scope, code, next));
  return [own, refsText(scope, slice, next)].join(' ');
}

function refsText(scope, src, seen) {
  return codeRefs(src)
    .filter(([name]) => !seen.has(name))
    .map(([name, prop]) => declText(scope, name, prop, seen))
    .join(' ');
}

// ─── PAGE_SOURCES: one visible-text extractor per core page ──────────────────
// The route handler for `path`, from `app.get('<path>'` to the `});` that closes
// it at the same indent. Every nested close is indented deeper, so this is exact.
const handlerSrc = (src, path) =>
  src.match(new RegExp(`\\n  app\\.get\\('${reEscape(path)}',[\\s\\S]*?\\n  \\}\\);\\n`))?.[0];

// The second argument of `injectSsrArticle(injected, …)` — the exact markup the
// route puts in the served page, and the only part of a handler a reader sees.
function ssrArticleArg(handler) {
  // Searched in the blanked copy so a mention inside a comment or a string
  // cannot be mistaken for the call. Indices line up with the original.
  const code = blankLiterals(handler);
  const at = code.indexOf('injectSsrArticle(');
  if (at < 0) return null;
  let depth = 1;
  let i = at + 'injectSsrArticle('.length;
  let comma = -1;
  for (; i < code.length && depth > 0; i++) {
    const c = code[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 1 && comma < 0) comma = i;
  }
  return comma < 0 ? null : handler.slice(comma + 1, i - 1);
}

const ssrArticle = path => [SERVER, src => {
  const handler = handlerSrc(src, path);
  if (!handler) return undefined;
  const arg = ssrArticleArg(handler);
  if (!arg) return undefined;
  // Handler locals shadow module scope: `const article = …` inside the route
  // must win over any same-named declaration elsewhere in the file.
  const scope = `${handler}\n${src}`;
  const seen = new Set();
  return htmlToText([literals(arg, code => refsText(scope, code, seen)), refsText(scope, arg, seen)].join(' '));
}];

// The six homepage FAQ answers. server.js parses them out of the shell's
// FAQPage schema and renders them in flow, so the answers ARE page copy — but
// only `name`/`acceptedAnswer.text` are; the rest of the block is machine-only.
const shellFaqAnswers = () => [SHELL, src => {
  const m = src.match(/<!-- Structured Data: FAQPage[\s\S]*?<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) return undefined;
  try {
    return htmlToText(JSON.parse(m[1]).mainEntity.map(q => `${q.name} ${q.acceptedAnswer.text}`).join(' '));
  } catch {
    return undefined;
  }
}];

// A React page whose copy is a data literal (the three legal pages). Class
// names and JSX structure reduce away with every other attribute.
const pageComponent = file => [file, src => visibleText(src)];

// One /compare/* or /solutions/* page: the getter PAGE_MAP points at, rendered
// to text, plus whatever shared copy it names (the medical disclaimer section),
// so an edit to shared copy still moves the pages that show it.
const comparePage = path => [COMPARE, src => {
  const name = src.match(new RegExp(`'${reEscape(path)}':\\s*(\\w+)`))?.[1];
  if (!name) return undefined;
  const slice = src.match(new RegExp(`\\nfunction ${name}\\([\\s\\S]*?\\n\\}\\n`))?.[0];
  if (!slice) return undefined;
  const seen = new Set([name]);
  return htmlToText([literals(slice), refsText(src, slice, seen)].join(' '));
}];

const PAGE_SOURCES = {
  // The homepage article is homeArticleHtml(), which the handler passes to
  // injectSsrArticle — reached through `const article = homeArticleHtml()` —
  // plus the FAQ answers it renders from the shell's FAQPage block.
  '/':                       [ssrArticle('/'), shellFaqAnswers()],
  '/how-it-works':           [ssrArticle('/how-it-works')],
  '/pricing':                [ssrArticle('/pricing')],
  '/about':                  [ssrArticle('/about')],
  // /editorial-policy renders from a data module, not from literals in the
  // handler, so the module IS the page: its title, standfirst, sections,
  // "last updated" line and the author box it closes with are exactly what a
  // reader sees there, and nothing else in the file is anything else. (The
  // meta title and description live in server.js precisely so that editing
  // them cannot move this date.)
  '/editorial-policy':       [pageComponent('src/data/editorialPolicy.ts')],
  // The legal routes inject no SSR article: what a reader sees is the React
  // page. Their handlers carry meta and JSON-LD only, so they are not a source.
  '/privacy':                [pageComponent('src/pages/PrivacyPage.tsx')],
  '/terms-and-conditions':   [pageComponent('src/pages/TermsPage.tsx')],
  '/refund-policy':          [pageComponent('src/pages/RefundPage.tsx')],
};
for (const p of Object.keys(PAGE_MAP)) PAGE_SOURCES[p] = [comparePage(p)];

const readWorkTree = file => safeRead(join(ROOT, file));
function fingerprint(read, path) {
  const parts = [];
  for (const [file, pick] of PAGE_SOURCES[path]) {
    const src = read(file);
    if (src == null) return null;
    const slice = pick(src);
    // Empty is a failure, not "this page has no copy": it means the extractor
    // no longer recognises the shape of the code that renders the page.
    if (!slice) return null;
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
// Every canonical URL the site publishes. llms.txt is checked against this set
// below, so it cannot point at a route the sitemap does not contain.
const sitemapUrls = new Set();
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

  for (const u of urls) sitemapUrls.add(u.loc);

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

// ─── LLMS.TXT — public/llms.txt ──────────────────────────────────────────────
// llms.txt is the file AI assistants read to decide what this site says, so a
// stale sentence here is repeated to the exact audience a correction was made
// for. It drifted twice in one month, both times silently:
//
//   · the /compare/stop-biting-vs-nailed blurb still called Nailed a "$4.99
//     one-time" app after the page itself had stopped asserting any single
//     price (the vendor's site and the store listing it links to disagree);
//   · the /compare/ai-detection-apps blurb still said "facts verified August
//     2026" after the 10 September re-verification.
//
// Neither was a typo. Both were hand-written prose restating a page — a second
// copy of a claim, with nothing tying it to the first. The fix is to stop
// keeping a second copy:
//
//   1. EVERY "## " section is a DERIVED link list, regenerated in full.
//        "## Key pages"     — core routes: the title and description server.js
//                             injects for that route. /compare/* and
//                             /solutions/*: the title and subtitle
//                             ComparePage.tsx renders from comparePages.ts.
//        "## Blog articles" — title + first sentence of post.description.
//      The blurb is no longer a description OF the page, it IS the page's own
//      sentence, so correcting the page corrects llms.txt on the next sync.
//
//   2. The free prose above the first "## " (the summary, the pricing block,
//      the key facts) summarises the whole site rather than restating one page,
//      so there is nothing to derive it from. It gets a TRIPWIRE instead: every
//      price, percentage, platform version, distinctive number and citation in
//      it must still appear in the site's own rendered text, or seo:check fails
//      naming the token. A "(Cochrane review, 2012)" citation this site has
//      never published, and a "70–90%" figure it explicitly refuses to repeat,
//      both sat in that block looking exactly like the facts around them.
//
//   3. Every URL must exist in the sitemap generated above — which a link to a
//      "#contact" anchor that no page defines does not.
{
  const llmsPath = join(ROOT, 'public/llms.txt');
  const lines = (safeRead(llmsPath) ?? '').split('\n');
  const firstHeading = lines.findIndex(l => l.startsWith('## '));

  if (firstHeading === -1) {
    problems.push('llms.txt: no "## " section found — nothing to derive');
  } else {
    // ── 1. Regenerate each link section from its source ──────────────────────
    const sections = {
      '## Key pages': keyPageEntries(),
      '## Blog articles': BLOG_POSTS.map(p => ({
        href: `${ORIGIN}/blog/${p.slug}`,
        title: p.title,
        note: firstSentence(p.description),
      })),
    };
    let out = lines.slice(0, firstHeading);
    for (const [heading, entries] of Object.entries(sections)) {
      const at = lines.findIndex(l => l.trim() === heading);
      if (at === -1) {
        problems.push(`llms.txt: "${heading}" section not found — cannot regenerate it`);
        continue;
      }
      out = out.concat(heading, '', entries.map(e => `- [${e.title}](${e.href}): ${e.note}`), '');
    }
    // Anything after the last generated section (there is nothing today) would
    // be dropped silently, so say so rather than deleting a reader's section.
    const known = new Set(Object.keys(sections));
    for (const l of lines.slice(firstHeading)) {
      if (l.startsWith('## ') && !known.has(l.trim())) {
        problems.push(`llms.txt: unknown section "${l.trim()}" — sync-seo.mjs regenerates every "## " section and would drop it`);
      }
    }
    const next = `${out.join('\n').replace(/\n+$/, '')}\n`;
    writeIfChanged(llmsPath, next, `llms.txt (${Object.values(sections).flat().length} links, all derived)`);

    // ── 2 + 3. Check the file that WILL be on disk, not the one that was ─────
    checkFreeTextClaims(next.split('\n').slice(0, firstHeading).join('\n'));
    checkLlmsUrls(next);
  }
}

// The "## Key pages" list. Core routes carry their own one-line description in
// the `injectMeta` call that serves them; /compare/* and /solutions/* carry
// theirs as the subtitle ComparePage renders under the h1. Both are the page's
// own sentence about itself, which is the only kind that cannot go stale
// without the page going stale with it.
function keyPageEntries() {
  const server = readWorkTree(SERVER) ?? '';
  const entries = [];
  for (const path of ['/', '/how-it-works', '/pricing', '/about', '/blog', '/editorial-policy']) {
    const meta = routeMeta(server, path);
    if (!meta) {
      problems.push(`llms.txt: cannot read the injectMeta title/description for ${path} in server.js — the extractor no longer matches the handler`);
      continue;
    }
    entries.push({ href: `${ORIGIN}${path}`, title: meta.title, note: meta.description });
  }
  for (const [path, get] of Object.entries(PAGE_MAP)) {
    const page = get();
    entries.push({ href: `${ORIGIN}${path}`, title: page.title, note: page.subtitle });
  }
  const privacy = routeMeta(server, '/privacy');
  if (privacy) entries.push({ href: `${ORIGIN}/privacy`, title: privacy.title, note: privacy.description });
  // The one entry with no page behind it: llms-full.txt is a build artifact of
  // scripts/generate-seo-content.mjs, and the note describes how it is produced
  // rather than making any claim of its own.
  entries.push({
    href: `${ORIGIN}/llms-full.txt`,
    title: 'Full content',
    note: 'Complete article text of every guide and comparison page, generated from the same source the site renders',
  });
  return entries;
}

// A route is usually registered with its path inline, but not always:
// /editorial-policy is registered as `app.get(EDITORIAL_POLICY_PATH, …)`. Fall
// back to the const that holds the path rather than silently losing the page.
function routeHandler(src, path) {
  const direct = handlerSrc(src, path);
  if (direct) return direct;
  const named = src.match(new RegExp(`\\b(?:const|let|var) (\\w+) = '${reEscape(path)}';`))?.[1];
  return named
    ? src.match(new RegExp(`\\n  app\\.get\\(${named},[\\s\\S]*?\\n  \\}\\);\\n`))?.[0] ?? null
    : null;
}

// The `title` and `description` server.js injects for a route — the exact two
// strings a crawler receives for it. Both may be a literal or a local const.
function routeMeta(src, path) {
  const handler = routeHandler(src, path);
  if (!handler) return null;
  const code = blankLiterals(handler);
  const at = code.indexOf('injectMeta(');
  if (at < 0) return null;
  let depth = 1;
  let i = at + 'injectMeta('.length;
  for (; i < code.length && depth > 0; i++) {
    const c = code[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
  }
  const args = handler.slice(at + 'injectMeta('.length, i - 1);
  // Handler locals shadow module scope, same rule ssrArticle() follows.
  const scope = `${handler}\n${src}`;
  const read = name => {
    const body = propBody(args, name);
    // `{ description, canonical }` shorthand names a local of the same name.
    const expr = body?.trim()
      || (new RegExp(`\\b${reEscape(name)}\\s*[,}]`).test(blankLiterals(args)) ? name : '');
    const direct = htmlToText(literals(expr));
    if (direct) return direct;
    if (!/^[A-Za-z_$][\w$]*$/.test(expr)) return null;
    const decl = declBody(scope, expr);
    return decl ? htmlToText(literals(decl)) : null;
  };
  const title = read('title');
  const description = read('description');
  if (!title || !description) return null;
  // The shell suffix is site chrome, not part of the page's name.
  return { title: title.replace(/\s*\|\s*Stop Biting$/, ''), description };
}

// ─── The tripwire: free prose vs. the site's own text ────────────────────────
// Normalisation exists so that a figure written "20–30%" in one file and
// "20-30%" in another is the same figure. Everything is compared lowercased,
// with every Unicode dash and quote folded to ASCII and runs of space collapsed.
function foldClaims(s) {
  return s
    .replace(/&#39;|&amp;|&quot;|&lt;|&gt;|&nbsp;|&mdash;|&ndash;/g, m => ENTITIES[m])
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, '\'')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function checkFreeTextClaims(freeText) {
  // What counts as a checkable claim. Deliberately narrow: things carrying a
  // unit or a citation, where a silent change is a factual error and not a
  // rewording. Matched against the folded text, so dashes are already ASCII.
  const CLAIM_PATTERNS = [
    /[$€£]\s?\d[\d,]*(?:\.\d+)?/g,                              // prices
    /\d+(?:\.\d+)?\s?-\s?\d+(?:\.\d+)?%|\d+(?:\.\d+)?%/g,       // percentages and ranges
    /\b(?:macos|windows|ios|android)\s?\d+(?:\.\d+)?\+?/g,      // platform requirements
    /\bd\s?=\s?\d*\.\d+/g,                                      // effect sizes
    /\b\d[\d,]*[- ](?:day|days|keypoints?|minutes?|hours?)\b/g, // counted units
    /\b\d{3,}\b/g,                                              // 468 landmarks, 575 participants, years
  ];
  // Words inside a citation that name nothing — the check is for proper nouns.
  const CITATION_NOISE = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'our']);

  const corpus = siteCorpus();
  const folded = foldClaims(freeText);
  const unsupported = new Set();

  for (const re of CLAIM_PATTERNS) {
    for (const m of folded.match(re) ?? []) {
      if (!corpus.includes(foldClaims(m))) unsupported.add(m);
    }
  }
  // A parenthetical citation — "(Azrin, Nunn & Frantz, 1980)". Every proper
  // noun in it must be something this site actually publishes; a source name
  // that appears nowhere in the corpus was either invented or outlived the page
  // that carried it. Read from the raw text, where the capitals still exist.
  for (const m of freeText.matchAll(/\(([^()]*\b(?:19|20)\d{2}\b[^()]*)\)/g)) {
    for (const word of m[1].match(/\b[A-Z][A-Za-z'’-]{2,}\b/g) ?? []) {
      if (CITATION_NOISE.has(word.toLowerCase())) continue;
      if (!corpus.includes(foldClaims(word))) unsupported.add(`${word} (in "${m[1]}")`);
    }
  }

  for (const token of unsupported) {
    problems.push(`llms.txt: "${token}" appears in the summary/pricing/key-facts prose but nowhere in the site's own text — correct it or delete it, never restate it`);
  }
}

// Everything this site publishes as text, in one folded string: the blog and
// comparison bodies React renders, the visible text of every core route (the
// same extractors the freshness ledger fingerprints), and index.html's product
// schema, which is where the supported OS versions are declared. HTML comments
// in the shell are stripped — several of them quote claims that were REMOVED,
// and a corpus that contains the removed claim proves nothing.
function siteCorpus() {
  const parts = [];
  for (const p of BLOG_POSTS) {
    parts.push(p.title, p.description);
    for (const s of p.sections) parts.push(s.heading, s.body, (s.list ?? []).join(' '), s.html ?? '');
  }
  for (const get of Object.values(PAGE_MAP)) {
    const page = get();
    parts.push(page.title, page.subtitle, page.intro);
    for (const s of page.sections) parts.push(s.heading, s.body, s.html ?? '');
  }
  const files = new Map();
  const cachedRead = f => {
    if (!files.has(f)) files.set(f, readWorkTree(f));
    return files.get(f);
  };
  for (const sources of Object.values(PAGE_SOURCES)) {
    for (const [file, pick] of sources) {
      const src = cachedRead(file);
      if (src) parts.push(pick(src) ?? '');
    }
  }
  parts.push((cachedRead(SHELL) ?? '').replace(/<!--[\s\S]*?-->/g, ' '));
  return foldClaims(parts.join(' '));
}

// Every URL llms.txt points at must be one the sitemap publishes. Generated
// text artifacts are the exception — they are content, not indexable routes.
function checkLlmsUrls(text) {
  for (const m of text.matchAll(/\]\((https:\/\/stopbiting\.today[^)\s]*)\)/g)) {
    const url = m[1];
    if (/\.txt$/.test(url)) continue;
    if (!sitemapUrls.has(url)) {
      problems.push(`llms.txt: ${url} is not in sitemap.xml — it is either a dead link or a page the sitemap forgot`);
    }
  }
}

// ─── MIRRORS: a title or description may not out-claim the body it summarises ─
// llms.txt was the first mirror to get a tripwire (above), and it was not the
// worst one. Three correction passes in a row rewrote a BODY and left the copy
// above it still asserting what that body had just retracted:
//
//   · the COMPARE_META block in server.js — the meta descriptions for all nine
//     /compare and /solutions pages — still priced a competitor at "$4.99
//     one-time" three iterations after the body stopped asserting any single
//     price, with four more retracted claims sitting beside it;
//   · 25 blog `description` fields contradicted their own article, and one
//     carried an "n=22" that appears only in SIBLING posts.
//
// All of it was caught by a human re-reading two strings side by side, weeks
// late. A stale description is worse than a stale body sentence: it is the SERP
// snippet AND the on-page standfirst AND the `speakable` target, so it is the
// copy most readers ever see — and nothing tied it to the article underneath.
//
// What is gated is deliberately narrow and mechanical, because a gate that has
// to judge meaning is a gate that gets switched off. Rewording is free. Two
// things are not:
//
//   1. every FIGURE a mirror states must appear in the body it summarises —
//      matched as whole tokens, so "22" is NOT satisfied by "2200" and a
//      currency, a percent sign or a unit that the body never attaches to that
//      number is as much a defect as the number being absent;
//   2. every CITED SOURCE it names — a surname this site cites in a reference
//      list somewhere — must be one THAT body actually cites.
//
//   post.description / post.title / post.seoTitle  →  that post's own sections
//   COMPARE_META[path].description / .title        →  PAGE_MAP[path] in
//                                                     src/data/comparePages.ts
//
// Scoping is per page, which is the whole point: a figure lifted from a sibling
// post fails here even though the site as a whole publishes it. (The llms.txt
// tripwire checks against the site-WIDE corpus, because llms.txt summarises the
// whole site; these mirrors each summarise exactly one page.)
//
// ── Mirrors this does NOT gate — where drift can still hide ──────────────────
//   · The free prose at the top of public/llms.txt. Gated, but only against the
//     site-wide corpus (checkFreeTextClaims): a claim that is true of some
//     OTHER page passes there, and a rewording no page makes is invisible.
//   · The injectMeta title/description of the core routes in server.js (/,
//     /about, /pricing, /how-it-works, the legal pages). Same defect class, and
//     llms.txt now quotes them verbatim so a stale one propagates. It was
//     TRIED against the PAGE_SOURCES visible text and rejected: the metas for
//     /, /how-it-works and /about all say "100% private", and all three bodies
//     make that claim in words instead — "no camera data ever leaves your
//     device", "entirely on-device" — without ever writing the figure. The
//     rule would fail three pages whose copy is not wrong, and a gate that
//     cries wolf is a gate someone deletes. Re-read them by hand when a core
//     page changes — or give the figure a home in those bodies and switch this
//     on (the check is one call to checkMirror per route).
//   · Duplicated standfirst prose in src/pages/*.tsx — HowItWorks.tsx and
//     Landing.tsx have each shipped a sentence the SSR body had already
//     corrected. Nothing in the source says which string mirrors which: the
//     React copy is a second original, not a derived one, so there is no source
//     to check it against. The fix is to stop keeping the second copy.
//   · relatedPosts[].label in comparePages.ts, and the link labels in the
//     generated llms.txt sections — one page's one-line summary of ANOTHER
//     page's argument. The body that would verify them is not this page's.
//   · The titles baked into public/og/*.png. `npm run og:check` verifies the
//     image matches the title; nothing verifies the title against the body.
//
// checkMirrors() runs at the end of this section, once the tables it reads are
// initialised; everything between here and there is what it reads.

// The body a mirror is checked against: everything the page renders as prose,
// and nothing else. A post's own title and description are excluded on purpose
// — a description that cites itself proves nothing. `html` is reduced with
// htmlToText, so the figures inside a comparison table count as body text while
// the digits inside an href do not.
function postBodyText(post) {
  const parts = [];
  for (const s of post.sections) {
    parts.push(s.heading, s.body, (s.list ?? []).join(' '), htmlToText(s.html ?? ''));
  }
  return parts.join(' ');
}

function comparePageText(page) {
  const parts = [page.title, page.subtitle, page.intro];
  for (const s of page.sections) parts.push(s.heading, s.body, htmlToText(s.html ?? ''));
  return parts.join(' ');
}

// "12 evidence-based alternatives" is a claim about the article's SHAPE, not
// about the world: the body backs it by containing twelve list items, and no
// sentence in it writes "12". Counting is the only honest way to verify that,
// so a figure equal to the length of one of the post's lists (or to their total)
// is treated as supported by the body it counts.
function enumeratedCounts(post) {
  const counts = new Set();
  let total = 0;
  for (const s of post.sections) {
    if (!s.list?.length) continue;
    counts.add(String(s.list.length));
    total += s.list.length;
  }
  counts.add(String(total));
  return counts;
}

// ─── Figures ─────────────────────────────────────────────────────────────────
// A figure is a number plus whatever makes it a claim: the currency in front of
// it, a percent sign, and the unit word after it. Everything else about the
// sentence is free to change.
//
// Tokenising both sides — rather than searching the body for the mirror's
// string — is what makes the match exact. The first attempt used `includes()`,
// so "22" was satisfied by "2200" and the check reported a clean corpus that in
// fact contained the "n=22" defect it was written for. A regex with \b would
// still accept "22" inside "22.5". Here each side is cut into whole numbers, so
// "22", "2200" and "22.5" are three different figures and only "22" matches
// "22".
const MIRROR_UNITS = new Map([
  ['mm', 'mm'], ['cm', 'cm'],
  ['second', 'second'], ['seconds', 'second'],
  ['minute', 'minute'], ['minutes', 'minute'],
  ['hour', 'hour'], ['hours', 'hour'],
  ['day', 'day'], ['days', 'day'],
  ['week', 'week'], ['weeks', 'week'],
  ['month', 'month'], ['months', 'month'],
  ['year', 'year'], ['years', 'year'],
  ['study', 'study'], ['studies', 'study'],
  ['trial', 'trial'], ['trials', 'trial'],
  ['participant', 'participant'], ['participants', 'participant'],
]);

// Read against the FOLDED text, so the en-dash in "20–30%" is already an ASCII
// hyphen and "3,000" and "3000" are the same number. The optional hyphen before
// the unit is what makes "3-day trial" carry its unit the way "3 days" does —
// and it also lets a range fall apart into its two ends, which is the only
// reading that survives the body writing it out as "between 20% and 30%".
const FIGURE = /([$€£])?\s?(\d[\d,]*(?:\.\d+)?)\s*(%|per ?cent)?\s*-?\s*([a-z]+)?/g;

function figures(text) {
  const out = [];
  for (const m of foldClaims(text).matchAll(FIGURE)) {
    const unit = (m[4] && MIRROR_UNITS.get(m[4])) ?? null;
    out.push({
      // Canonical, so "0.80" and "0.8" are one figure and "2,618" and "2618"
      // are too. Never a substring: this is the whole number or nothing.
      n: String(Number(m[2].replace(/,/g, ''))),
      currency: m[1] ?? null,
      percent: Boolean(m[3]),
      unit,
      // Reassembled rather than taken from the match, so the message quotes the
      // figure ("$4.99", "3.47 mm") and not the word that happened to follow it.
      raw: `${m[1] ?? ''}${m[2]}${m[3] ? (m[3] === '%' ? '%' : ' per cent') : ''}${unit ? ` ${m[4]}` : ''}`,
    });
  }
  return out;
}

// A year in a TITLE is a recency marker, not a claim about the article ("Best
// Apps to Stop Nail Biting in 2026"), and no body writes its own publication
// year into a sentence. In a DESCRIPTION a year is exactly the claim that went
// wrong — a fabricated "(Cochrane review, 2012)" — so it stays checked there.
const isYear = n => /^(?:19|20)\d{2}$/.test(n);

function checkMirror(where, mirrors, bodyText, sources, enumerated = new Set()) {
  const body = figures(bodyText);
  const bodyProse = foldClaims(bodyText);

  for (const [field, text] of mirrors) {
    if (!text) continue;
    // Why this matters, in the message, so it is obvious what to do about it.
    const role = field === 'description'
      ? 'the description is the SERP snippet, the on-page standfirst and the speakable target'
      : 'the title is what a SERP and an AI answer quote first';

    for (const f of figures(text)) {
      if (enumerated.has(f.n) || (field !== 'description' && isYear(f.n))) continue;
      const same = body.filter(b => b.n === f.n);
      if (!same.length) {
        problems.push(`${where}: ${field} asserts "${f.raw}" and the body it summarises never states that figure — ${role}, so a number only the mirror carries is one no reader can check. Correct it against the body, or drop it.`);
        continue;
      }
      if (f.currency && !same.some(b => b.currency === f.currency)) {
        problems.push(`${where}: ${field} prices something at "${f.raw}" but the body never gives ${f.n} in ${f.currency} — ${role}, and a price the page itself does not state is the claim that outlived three corrections. Correct it against the body, or drop it.`);
      }
      if (f.percent && !same.some(b => b.percent)) {
        problems.push(`${where}: ${field} says "${f.raw}" but the body gives ${f.n} without a percent sign — ${role}, and the same number as a proportion is a different claim. Correct it against the body, or drop it.`);
      }
      if (f.unit && !same.some(b => b.unit === f.unit || b.unit === null)) {
        const has = [...new Set(same.map(b => b.unit))].join('/');
        problems.push(`${where}: ${field} says "${f.raw}" but the body measures ${f.n} in ${has}, never in ${f.unit} — ${role}, and a unit the body does not use is a claim it does not make. Correct it against the body, or drop it.`);
      }
    }

    for (const raw of text.match(/\b[A-Z][a-z][A-Za-z'’-]+\b/g) ?? []) {
      const name = raw.replace(/['’]s$/, '').toLowerCase();
      if (!sources.has(name)) continue;
      if (new RegExp(`\\b${reEscape(name)}\\b`).test(bodyProse)) continue;
      problems.push(`${where}: ${field} credits "${raw}", a source this site cites elsewhere but that this page's body never cites — ${role}, so a study named only in the mirror is one the page cannot support. Cite it in the body, or drop the name.`);
    }
  }
}

// ─── Cited sources ───────────────────────────────────────────────────────────
// The vocabulary of surnames this site actually cites, read out of the two
// shapes a citation takes here: a reference-list author ("Lipner SR,") and an
// inline parenthetical ("(Azrin, Nunn & Frantz, 1980)"). Only names found in
// one of those shapes are ever checked, which is what keeps the rule free of
// false positives — a description may say "Stop Biting", "Windows" or "ADHD"
// without any of them being a citation.
//
// Any name the site ALSO writes as an ordinary lowercase word ("long", "grant",
// "treatment" — real surnames in the reference lists, ordinary English
// everywhere else) is dropped: a capitalised "Long" at the start of a sentence
// is not a citation, and guessing which it is would fail a green page.
const AUTHOR_INITIALS = /\b([A-Z][a-z][A-Za-z'’-]+)\s+[A-Z]{1,3}\b(?=\s*[,.;)]|\s+et al)/g;
const PARENTHETICAL_CITE = /\(([^()]*\b(?:19|20)\d{2}\b[^()]*)\)/g;
const AUTHOR_IN_LIST = /\b([A-Z][a-z][A-Za-z'’-]+)(?=\s*(?:,|&|and\b|et al))/g;

function citedSurnames() {
  const corpus = [
    ...BLOG_POSTS.map(postBodyText),
    ...Object.values(PAGE_MAP).map(get => comparePageText(get())),
  ].join(' ');

  const names = new Set();
  for (const m of corpus.matchAll(AUTHOR_INITIALS)) names.add(m[1].toLowerCase());
  for (const cite of corpus.matchAll(PARENTHETICAL_CITE)) {
    for (const m of cite[1].matchAll(AUTHOR_IN_LIST)) names.add(m[1].toLowerCase());
  }
  for (const word of corpus.match(/\b[a-z][a-z'’-]+\b/g) ?? []) names.delete(word);
  return names;
}

// ─── COMPARE_META in server.js ───────────────────────────────────────────────
// The last hand-written content mirror left in server.js: nine title and
// description pairs that restate nine pages in src/data/comparePages.ts. They
// are read as SOURCE TEXT rather than imported, because importing server.js
// starts a server. Braces are matched in the blanked copy (blankLiterals), so a
// `{` or a `'/…':` inside a description cannot be mistaken for structure.
//
// The blank starts AT the declaration, never at the top of the file:
// blankLiterals does not know regex literals, and server.js has several with a
// quote inside (`.replace(/"/g, '&quot;')`) — blanking the whole file reads one
// as a string opener and everything after it desynchronises. From the
// declaration to its closing brace there is nothing but strings and comments,
// which is exactly what has to be blanked, so the scoped blank is exact.
function compareMetaEntries(server) {
  const declared = server.search(/\n\s*const COMPARE_META = \{/);
  if (declared < 0) return null;
  const open = server.indexOf('{', declared);
  const code = blankLiterals(server.slice(open));
  const end = matchBrace(code, 0);
  if (end < 0) return null;

  const block = server.slice(open, open + end);
  const blockCode = code.slice(0, end);
  const entries = [];
  for (const m of block.matchAll(/'(\/[a-z0-9/-]+)':\s*\{/g)) {
    const from = m.index + m[0].length - 1;
    const to = matchBrace(blockCode, from);
    if (to < 0) continue;
    const entry = block.slice(from, to);
    const entryCode = blockCode.slice(from, to);
    entries.push({
      path: m[1],
      title: readProp(entry, entryCode, 'title'),
      description: readProp(entry, entryCode, 'description'),
    });
  }
  return entries.length ? entries : null;
}

// Index just past the `}` closing the `{` at `open`, in already-blanked code.
function matchBrace(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

// One property's string value. The property NAME is located in the blanked
// copy, so the word "title:" inside a comment — this block is full of comments
// explaining which claim was corrected — cannot be read as the property.
function readProp(src, code, prop) {
  const at = code.search(new RegExp(`\\b${reEscape(prop)}:`));
  if (at < 0) return null;
  const from = at + prop.length + 1;
  let depth = 0;
  let i = from;
  for (; i < code.length; i++) {
    const c = code[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { if (depth === 0) break; depth--; }
    else if (c === ',' && depth === 0) break;
  }
  return htmlToText(literals(src.slice(from, i))) || null;
}

checkMirrors();

function checkMirrors() {
  const sources = citedSurnames();

  for (const post of BLOG_POSTS) {
    checkMirror(
      `blogPosts.ts ${post.slug}`,
      [['description', post.description], ['title', post.title], ['seoTitle', post.seoTitle]],
      postBodyText(post),
      sources,
      enumeratedCounts(post),
    );
  }

  const metas = compareMetaEntries(readWorkTree(SERVER) ?? '');
  if (!metas) {
    problems.push('COMPARE_META: cannot read the declaration in server.js — the extractor in sync-seo.mjs no longer matches it, which silently un-gates every hand-written /compare and /solutions meta description');
    return;
  }
  for (const path of Object.keys(PAGE_MAP)) {
    if (!metas.some(m => m.path === path)) {
      problems.push(`COMPARE_META: no entry for ${path} — server.js serves that page with meta from somewhere this check cannot see`);
    }
  }
  for (const { path, title, description } of metas) {
    const page = PAGE_MAP[path]?.();
    if (!page) {
      problems.push(`COMPARE_META: ${path} has no page in comparePages.ts — its meta describes a body that does not exist`);
      continue;
    }
    if (!title || !description) {
      problems.push(`COMPARE_META: cannot read the ${title ? 'description' : 'title'} for ${path} — the extractor no longer matches the entry`);
      continue;
    }
    checkMirror(
      `server.js COMPARE_META ${path}`,
      [['description', description], ['title', title]],
      comparePageText(page),
      sources,
    );
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
