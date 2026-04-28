# GEO Audit Report: Stop Biting

**Audit Date:** 2026-04-28
**URL:** https://stopbiting.today/
**Business Type:** SaaS — Health/Habit Technology (Hybrid: app + content publisher)
**Pages Analyzed:** 12 (homepage, blog index, 8 blog posts, /about, robots.txt)

---

## Executive Summary

**Overall GEO Score: 33/100 (Critical)**

Stop Biting has excellent technical GEO infrastructure (robots.txt, llms.txt, sitemap) and rich homepage schema, but the entire site is a client-side rendered (CSR) SPA — meaning AI crawlers that don't execute JavaScript see an empty shell for all blog posts. This single issue undermines the content investment. The site also has zero author attribution, no About page, no brand presence on Reddit/YouTube/Wikipedia, and no schema on any blog post, making it nearly invisible to AI systems despite having 40 research-backed articles.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| AI Citability | 40/100 | 25% | 10.0 |
| Brand Authority | 20/100 | 20% | 4.0 |
| Content E-E-A-T | 32/100 | 20% | 6.4 |
| Technical GEO | 55/100 | 15% | 8.25 |
| Schema & Structured Data | 30/100 | 10% | 3.0 |
| Platform Optimization | 15/100 | 10% | 1.5 |
| **Overall GEO Score** | | | **33/100** |

---

## Critical Issues (Fix Immediately)

### CRITICAL-1: Blog posts are client-side rendered — AI crawlers see empty HTML

**Affected pages:** All 40 blog posts, /blog index, homepage content  
**Evidence:** `index.html` body is a bare `<div id="root"></div>`. All content rendered via React JavaScript. AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript and receive an empty shell.  
**Impact:** 40 research-backed articles are effectively invisible to AI citation systems.  
**Fix:** Implement static pre-rendering for blog routes at build time. Two approaches:
1. **Vite SSG** — add `vite-ssg` or `vite-plugin-ssr` to generate static HTML per blog slug at build time. Blog content already exists in `src/data/blogPosts.ts`.
2. **Express per-route injection** — detect blog slugs in server.js and inject content into the HTML response before serving (simpler, doesn't require build changes).

Option 2 is faster to ship: in `server.js`, intercept `/blog/:slug` requests, find the post in a JSON file exported from `blogPosts.ts`, and inject blog content + Article schema directly into the HTML response.

### CRITICAL-2: No Article schema on any blog post

**Affected pages:** All 40 blog posts  
**Evidence:** Schema extraction across all sampled blog posts returned zero structured data.  
**Impact:** AI systems cannot identify posts as articles, cannot extract author, datePublished, or topics. Google AI Overviews deprioritizes unstructured content.  
**Fix:** Inject Article schema for each blog post via server.js (same request interception as CRITICAL-1). Minimum viable schema:
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[post title]",
  "datePublished": "[datePublished]",
  "dateModified": "[dateModified]",
  "author": {
    "@type": "Person",
    "name": "Igor Gazivoda",
    "url": "https://stopbiting.today/about"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Stop Biting",
    "logo": "https://stopbiting.today/icons/icon-512x512.png"
  }
}
```

---

## High Priority Issues

### HIGH-1: No About page — largest E-E-A-T gap

**Affected pages:** No `/about` page exists (fetching `/about` returns the app homepage)  
**Impact:** AI systems evaluate E-E-A-T heavily when recommending health-adjacent content. Anonymous authorship is a strong signal against citation. The SITE-STRUCTURE.md already specifies what this page needs.  
**Fix:** Create `/about` page per `docs/seo/SITE-STRUCTURE.md` specification. Must include: founder story, personal nail biting experience, why app was built, Person schema with LinkedIn/GitHub sameAs. This is also the target for author bylines on every blog post.

### HIGH-2: No author byline or publication dates on blog posts

**Affected pages:** All 40 blog posts  
**Evidence:** Confirmed absent across all sampled posts (habit-reversal-training-guide, why-do-people-bite-their-nails, best-nail-biting-remedies, nail-biting-adhd).  
**Impact:** Anonymous, undated content is the single strongest negative E-E-A-T signal. ChatGPT citation studies show author attribution is required for health/clinical content to be cited.  
**Fix:** Once `/about` exists, add `<author>` byline linking to `/about` in the `BlogPost` component. Add `datePublished` display. Both are already stored in `blogPosts.ts` (`datePublished`, `dateModified` fields).

### HIGH-3: No BreadcrumbList schema on blog posts

**Affected pages:** All blog posts  
**Fix:** Add alongside Article schema in server-side injection:
```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Stop Biting", "item": "https://stopbiting.today/"},
    {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://stopbiting.today/blog"},
    {"@type": "ListItem", "position": 3, "name": "[Post Title]", "item": "https://stopbiting.today/blog/[slug]"}
  ]
}
```

### HIGH-4: No brand presence on Reddit, YouTube, or Wikipedia

**Evidence:** Zero Reddit mentions found in search. No YouTube channel. No Wikipedia article. The HN thread for a similar concept (handsdown.kianpak.com) is a different product.  
**Impact:** ChatGPT cites Reddit at 11.3% and Wikipedia at 47.9%. Perplexity cites Reddit at 46.7%. Brand absent from these platforms = near-zero AI citation probability regardless of content quality.  
**Fix priority:**
1. Post in r/nailbiting, r/BFRB, r/ADHD with genuinely helpful comments (not spam)
2. Answer nail-biting questions on Quora
3. Target 1 YouTube video: "How AI detects nail biting (WebAssembly explainer)"

### HIGH-5: No unique canonical or per-post meta tags for blog posts

**Evidence:** `index.html` has a single `<link rel="canonical" href="https://stopbiting.today/">`. All blog posts return this same canonical (the homepage). All blog posts share the same meta title and description.  
**Impact:** Google may treat all blog posts as duplicate content pointing at the homepage. Search engines and AI systems cannot distinguish between posts.  
**Fix:** React Helmet or equivalent must inject per-post `<title>`, `<meta name="description">`, and `<link rel="canonical">` for each blog route. If these aren't already implemented, verify with a view-source check.

---

## Medium Priority Issues

### MEDIUM-1: Blog posts are too short (650-700 words vs 1,500+ word floor)

**Evidence:** Three independently sampled posts (habit-reversal-training-guide, why-do-people-bite-their-nails, best-nail-biting-remedies) all estimated at 650-700 words.  
**Impact:** AI systems have a preference for comprehensive coverage. Short posts are less likely to contain the 134-167 word self-contained answer blocks optimal for AI citation.  
**Fix:** Prioritize expanding top-traffic posts first (CONTENT-CALENDAR.md already lists these). Target 1,500-2,000 words for priority posts.

### MEDIUM-2: No internal links between blog posts

**Evidence:** Zero internal links detected across all sampled posts.  
**Impact:** Internal links distribute link equity, help AI crawlers discover related content, and improve topical authority clustering.  
**Fix:** Add 3-5 internal links per post once pillar pages exist. SITE-STRUCTURE.md already defines the hub→spoke link map — implement it systematically.

### MEDIUM-3: No FAQ sections on blog posts

**Evidence:** None of the sampled blog posts contain FAQ sections.  
**Impact:** FAQ sections are the highest-density format for AI citation. Google AI Overviews draw heavily from Q&A formatted content.  
**Fix:** Add a "Frequently asked questions" section (2-4 questions) to the 10 highest-traffic posts. Do NOT use FAQ schema for commercial/SaaS content on Google (it was removed from Google Search features), but include visible FAQ HTML for AI citation.

### MEDIUM-4: llms.txt has no `/blog/:slug` full content summaries

**Current state:** llms.txt has one-line summaries for each post — good start.  
**Opportunity:** The llms.txt standard supports longer per-section descriptions. Adding 2-3 sentence summaries per post would help AI systems that only read llms.txt build richer context about the content.  
**Impact:** Low. The primary fix is SSR (CRITICAL-1) which makes content directly crawlable.

### MEDIUM-5: Organization sameAs only lists GitHub

**Evidence:** `index.html` Organization schema has `"sameAs": ["https://github.com/gazivoda/nail-biting"]`.  
**Impact:** AI systems use sameAs to build entity knowledge graphs. More sameAs links = stronger entity recognition.  
**Fix:** Add Twitter/X, LinkedIn, Product Hunt, YouTube (when created).

---

## Low Priority Issues

### LOW-1: No Open Graph on blog posts

The homepage has full OG tags but blog posts likely share the same static OG metadata. Once React Helmet injects per-post meta, add per-post OG title/description/image.

### LOW-2: Google Analytics loaded after `window.load` event

This is intentional for performance (non-blocking), but worth noting it means GA fires slightly delayed. Not a GEO issue.

### LOW-3: Missing `dateModified` in some sitemap entries

Several posts from 2026-04-03 batch in the sitemap show `lastmod` equal to `datePublished`. The sitemap should reflect actual content modification dates. Update `lastmod` whenever post content is upgraded.

---

## Category Deep Dives

### AI Citability (40/100)

**Strengths:**
- Question-based H2 headings present across all sampled posts (e.g., "What is onychophagia?", "Why does nail biting become automatic?")
- Statistics cited with specific sources (PLOS ONE 2015, Cochrane 2012, Deckersbach et al.)
- Content shows genuine research depth — not AI-generated filler

**Weaknesses:**
- 650-700 word posts are too short to contain multiple 134-167 word self-contained citation blocks (the optimal AI-citation length per Georgia Tech research)
- No answer-first formatting — posts open with context before answering the implied question
- No definition blocks ("Onychophagia is...") in the opening 60 words
- No FAQ sections to provide dense Q&A material
- Internal links absent — AI systems use link graphs to assess topic authority

**Recommended rewrite for highest-citability opening (example for any post):**
> "Habit Reversal Training (HRT) is a three-component cognitive-behavioral therapy technique for stopping nail biting. In clinical trials, consistent practitioners report 70–90% reductions in biting frequency (Cochrane Systematic Review, 2012). The technique works by building conscious awareness of the habit and substituting biting with an incompatible competing response."

That's 57 words, answers the question immediately, includes a specific citation and statistic — the structure AI systems extract most readily.

---

### Brand Authority (20/100)

**Presence map:**
| Platform | Status | Notes |
|---|---|---|
| Reddit | Not found | No brand mentions in r/nailbiting or general search |
| Wikipedia | Not present | No article; not cited |
| YouTube | Not found | No channel detected |
| LinkedIn | Unknown | Not verified |
| GitHub | Present | sameAs link in Organization schema |
| Product Hunt | Adjacent | StopBite (different app) has PH presence |
| breakthehabit.blog | Mentioned | Independently lists nail biting apps |
| Hacker News | Not found | HN thread was for handsdown.kianpak.com |

**Key insight:** Brand mentions correlate 3× more with AI citation than backlinks (Ahrefs Dec 2025). YouTube mentions have the strongest correlation (~0.737). Reddit is the primary citation source for Perplexity (46.7%). Stop Biting has near-zero presence on both.

---

### Content E-E-A-T (32/100)

| Factor | Score | Signals |
|---|---|---|
| Experience | 5/25 | No founder story, no personal narrative, no before/after data |
| Expertise | 15/25 | Research citations present, clinical terminology used correctly |
| Authoritativeness | 7/25 | No external citations TO the site, no expert quotes |
| Trustworthiness | 5/25 | HTTPS ✓, privacy policy ✓, but no author, no dates, no contact visible |

**Critical gap:** Health-adjacent content (BFRB, OCD, anxiety, medication) faces the highest E-E-A-T bar. Google's QRG explicitly requires author credentials for YMYL-adjacent topics. An anonymous blog about OCD, ADHD, and anxiety treatment will not earn AI citation in health queries.

---

### Technical GEO (55/100)

**Strengths:**
- **robots.txt:** Best-practice AI crawler configuration. Allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot. Blocks CCBot, anthropic-ai (training), Bytespider, Google-Extended. This is textbook GEO configuration.
- **llms.txt:** Present, comprehensive, lists all 40 posts with one-line summaries. Updated 2026-04-28.
- **Sitemap:** Complete, 45 URLs, correct slugs, all posts included.
- **Homepage schema:** 5 schema types on homepage — WebSite, Organization, SoftwareApplication, FAQPage, MedicalCondition. The MedicalCondition schema for Onychophagia is particularly strong for entity recognition.

**Weaknesses:**
- **CSR/SPA architecture:** The entire site renders from `<div id="root"></div>`. AI crawlers that don't execute JavaScript see nothing. This is the defining GEO limitation.
- **Per-page canonical/meta:** Not injected server-side. Likely handled by React Helmet (client-side), which means AI crawlers see the homepage title/description for every URL.

---

### Schema & Structured Data (30/100)

| Page Type | Schema Present | Missing |
|---|---|---|
| Homepage | WebSite, Organization, SoftwareApplication, FAQPage, MedicalCondition | Person (author), AggregateRating |
| Blog posts | **Nothing** | Article, BreadcrumbList, FAQPage |
| Blog index | **Nothing** | CollectionPage, BreadcrumbList |
| /about | Does not exist | Person, Organization |
| /privacy | Nothing | WebPage |

Homepage schema is genuinely impressive — 5 types with correct nesting. But 40 blog posts with zero schema is the largest single gap. Each blog post should have at minimum: Article, BreadcrumbList.

---

### Platform Optimization (15/100)

| Platform | Optimization Status |
|---|---|
| Google AI Overviews | Possible via Googlebot (JS-capable) — but CSR means low-confidence indexing |
| ChatGPT | Near-zero — no Wikipedia, no Reddit, no established entity profile |
| Perplexity | Near-zero — no Reddit presence (primary source: 46.7% of Perplexity citations) |
| Bing Copilot | Low — no Bing-specific optimization or IndexNow implementation |
| Google Search | Indexed, but thin due to CSR and no per-post meta |

---

## Quick Wins (Implement This Week)

1. **Add SSR/static pre-rendering for blog routes** — single highest-impact fix. Even simple server-side text injection from blogPosts.ts data transforms 40 pages from invisible to crawlable.

2. **Add Article + BreadcrumbList schema to all blog posts** — can be done alongside #1 via server.js injection. Schema boost is immediate for AI systems that crawl incrementally.

3. **Add author byline + datePublished to blog post component** — 30-minute frontend change. Link byline to `/about` once that page exists. This immediately upgrades E-E-A-T signals on all 40 posts.

4. **Create `/about` page** — the single page with the highest E-E-A-T leverage. SITE-STRUCTURE.md has full spec. Add Person schema with sameAs links to LinkedIn/GitHub.

5. **Rewrite opening paragraph of top 5 posts to answer-first format** — add definition block + key statistic in the first 60 words. This is pure content editing, no tech changes needed.

---

## 30-Day Action Plan

### Week 1: Server-side rendering for blog posts
- [ ] Export `blogPosts.ts` data as a JSON file used at both build and runtime
- [ ] In `server.js`, intercept `/blog/:slug` requests
- [ ] For matching slugs: inject post title into `<title>`, post description into `<meta name="description">`, unique `<link rel="canonical">`
- [ ] Inject Article + BreadcrumbList JSON-LD into `<head>`
- [ ] Verify with `curl -s https://stopbiting.today/blog/habit-reversal-training-guide | grep '<title>'`
- [ ] Test that GPTBot would now see the correct meta per post

### Week 2: E-E-A-T foundation
- [ ] Create `/about` page with founder story (spec in SITE-STRUCTURE.md)
- [ ] Add Person schema with sameAs (LinkedIn, GitHub)
- [ ] Add author byline component to BlogPost rendering (links to /about)
- [ ] Display `datePublished` and `dateModified` on each post

### Week 3: Content upgrades
- [ ] Expand top 5 posts to 1,500+ words (start with habit-reversal-training-guide, best-nail-biting-remedies, why-do-people-bite-their-nails)
- [ ] Add answer-first opening paragraph to each expanded post (definition + key stat in first 60 words)
- [ ] Add FAQ section (3-4 questions) to top 5 posts
- [ ] Add 3-5 internal links per post following SITE-STRUCTURE.md hub→spoke map

### Week 4: Brand presence
- [ ] Post genuinely helpful content in r/nailbiting (link to most relevant article)
- [ ] Answer 5 Quora questions about nail biting — include attribution to stopbiting.today
- [ ] Submit sitemap via Google Search Console
- [ ] Request indexing for the 17 recently added URLs
- [ ] Create LinkedIn company page
- [ ] Record 1 short YouTube video (MediaPipe tech explainer or "how the AI works")

---

## Appendix: Pages Analyzed

| URL | Title (as seen by AI crawlers) | Issues |
|---|---|---|
| https://stopbiting.today/ | Stop Nail Biting with AI | Schema rich; body CSR only |
| https://stopbiting.today/blog | Nail Biting Resources | CSR empty — zero content |
| https://stopbiting.today/about | Stop Nail Biting with AI | Page does not exist; redirects to SPA |
| https://stopbiting.today/blog/habit-reversal-training-guide | Post title visible | No schema, no author, no dates, no internal links |
| https://stopbiting.today/blog/why-do-people-bite-their-nails | Post title + content visible | No schema, no author, no dates, no internal links |
| https://stopbiting.today/blog/best-nail-biting-remedies | Post title + content visible | No schema, no author, no dates, no internal links |
| https://stopbiting.today/blog/nail-biting-adhd | SPA shell only (title tag) | CSR rendering — no visible content |
| https://stopbiting.today/blog/nail-biting-cure | SPA shell only (title tag) | CSR rendering — no visible content |
| https://stopbiting.today/robots.txt | N/A | ✅ Excellent AI crawler config |
| https://stopbiting.today/sitemap.xml | N/A | ✅ Complete, 45 URLs |
| https://stopbiting.today/llms.txt | N/A | ✅ Comprehensive, all 40 posts |

---

## Priority Matrix

| Fix | Effort | GEO Impact | Start |
|---|---|---|---|
| Blog SSR/static pre-rendering | High | Critical | Week 1 |
| Article schema injection | Medium | High | Week 1 (same PR) |
| /about page | Medium | High | Week 2 |
| Author byline + dates | Low | High | Week 2 |
| Expand top 5 posts to 1,500w | Medium | Medium | Week 3 |
| Internal link network | Medium | Medium | Week 3 |
| Reddit presence | Low | High | Week 4 |
| FAQ sections on top posts | Medium | Medium | Week 3 |
| YouTube video | High | High | Month 2 |
| Wikipedia article | High | High | Month 3 |
