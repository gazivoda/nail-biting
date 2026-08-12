# GEO Audit Report: Stop Biting

**Audit Date:** 2026-08-11 (prior baseline: 2026-06-15)
**URL:** https://stopbiting.today
**Business Type:** Consumer App / SaaS (on-device AI habit-breaking app; freemium subscription)
**Pages Analyzed:** 152 live sitemap URLs (homepage, blog index, 140 blog posts, about, how-it-works, 2 compare pages, 3 solutions pages, legal) — every template fetched raw with AI-crawler user agents (ClaudeBot / GPTBot / PerplexityBot / bingbot), no JS execution

---

## ⚠️ REPO ≠ PRODUCTION — read before touching any code

**The local checkout is NOT the deployed site.** Local `main` is **[ahead 128, behind 152]** of `origin/main` after a forced update (`+ dc689d2...4da4455`). The live site matches **`origin/main` (4da4455)**, which contains the compare/solutions SSR injection (`b077125`), ~90 additional blog posts, `scripts/sync-seo.mjs` (152-URL sitemap), the 140-post llms.txt, the `/pricing → /#pricing` 301, and an `index.html` SoftwareApplication with 3 offers — none of which exist in the local tree (local: 63-URL sitemap, 40-post llms.txt, no compare/solutions SSR, live `/pricing` handler).

- **All fixes are being built on branch `seo-geo-fixes`, cut from `origin/main`.**
- **Redeploying local HEAD (`dc689d2`) would regress the live site**: wipe ~90 posts from the sitemap, remove the compare/solutions SSR bodies, resurrect `/pricing` (emitting two conflicting SoftwareApplication objects), and downgrade the shell schema.
- Every file/line reference below states which tree it refers to. Do not apply fixes to local `main`.

---

## ✅ STATUS 2026-08-12 — remediation complete on `seo-geo-fixes` (13 commits, pushed)

**The audit below describes the LIVE site (origin/main). Branch `seo-geo-fixes` re-scores 75/100.**
Independently re-audited against this same rubric after the fixes landed — built, served, and fetched
with AI-crawler user agents and no JS:

| Category | Live (this report) | Branch | Δ |
|---|---:|---:|---:|
| AI Citability | 74 | **88** | +14 |
| Brand Authority | 46 | **49** | +3 |
| Content E-E-A-T | 48 | **75** | +27 |
| Technical GEO | 80 | **93** | +13 |
| Schema & Structured Data | 48 | **78** | +30 |
| Platform Optimization | 52 | **61** | +9 |
| **Composite** | **59** | **75** | **+16** |

Gates on the branch: `build:web`, `seo:check`, `tsc` and `npm test` (53/53) all exit 0; 160/160 sitemap
URLs return 200; 0 JSON-LD parse failures; 0 broken internal links; 0 pages using the hidden-text pattern.
Raw-HTML prose where there was none: `/` 0→544 words, `/about` 0→333, `/how-it-works` 0→366,
`/blog` 0→5,026, `/pricing` 301→a real page. Corpus: ~120,000 crawler-readable words.

**Brand Authority moved only +3, and that is honest** — a `docs/off-site-kit/` playbook was written but
**no off-site item was executed**, and off-site presence is 55% of that category. ~11 composite points
are locked outside the codebase (see the owner action list at the end of this report).

Detail: `tasks/todo.md` (iteration log) and the scratchpad reports `iter9-reaudit.md` / `iter10-fixes.md`.

---

## Executive Summary

**Overall GEO Score: 59/100 (Poor — upper edge). Prior: 64/100.** *(This is the LIVE site as audited
2026-08-11 — see the status block above for the remediated branch score of 75/100.)*

**The score dropped 5 points, but the site did not get worse — it got better.** Since June, the two biggest prior gaps were closed: `/compare/*` and `/solutions/*` now serve real server-rendered prose (372–559 words each, verified live with crawler UAs), and the blog corpus grew from 50 to 140 posts, all crawler-readable. AI Citability (68→74), Brand Authority (42→46), and Technical GEO (72→80) all rose.

The drop comes from **stricter verification surfacing deeper issues the June audit missed**, concentrated in two categories:

1. **Content E-E-A-T 68→48.** This audit greped the full corpus and diffed crawler HTML against the hydrated page. It found a **crawler/user content fork** (the manually-synced `server.js` article mirror has drifted — 9/50 titles differ, bodies rewritten), **confirmed zero outbound citations in ~43,000 words** of health content with named-but-unverifiable studies, unverifiable hardcoded testimonials next to a leftover "PERSONALIZE ME" template comment, and published/modified date contradictions.
2. **Schema 80→48.** June counted schema types; this audit validated them against visible content. It found a homepage FAQPage where only 1 of 6 Q&As is visible on the page, a fabricated SearchAction targeting a search page that doesn't exist, duplicate conflicting BlogPosting blocks after hydration, sitewide MedicalCondition on off-topic routes, and a sameAs containing exactly one URL.

Platform Optimization (65→52) fell because this audit weights off-site pillars (entity recognition, community validation, ecosystem presence) that remain at effectively zero — not because on-site readiness declined (it improved).

The headline risks are now: (1) the repo/production fork itself, (2) the content mirror drift combined with the hidden off-screen SSR pattern — together a genuine cloaking exposure under Google's spam policies, (3) the still-prose-empty homepage/`/about`/`/how-it-works`, and (4) an off-site brand footprint of zero while competitors (Hands Off, StopBite, NailKeeper) hold the Product Hunt / AlternativeTo / app-store listings that AI engines cite.

### Score Breakdown

| Category | Score | Prior | Weight | Weighted |
|---|---|---|---|---|
| AI Citability | 74/100 | 68 | 25% | 18.5 |
| Brand Authority | 46/100 | 42 | 20% | 9.2 |
| Content E-E-A-T | 48/100 | 68 | 20% | 9.6 |
| Technical GEO | 80/100 | 72 | 15% | 12.0 |
| Schema & Structured Data | 48/100 | 80 | 10% | 4.8 |
| Platform Optimization | 52/100 | 65 | 10% | 5.2 |
| **Overall GEO Score** | | **64** | | **59/100** |

---

## Fixed Since June — verified live, do NOT re-report

| June finding | Status 2026-08-11 |
|---|---|
| `/compare/*` and `/solutions/*` CSR-only (June High #1/#2) | **FIXED** — SSR `<article id="ssr-page-content">` live on all 5 pages: bitter-polish 547 words/16 `<p>`, habit-tracking 559 w, for-adhd 543 w, for-desk-workers 372 w, for-gamers 384 w |
| Blog corpus | **Grew 50 → 140 posts**, all with SSR bodies + BlogPosting + BreadcrumbList; CollectionPage on `/blog` lists all 140 |
| llms.txt blog section | **Fresh** — all 140 live slugs present, 0 missing (30.9 KB, valid format, pricing + key-facts sections) |
| FAQPage scoped to homepage only (commit 2362445) | **VERIFIED** — present on `/` only, absent from all other routes |
| Compare/solutions "thin/templated" concern | **Does not hold** — pages are substantive and differentiated |
| `/pricing` page CSR-only | **Obsolete** — route now 301s to `/#pricing`; sitemap consistent (but see High #4: the redirect created a new gap) |
| Soft-404s / canonical hygiene | Clean — real 404 + `noindex` on unknown routes; self-referencing canonicals on all templates |

---

## Critical Issues (Fix Immediately)

1. **Repo/production divergence — any deploy from local `main` regresses the live site.**
   See the warning box above. Concrete conflicts: local `server.js:1547-1586` still serves `/pricing` (live: 301); local `server.js:1625-1676` compare/solutions handlers inject meta only (live: full SSR bodies); local `public/sitemap.xml` = 63 URLs incl. `/pricing` (live: 152, no `/pricing`); local `public/llms.txt` = 40 posts (live: 140); local `index.html:101-109` SoftwareApplication has 1 offer (live shell: 3 offers — Free $0 / $2.99 P1M / $29.00 P1Y — matching no committed index.html). **Fix:** work only on `seo-geo-fixes` (from `origin/main`); reconcile or discard local `main`.

2. **Crawler-visible content differs from user-visible content (cloaking risk).**
   `server.js` maintains a manually-synced mirror of the article corpus (`BLOG_META` ~631, `BLOG_DATES` ~836, `BLOG_SECTIONS_DATA` ~892 in local tree; each commented "kept in sync manually") injected as a hidden off-screen article. The mirror has drifted from `src/data/blogPosts.ts`: **9/50 titles differ** and section headings/bodies diverge substantially. Verified live on https://stopbiting.today/blog/why-do-people-bite-their-nails — crawler H1 "…The Psychology and Science Behind Onychophagia" vs hydrated H1 "…And Why Is It So Hard to Stop?", with entirely different H2s; the server versions name researchers (Deckersbach, Grant et al., PLOS ONE 2015) users never see. Hidden text that diverges from rendered content is exposure under Google's cloaking/hidden-text spam policies, and AI engines are citing article text users cannot find on the page. **Fix:** make `server.js` consume the same data module as the client (single source of truth); this also fixes the date mismatches (High #7).

3. **Homepage, `/about`, `/how-it-works` ship 0 bytes of body prose; `/blog` index is noscript-only.**
   Verified live with GPTBot/ClaudeBot UAs: `/`, `/about`, `/how-it-works` = 0 `<p>`, 0 `<h1>`, empty `<div id="root">` + 350 B noscript nav; `/blog` = 0 B visible prose (16.8 KB inside `<noscript>`, unreliably indexed). The site's priority-1.0 page is the worst page on the site for non-JS crawlers while ~145 of 152 URLs are readable. `/how-it-works` still ships HowTo schema describing steps invisible in raw HTML (schema/content mismatch, open since June). **Fix (on `seo-geo-fixes`):** extend the proven `ssr-page-content` injection to `app.get('/')`, `/about`, `/how-it-works`; move the `/blog` post list from `<noscript>` into real HTML (the CollectionPage data already exists server-side).

4. **Zero outbound citations across the entire science-heavy corpus.**
   `grep -c "http"` on `src/data/blogPosts.ts` → **0** external links in ~43,000 words of health/psychology content (only external links in served HTML are Google Fonts). Meanwhile posts make precise clinical claims: "70–90% reductions" (~6× sitewide), "A 2012 Cochrane review" (`ComparePage.tsx:30`), "2021 Journal of Attention Disorders… 74% of adults with ADHD" (`server.js:1058`), "2017 JPSP hand-grooming study" (`blogPosts.ts:1388`), "2018 study… 58% more likely to have oral HPV" (`server.js:1143`), Grant et al. 2009, Deckersbach follow-up (`server.js:905`). Several could not be verified — a factual-integrity liability on YMYL-lite content, not just a trust-signal gap. bfrb.org (TLC Foundation) is mentioned twice as plain text and never linked. **Fix:** cite-or-delete pass on the top 10 posts; verify every named study against the actual paper; link bfrb.org where already mentioned.

---

## High Priority Issues (Fix Within 1 Week)

1. **Hidden-text SSR delivery pattern.** All server-rendered prose ships as `<article id="ssr-page-content|ssr-blog-content" style="position:absolute;left:-9999px;…" aria-hidden="true">` (local `server.js:1278` and origin/main equivalents). AI crawlers read it fine; for Google it is the classic off-screen-text pattern — and it is the page's *only* pre-JS content. `aria-hidden="true"` on the only machine-readable content is also an accessibility anti-signal. origin/main commit `bf4dab1` (drop fallback after hydration) mitigates but does not remove the risk — and Critical #2 shows the parity it depends on has already broken. **Fix:** serve the article in-flow (visible until hydration replaces it), not off-screen.

2. **The five-tool comparison table is invisible to crawlers — zero `<table>` elements in raw HTML sitewide.** On https://stopbiting.today/blog/best-apps-to-stop-nail-biting (sitemap priority 0.9), the SSR block contains `<h2>Full feature comparison table</h2>` followed by an intro `<p>` and then… the next section. The table renders client-side only. Tables are the most-extracted structure for "best app for X" AI answers; the site's single most extractable asset is missing where it matters. **Fix:** render the matrix as a real `<table>` in the SSR article.

3. **Zero off-site brand footprint, with active brand collision.** Verified absent (2026-08-11): Wikipedia (API search 0, `/wiki/Stop_Biting` 404), Wikidata (0), YouTube, Hacker News (Algolia 0 — HN item 35787643 "stop nail-biting with webcam" is competitor handsdown.kianpak.com), Product Hunt (the "StopBite" listing is a different product), AlternativeTo (competitor Hands Off is listed; Stop Biting is not), G2/Trustpilot/Capterra, app stores. Reddit: none surfaced (API blocked — reported as unconfirmed, not zero). Aggravating: searches for the brand surface **stopbiting.com** (unrelated psychologist site) and competitor roundups (nailedapp.io "StopBite Alternative…") that exclude the brand. This caps AI recommendation confidence regardless of on-site quality and drags ChatGPT (entity 9/35), Perplexity (community 3/30), and Gemini (ecosystem 4/35) simultaneously. **Fix:** see "Off-Repo / Off-Site Actions" below — these are owner tasks, not code.

4. **`/pricing` 301 → `/#pricing` lands on a prose-empty page.** The fragment resolves to the homepage, which has 0 body prose (Critical #3); the dedicated Offer-schema page is gone. "How much does Stop Biting cost" is currently answerable only from llms.txt and the shell schema. **Fix:** either restore a 200 `/pricing` page with prose + a single merged SoftwareApplication (use `@id: https://stopbiting.today/#app`), or keep the redirect and SSR the pricing section into the homepage body.

5. **Homepage FAQPage schema mismatches visible content.** 6 Q&As in schema (`index.html:128-183` local; live shell equivalent) but only 1 question ("Why do people bite their nails?", `Landing.tsx:303`) is rendered on the page — and the raw-HTML body is ~8 words. Schema describing invisible content is a Google policy risk. **Fix:** render all 6 Q&As as a visible homepage FAQ section (pairs naturally with Critical #3's homepage SSR), or trim schema to what is shown.

6. **`https://www.stopbiting.today` is broken.** DNS resolves (A → 91.99.19.151, same box) but Traefik serves `CN = TRAEFIK DEFAULT CERT` (self-signed) — TLS handshake fails for every www visitor and crawler. **Fix (infra, not repo):** issue a cert for www + 301 to apex in Coolify/Traefik, or delete the www A record.

7. **No named author or medical reviewer; conflicting dates; duplicate schema.** All 140 posts are bylined `Organization: "Stop Biting Editorial Team"` (`BlogPost.tsx:57-63`, `server.js:1313-1319`) — no named Person, no credentials, no reviewer, despite content on HPV/HSV transmission, NAC dosing, pregnancy, children. The founder (Igor Gazivoda) has Person schema on `/about` but never bylines articles. Compounding: client-side `BlogPost.tsx:47-137` injects a *second* BlogPosting+BreadcrumbList after hydration whose fields conflict with the server pair — dateModified differs on ≥3 posts (e.g. habit-reversal-training-guide: server 2026-04-03 vs client 2026-04-17); the live byline shows "Updated 17 April 2026" while live schema says 2026-04-03. **Fix:** byline the founder as Person author (+ url `/about`, + sameAs); delete the client-side schema injection (server is authoritative); sync `BLOG_DATES` with `blogPosts.ts` (falls out of Critical #2's shared-data refactor).

8. **Unverifiable testimonials and undisclosed self-review.** `Landing.tsx:405-455` hardcodes three 5-star quotes ("Sarah K.", "Marcus T.", "Priya M.") with no source, adjacent to a leftover template comment "PERSONALIZE ME → …replace the copy below with your real story" (`Landing.tsx:378-383`). `/blog/stop-biting-app-review` reviews the site's own product with no disclosure — inconsistent with best-apps (`blogPosts.ts:753`) and vs-mavala (`blogPosts.ts:879`), which disclose properly. Mitigating: no fabricated aggregateRating/Review schema anywhere (verified). **Fix:** add the disclosure line; replace or remove testimonials until real quotes exist; delete the template comment.

9. **Compare/solutions pages carry zero page-specific schema.** All 5 pages emit only the 4 global blocks despite now having full SSR prose — no BreadcrumbList, no WebPage/Article wrapper, no FAQPage. A vetted `comparison-schema.json` sits unused in the repo root. **Fix:** wire it into the origin/main compare/solutions handlers.

---

## Medium Priority Issues (Fix Within 1 Month)

1. **Fabricated SearchAction.** WebSite `potentialAction` targets `https://stopbiting.today/?q={search_term_string}` (`index.html:63-70`) but the site has no search. Remove the potentialAction.
2. **Organization sameAs = 1 URL** (github.com/gazivoda/nail-biting, verified 200). No LinkedIn, X, Product Hunt, YouTube, Wikidata. The `/about` Person schema has no sameAs and no image (`/founder.jpg` 404s); landing founder note is signed "— The Stop Biting team" while `/about` says "I'm Igor Gazivoda". Highest-leverage entity-resolution property on the site. (Profile creation is an off-site owner task; see below.)
3. **Sitewide MedicalCondition schema on every route** (`index.html:186-218`) — health YMYL schema on gaming/comparison pages is a topical mismatch. Scope to homepage + relevant posts.
4. **Find-replace grammar damage in user-facing copy.** Bulk replace of "BFRB(s)"→"these habits" / "onychophagia"→"nail biting" broke ~9–16 passages in `blogPosts.ts` ("anxiety, depression, or other these habits" at :431, "How these habits Compare", "Hereditary habit Risk"…). Visible to every reader; one-hour cleanup.
5. **No medical disclaimer sitewide** despite pathogen-transmission, supplement-dosing, pregnancy, and children's mental-health content; only the NAC post has a consult-your-provider line (`blogPosts.ts:1055`). No legal entity/address on terms/privacy/refund (partially mitigated by Paddle as merchant of record).
6. **llms.txt "Key pages" stale; no llms-full.txt.** Key pages lists only Home, Blog, Privacy, `/#contact` — missing `/how-it-works`, `/about`, both `/compare/*`, all three `/solutions/*` (all now SSR'd and sitemap-listed). `llms-full.txt` → 404. Open since June.
7. **Google-Extended blocked in robots.txt.** Per Google's docs this opts the site out of **Gemini grounding**, not just training (Search/AI Overviews unaffected). Gemini is the weakest platform (40/100) partly because of it. Deliberate choice — needs an explicit owner decision (see below).
8. **No IndexNow, no verifiable Bing Webmaster presence.** No IndexNow key file in `public/`, no ping code, no `msvalidate.01` meta. Copilot citations are fed by the Bing index and the blog publishes frequently. (Verification step is an owner task.)
9. **Redirect and caching hygiene.** `http→https` is a **302** (should be 301/308, Traefik `permanent: true`); HTML responses send only a weak ETag — no `Cache-Control`, so stale head metadata may outlive deploys. Add `Cache-Control: no-cache` to HTML routes.
10. **Stale old-brand SERP title.** Google's indexed homepage title is still "…| **Nail Habit App**" vs live "Stop Nail Biting with AI | Stop Biting" — AI engines quoting SERPs echo the dead brand. Request recrawl in Search Console once homepage SSR (Critical #3) lands.
11. **Blog FAQ sections are schema-less prose blobs.** Question+answer concatenated inside single `<p>` elements (verified on best-apps post); no per-post FAQPage, questions not in heading markup. Mark up as `<h3>` question + `<p>` answer and add per-post FAQPage.
12. **Missing `Permissions-Policy` header; CSP `script-src` retains `'unsafe-inline'`.**

---

## Low Priority Issues (Optimize When Possible)

1. HowTo schema ×2 (`/how-it-works`, HRT guide) — deprecated for Google rich results since Sep 2023; keep for AI semantic value or remove, but don't invest further.
2. `speakable` absent sitewide (0/10 in schema scoring) — cheap differentiator on homepage FAQ + top posts once visible content exists.
3. No `Content-Signal:` directive in robots.txt — declare `search=yes, ai-retrieval=yes, ai-train=no` to make current intent explicit (contentsignals.org).
4. Single shared `og-image.png` for all 140 posts; zero in-article images/screenshots; `readingMinutes` inflated (~7 min claimed for ~600-word posts).
5. Trailing-slash variants return 200 instead of 301 (canonical mitigates); HSTS lacks `preload`; `/faq` route exists in server.js but is absent from sitemap and llms.txt.
6. `/blog` CollectionPage JSON-LD is 49 KB (140 hasPart stubs) — valid but heavy; consider top-N.
7. Wikipedia/Wikidata entity not feasible until independent coverage exists — sequence after off-site work.

---

## Category Deep Dives

### AI Citability — 74/100 (was 68)
The compare/solutions SSR fix closed the highest-intent gap, and the corpus nearly tripled — all of it crawler-readable. Sampled passages score 78–85/100 citability (statistics post prevalence block; best-apps "Why most habit apps fail"; app-review privacy passage "nothing is ever transmitted… processed locally by MediaPipe"; compare/bitter-polish "most nail biting is automatic…"). Held back by: prose-empty homepage (~45 via FAQ schema only), `/about` (~20), `/how-it-works` (~35), the `/pricing` redirect (~15), the missing SSR comparison table, zero outbound citations, and org-only authorship.

### Brand Authority — 46/100 (was 42)
Composite: Crawler Access 100 (×0.30) + llms.txt 80 (×0.15) + Off-site Presence **8** (×0.55). Crawler access is exemplary (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot explicitly allowed; only training-only bots blocked; CCBot deliberately open). llms.txt is excellent except the stale Key-pages section. Off-site presence is near-zero across every platform AI engines consult, while a name collision (stopbiting.com, StopBite) actively muddies entity resolution. Entity recognition exists — category searches do surface the brand and AI summarizes its positioning accurately — but authority scaffolding does not.

### Content E-E-A-T — 48/100 (was 68)
**The drop is verification depth, not content regression** — the corpus improved (best-apps upgrade, disclosures on 2 of 3 comparison posts, substantive compare pages, honest treatment of product limitations and weak evidence bases). The score reflects what full-corpus grep + crawler-vs-hydrated diffing found: the content fork (Critical #2), confirmed zero citations (Critical #4), anonymous org authorship on YMYL topics, unverifiable testimonials with template scaffolding, date contradictions, and find-replace grammar damage. Dimensions: authorship 6/20, citations 3/20, experience 8/15, about-page 9/15, freshness 11/15, depth/originality 11/15. Genuine strengths: ~43k words, no thin pages, strong founder narrative on `/about`, fresh Apr–May 2026 corpus.

### Technical GEO — 80/100 (was 72)
Crawlability 95, meta/indexability 92, URL structure 90, mobile 85, security 85. Verified: valid 152-URL sitemap with lastmod, per-route rewritten canonicals/OG/Twitter, real 404s with noindex, brotli + immutable asset caching, HSTS/CSP/XFO/nosniff/COOP-CORP. Deductions: the SSR gap on 4 routes (65/100 on the rendering axis — homepage LCP gated on ~140 KB br of JS), hidden-text delivery, broken www TLS, 302 http→https, no HTML Cache-Control, no Permissions-Policy.

### Schema & Structured Data — 48/100 (was 80)
June counted types; August validated them. 100% JSON-LD, all server-delivered, all parseable — and no invented ratings/reviews anywhere (the repo even documents "Do NOT add aggregateRating until real review data exists"; prices in schema match visible copy exactly). But: FAQPage visible-content mismatch (High #5), fabricated SearchAction (Medium #1), duplicate conflicting BlogPosting post-hydration (High #7), zero page-specific schema on the 5 compare/solutions pages (High #9), sitewide MedicalCondition (Medium #3), sameAs 1/15 (Medium #2), speakable 0/10, deprecated HowTo ×2.

### Platform Optimization — 52/100 (was 65)
Per-platform: Google AI Overviews 64 (strongest — Google renders JS and rewards the schema depth + topical cluster), ChatGPT 60 (crawler access 25/25, but entity recognition 9/35), Bing Copilot 50 (no IndexNow/webmaster verification, thin Microsoft ecosystem), Perplexity 48 (community validation 3/30 — the single biggest platform drag), Gemini 40 (weakest: zero Google-ecosystem presence + Google-Extended blocked = Gemini grounding opt-out). The June→August drop reflects heavier weighting of these off-site pillars; on-site readiness improved (compare/solutions SSR verified on every platform rubric).

---

## Off-Repo / Off-Site Actions — the site owner must do these personally

No code change can move these; they gate Brand Authority (46) and three of five platform scores.

1. **Product Hunt launch** for Stop Biting (the existing "StopBite" listing is a different product). Use consistent "Stop Biting (stopbiting.today)" naming to disambiguate.
2. **AlternativeTo listing** — competitor Hands Off is already listed; this is the directory AI engines most often cite for "X alternatives".
3. **Create real profiles for sameAs** — LinkedIn company page, X account, (Product Hunt once live) — then they get added to Organization + Person schema on `seo-geo-fixes`. Fix the founder photo and identity story while at it.
4. **Bing Webmaster Tools verification** (GSC import takes minutes) + confirm IndexNow key once the repo side ships; submit the sitemap.
5. **www TLS**: issue the `www.stopbiting.today` cert in Coolify/Traefik (+ 301 to apex) or delete the www DNS A record.
6. **Google-Extended decision**: keep the block (privacy-consistent, forfeits Gemini grounding) or unblock (Gemini citations; Search/AIO unaffected either way). Decide explicitly and record it.
7. **Community presence** (slower burn): value-first participation on r/calmhands and r/BFRB per subreddit rules; 1–2 short YouTube demos of on-device detection referenced from `/how-it-works`.
8. **Search Console**: request homepage recrawl after the SSR fix lands to purge the stale "Nail Habit App" SERP title.

---

## Quick Wins (Implement This Week, on `seo-geo-fixes`)

1. **Extend the proven `ssr-page-content` injection to `/`, `/about`, `/how-it-works`** and move the `/blog` post list into real HTML — 0 B → ~3–4 KB prose each on the most-cited URLs. *Impact: high.*
2. **Render the five-tool comparison table as a real `<table>`** in the SSR article on `/blog/best-apps-to-stop-nail-biting` — the heading already promises it. *Impact: high.*
3. **Kill the manual mirror**: make `server.js` consume `src/data/blogPosts.ts` (shared module) — fixes 9 drifted titles, divergent bodies, and 3 date mismatches in one refactor, and removes the cloaking exposure. Delete the client-side schema injection in `BlogPost.tsx:47-137` in the same pass. *Impact: high (risk removal).*
4. **Cite-or-delete pass** on the top 10 posts: 2–4 verified PubMed/DOI links each, starting with claims that already name studies; link bfrb.org; remove anything unverifiable. *Impact: high (E-E-A-T's biggest lever).*
5. **Schema hygiene batch**: visible homepage FAQ section (or trim FAQPage), remove the fake SearchAction, wire `comparison-schema.json` into the compare/solutions handlers, byline the founder as Person author, refresh llms.txt Key pages. *Impact: medium-high.*

---

## 30-Day Action Plan

### Week 1: De-risk (repo + cloaking + prose gap)
- [ ] Confirm all work happens on `seo-geo-fixes` (from `origin/main`); archive or hard-reset local `main` so it cannot be deployed
- [ ] Unify `server.js` article data with `src/data/blogPosts.ts`; delete client-side BlogPosting injection; verify crawler H1/H2s == hydrated H1/H2s on 5 sampled posts
- [ ] SSR `/`, `/about`, `/how-it-works`, `/blog` index; verify with `curl -A GPTBot <url> | grep "<p>"`
- [ ] Serve SSR articles in-flow (drop `left:-9999px` + `aria-hidden`)

### Week 2: Extraction surfaces
- [ ] SSR the comparison `<table>` on best-apps post
- [ ] Restore a citable pricing surface (200 `/pricing` with merged `@id` schema, or pricing prose in homepage SSR); sync sitemap
- [ ] Visible homepage FAQ (6 Q&As) matching FAQPage schema; remove fake SearchAction; scope MedicalCondition to relevant routes
- [ ] Page-specific schema (BreadcrumbList + WebPage/FAQ) on all 5 compare/solutions pages via `comparison-schema.json`

### Week 3: Trust layer
- [ ] Citations pass (top 10 posts, verified links only); fix ~16 grammar artifacts; add medical-disclaimer component to Health-tagged posts
- [ ] Byline founder as Person author with sameAs; fix `/founder.jpg`; sign the landing note; add disclosure to app-review post; replace/remove hardcoded testimonials + "PERSONALIZE ME" comment
- [ ] Refresh llms.txt Key pages; publish llms-full.txt; add IndexNow key file + deploy ping
- [ ] Infra: 301 http→https, `Cache-Control: no-cache` on HTML, Permissions-Policy header

### Week 4: Off-site (owner tasks — see section above)
- [ ] Product Hunt launch + AlternativeTo listing
- [ ] LinkedIn/X profiles created → sameAs expanded to 4+ URLs
- [ ] Bing Webmaster verification + sitemap submit; www cert or DNS removal
- [ ] Google-Extended decision recorded; Search Console recrawl request for `/`

---

## Appendix: Pages Analyzed (raw non-JS view, 2026-08-11)

| URL / Template | HTTP | `<p>` / `<h1>` / `<table>` | Crawler-readable body? | Issues |
|---|---|---|---|---|
| `/` | 200 | 0 / 0 / 0 | No — FAQPage schema + noscript nav only | C3, H5 |
| `/about` | 200 | 0 / 0 / 0 | No | C3, H7, M2 |
| `/how-it-works` | 200 | 0 / 0 / 0 | No — HowTo schema unbacked | C3, L1 |
| `/blog` (index) | 200 | 0 / 0 / 0 | No — 16.8 KB in `<noscript>`; 140 crawlable links | C3, L6 |
| `/pricing` | 301 → `/#pricing` | — | Redirects to prose-empty homepage | H4 |
| `/compare/bitter-polish-alternative` | 200 | 16 / 1 / 0 | **Yes — SSR, 547 words** | H1, H9 |
| `/compare/habit-tracking-apps` | 200 | 15 / 1 / 0 | **Yes — SSR, 559 words** | H1, H9 |
| `/solutions/for-adhd` | 200 | 15 / 1 / 0 | **Yes — SSR, 543 words** | H1, H9 |
| `/solutions/for-desk-workers` | 200 | 11 / 1 / 0 | **Yes — SSR, 372 words** | H1, H9 |
| `/solutions/for-gamers` | 200 | 11 / 1 / 0 | **Yes — SSR, 384 words** | H1, H9 |
| `/blog/best-apps-to-stop-nail-biting` | 200 | 32 / 1 / 0 | Yes — SSR, 1,310 words; **table missing** | H2, C4 |
| `/blog/why-do-people-bite-their-nails` | 200 | many / 1 / 0 | Yes — but **content differs from hydrated page** | C2 |
| `/blog/habit-reversal-training-guide` | 200 | 10 / 1 / 0 | Yes — SSR, 631 words | C4, H7 (dates) |
| `/blog/stop-biting-app-review` | 200 | many / 1 / 0 | Yes — SSR, 706 words | H8 (no disclosure) |
| `/blog/nail-biting-statistics` | 200 | many / 1 / 0 | Yes — SSR, 473 words | C4 |
| `/blog/stop-biting-vs-mavala-stop` | 200 | many / 1 / 0 | Yes — SSR, 752 words | — |
| `/privacy`, `/terms-and-conditions`, `/refund-policy` | 200 | legal | Low priority | M5 (no legal entity) |
| `www.stopbiting.today` | TLS fail | — | Self-signed Traefik default cert | H6 |

*Method: raw HTML fetched with ClaudeBot/GPTBot/PerplexityBot/bingbot UAs (no JS); robots.txt, llms.txt, sitemap.xml (152 URLs) fetched live; source cross-checked against local repo AND `origin/main` (live = `4da4455`); brand presence via Wikipedia/Wikidata APIs, HN Algolia, and live web search; raw fetch evidence saved in the audit scratchpad (`pages/`, `fetches/`). Detailed per-category worksheets: audit-ai-visibility.md, audit-platform.md, audit-technical.md, audit-content.md, audit-schema.md (2026-08-11).*
