# SEO Audit Report: stopbiting.today

**Audit Date:** 2026-05-11  
**URL:** https://stopbiting.today  
**Business Type:** SaaS App (AI nail biting habit detection — $2.99/mo or $29/yr, 3-day free trial)  
**Pages Analyzed:** 45 (from sitemap) + key additional pages  
**Framework:** Vite + React SPA with server-injected head meta and hidden SSR article element  

---

## Executive Summary

**Overall SEO Health Score: 53/100 (Poor)**

stopbiting.today has an unusually strong technical foundation for a solo-built SaaS product: rich structured data (5 JSON-LD types on homepage), a well-configured robots.txt, per-page meta tags on blog posts, and comprehensive topic coverage across 47 articles. The site is not invisible — it is findable and partially indexed.

The score is held back by four interrelated structural problems that compound each other: (1) a hidden-content SSR workaround that creates cloaking risk, (2) zero internal links across all 47 blog posts, (3) no author attribution anywhere on the site, and (4) near-zero brand authority footprint outside the domain itself. These aren't quick fixes — they require architectural decisions.

**Top 5 Critical Issues:**
1. Hidden SSR article (`position:absolute;left:-9999px`) — cloaking risk under Google's spam policy
2. Zero internal links across all 47 blog posts — no link equity, no topic clustering
3. No author bylines or author pages — E-E-A-T cannot score positively without named humans
4. www.stopbiting.today returns 503 — broken for any inbound link using www prefix
5. Soft 404s return HTTP 200 — every non-existent URL gets crawled and indexed as a homepage duplicate

**Top 5 Quick Wins (this week):**
1. Fix Twitter Card bug — blog posts show homepage title/description (a 1-line code change)
2. Change `og:type` to `article` on blog post pages
3. Add `image` property to BlogPosting schema (unlock Article rich results immediately)
4. Fix www redirect from 503 → 301 to `https://stopbiting.today` (DNS/hosting config)
5. Fix HTTP→HTTPS redirect from 307 Temporary → 301 Permanent (hosting config)

---

## Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| Technical SEO | 62/100 | 25% | 15.5 |
| Content Quality & E-E-A-T | 42/100 | 25% | 10.5 |
| On-Page SEO | 62/100 | 20% | 12.4 |
| Schema / Structured Data | 52/100 | 10% | 5.2 |
| Performance (Core Web Vitals) | 55/100 | 10% | 5.5 |
| Images | 25/100 | 5% | 1.25 |
| AI Search Readiness | 47/100 | 5% | 2.35 |
| **Overall SEO Health Score** | | | **53/100** |

---

## Critical Issues (Fix Immediately)

### 1. Hidden SSR Article — Cloaking Risk

**Pages Affected:** All 47 blog posts  
**Risk:** Google Manual Action (Spam)

Blog post pages inject a visually-hidden `<article>` element containing the full post body:

```html
<article id="ssr-blog-content" 
  style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" 
  aria-hidden="true">
  <h1>Why Do People Bite Their Nails?...</h1>
  ...full content...
</article>
```

This is structurally a cloaking pattern: crawlers (ClaudeBot, GPTBot, PerplexityBot, Googlebot) see the full article text; human visitors see only the JS-rendered React app. Google's Webmaster Guidelines prohibit serving different content to crawlers vs users. As traffic grows and the site gains visibility, this is a credible manual action trigger.

**Fix:** Move to proper static site generation (SSG). Astro, Next.js, or Vite SSG pre-renders HTML at build time — the same full content is served to crawlers and users without hiding anything. This is the most impactful architectural change possible.

---

### 2. Zero Internal Links Across All 47 Blog Posts

**Pages Affected:** All blog posts  
**Impact:** No link equity distribution, no topic clustering signal, broken hub-and-spoke architecture

Every blog post analyzed contains zero `<a>` links to any other page on the site. The HRT guide doesn't link to the statistics post. The ADHD post doesn't link to the remedies post. The statistics post doesn't link to the cure article. There is no internal linking whatsoever in the article body content.

This is the single highest-leverage SEO action available — 47 posts exist, fully written, with zero internal link equity flowing between them. Google cannot determine topical relationships between articles. The topic cluster architecture exists on paper (blog index) but not through link signals.

**Fix:** Add 3–5 contextual internal links per blog post. Start with the highest-traffic posts and link to directly related articles. Example:
- HRT Guide → Statistics post, Nail Biting Cure, ADHD post
- Statistics post → HRT Guide, Nail Biting Cure, Best Remedies
- ADHD post → HRT Guide, Statistics post

---

### 3. No Author Attribution

**Pages Affected:** All 47 blog posts, all core pages  
**Impact:** E-E-A-T cannot score — Experience/Expertise signal is near-zero

No blog post carries a byline. The `author` field in BlogPosting schema is set to an Organization ("Stop Biting Editorial Team"), not a named Person. No author page exists. The About page, while returning 200, has its canonical pointing to the homepage and no unique content served in raw HTML.

AI models asked to cite information from the site cannot attribute quotes to a named expert. This is the primary reason the E-E-A-T score is 38/100.

**Fix:** Add a named author (real name preferred, pseudonym acceptable) to every blog post. Create `/about` with an author bio, photo, and credentials. Add `Person` JSON-LD schema. Update BlogPosting `author` from Organization to Person with `name`, `url`, and `sameAs` (LinkedIn/Twitter).

---

### 4. www.stopbiting.today Returns 503

**Impact:** Any inbound link using `www.` prefix returns 503 Service Unavailable — broken experience and lost link equity

`www.stopbiting.today` currently returns HTTP 503. This means social shares, directory listings, and inbound links that include the www subdomain send visitors to an error page rather than redirecting to the site.

**Fix:** Configure a 301 permanent redirect from `https://www.stopbiting.today` → `https://stopbiting.today` at the DNS/hosting level (not application level).

---

### 5. Soft 404s — All Non-Existent Routes Return HTTP 200

**Impact:** Googlebot wastes crawl budget; may create duplicate content signals

The Vite SPA serves `index.html` for every URL, including URLs that don't exist. `/404test`, `/blog/nonexistent-post`, and any misspelled URL return HTTP 200 with the homepage shell (`<div id="root"></div>`) and a canonical pointing to `/`. This is a soft 404 problem.

Google must crawl each discovered URL, fetch a 200 response, and then eventually determine it's identical to the homepage. This wastes crawl budget and can dilute crawl frequency on legitimate pages.

**Fix:** Configure the hosting platform to return HTTP 404 for paths not matching a known route list. For Vite/React SPAs this is typically a server/hosting configuration setting, not an application change.

---

## High Priority Issues (Fix Within 1 Week)

### 6. Twitter Card Bug — Homepage Content on All Blog Posts

Every blog post serves homepage content in Twitter Card tags:
- `twitter:title`: "Stop Nail Biting with AI | Stop Biting" (should be post-specific)
- `twitter:description`: "On-device AI detects nail biting in real-time..." (should be post-specific)

The `og:title` and `og:description` are correct per-page — only the Twitter Card tags are broken. This affects how posts appear when shared on Twitter/X.

**Fix:** Find where `twitter:title` and `twitter:description` are set in the codebase. They appear to not use the same dynamic value as `og:title`/`og:description`. Apply the same per-page logic.

---

### 7. /about, /pricing, /faq Canonicalize to Homepage

These pages exist (return HTTP 200) but serve the homepage canonical tag (`https://stopbiting.today/`). Google will treat them as canonical variations of the homepage and won't index them as separate pages. This means `/pricing` — a high-intent page for a SaaS product — cannot rank independently.

**Fix:** Each route needs its own canonical tag, unique title tag, meta description, and Open Graph tags in the server-injected `<head>`. Currently only blog post routes get per-page head injection.

---

### 8. HTTP→HTTPS Redirect is 307 Temporary (Should Be 301 Permanent)

`http://stopbiting.today` redirects with a `307 Temporary Redirect`. This should be a `301 Permanent Redirect`. The distinction matters for link equity: 307 does not pass PageRank; 301 does. Any inbound link or bookmark using plain HTTP loses link equity at the redirect.

**Fix:** Change the HTTP→HTTPS redirect to 301 at the hosting/server configuration level.

---

### 9. BlogPosting Schema Missing `image` Property

All 47 blog posts have BlogPosting schema but none include the `image` property. Google requires `image` for Article rich result eligibility. Without it, no blog post can display a thumbnail image in Google Search results — blocking an entire rich result type site-wide.

**Fix:** Add `image` to the BlogPosting schema template. Even the shared OG image works:
```json
"image": {
  "@type": "ImageObject",
  "url": "https://stopbiting.today/og-image.png",
  "width": 1200,
  "height": 630
}
```
For maximum impact, generate unique per-post OG images.

---

### 10. Organization sameAs Has Only 1 URL (GitHub)

```json
"sameAs": ["https://github.com/gazivoda/nail-biting"]
```

AI models use `sameAs` to resolve a brand entity across the web. With only one link — to a personal GitHub repo — AI systems have almost no cross-platform evidence that "Stop Biting" is a real, established product. This is the primary reason the Brand Authority score is 8/100.

**Fix:** Create profiles on LinkedIn, ProductHunt, Twitter/X, and Crunchbase. Add each live URL to `sameAs`. Do not add placeholder URLs — only add URLs of profiles that exist and are publicly accessible.

---

### 11. No External Citation Links in Blog Posts

Every blog post references named studies (Ghanizadeh 2015, 2012 Cochrane review, Journal of Attention Disorders 2021) but none link out to the actual source. AI models and Google both treat outbound links to authoritative sources as a trust signal.

**Fix:** Add hyperlinks to PubMed, DOI pages, or journal abstracts for every named study. The Statistics post alone references 15+ studies that could all be linked.

---

### 12. MediaPipe WASM Bundle Loaded on All Blog Pages

The `mediapipe-db9maXuS.js` WebAssembly bundle is preloaded on every page, including text-only blog posts. This is a large, CPU-intensive payload that has zero purpose on blog pages and increases parse time (particularly on mobile).

**Fix:** Code-split at the route level in Vite config. Load the MediaPipe bundle only on routes that use the detection feature, not on `/blog/*` routes.

---

### 13. CCBot Blocked (Reduces AI Training Visibility)

CCBot (Common Crawl) is blocked in robots.txt. Common Crawl feeds training corpora for LLaMA, Mistral, GPT-3, and many open-weight models. Sites blocked from CCBot are absent from models trained on CC data.

The current robots.txt blocks CCBot with a comment implying scraping concern. However, the content on this site is publicly available and the blog posts are designed to be read and cited — the same content the site wants AI search crawlers to access.

**Fix:** Consider unblocking CCBot. If content theft is a concern, note that CCBot does not enable direct content theft — it crawls for training data discovery, not real-time copying. Unblocking it would meaningfully increase the site's presence in future open-weight model training data.

---

## Medium Priority Issues (Fix Within 1 Month)

### 14. og:type Is "website" on All Blog Posts
Should be `"article"` for blog post pages. Affects how social platforms and some AI crawlers categorize the page type.

### 15. Publication Dates Not Visible to Readers
Blog posts have `datePublished` in BlogPosting schema but the date is not rendered visibly on the page. AI models parsing page content cannot determine when the article was written. Readers cannot assess freshness. The statistics post title says "2025 Research Data" but today is May 2026 — this timestamp mismatch signals stale content.

**Fix:** Render a visible publication date on each blog post (e.g., "Published April 2026, last reviewed May 2026").

### 16. FAQPage and MedicalCondition Schema Injected on All Pages
The FAQPage (with 6 homepage-level questions) and MedicalCondition (Onychophagia definition) schemas appear on every page including blog posts. This is semantically incorrect — an article about ADHD and nail biting should not declare itself a FAQPage with questions about webcam privacy.

**Fix:** Scope FAQPage to the homepage only. Scope MedicalCondition to the homepage and any dedicated condition-explainer pages. Individual blog posts should have their own FAQPage schema only if they contain actual FAQ content.

### 17. SoftwareApplication Schema Missing Paid Pricing
The SoftwareApplication schema declares only a $0 free trial offer. The $2.99/mo and $29/yr plans are not in the schema. AI models asked "how much does Stop Biting cost?" cannot answer from structured data.

**Fix:** Add Offer objects for both paid tiers to the SoftwareApplication schema.

### 18. No /llms-full.txt
The `llms.txt` at `/llms.txt` is well-structured but is a high-level index, not a full-text corpus. AI systems that support `/llms-full.txt` get the complete article content without crawling individual pages. This is the highest-ROI GEO action not yet implemented.

**Fix:** Generate `/llms-full.txt` containing the complete body text of all 47 blog posts, formatted as Markdown with source URLs.

### 19. No Contact Information Visible Anywhere
No email address, contact form link, or support address appears on any analyzed page. Privacy regulations (GDPR, CCPA) require a contact method. Trust signals require visible contact options.

### 20. SearchAction Schema May Reference Non-Existent Search
The WebSite schema declares a SearchAction pointing to `?q={search_term_string}`. If the Vite SPA does not actually handle this parameter as a search function, this is a false declaration. Google may trigger a rich result validation error.

**Fix:** Either implement site search at `?q=` or remove the SearchAction from the WebSite schema.

### 21. Google-Extended Blocked (Gemini Training)
`Google-Extended` is blocked in robots.txt. This blocks Gemini training data collection. Over time, this reduces Gemini's awareness of the brand and reduces the likelihood of being cited in Gemini AI responses.

---

## Low Priority Issues (Backlog)

### 22. Permissions-Policy Header Missing
All other security headers are present. Add `Permissions-Policy: camera=(self), microphone=(), geolocation=()` — correctly documents that the app needs camera access (legitimate) while restricting other capabilities.

### 23. HowTo Schema (Habit Reversal Training post)
HowTo rich results were removed from Google in September 2023. The schema itself is valid and AI models can parse the structured steps, but it generates no Google Search benefit. Keep for AI semantic value; do not rely on it for search visibility.

### 24. Google Fonts Synchronous Load — Minor CLS Risk
Fonts loaded via `<link rel="stylesheet">` with `display=swap` create a text-layout-shift when the custom font loads and replaces the fallback. Consider using `font-display: optional` for body fonts or adding `font-metric-overrides` to reduce CLS.

### 25. Identical Keywords Meta Tag on All Pages
`<meta name="keywords">` is the same on every page. Google ignores this tag, but per-page keyword tags are marginally better practice for completeness. Low priority since the tag has no ranking impact.

### 26. Trailing Slash Inconsistency
Homepage canonical uses trailing slash (`stopbiting.today/`), blog posts do not (`/blog/nail-biting-cure`). This is a minor inconsistency — not harmful given definitive canonicals are in place, but standardizing is cleaner.

---

## Category Deep Dives

### Technical SEO: 62/100

**Strengths:**
- Excellent security headers: HTTPS, HSTS (1-year, includeSubDomains), CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- robots.txt correctly allows AI citation crawlers (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot)
- All JSON-LD schema is server-rendered in static `<head>` — immediately visible to all crawlers
- Sitemap exists at `/sitemap.xml` with 45 URLs, correct priorities, and per-post lastmod dates
- Canonical tags on all blog posts are correct and self-referencing
- URL structure is clean (hyphenated, descriptive slugs, two-level hierarchy)
- Google Analytics deferred to `window.load` — removed from critical path

**Critical Problems:**
- Hidden SSR content (`position:absolute;left:-9999px`) — cloaking risk
- Soft 404s — all routes return HTTP 200
- www subdomain returns 503 (not even a clean 404)
- HTTP→HTTPS redirect is 307 Temporary, not 301 Permanent
- /about, /pricing, /faq canonical → homepage (not indexed separately)
- MediaPipe WASM loaded on blog post pages (unnecessary payload)

---

### Content Quality & E-E-A-T: 42/100

| Dimension | Score | Key Finding |
|---|---|---|
| Experience | 8/25 | Only signal: product disclosure in best-apps post and MediaPipe technical detail. No first-hand narratives or user outcomes anywhere. |
| Expertise | 7/25 | No author bylines on any page. Content demonstrates domain knowledge but is attributed to no one. |
| Authoritativeness | 10/25 | 47-post cluster covers the topic space well. Zero external links from posts to any other source. |
| Trustworthiness | 13/25 | HTTPS, privacy policy, terms, refund policy present. No contact info, no editorial standards page, no visible publication dates. |

**Content quality highlights:**
- Statistics page has exceptional statistical density — 15+ named research statistics, excellent for AI citation
- HRT guide correctly cites Azrin/Nunn 1973 and Cochrane 2012
- Best-apps post contains explicit conflict-of-interest disclosure (positive)
- Word counts: HRT guide ~1,420 words (good), Best Apps ~1,850 words (good), Nail Biting Cure ~420 words (thin)
- Zero internal links in any post body
- Zero external links to cited studies in any post

---

### On-Page SEO: 62/100

**Title Tags:**
- Blog posts: unique, keyword-rich, correctly server-injected ✓
- Some titles exceed 60 characters (e.g., "Why Do People Bite Their Nails? The Psychology and Science Behind Onychophagia | Stop Biting" — 93 chars)
- /about, /pricing, /faq all serve homepage title (not unique)

**Meta Descriptions:**
- Blog posts: unique, well-written, appropriate length ✓
- Homepage: 175 chars (slightly over 160 recommended)
- /about, /pricing, /faq serve homepage description

**Twitter Card:**
- All blog posts show homepage title and description — confirmed bug across 6+ blog posts tested

**Open Graph:**
- `og:title` and `og:description` correct per-page ✓
- `og:type` is "website" on all blog posts (should be "article")
- All pages share same `og:image` (no unique per-post images)

**Heading Structure:**
- Consistently strong H1→H2 hierarchy across all analyzed blog posts ✓
- No H3 sub-sections used even where nested structure would help

---

### Schema & Structured Data: 52/100

**Present and working:**
- WebSite + SearchAction ✓ (verify search actually works)
- Organization ✓ (thin — only 1 sameAs URL)
- SoftwareApplication ✓ (missing paid offers, missing aggregateRating)
- FAQPage ✓ (valid JSON-LD; no rich result for non-authority sites since Aug 2023; misapplied globally)
- MedicalCondition — Onychophagia ✓ (good GEO signal; misapplied globally)
- BlogPosting on all blog posts ✓ (missing image, author is Organization not Person)
- BreadcrumbList on all blog posts ✓ (correctly implemented)
- HowTo on habit-reversal-training-guide ✓ (removed from Google rich results Sep 2023 — keep for AI value)

**Missing:**
- `image` on BlogPosting (CRITICAL — blocks Article rich results)
- `Person` schema for author
- Paid pricing on SoftwareApplication offers
- `aggregateRating` on SoftwareApplication
- `speakable` property on blog posts (direct GEO signal)
- FAQPage on individual blog posts (where appropriate)
- Per-post FAQPage schema reflecting actual post-specific questions

---

### Performance (Core Web Vitals): 55/100

*Note: This is a static-HTML proxy analysis. Validate with PageSpeed Insights for real field data.*

**LCP Risk: Medium**
- Google Fonts loaded synchronously via `<link rel="stylesheet">` — minor render delay
- Hero content is JS-rendered (invisible in raw HTML) — LCP candidate cannot be identified or optimized from server
- No `fetchpriority="high"` observable on any above-fold element

**INP Risk: Low-Medium**
- GA correctly deferred to `window.load` ✓
- JS bundles use `modulepreload` (non-blocking) ✓
- MediaPipe WASM parsed on blog pages unnecessarily — CPU overhead on mobile

**CLS Risk: Medium-High**
- Google Fonts with `display=swap` → text renders in fallback, then swaps to Instrument Serif/Inter → layout shift
- No `size-adjust` or `ascent-override` compensation
- Homepage images are JS-rendered — cannot verify width/height attributes are set

**Caching:**
- `cache-control: public, max-age=0` — effectively no browser caching
- ETag is present (conditional requests work) but max-age=0 means every page load triggers a revalidation request

---

### Images: 25/100

- All 47 blog posts contain zero images
- OG image exists (`/og-image.png`, 1200x630) but is shared across all pages
- No unique per-post featured images
- No alt text audit possible (no images to analyze)
- No image schema (`ImageObject`) on any content page

---

### AI Search Readiness: 47/100

| Metric | Score |
|---|---|
| AI Citability (content structure) | 62/100 |
| Brand Authority / External Footprint | 8/100 |
| Platform Readiness | 50/100 |
| AI Crawler Access | 65/100 |
| llms.txt | 70/100 |

**AI Platform Readiness:**
| Platform | Score | Key Gap |
|---|---|---|
| Google AI Overviews | 55/100 | No FAQ schema per-post, no author, "2025" title now stale |
| Perplexity | 65/100 | Good stats density; needs outbound citation links |
| ChatGPT Browse | 50/100 | Accessible; no named author reduces citation confidence |
| Gemini | 30/100 | Google-Extended blocked; reduces training weight over time |
| Bing Copilot | 55/100 | Schema supports; Twitter Card bug reduces entity clarity |

**Brand Mentions:**
| Platform | Status |
|---|---|
| Wikipedia | Not referenced |
| Reddit | No mentions found |
| Product Hunt | No listing found |
| LinkedIn | No company page found |
| App stores | N/A (desktop/web only) |
| Review sites (G2, Capterra, AlternativeTo) | Not listed |
| Press/media | No coverage found |

---

## Quick Wins (Implement This Week)

1. **Fix Twitter Card tags** — Blog posts show homepage title/description. One code change (use the same per-page value as `og:title`/`og:description`). Zero content work required.

2. **Change `og:type` to `"article"` on blog posts** — One-line template change. Affects social sharing classification and AI crawler categorization.

3. **Add `image` to BlogPosting schema** — Add `"image": {"@type": "ImageObject", "url": "https://stopbiting.today/og-image.png", "width": 1200, "height": 630}` to the BlogPosting template. Unlocks Google Article rich results site-wide immediately.

4. **Fix www subdomain 503 → 301 redirect** — DNS/hosting configuration only. Protects all inbound links using www prefix.

5. **Fix HTTP→HTTPS from 307 → 301** — Hosting configuration. Passes link equity through the redirect.

---

## 30-Day Action Plan

### Week 1: Fix Broken Signals
- [ ] Fix Twitter Card tags (homepage content appearing on blog posts)
- [ ] Change `og:type` from "website" to "article" on blog post pages
- [ ] Add `image` property to BlogPosting schema template
- [ ] Fix www subdomain 503 → 301 redirect to `https://stopbiting.today`
- [ ] Fix HTTP → HTTPS redirect from 307 → 301 Permanent
- [ ] Fix /about, /pricing, /faq to have their own unique canonical, title, meta description, and OG tags

### Week 2: Internal Linking Sprint
- [ ] Add 3–5 internal links to each of the top 10 blog posts (by estimated traffic intent)
- [ ] Start with highest-intent pages: habit-reversal-training-guide, nail-biting-statistics, nail-biting-cure, best-nail-biting-remedies, nail-biting-adhd
- [ ] Ensure every post links to at least 2 other related posts

### Week 3: E-E-A-T and Author
- [ ] Create an /about page with: founder name, photo, brief bio, credentials, link to GitHub/LinkedIn
- [ ] Add named author byline to all blog posts
- [ ] Update BlogPosting `author` from Organization to Person with `name`, `url`, `sameAs`
- [ ] Make publication dates visible on all blog posts
- [ ] Update "2025 Research Data" in statistics post title to 2026

### Week 4: Citations, Schema, and Brand Footprint
- [ ] Add hyperlinks to primary studies in Statistics post (PubMed/DOI links for all named studies)
- [ ] Add citation links to top 5 most research-heavy blog posts
- [ ] Add paid pricing to SoftwareApplication schema ($2.99/mo and $29/yr Offer objects)
- [ ] Create Product Hunt listing
- [ ] Create LinkedIn company page
- [ ] Update Organization sameAs with new platform URLs
- [ ] Generate `/llms-full.txt` with complete article bodies

---

## Appendix: Pages Analyzed

| URL | HTTP | Title | Key Issues |
|---|---|---|---|
| / (homepage) | 200 | Stop Nail Biting with AI \| Stop Biting | No www redirect; excellent schema |
| /blog | 200 | Nail Biting Resources — Evidence-Based Guides | No meta description in raw HTML |
| /blog/habit-reversal-training-guide | 200 | Habit Reversal Training for Nail Biting: A Complete Evidence-Based Guide | No images, no internal links, no author |
| /blog/nail-biting-statistics | 200 | Nail Biting Statistics: How Common Is It, Really? (2025 Research Data) | "2025" title stale (now 2026); studies not linked |
| /blog/nail-biting-cure | 200 | Nail Biting Cure \| Stop Biting | ~420 words (thin); no images, no internal links |
| /blog/best-nail-biting-remedies | 200 | Best Remedies to Stop Nail Biting | Good structure; conflict-of-interest disclosure present |
| /blog/best-apps-to-stop-nail-biting | 200 | 5 Best Tools to Stop Nail Biting in 2026 | Good length (~1,850 words); COI disclosed |
| /blog/nail-biting-adhd | 200 | Nail Biting and ADHD \| Stop Biting | Good stats density; no external links |
| /blog/mediapipe-ai-detection-explained | 200 | How AI Detects Nail Biting: MediaPipe \| Stop Biting | Technical depth good; low priority (0.6) in sitemap |
| /about | 200 | Stop Nail Biting with AI \| Stop Biting | Canonical → homepage; no unique content served |
| /faq | 200 | Stop Nail Biting with AI \| Stop Biting | Canonical → homepage |
| /pricing | 200 | Stop Nail Biting with AI \| Stop Biting | Canonical → homepage — CRITICAL for SaaS |
| /404test | 200 | Stop Nail Biting with AI \| Stop Biting | Soft 404 — should return 404 |
| www.stopbiting.today | 503 | — | No www redirect configured |

---

## Appendix: Confirmed Site Strengths

The following are genuinely strong implementations worth preserving:

- **Schema breadth and server-rendering:** 5 JSON-LD types on homepage (WebSite, Organization, SoftwareApplication, FAQPage, MedicalCondition), all in static `<head>` — immediately readable by all crawlers
- **robots.txt configuration:** Correct AI citation crawler allowlist (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, ChatGPT-User) with API endpoint protection
- **llms.txt:** Exists, is comprehensive, and documents app description, pricing, privacy model, and 41 blog article summaries
- **Security headers:** Comprehensive (HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CORS headers) — better than most similarly-sized SaaS products
- **Per-page blog head injection:** Blog posts have correct, unique canonical, title, meta description, og:title, og:description — all server-rendered
- **BreadcrumbList schema:** Correctly implemented on all blog posts (3-level: Home > Blog > Post)
- **BlogPosting schema:** Present on all blog posts with datePublished, headline, description, publisher
- **URL structure:** Clean, descriptive, hyphenated slugs with logical two-level hierarchy
- **Topic coverage:** 47 posts covering the nail biting topic space comprehensively (psychology, clinical treatment, demographics, comorbidities, technical product explainer)
- **Google Analytics deferral:** Loaded via `window.addEventListener('load', ...)` — correctly off the critical path
- **PWA manifest:** Present, enables mobile installation
- **Content statistical density:** Statistics and HRT posts in particular have citation-dense content well-suited for AI extraction
