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
