# GEO Analysis — Stop Biting (stopbiting.today)
> Updated: 2026-04-19 | Previous: 2026-04-09

---

## GEO Readiness Score: 71/100 ↑ from 54/100

| Category | Score | Max | Change |
|---|---|---|---|
| Citability (content extractability) | 20 | 25 | +7 ✅ |
| Structural Readability | 15 | 20 | +3 ✅ |
| Multi-Modal Content | 4 | 15 | — |
| Authority & Brand Signals | 14 | 20 | +3 ✅ |
| Technical Accessibility | 18 | 20 | +4 ✅ |

---

## Platform Breakdown

| Platform | Score | Bottleneck |
|---|---|---|
| Google AI Overviews | 72/100 | No images in blog; no FAQ sections on posts |
| ChatGPT | 55/100 | No Wikipedia entry; no Reddit presence |
| Perplexity | 52/100 | No Reddit presence; no author Person schema |
| Bing Copilot | 65/100 | Strong meta + schema; body now visible |

---

## What Changed Since April 9

| Fix | Status |
|---|---|
| Blog body content server-side injected | ✅ Fixed — `BLOG_SECTIONS_DATA` in server.js |
| `datePublished`/`dateModified` in BlogPosting schemas | ✅ Fixed — `BLOG_DATES` in server.js |
| Per-post OG tags (title, description, url) | ✅ Already in `injectMeta` |
| `llms.txt` pricing information | ✅ Already present |
| `MedicalCondition` schema for onychophagia | ✅ Added today — index.html |
| `HowTo` schema for HRT guide | ✅ Added today — server.js |
| `llms.txt` contact page reference | ✅ Added today |

---

## 1. AI Crawler Access Status

**Verdict: Correct — no changes needed.**

| Crawler | Status | Notes |
|---|---|---|
| GPTBot (OpenAI) | ✅ Allowed | Explicit allow rule |
| OAI-SearchBot (OpenAI) | ✅ Allowed | Explicit allow rule |
| ChatGPT-User | ✅ Allowed | Explicit allow rule |
| ClaudeBot (Anthropic) | ✅ Allowed | Explicit allow rule |
| PerplexityBot | ✅ Allowed | Explicit allow rule |
| CCBot (Common Crawl) | ✅ Blocked | Training crawler — correct |
| Bytespider (ByteDance) | ✅ Blocked | Training crawler — correct |
| cohere-ai | ✅ Blocked | Training crawler — correct |
| anthropic-ai | ✅ Blocked | Training crawler — correct |
| Google-Extended (Gemini) | ✅ Blocked | Training crawler, not search — correct |

---

## 2. llms.txt Status

**Verdict: Present and well-structured.**

`/llms.txt` contains:
- Site description with key differentiators (on-device, offline, 100% private)
- All 20 blog posts with URLs and one-line descriptions
- Key facts block with specific statistics
- Pricing information
- Contact page reference (added today)

**Minor remaining gap:** No download URLs for Mac/Windows DMGs — relevant for "best nail biting apps" queries where AI systems may cite download links.

---

## 3. Blog Body Content — Server-Side Rendering

**Verdict: Fixed. ✅**

All 20 blog posts now have their full section content injected server-side via `BLOG_SECTIONS_DATA` in `server.js`. AI crawlers fetching any blog post URL now receive the complete article body in raw HTML, not a blank `<div id="root">`.

| Element | Status |
|---|---|
| `<title>` tag | ✅ Server-injected per page |
| `<meta description>` | ✅ Server-injected per page |
| `<link canonical>` | ✅ Server-injected per page |
| OG title/description/url | ✅ Server-injected per page |
| JSON-LD schemas | ✅ Server-injected per page |
| Blog body content | ✅ Server-injected (`BLOG_SECTIONS_DATA`) |
| `datePublished`/`dateModified` | ✅ Server-injected (`BLOG_DATES`) |

---

## 4. Schema Status

| Schema | Status | Notes |
|---|---|---|
| `WebSite` + SearchAction | ✅ Present | index.html |
| `Organization` | ✅ Present | Weak `sameAs` — only GitHub |
| `SoftwareApplication` | ✅ Present | Good featureList and offers |
| `FAQPage` (6 questions) | ✅ Present | index.html |
| `BlogPosting` per article | ✅ Present | Server-injected with dates |
| `BreadcrumbList` per article | ✅ Present | Server-injected |
| `CollectionPage` on /blog | ✅ Present | |
| `MedicalCondition` (Onychophagia) | ✅ Added today | index.html — epidemiology, treatments, DSM-5 ref |
| `HowTo` (HRT guide) | ✅ Added today | Server-injected on `habit-reversal-training-guide` slug |
| `Person` schema for author | ❌ Missing | All posts use Organization author |
| `HowTo` on other instructional posts | ⚠️ Partial | Only HRT guide so far |
| `AggregateRating` on SoftwareApplication | ❌ Missing | |
| RSL 1.0 licensing | ❌ Missing | |

---

## 5. Brand Mention Analysis

**Verdict: Critically weak. Highest-ROI non-code gap.**

Brand mentions correlate 3× more strongly with AI visibility than backlinks (Ahrefs, Dec 2025).

| Platform | Status | Notes |
|---|---|---|
| Wikipedia | ❌ Missing | No page for "Stop Biting" app or brand |
| Reddit | ❌ Missing | No community presence in r/NailBiting, r/OCD, r/BFRBs |
| YouTube | ❌ Missing | No video content or channel |
| LinkedIn | ❌ Missing | No company page |
| GitHub | ✅ Present | In `sameAs` (`github.com/gazivoda/nail-biting`) |
| ProductHunt | ❌ Unknown | Not referenced in schema |

**Recommended actions (manual):**
1. Create a LinkedIn company page → add to `sameAs` in index.html Organization schema
2. Post in r/NailBiting, r/StopSelfHarm, r/OCD — genuine participation, mention the app where relevant
3. One 2–3 minute YouTube demo video (screen recording) — highest-weight AI citation signal

---

## 6. Passage-Level Citability

Blog content is now visible to AI crawlers. Highest-citability passages (134–167 word optimal range):

| Post | Section | Status |
|---|---|---|
| `habit-reversal-training-guide` | "What is Habit Reversal Training?" (~160 words) | ✅ Optimal |
| `habit-reversal-training-guide` | "How long does HRT take to work?" (~155 words) | ✅ Optimal |
| `why-do-people-bite-their-nails` | "Why does nail biting become automatic?" (~140 words) | ✅ Optimal |
| `nail-biting-health-risks` | "How nail biting spreads pathogens" (~140 words) | ✅ Optimal |
| `nail-biting-health-risks` | "Dental damage from chronic nail biting" (~155 words) | ✅ Optimal |

**Remaining content improvements (medium effort):**
- Add "Bottom Line" 2–3 sentence summary at the end of each article (optimal AI snippet extraction)
- Add FAQ-style Q&A sections to top 5 articles (most-cited format in AI Overviews)
- Restructure `best-nail-biting-remedies` as a comparison table (Method | Evidence | Best For | Effectiveness)

---

## 7. Top 5 Remaining High-Impact Changes

### #1 — Build Reddit presence (Impact: High, Effort: Low-Medium)
Perplexity sources 46.7% of citations from Reddit. Authentic participation in r/NailBiting, r/OCD, r/StopSelfHarm costs nothing and compounds. One genuine post per month mentioning the app where relevant.

### #2 — Add FAQ sections to top 5 blog posts (Impact: Medium-High, Effort: Medium)
FAQ-format Q&A at article end is the most-cited content format in AI Overviews. Add 4–5 Q&As to: HRT guide, remedies, why people bite, health risks, how long it takes. Each answer should be 50–80 words.

### #3 — Create LinkedIn company page (Impact: Medium, Effort: Low)
Takes 30 minutes. Update `sameAs` in index.html Organization schema after creating. Immediately improves entity recognition across all AI platforms.

### #4 — Add "Bottom Line" summary blocks to all blog posts (Impact: Medium, Effort: Low)
Each article should end with a 2–3 sentence "Bottom Line" before any FAQ. The 40–60 word summary block is the most extracted content format in Google AI Overviews. One afternoon to add to all 20 posts.

### #5 — Add `HowTo` schema to remaining instructional posts (Impact: Medium, Effort: Low)
HRT guide now has HowTo schema. Candidates for the same treatment: `best-nail-biting-remedies`, `stopping-nail-biting-for-good`, `how-long-to-stop-nail-biting`, `nail-biting-in-children`.

---

## Quick Reference: Status Summary

| Item | Status |
|---|---|
| robots.txt — AI crawlers | ✅ Correct |
| llms.txt | ✅ Present + updated |
| Server-side meta injection | ✅ Working |
| Per-post OG tags | ✅ Working |
| Blog body content visible to crawlers | ✅ Fixed |
| `datePublished` in BlogPosting schemas | ✅ Fixed |
| `MedicalCondition` schema | ✅ Added |
| `HowTo` schema (HRT guide) | ✅ Added |
| Author credentials (Person schema) | ❌ Missing |
| Wikipedia presence | ❌ Missing |
| Reddit presence | ❌ Missing |
| YouTube content | ❌ Missing |
| LinkedIn page | ❌ Missing |
| `HowTo` schema on other instructional posts | ⚠️ Partial |
| FAQ sections on blog posts | ⚠️ Homepage only |
| "Bottom Line" summary blocks | ❌ Missing |
| `AggregateRating` on SoftwareApplication | ❌ Missing |
| RSL 1.0 licensing | ❌ Missing |
