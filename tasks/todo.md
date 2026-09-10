# SEO/GEO Optimization Loop — stopbiting.today

Started: 2026-08-11 (via /loop, self-paced). Baseline: GEO-AUDIT-REPORT.md 2026-06-15 = 64/100.

## Phase 1: Fresh audits (parallel subagents)
- [x] AI Visibility / Citability / Brand audit (geo-ai-visibility) — Citability 74 (+6), Brand 46 (+4); off-site presence ~zero (no Wikipedia/Wikidata/PH/AlternativeTo/YouTube; brand collisions with stopbiting.com + StopBite); /pricing 301→/#pricing killed crawler-readable pricing prose; llms-full.txt 404; Google-indexed title stale old brand

## Composite (2026-08-11): 59/100 — Citability 74×.25 + Brand 46×.20 + EEAT 48×.20 + Technical 80×.15 + Schema 48×.10 + Platform 52×.10
- [x] Platform optimization audit (geo-platform-analysis) — 52/100; SSR fix confirmed live on compare/solutions; home//how-it-works//about still 0 raw-HTML prose; best-apps comparison table CSR-only; off-site zero + entity collision (stopbiting.com, StopBite on PH); no IndexNow; Google-Extended blocked (confirm intent)
- [x] Technical GEO audit (geo-technical) — 80/100; SSR partially fixed (compare/solutions/blog-post have prose; `/`, /about, /how-it-works still 0 B); SSR uses hidden-text pattern (left:-9999px + aria-hidden) — devaluation risk; www serves broken Traefik default cert; http→https is 302; /blog list only in noscript
- [x] Content E-E-A-T audit (geo-content) — 48/100; CRITICAL: zero outbound citations in 50-post corpus (unverifiable clinical claims — cite-or-delete needed); server.js content mirror drifted from rendered content (9/50 titles differ = cloaking risk); anonymous "Editorial Team" byline; fake-looking hardcoded testimonials + "PERSONALIZE ME" comment; date contradictions; ~16 grammar artifacts
- [x] Schema & structured data audit (geo-schema) — 48/100; FAQPage 6 Q&As in schema vs 1 visible (policy risk); compare/solutions have zero page schema (comparison-schema.json unused); dup client+server BlogPosting with conflicting dateModified; fake SearchAction; sameAs=GitHub only; author is "Editorial Team" org not Person

## CRITICAL PROCESS FINDING (verified)
Local main is [ahead 128, behind 152] vs origin/main — LIVE SITE = origin/main (4da4455). Local has stale 63-URL sitemap, un-deployed /pricing//faq routes, dead /pricing handler. ALL FIXES MUST BRANCH FROM origin/main (use a worktree; do not touch user's checked-out main). Redeploying local HEAD would regress live schema.

## Phase 2: Aggregate
- [x] Composite GEO score + updated GEO-AUDIT-REPORT.md (2026-08-11, 59/100, written to repo root)
- [x] Prioritized fix list (Critical → High → Medium → Low) — in report + distributed to fix agents

## Phase 3: Fix (subsequent loop iterations)
- [x] Server-side fixes (commit 30f8061 on seo-geo-fixes, pushed): content fork deleted (build-step generator, drift now fails the build); SSR in-flow on all pages (hidden-text pattern removed); best-apps real <table>; /pricing restored 200 + Offer schema; SearchAction removed; Article+BreadcrumbList on compare/solutions; client dup schema deleted; author=Person Igor; http→301; Cache-Control; Permissions-Policy; llms.txt+llms-full.txt
- [x] Content fixes (commit d45a272, pushed): 43 citations/17 verified sources in 12 posts; ~25 fabricated claims removed (fake Cochrane 2012, Oblonskyy trial, JPSP 2017...); 70–90% HRT claim replaced w/ Azrin/Nunn in schema+copy (verbatim parity); honest social-proof section; disclaimers on 31 clinical posts; readingMinutes recomputed ×140; self-review disclosed; grammar artifacts zero
- [x] Verify integrated build (build:web exit 0; SSR smoke: FAQ parity, no hidden text, /pricing 200, best-apps <table>)
- [x] IndexNow key + post-deploy ping script (commit 01a02fa; run `node scripts/indexnow-ping.mjs` after deploys)
- [x] Adversarial review of branch diff vs live — verdict: content/schema/citations clean, strictly better than live on every route (parity table in scratchpad review-findings.md); 1 Critical + 1 High found, both fixed in commit 1181268 (Dockerfile missing COPY scripts → Docker deploys would fail, reproduced + fix verified via COPY-set build simulation; HowTo schema republished scrubbed 70–90% + unsupported 87% claim; also fixed: blog 200-fallback when seo-content.json missing, compare-page build validation)

### Needs user review (from server agent)
- Hand-tuned BLOG_META titles discarded — client `seoTitle ?? title` now wins (titles may shift)
- /pricing hydrates into landing page (no dedicated React route; adding one touches App.tsx)
- Visible blog byline still "Editorial Team" while schema says Igor (UI edit pending)
- If live 302 comes from Coolify proxy, flip to 301 in dashboard too
- sync-seo surfaces ~130 pre-existing meta-length warnings (content backlog)

## Known open items from 2026-06-15 audit (re-verify, don't trust)
- Non-blog pages (home, pricing, about, how-it-works, compare/*, solutions/*) shipped empty `<div id="root">` — JS-only prose
- Brand authority 42/100 — no Wikipedia/Reddit/YouTube presence, no aggregateRating

## Extension: 10 more iterations (user-requested 2026-08-11)
- [x] 1. Rewrite 64 blog titles >60 chars (commit 17b7505; all ≤46 chars, brand suffix preserved, seo:check 0 title problems)
- [x] 2. Rewrite 76 meta descriptions >165 chars (commit be93b71; 145–160 chars, seo:check exit 0 clean; note: llms.txt keeps old blurbs for existing entries — folded into iter 3)
- [x] 3. UI/schema alignment (commit 0f5f5a1): byline → Igor visible; /pricing real route w/ shared PricingSection; founder.jpg already clean on branch; llms.txt sync refreshes existing blurbs (74)
- [x] 4. Schema upgrades (commit fea26d1): speakable on home+posts (selector-verified); dateModified bumped for 61 body-changed posts only; ogImage wiring w/ fallback + 11-tag generation plan in scratchpad
- [x] 5. New comparison pages (commit 0d4295d): vs-hands-off, vs-nailed, vs-smartbehavior, ai-detection-apps roundup; all competitor facts verified on vendor sites 2026-08-11; sitemap 157 URLs
- [x] 6. New blog posts (commit 0866279): how-to-choose-nail-biting-treatment, nail-biting-mistakes, nail-biting-gym-sports; 2 new PubMed sources verified; corpus 143. Skipped founder/user-story topics (need real input — refused to fabricate). Queue: relapse recovery, explaining to partner
- [x] 7. Off-site launch kit (commit c87a510): docs/off-site-kit/ — PH launch (differentiate vs StopBite manual-logger), AlternativeTo FIRST (empty BFRB category graph = first-mover), 7 verified directories, participation-first outreach, sameAs staging; also fixed missing sameAs on /about Person. USER: GitHub repo README is default Vite — worth writing a real one
- [x] 8. Internal linking (commit 6528144): found blog SSR emitted NO related links — all 143 posts were dead ends for non-JS crawlers; shared pure getRelated() now feeds both client + build step; algorithm changed to cyclic (was: whole tag pointing at same 3); +15 contextual links to commercial pages. Graph: dead ends 143→0, orphans 6→0, broken 0, inbound min 2/avg 3.3/max 9
- [x] 9. Full re-audit of branch build — **composite 59 → 75 (+16)**: Citability 74→88, Brand 46→49, E-E-A-T 48→75, Technical 80→93, Schema 48→78, Platform 52→61. Zero critical regressions; 160/160 sitemap URLs 200, 0 JSON-LD parse failures, 0 broken links, 53/53 tests. Report: scratchpad/iter9-reaudit.md
- [x] 10. Final polish (commit 5cbeb29): /pricing now ONE SoftwareApplication via @id ref (the branch's only regression, closed); visible byline parity 152→0 pages; MedicalCondition scoped 160→71 pages; @id entity graph (#organization/#website/#app/#person); 404s noindex (bug predated branch); speakable on 9 compare/solutions. Independently re-verified by me via curl.

## EXTENSION COMPLETE — branch seo-geo-fixes = 13 commits, pushed, 75/100
Loop stopped 2026-08-12. Everything fixable from the repo is done and verified.
GEO-AUDIT-REPORT.md carries the status block with before/after scores.

## Review (loop phase 1 complete, 2026-08-11)

**Branch `seo-geo-fixes` pushed (4 commits: 30f8061, d45a272, 01a02fa, 1181268) — ready for review + merge.**
Merging and deploying is the user's call. After deploy: run `node scripts/indexnow-ping.mjs`.

Audit composite 59/100 (GEO-AUDIT-REPORT.md). Every on-repo Critical/High issue fixed and adversarially verified: raw-HTML prose on all routes (+563 words on `/`, +3915 on /blog vs live), zero fabricated claims remain, all schema valid, hidden-text pattern gone, no lost content.

### Remaining — needs the user
1. Merge seo-geo-fixes → main + deploy (Coolify); review flagged items above (titles now source-derived, byline UI, /pricing hydration)
2. www TLS cert (currently Traefik default cert) or drop the www A record; flip Coolify proxy 302→301 if proxy-issued
3. Bing Webmaster verification (import from GSC), then IndexNow ping
4. Off-site — the biggest remaining score lever (Brand 46/100): Product Hunt launch, AlternativeTo listing, expand Organization sameAs as profiles are created; confirm Google-Extended block is intentional (opts out of Gemini grounding)
5. Content backlog: 76 meta descriptions >165 chars, 64 titles >60 chars (pre-existing, identical to live; `npm run seo:check` lists them)
6. Reconcile local main (ahead 128 / behind 152 vs origin) — deliberately untouched by this loop

## Live demo in the landing hero (2026-08-12, branch `live-demo` from origin/main f84ce38)

Spec: `docs/superpowers/specs/2026-08-12-live-demo-design.md`. Built by 4 subagents in 2 waves.

- [x] Extract `DetectionSurface` from `CameraView` (pure presentational split; PiP stays in CameraView)
- [x] Add typed `CameraError` to `useCamera` (was swallowing every failure into console.error)
- [x] Pure `demoSession.ts` reducer + 18 unit tests (60s clock, catches ignored outside `running`)
- [x] `HeroDemo.tsx` — same useCamera/useDetection/createBiteDetector as the paid app
- [x] Landing hero wiring, lazy-mounted on click (replaces decorative DetectionWave)
- [x] SSR parity in `server.js` + `featureList` entry in `index.html`

Verified: tsc 0, 71/71 tests, build 0, SSR↔client copy byte-exact (302 chars, U+2014 + U+0027
on both sides), entry chunk has 0 MediaPipe refs, browser confirms zero mediapipe/wasm/.task
requests on page view, HeroDemo never touches useAppStore or localStorage.

Fixed during verification: demo card rendered light-grey in dark mode. Root cause is
pre-existing and site-wide — the `ink`/`cream`/`forest` scales are raw `oklch()` strings with
no `<alpha-value>` placeholder, so Tailwind silently drops EVERY `bg-{custom}/{opacity}` class
(`bg-ink-100/90`, `bg-cream-100/90`, `bg-forest-900/20` all generate nothing). Only bit us
because `bg-white/70` does generate and so won with no dark override. Card switched to the
opaque `bg-white dark:bg-ink-50` pair. **The site-wide issue is untouched and still latent.**

### Not verified / needs a human
- End-to-end detection in the demo (needs a real camera and a face) — logic is the shipping
  detector, but nobody has watched it fire from the landing page.
- Light mode on the demo card (theme toggle would not respond to automated clicks; the class
  pair is the one `CameraPanel` already ships).

## SEO/GEO loop round 2 (2026-09-10) — 10 iterations, 5-min cadence, branch `seo-geo-loop-sept`

Base: main @117bcc6 (rounds 1's work merged via PR #1/#2 and **confirmed live** — `/` 1819
crawler-readable words, `/blog` 5679). Prior composite 75/100.

### Iteration 1 — audit (4 parallel subagents) + fix (4 parallel subagents, strict file lanes)
- [x] Audit: platform 58/100, schema 82/100, technical 93/100 held, content integrity swept
- [x] **Content integrity** (`blogPosts.ts`): 5 unsourced claims deleted, 8 softened, 11 sources
      re-fetched and verified. Baydaş 2007 citation repointed from a BDJ news digest to
      PMID 17241163 (figures independently re-verified against the NCBI abstract).
      Medical disclaimer coverage 32 → 119 posts.
- [x] **Compare pages** (`comparePages.ts`): tables 4/9 → 9/9 (all cells vendor-verified
      2026-09-10); uncited first-party "30–60 detected" stat deleted; ADHD stimulant-rebound
      claims softened; disclaimers on all 9; run-on FAQ split into real `<h3>` pairs
- [x] **Shell schema + fonts** (`index.html`): unsourced YMYL claims stripped from
      MedicalCondition (prevalence, epidemiology, DSM-5, recognizingAuthority, cause);
      invalid `billingIncrement` → nested `UnitPriceSpecification`/`billingDuration`;
      Google Fonts self-hosted (8 woff2, `font-display:swap`) to unblock a 4.7s LCP render delay
- [x] **SSR + freshness** (`server.js`, `sync-seo.mjs`): schema `headline` now matches the
      rendered `<h1>` (97 mismatches → 0); real `dateModified`/`lastmod` from a git-pinned
      content fingerprint (no "stamp now"); `Last-Modified` on every indexable route;
      FAQPage on /how-it-works byte-exact to visible text; MedicalCondition gate 71 → 15 pages;
      robots.txt Google-Extended comment corrected; IndexNow wired + made incremental

Gates: `tsc -b` 0 · `npm test` 71/71 · `build:web` 0 · `seo:check` 0 · 160/160 URLs 200 ·
0 JSON-LD parse failures across 7 sampled routes.

**Owner decisions surfaced (not actioned):**
1. `Google-Extended: Disallow: /` currently blocks Gemini from *citing* the site, not just
   from training — the tokens are not separable. Business call, left as-is.
2. www.stopbiting.today still serves a Traefik default cert + 503, and apex HSTS
   `includeSubDomains` now makes that failure non-bypassable. Provision the cert or drop the
   A record.
3. http→https is a 302; should be 301/308 (Traefik `permanent: true`).
4. Brotli is not actually served to real browsers (only when `br` is the sole offered encoding).
5. IndexNow fires only via `npm run seo:indexnow` from a checkout — deliberately not auto-wired.

### Iteration 2 — Medium/Low tier: entity graph, citation granularity, page weight (5 subagents)
- [x] **Entity graph** (`index.html` + `server.js`, shape pinned centrally so the two lanes could not
      disagree): `#organization` had 2 conflicting declarations per page (differing `url` and `logo`
      type) → now 1 signature, 0 conflicting properties across all 4 `@id` entities sitewide.
      All 152 Article/BlogPosting nodes were anonymous and `/blog` declared 143 more anonymous stubs
      for the same articles — every article existed as two unlinked half-entities. `@id` = canonical
      on both → they merge. `#person.knowsAbout` drift hoisted to a shared const.
- [x] **Page weight**: `/blog` JSON-LD 48.5 KB → 8.6 KB (`hasPart` 143 → 20); page 104 KB → 64.5 KB.
      All 143 visible in-flow links preserved (verified).
- [x] **Schema-vs-content**: `itemListOrder: Descending` → `Unordered` (the page explicitly disclaims
      ranking); `$0` Offer bounded with a 3-day `eligibleDuration`; FAQPage given the homepage `@id`
      so it merges with the WebPage node; `speakable` + `.article-summary` landed together on 4
      templates (314 selectors resolve, 0 dangling); BreadcrumbList 153 → 160 pages.
- [x] **Citations** (`blogPosts.ts`): M1–M5 + 4 further defects the audit missed, incl. a Lee & Lipner
      characterisation absent from the paper (full text fetched, 0 hits for its key terms) and a CDC
      link pointing at a page carrying no nail guidance. Sources blocks split onto the sections whose
      claims they support. One blocked citation swapped to an open PMC equivalent.
- [x] **Competitor fairness** (`comparePages.ts`): quarterly re-verification against 10 vendor URLs
      found **5 places where we understated competitors** — Hands Off ships a stats tracker and a 5th
      BFRB, Nailed does track and its store price is Free (not $4.99), SmartBehavior does run on Macs.
      All corrected. "How we verified this page" now visible + dated on all 9 pages.

- [x] **Fixed a defect iteration 1 introduced.** The freshness ledger fingerprinted route-handler
      *source*, so schema-only edits faked content updates: `seo:sync` moved `/`, `/how-it-works`,
      `/pricing`, `/about` to today while their visible prose was byte-identical to live (proved by
      diffing tag-stripped local vs live output). Basis is now the route's rendered *visible text* —
      markup/schema/class/comment edits no longer move a date; a one-word prose edit does. Both
      directions proved with negative and positive tests.
      Side effect: dates corrected to when content actually first appeared (`/how-it-works`,
      `/pricing`, `/about` → 2026-08-11, the commit that created those SSR articles; legal pages →
      2026-04-09/04-16, independently corroborated by `PrivacyPage.tsx`'s own `lastUpdated` string).

Gates: `tsc -b` 0 · `npm test` 71/71 · `build:web` 0 · `seo:check` 0 · 160/160 URLs 200 ·
820 JSON-LD nodes, 0 parse failures · MedicalCondition still correctly scoped to 15/160.

### Iteration 3 — E-E-A-T surface, citability, and three false exclusivity claims (4 subagents)
- [x] **Editorial policy + author surface** (L4 H7, the largest remaining repo-fixable gap): new
      `/editorial-policy` page, author box on 153 pages, byline now links to `/about`,
      `<meta name="author">` "Stop Biting" → "Igor Gazivoda" (161/161, now derived from
      `SCHEMA_AUTHOR.name` so meta/JSON-LD/visible byline cannot drift).
      The policy documents ONLY practices the repo actually follows — each sentence traced to
      evidence (the fact-check log, disclaimer coverage, the soften-or-delete rule, the
      visible-text freshness fingerprint). It states plainly that Igor is a software developer,
      not a clinician, and that nothing here is medically reviewed. No editorial board, reviewer,
      cadence or credential was invented.
- [x] **FAQ answer blocks**: FAQPage 2 → 12 pages, 39 new Q&A pairs, built by reading the `<h3>Q</h3>
      <p>A</p>` pairs out of the served markup — no hardcoded question text, and a malformed pair is
      dropped rather than half-marked. Byte-identity verified by an independent HTML parser: 12 pages,
      0 mismatches. `/pricing` gained a question-form heading + direct answer from its real prices.
- [x] **Citability**: 10 audit-named posts rewritten to answer their own title question in ≤40 words,
      plus the corpus lever applied to 22 more. Posts whose FIRST H2 is a question: **30 → 62 of 143**.
      Zero new factual claims (machine-verified: 0 figures lost, 0 figures added, citation counts
      unchanged). 47 statement headings → questions across the 9 compare/solutions pages.
- [x] **Three false exclusivity claims found and fixed** — all understated competitors or overstated us:
      1. `/compare/bitter-polish-alternative`: "the only app that detects nail biting in real time"
         — contradicted our own `/compare/ai-detection-apps` ("four products now watch…")
      2. `best-apps-to-stop-nail-biting`: "the only dedicated AI detection tool for nail biting"
      3. **`Landing.tsx` hero**: HRT is "the only approach with real clinical evidence behind it" —
         false by the site's own citations (it cites an NAC RCT and a controlled bitter-polish trial)
      Six further "only…" claims were checked and left: each is scoped, true, and one of them
      actually credits a competitor.
- [x] **Honest `dateModified`**: bumped 31 of the 32 rewritten posts. The 32nd
      (`nail-biting-medication`) was excluded — its body text is byte-identical to HEAD, only a
      heading changed. `readingMinutes` recomputed on 4 posts using the rule the corpus itself
      encodes (reproduces 95 of 111 untouched posts exactly); 4 raised, none lowered, none overstating.

Gates: `tsc -b` 0 · `npm test` 71/71 · `build:web` 0 · `seo:check` 0 · 161/161 URLs 200 ·
0 JSON-LD parse failures · MedicalCondition still correctly scoped to 15.
