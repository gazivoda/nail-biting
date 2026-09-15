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

### Iteration 4 — re-audit + compression, OG images, llms.txt drift (5 subagents)

**Independent re-audit (scratchpad/iter4-reaudit.md), measured on the local build, 161 URLs, crawler UAs:**

| Category | Baseline | Now | Δ |
|---|---:|---:|---:|
| AI Citability | 88 | 91 | +3 |
| Brand Authority | 49 | 49 | 0 |
| Content E-E-A-T | 75 | 79 | +4 |
| Technical GEO | 93 | 90 | **−3** |
| Schema & Structured Data | 78 | 90 | +12 |
| Platform Optimization | 61 | 65 | +4 |
| **Composite** | **75** | **77** | **+2** |

Technical fell because the old 93 credited Brotli that was never actually served — a correction to the
record, not a regression. Every claim from iterations 1–3 was independently re-verified and held:
first-H2-is-a-question 62/143 exactly; 12 FAQPage / 48 pairs with byte-identity checked on **all 48**;
MedicalCondition 15/15 with condition + treatment visible; 0 aggregateRating sitewide; 0 conflicting
`@id` properties; 316/316 speakable selectors resolve; 0 fabricated date bumps.

- [x] **Compression — the origin served none at all.** No middleware, no dependency; `Content-Length`
      identical across every `Accept-Encoding`. Added Brotli + gzip above the static mounts so
      per-request HTML is covered. HTML −70% (26.6 KB → 8.1 KB), JS −75%, CSS −83%, MediaPipe wasm
      11.5 MB → 3.1 MB. `/og/*.png` and `/fonts/*.woff2` explicitly excluded; cache headers preserved.
- [x] **Per-page OG images**: 152 cards (143 posts + 9 compare/solutions), rendered through Chrome CDP
      using the site's own self-hosted fonts, palettised to 8-bit with a stdlib re-encoder — 3.27 MB
      total, max 28.2 KB, no new dependency, byte-deterministic across reruns. `SoftwareApplication.
      screenshot` pointed at a marketing image; no real screenshot exists in the repo, so it was
      **removed** rather than repointed.
- [x] **llms.txt had drifted from the site it describes** — still asserted Nailed is "$4.99 one-time"
      (corrected in iteration 2) and carried a **fabricated "Cochrane review, 2012"** citation plus the
      Hands Off vendor marketing figure the fact-check log explicitly refuses to repeat. Root cause
      fixed: link descriptions now derive from the same strings the pages render, and a tripwire fails
      `seo:check` when llms.txt asserts a token absent from the rendered corpus (all three failure modes
      regression-proved). Also fixed two fidelity bugs in `llms-full.txt` generation that welded every
      FAQ question onto the previous answer.
- [x] **Seven misattributed citations** found and corrected — the recurring failure mode on this site.
      "up to 45% of children" was credited to Halteh 2017, which does not contain it (it is Lee & Lipner
      2022 quoting Gupta & Gupta). Also: Berk 2009 described as a "trial" when it is three case
      observations; Ghanizadeh & Shekoohi reported as confirming diagnoses when it used no diagnostic
      interview; an HPV oral-cavity claim absent from its source; McGinley's "100×" figure not in the
      paper; Monzani's "5,409 adult twins" is female-only. 19 further citations verified as accurate.
- [x] `possibleTreatment` asserted bitter-taste polish on 14 pages that never mention it — now filtered
      per page against visible text (15 pages HRT-only, 2 with both).

**Correction to this log:** iteration 1's "`/` 1819 crawler-readable words" was a naive tag-strip that
counted inline CSS/JS as prose. The real figure is ~623. No regression — the span is unchanged — but the
number was wrong.

**Highest-value remaining repo action (audit's assessment):** only 26 of 143 posts carry any outbound
citation across ~153k words of health content, and just 13% of paragraphs contain a number, percentage
or year. Est. +2.4 composite — more than compression and OG images combined.
**~10 composite points are locked outside the repo**: off-site presence measures 3/100 (no Wikipedia, no
AlternativeTo, 0 Reddit threads, and the Product Hunt listing that exists is a *competitor's*), ≈6.8 pts;
platform/community pillars ≈1.9; the Google-Extended decision ≈0.5; www TLS + the 302 ≈0.45.

Gates: `tsc -b` 0 · `npm test` 71/71 · `build:web` 0 · `seo:check` 0 · 161/161 URLs 200 ·
837 JSON-LD blocks, 0 parse failures.

### Iteration 5 — verified source libraries, then ~20 more misattributions (5 subagents)

Method deliberately inverted. This site's recurring defect is citations that *resolve but do not
support the claim*, and the usual cure ("find a source for this sentence") is what produces it. So:
three agents first built libraries of what specific papers ACTUALLY say — **73 sources fetched and
read**, each recorded with verbatim quotes, sample details, and a **"DOES NOT SUPPORT"** list naming
the adjacent claims a careless writer would wrongly attach. Only then were claims matched to sources.

- [x] **~20 further misattributions corrected**, including:
      · Monzani 2014 (a twin study that ran no treatment) cited for a *treatment-sequencing* claim, and
        again for "environmental components are modifiable" when it found shared environment negligible
      · Roberts 2015 cited for perfectionism — it administered no perfectionism scale (n=24, outcome
        self-reported urge, and its stress induction was an explicit null)
      · An HPV finger→mouth transmission claim in a second article, sourced to a saliva-bacteria study
      · Klebsiella/Salmonella "routinely recovered from under fingernails" — neither was isolated in
        either cited study
      · Azrin 1980's "99% **at five-month follow-up**" (12 instances) — the design was self-recorded
        daily counts *for* five months. Now states the duration, the self-report, and cites the one
        openly-readable source for the figure
      · "HRT has consistently outperformed every other intervention" — contradicted by Allen 1996 and
        Koritzky & Yechiam 2011; it has never been tested against physical barriers at all
      · The dental chain (incisor wear, malocclusion, alveolar destruction) traced to a review with **no
        dental data** and an opinion piece with no N. Only root resorption has a real measurement.
        **Otsugu 2023 (n=503) found nail biting significantly NEGATIVELY related to malocclusion** — the
        opposite of what the site asserted — and is now presented honestly
- [x] **Derived-figure defects**: "hundreds of thousands vs hundreds to a few thousands" were antilogs
      the site computed from McGinley's log10 values. Now reports what the paper writes, and says
      explicitly why it won't convert them into a fold-difference.
- [x] **Two titles asserted claims their own bodies disown** — "Why It Peaks at 15" (no source locates a
      peak at any age) and "Why High Standards Drive the Habit". Both retitled; slugs unchanged.
- [x] **~16 claims softened rather than sourced** — regrowth *time*, handwashing, permanence thresholds,
      paronychia relative risk, per-day frequency, respiratory spread. Where nothing readable exists, the
      number is gone, not re-sourced.
- [x] Stale mirrors closed: `llms.txt` free prose and **`src/pages/Landing.tsx`** both still carried the
      old Azrin wording. Two meta descriptions still asserted the perfectionism claim their bodies had
      just disowned. 28 posts' `dateModified` bumped — verified by rendered-text diff, 0 markup-only bumps.

**Empirical correction worth keeping:** the libraries recommended swapping ~23 PubMed links to Europe PMC
for bot-readability. Measured before acting — `europepmc.org` returns **403 to ClaudeBot, GPTBot,
PerplexityBot and OAI-SearchBot**, while `pubmed.ncbi.nlm.nih.gov` returns a soft 203. The swap would
have made citability *worse*. None of the 23 has a PMC deposit, so they stayed; **13 genuinely
bot-readable PMC/OA sources were added alongside instead.** Citation URLs in the corpus: ~26 → **123**.

Gates: `tsc -b` 0 · `npm test` 71/71 · `build:web` 0 · `seo:check` 0 · 161/161 URLs 200 ·
0 JSON-LD parse failures · 0 occurrences of any corrected claim remaining in `dist/`.

### Iteration 6 — citation campaign across the uncited corpus (4 subagents + recovery)

Measured baseline: **29 of 143 posts carried any outbound citation**; 87 of the uncited were
health-adjacent. Three agents produced *patch proposals* (read-only, byte-exact find/replace) against
their matching library from iteration 5, then one applier landed all three — the only way to let three
agents work one file safely.

- [x] **301 proposed edits**: 149 CITE · 123 SOFTEN · 13 NO CHANGE. Posts with ≥1 citation:
      **29 → 100 of 143.** Unique citation URLs: ~26 → **73**.
- [x] The 43 still uncited are almost entirely the proposals' explicit NO CHANGE calls — Technology,
      Products, Comparison, Humor, plus 21 health posts where the libraries genuinely cover nothing
      (sleep, eczema, menopause, autism, panic disorder, dopamine…). Softening beat citing there.

**Three reader-safety escalations, all fixed:**
1. `nail-biting-healthcare-workers` asserted *"Research on subungual bacterial load has found
   meaningfully higher counts… under the nails of healthcare workers compared to the general
   population."* **No such study exists** — a fabricated finding aimed at an occupational audience.
2. `nail-biting-chefs-food-service` stated a real finding **backwards**: it claimed evidence that
   artificial nails harbour *more bacteria*. Hedderwick found quantities did **not** differ; what
   differed was likelihood of harbouring a pathogen (87% vs 43%).
3. `stop-nail-biting-challenge` claimed self-monitoring alone "produces measurable reductions in
   frequency". In both controlled nail-biting comparisons self-monitoring **was the control arm** and
   showed no significant improvement.

Also swept sitewide: "catches fewer than half of biting episodes" (unsourced, 9 occurrences), HRT's
third component mislabelled "external feedback" (trials say *social support*, 7 occurrences), and the
unsourced handwashing claim. All now 0. Two surviving uncited first-party "60–80% of daily episodes"
claims softened — the twin of one iteration 1 already fixed in `comparePages.ts`.
`nail-biting-warts` retitled: its title and description asserted the HPV finger→mouth route that its
own corrected body disowns. Third such self-contradicting title found in two iterations.

**Recovery note:** the applier hit a session limit mid-run. The tree was left consistent (tsc 0,
71/71, `seo:check` clean, 143 posts parsing) and the remaining items were finished directly.

**A swap I measured and rejected.** 8 new `doi.org` links return 403/406 to crawlers, so I tried to
repoint them at PMC. `elink`'s `linksetdbs[0]` returned the **same PMC ID for two different PMIDs**
twice over — it yields citation links, not each article's own deposit. Trusting that shape would have
minted 7 fresh misattributions. The DOIs stay: a DOI is a canonical permanent identifier, and a
bot-blocked-but-correct link beats a readable wrong one.

Gates: `tsc -b` 0 · `npm test` 71/71 · `build:web` 0 · `seo:check` 0 · 161/161 URLs 200 ·
0 JSON-LD parse failures.

### Iteration 7 — verify the citation campaign, then fix what it broke (5 subagents)

Rather than add more, this pass audited the last one. Two independent agents: an adversarial
citation verifier and a full re-audit.

**Re-audit (scratchpad/iter7-reaudit.md), local build, 161 URLs, crawler UAs:**

| Category | Orig | @0ccc121 | Now | Δ |
|---|---:|---:|---:|---:|
| AI Citability | 88 | 91 | **93** | +2 |
| Brand Authority | 49 | 49 | **50** | +1 |
| Content E-E-A-T | 75 | 79 | **86** | +7 |
| Technical GEO | 93 | 90 | **94** | +4 |
| Schema & Structured Data | 78 | 90 | **91** | +1 |
| Platform Optimization | 61 | 65 | **69** | +4 |
| **Composite** | **75** | **77** | **81** | **+4** |

Compression, OG cards and citation counts all verified as claimed (citations measured 26→102 posts,
slightly better than reported). The auditor also documented 5 of its own first-pass findings as false
positives so nobody re-derives them.

**Adversarial citation verification (scratchpad/iter7-verify.md)** — sampled 52 of the **216**
(claim, source) pairs the campaign created: 45 SUPPORTED, 4 OVERSTATED, 2 MISATTRIBUTED, 1
UNVERIFIABLE. **13.5% defect rate, 5.8% hard.** All 7 fixed this pass.
The actionable pattern: defects cluster at **~17% where a citation was bolted onto prose that was not
rewritten**, versus ~5% where the prose was rewritten alongside. Bolting on doesn't force you to read
the claim. Fixes this pass rewrote the surrounding sentence rather than swapping the link.

- [x] **Schema regression the campaign caused, and it was bigger than the audit found.** The
      `MedicalCondition` gate matches a treatment if every word of its name appears in the page text.
      Adding bibliographies put *paper titles* into that text — Twohig's "Evaluating the efficacy of
      **habit reversal**…" and Lee & Lipner's "…of **onychophagia**…". So pages began asserting the
      condition and its treatments on the strength of a reference list. Surface had grown **15 → 42**
      pages; the audit caught the treatment half (2 pages), the fix found the condition half too
      (25 more). Gate now strips Sources blocks by label *and* by shape (any `<li>` with an outbound
      link). Back to **15 pages / 20 assertions, 0 unevidenced** — proved by an independent checker
      that keeps only prose containers rather than reusing the gate's own denylist.
- [x] **The meta descriptions were never in the content file.** All 9 compare/solutions descriptions
      are hand-written in `COMPARE_META` in `server.js`, derived from nothing — which is why no gate
      caught that `/compare/stop-biting-vs-nailed` still asserted Nailed is "a $4.99 one-time app"
      three iterations after the body stopped. Four more corrected-away claims were found in the same
      block (tracking exclusivity, "catches every episode", the Desktop-vs-Mobile framing, and one
      logically inverted description). The fact-check log now names `COMPARE_META` as the un-gated mirror.
- [x] 4 posts had changed text with a stale `dateModified` — the inverse defect. Two were genuine
      (bumped); **two had not actually changed** and were correctly left alone.
- [x] `/fonts/*` and `/og/*` were serving `max-age=0` — fonts self-hosted to fix a 4.7s LCP, then
      paying a revalidation RTT. Both now `immutable`, still uncompressed, still correct content-type.

Gates: `tsc -b` 0 · `npm test` 71/71 · `build:web` 0 · `seo:check` 0 · 161/161 URLs 200 ·
0 JSON-LD parse failures · MedicalCondition 15/161 · FAQPage 12 pages, 48 pairs byte-identical.

### Iteration 8 — data-led answer blocks, and 25 descriptions that contradicted their own pages (4 subagents)

The prior audit named this the highest-value repo-fixable action: only **17 of 158** `.article-summary`
blocks contained a digit. That element does triple duty — it is the `<meta name="description">` SERP
snippet, the **first visible paragraph** of the article, and the target of the `speakable` schema. The
most extractable slot on every page was its vaguest sentence.

Two agents proposed byte-exact rewrites for the 143 posts; a third handled the 14 compare/solutions and
core pages; an applier landed them. The safety rule throughout: **a figure may appear in a summary only
if it already appears in that page's body with the citation the body carries.** No research, no new
figures, no strengthened claims — verified material moved into a more prominent slot.

- [x] **Answer blocks carrying a figure: 17 → 88 of 158.** Post descriptions with a digit: 12 → 77.
      All ≤165 chars (max 164). Hedging carried verbatim — "self-recorded … over five months",
      "measured in 22 adults", "though the quantities did not differ", "inherited from older reviews,
      not measured".
- [x] **25 descriptions contradicted their own body** — both proposal agents hit this independently,
      and it is the real find of the pass. A description promising "evidence-based ways to stop it" on a
      post whose body says *"nothing below has been tested for this"*; one asserting anxiety is the root
      cause where the body reports 22.5% of biters vs 26.2% of non-biters and "no correlation at all";
      one claiming elevated occupational infection risk on the page that explicitly retracts it.
      Same ungated-mirror defect iteration 7 found in `COMPARE_META`, now at corpus scale.
- [x] Five rewrites deliberately carry **no** number, because the sourced answer on those pages is
      "nobody has measured this". A number there would read as authority the evidence doesn't have.
- [x] Four flagged bugs fixed: an ungrammatical description left by an earlier edit; a "We tested every
      nail biting remedy" claim with no test behind it; "as of 2025" on a post titled "(2026 Data)"; and
      a body typo (`someight`) that predates all git history.

**Applier caught 1 defect in 93 entries (1.1%, vs 13.5% on the previous pass)** — a description carrying
"measured in 22 adults" where n=22 appears only in *sibling* posts. It also caught its own false
negative: a first automated check used substring matching, so `"22"` matched inside longer numbers and
reported zero defects; strict boundaries found the real one. The tighter rate is consistent with
iteration 7's finding that rewriting beats bolting on.

Gates: `tsc -b` 0 · `npm test` 71/71 · `build:web` 0 · `seo:check` 0 · 161/161 URLs 200 ·
0 JSON-LD parse failures · MedicalCondition 15/161 · speakable resolves on 161/161.
