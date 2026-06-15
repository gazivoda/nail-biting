# GEO Audit Report: Stop Biting

**Audit Date:** 2026-06-15
**URL:** https://stopbiting.today
**Business Type:** SaaS / Consumer App (on-device AI habit-breaking app; freemium subscription)
**Pages Analyzed:** 63 sitemap URLs (homepage, blog index, 50+ blog posts, pricing, about, how-it-works, compare/*, solutions/*, legal) — sampled across every page template

---

## Executive Summary

**Overall GEO Score: 64/100 (Fair — upper band)**

Stop Biting has a genuinely strong GEO foundation that most sites never build: an exemplary `robots.txt` AI-crawler allowlist, a comprehensive `llms.txt`, rich JSON-LD schema (SoftwareApplication, FAQPage, MedicalCondition, BlogPosting, HowTo), and 50+ science-backed blog posts whose full body text is **server-side rendered into the raw HTML** specifically so non-JS AI crawlers can read it. That blog layer is excellent.

The score is held back by one structural technical gap and one off-site gap. **(1) Every non-blog page — homepage, pricing, about, how-it-works, and critically the `/compare/*` and `/solutions/*` pages — ships an empty `<div id="root"></div>`.** Their visible prose is JavaScript-only, so AI crawlers that don't execute JS (GPTBot, ClaudeBot, PerplexityBot) see only `<head>` schema and no body copy. The highest-intent GEO queries ("X vs bitter polish", "best app for ADHD nail biting") land on pages that are invisible as prose. **(2) Brand authority is thin** — the brand is correctly recognized as an entity by AI, but there is no Wikipedia, no surfaced Reddit/YouTube presence, no third-party reviews, and no `aggregateRating` in schema.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| AI Citability | 68/100 | 25% | 17.0 |
| Brand Authority | 42/100 | 20% | 8.4 |
| Content E-E-A-T | 68/100 | 20% | 13.6 |
| Technical GEO | 72/100 | 15% | 10.8 |
| Schema & Structured Data | 80/100 | 10% | 8.0 |
| Platform Optimization | 65/100 | 10% | 6.5 |
| **Overall GEO Score** | | | **64/100** |

---

## Critical Issues (Fix Immediately)

None. No AI crawlers are blocked, no domain-level noindex, key pages return 200, and structured data is present site-wide. The site has no critical-severity GEO failures.

---

## High Priority Issues (Fix Within 1 Week)

1. **Marketing & conversion pages have no crawler-readable body (CSR-only).**
   `/` (homepage), `/pricing`, `/about`, `/how-it-works`, `/compare/bitter-polish-alternative`, `/compare/habit-tracking-apps`, `/solutions/for-desk-workers`, `/solutions/for-adhd`, `/solutions/for-gamers`, and `/blog` (index) all serve `<div id="root"></div>` with **0 `<p>` and 0 `<h1>` in raw HTML**. Verified via `curl -A ClaudeBot`. Only the blog *post* template (`/blog/:slug`) injects body content server-side.
   **Why it matters:** GPTBot, ClaudeBot, and PerplexityBot do not render JavaScript. These pages exist to AI only as schema + meta description.
   **Fix:** Extend the existing SSR body-injection mechanism in `server.js` (currently `injectBlogBody` → off-screen `<article id="ssr-blog-content">`, line ~1263) to cover the homepage and the `/compare/*` + `/solutions/*` + `/how-it-works` routes. These are the pages AI cites for high-intent comparison and use-case queries.

2. **`/compare/*` and `/solutions/*` pages carry only generic global schema — no page-specific structured data.**
   `/compare/bitter-polish-alternative` and `/solutions/for-adhd` emit the site-wide Organization/SoftwareApplication/WebSite blocks but no comparison-, FAQ-, or use-case-specific schema, and no body. For "X vs Y" and "best app for [audience]" queries — the most valuable AI-citation queries in this niche — there is nothing specific for an engine to extract.
   **Fix:** Add SSR body + FAQPage (and a comparison table in prose) to each `/compare/*` page, and FAQPage + targeted prose to each `/solutions/*` page.

3. **No `aggregateRating` / `Review` on `SoftwareApplication` schema.**
   Homepage SoftwareApplication has an `author` but no rating or review signal. AI recommendation engines heavily weight rating signals when choosing which app to surface in "best app for…" answers.
   **Fix:** Add genuine `aggregateRating` (from real user reviews/app-store ratings) to the SoftwareApplication schema. Do not fabricate — use real review data only.

---

## Medium Priority Issues (Fix Within 1 Month)

1. **`/how-it-works` ships HowTo schema with no matching readable body.** The page injects `HowTo`/`HowToStep` JSON-LD but has 0 `<p>` in raw HTML. Crawlers see structured steps they can't corroborate against prose — a schema/content mismatch. Add the SSR body so the steps are backed by visible text.

2. **No named author or medical reviewer on blog content.** BlogPosting `author` is `"Stop Biting Editorial Team"` (Organization with a good `knowsAbout` array) but there is no named `Person`, credentials, or "medically reviewed by" signal. For health/medical content (YMYL), AI engines favor identifiable expertise.

3. **Articles reference clinical evidence in prose but link to zero external sources.** Posts cite figures like "reduces frequency 70–90% in clinical studies" with no outbound citation. The only external links in article HTML are Google Fonts. Adding citations to PubMed/clinical sources materially raises trustworthiness for AI extraction.

4. **Thin third-party brand presence.** No Wikipedia entity, no surfaced Reddit threads, no YouTube, no independent review coverage. AI entity recognition works today but rests almost entirely on first-party signals.

---

## Low Priority Issues (Optimize When Possible)

1. WebFetch / lightweight scrapers retrieve only the homepage `<title>` (no body) — same root cause as the CSR gap; resolved by the High #1 fix.
2. `llms.txt` is excellent but lists only the homepage, blog, privacy, and contact under "Key pages" — add `/how-it-works`, `/pricing`, `/compare/*`, and `/solutions/*` once they have real SSR content.
3. Consider a `speakable` schema property on the homepage FAQ for voice-assistant surfacing.

---

## Category Deep Dives

### AI Citability (68/100)
**Strong where it counts most, absent everywhere else.** Blog posts are highly citable: server-rendered `<article>` bodies with a clean `<h1>`/`<h2>` hierarchy, 1,400–1,900 words, embedded comparison tables (e.g. the five-tool matrix on `/blog/best-apps-to-stop-nail-biting`), and discrete Q&A blocks (e.g. "How fast do nails grow after stopping nail biting?" answered with specific figures — 3–4mm/month). This is textbook extractable content.

The homepage is partially rescued by its FAQPage schema, which exposes 6 quotable Q&As to crawlers even with an empty body:
- "Why do people bite their nails?"
- "What are the best remedies to stop nail biting?"
- "What is habit reversal training for nail biting?"
- "Is nail biting harmful?"
- "Does Stop Biting send my camera feed to the internet?"
- "How effective is habit reversal training for nail biting?"

But `/compare/*`, `/solutions/*`, `/how-it-works`, `/pricing`, and `/about` contribute **no extractable prose** to crawlers. The comparison and use-case pages are exactly where AI looks for "should I use X or Y" answers — and they're prose-empty. Closing the SSR gap on these pages is the single highest-leverage citability action.

### Brand Authority (42/100)
The brand **is** recognized as a distinct entity — a live web search returns stopbiting.today and AI summarizes its positioning accurately ("on-device AI… 100% private… science-backed habit reversal"). But it competes in a crowded niche (Hands Off, SmartBehavior, Nailed, NailKeeper) and has **no off-site authority scaffolding**: no Wikipedia, no surfaced Reddit discussion, no YouTube demos, no independent reviews, and no rating signal in schema. Entity recognition currently rests on first-party content alone, which caps how confidently AI will *recommend* (vs merely *describe*) the product.

### Content E-E-A-T (68/100)
**Experience/Expertise:** Content is genuinely substantive and science-oriented — onychophagia terminology, BFRB classification, HRT mechanisms, MedicalCondition/MedicalTherapy schema. **Authoritativeness:** weakened by org-level (not named-expert) authorship and no medical reviewer. **Trustworthiness:** the privacy story (on-device, no data leaves device) is a strong, consistent trust signal; however articles make clinical claims without linking sources, and the `/about` page (where credentials/team would live) is CSR-only so crawlers can't read it. Add named authorship, a medical-review line, and outbound citations to lift this into the 80s.

### Technical GEO (72/100)
**Best-in-class signals:**
- `robots.txt` explicitly allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot; blocks only training-only crawlers (Bytespider, anthropic-ai, cohere-ai, Google-Extended) while deliberately keeping CCBot open for Common Crawl. Thoughtfully configured and well-commented.
- `llms.txt` present (HTTP 200), comprehensive, with a clear product summary, key pages, all 40+ blog articles with descriptions, and full pricing.
- `sitemap.xml` clean (63 URLs), referenced from robots.txt.

**The deduction** is entirely the CSR rendering gap: blog posts SSR their bodies, but the homepage and all marketing/comparison/solution pages do not. This is a solved problem in the codebase (the blog injection in `server.js`) that simply hasn't been extended to the other templates.

### Schema & Structured Data (80/100)
Rich and varied: `SoftwareApplication`, `Offer` (with pricing), `FAQPage` (6 Q&As), `Organization` (×2), `WebSite` + `SearchAction`, `MedicalCondition`, `MedicalTherapy`, `AnatomicalStructure` on the homepage; `BlogPosting`, `HowTo`/`HowToStep`, `BreadcrumbList`, `ImageObject`, `WebPage` on content pages. Gaps: no `aggregateRating`/`Review`, no page-specific schema on `/compare/*` and `/solutions/*`, and a HowTo-without-body mismatch on `/how-it-works`.

### Platform Optimization (65/100)
- **ChatGPT / OAI-SearchBot & Perplexity:** well-positioned for blog content (crawler access + SSR bodies + llms.txt); under-served on comparison/use-case queries due to the CSR gap.
- **Google AI Overviews:** strong schema and blog content help; the comparison/solutions pages need SSR to compete.
- **Gemini:** Google-Extended is blocked (a deliberate training-opt-out choice) — this does not affect Google Search/AI Overviews indexing but does opt out of Gemini model training. Reasonable, worth a conscious confirmation.
- **Off-platform (Reddit/YouTube):** essentially absent — the main drag on this score.

---

## Quick Wins (Implement This Week)

1. **Extend `server.js` SSR body injection to the homepage** (reuse the `injectBlogBody` pattern). Instant prose visibility for the most-cited page. *Expected impact: high.*
2. **SSR the two `/compare/*` pages** with their comparison tables in prose (the table content already exists in `server.js` around line 1045 — it just isn't injected on those routes). *Expected impact: high — these are top-intent AI queries.*
3. **Add real `aggregateRating` to SoftwareApplication schema** from genuine review/app-store data. *Expected impact: medium-high for "best app" recommendations.*
4. **Add a "Medically reviewed by [name, credential]" line + datePublished/dateModified visibility** to blog posts and a named `Person` author in BlogPosting schema. *Expected impact: medium (YMYL trust).*
5. **Add 5–8 outbound citations** to clinical sources in the highest-traffic posts (HRT guide, health-risks, statistics). *Expected impact: medium.*

## 30-Day Action Plan

### Week 1: Close the rendering gap on conversion pages
- [ ] Extend SSR body injection in `server.js` to `/` (homepage)
- [ ] Extend SSR body injection to `/how-it-works` (back the existing HowTo schema with prose)
- [ ] Verify with `curl -A ClaudeBot <url> | grep "<p>"` that body text appears in raw HTML

### Week 2: Make comparison & solutions pages AI-citable
- [ ] SSR full body + comparison tables for `/compare/bitter-polish-alternative` and `/compare/habit-tracking-apps`
- [ ] Add page-specific `FAQPage` schema to each `/compare/*` page
- [ ] SSR body + targeted `FAQPage` for `/solutions/for-desk-workers`, `/solutions/for-adhd`, `/solutions/for-gamers`

### Week 3: Strengthen E-E-A-T & trust signals
- [ ] Add named author + credentials (Person schema) and "medically reviewed by" to blog posts
- [ ] Add `aggregateRating`/`Review` to SoftwareApplication (real data only)
- [ ] Add outbound clinical citations to top 5 posts
- [ ] SSR the `/about` page so team/credentials are crawler-readable

### Week 4: Build off-site brand authority
- [ ] Seed authentic value-first presence on relevant subreddits (r/calmhands, r/BFRB) per community rules
- [ ] Publish 1–2 product demo videos (YouTube) showing on-device detection
- [ ] Pursue independent reviews / "best nail-biting app" roundup inclusions
- [ ] Update `llms.txt` "Key pages" to include the now-SSR'd how-it-works, pricing, compare, and solutions pages
- [ ] Assess Wikipedia/Wikidata entity eligibility once third-party coverage exists

---

## Appendix: Pages Analyzed (by template)

| URL / Template | Title | Crawler-readable body? | GEO Issues |
|---|---|---|---|
| `/` (homepage) | Stop Nail Biting with AI \| Stop Biting | No (schema only) | High #1, #3 |
| `/blog/:slug` (50+ posts) | per-post | **Yes — full SSR `<article>`** | Medium #2, #3 (author/citations) |
| `/blog` (index) | Blog | No body (links only) | High #1 |
| `/pricing` | — | No | High #1 |
| `/about` | — | No | High #1; Medium #2 |
| `/how-it-works` | — | No (HowTo schema only) | High #1; Medium #1 |
| `/compare/bitter-polish-alternative` | — | No | High #1, #2 |
| `/compare/habit-tracking-apps` | — | No | High #1, #2 |
| `/solutions/for-desk-workers` | — | No | High #1, #2 |
| `/solutions/for-adhd` | — | No | High #1, #2 |
| `/solutions/for-gamers` | — | No | High #1, #2 |
| `/privacy`, `/terms-and-conditions`, `/refund-policy` | legal | No (low priority) | Low |

*Method note: raw HTML fetched with `curl -A ClaudeBot` to reproduce what a non-JS AI crawler sees. robots.txt, llms.txt, and sitemap.xml fetched live. SSR mechanism confirmed against `server.js` (blog body injection at ~line 1263). Brand presence checked via live web search.*
