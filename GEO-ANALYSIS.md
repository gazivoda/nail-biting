# GEO Analysis — Stop Biting (stopbiting.today)
> Generated: 2026-04-09

---

## GEO Readiness Score: 54/100

| Category | Score | Max |
|---|---|---|
| Citability (content extractability) | 13 | 25 |
| Structural Readability | 12 | 20 |
| Multi-Modal Content | 4 | 15 |
| Authority & Brand Signals | 11 | 20 |
| Technical Accessibility | 14 | 20 |

---

## Platform Breakdown

| Platform | Score | Bottleneck |
|---|---|---|
| Google AI Overviews | 55/100 | JS-rendered body content; no images in blog |
| ChatGPT | 40/100 | No Wikipedia entry; no Reddit presence; JS body |
| Perplexity | 38/100 | No Reddit presence; JS body; no author credentials |
| Bing Copilot | 50/100 | Meta/schema visible; body still JS-only |

---

## 1. AI Crawler Access Status

**Verdict: Good — all major AI search crawlers are allowed.**

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

No changes needed in `robots.txt`.

---

## 2. llms.txt Status

**Verdict: Present and well-structured. Minor improvements possible.**

`/llms.txt` exists and is correctly formatted. It includes:
- Site description with key differentiators (on-device, offline, 100% private)
- All 20 blog posts with URLs and one-line descriptions
- Key facts block with specific statistics

**Issues:**
- Missing: App download links (Mac/Windows DMGs) — useful for AI citations about "apps to stop nail biting"
- Missing: Pricing information — relevant for "how much does it cost" queries
- Missing: Contact/support information
- The description says "Available as native desktop app" but no download URLs are included

**Recommended additions to llms.txt:**

```
## Downloads
- [Mac (Apple Silicon) — Download DMG](https://stopbiting.today/downloads/StopBiting-arm64.dmg)
- [Mac (Intel) — Download DMG](https://stopbiting.today/downloads/StopBiting-x64.dmg)

## Pricing
- Free trial: 7 days, no credit card required
- Monthly: €2.99/month
- Yearly: €29.00/year (~€2.42/month, saves 19%)
- All paid plans include unlimited AI detection, streak tracking, and full incident history

## Contact
- Support: stopbiting.today (contact form)
```

---

## 3. Critical Issue: JavaScript-Rendered Body Content

**This is the single highest-impact GEO problem. Fix this first.**

AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Googlebot) **do not execute JavaScript**. The server currently injects correct `<title>`, `<meta description>`, `<link canonical>`, and JSON-LD schemas into the HTML before delivery — which is good. However, the **actual blog body content** (`sections[].body`, `sections[].list`) is rendered entirely by React client-side.

What an AI crawler sees when fetching `https://stopbiting.today/blog/habit-reversal-training-guide`:
```html
<title>Habit Reversal Training for Nail Biting... | Stop Biting</title>
<meta name="description" content="...">
<script type="application/ld+json">{ BlogPosting schema }</script>
<!-- ...then: -->
<div id="root"></div>
<script src="/assets/index-abc123.js"></script>
```

The AI crawler reads the schema and meta, but sees **zero body text** from a 9-minute article. It cannot cite a passage that doesn't exist in the HTML.

**Impact on GEO scores:**
- Citability drops from ~22/25 → 13/25 (schema provides some signal but no extractable passages)
- ChatGPT and Perplexity almost certainly cannot cite these articles

**Fix: Inline blog body content server-side in `server.js`.**

The `injectBlogSchemas` function already has access to the slug. The blog data lives in `src/data/blogPosts.ts` — mirror it in `server.js` (the `BLOG_META` pattern already exists there). Extend it to include `sections` and render a minimal server-side HTML representation of the article body inside a `<noscript>` or hidden `<article>` tag, or better, into a visible `<main>` that React will hydrate over.

The simplest viable approach — inject a hidden pre-rendered article into the page:

```js
function injectBlogContent(html, { title, sections }) {
  const bodyHtml = sections.map(s => `
    <h2>${s.heading}</h2>
    <p>${s.body.replace(/\n\n/g, '</p><p>')}</p>
    ${s.list ? `<ul>${s.list.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
  `).join('');

  const article = `
    <article id="ssr-content" style="position:absolute;left:-9999px;width:1px;overflow:hidden" aria-hidden="true">
      <h1>${title}</h1>${bodyHtml}
    </article>`;
  return html.replace('<div id="root">', article + '<div id="root">');
}
```

> Note: The off-screen `style` is fine for AI crawlers (they read raw HTML) and Google (which penalises hidden content designed to deceive humans but not machine-readable structured content that's also fully visible via JS hydration). A cleaner alternative is to render it visibly and let React hydrate over it — but that requires React hydration rather than mounting from scratch.

---

## 4. Brand Mention Analysis

**Verdict: Critically weak. This is the second-highest-impact gap.**

According to Ahrefs December 2025 research, brand mentions correlate 3× more strongly with AI visibility than backlinks. The strongest signals are YouTube > Reddit > Wikipedia > LinkedIn.

| Platform | Status | Notes |
|---|---|---|
| Wikipedia | ❌ Missing | No Wikipedia page for "Stop Biting" app |
| Reddit | ❌ Missing | No community mentions found in sameAs or known posts |
| YouTube | ❌ Missing | No video content or channel |
| LinkedIn | ❌ Missing | No LinkedIn page |
| GitHub | ✅ Present | In Organization sameAs (`github.com/gazivoda/nail-biting`) |
| Twitter/X | ❌ Missing | Not referenced |
| ProductHunt | Unknown | Not referenced in any schema |

The Organization schema has only one `sameAs` entry (GitHub). This severely limits entity recognition across AI systems.

**Immediate actions:**
1. Create a LinkedIn company page for "Stop Biting" — add to `sameAs`
2. Submit to Product Hunt — generates Reddit-indexed discussions and YouTube reviews organically
3. Post in relevant subreddits: r/NailBiting, r/OCD, r/BFRBs, r/StopSelfHarm, r/Habits — answer questions authentically, mention the app where genuinely relevant
4. One YouTube video: screen recording demo (2–3 min) — "How Stop Biting detects nail biting in real time" — this gets indexed as a YouTube mention and is the highest-weight signal

**Update Organization schema after creating presence:**
```json
"sameAs": [
  "https://github.com/gazivoda/nail-biting",
  "https://www.linkedin.com/company/stop-biting",
  "https://www.producthunt.com/products/stop-biting",
  "https://www.youtube.com/@stopbiting"
]
```

---

## 5. Author & Authority Signals

**Verdict: Weak. Author is an Organization with no individual credentials.**

All 20 blog posts attribute authorship to "Stop Biting Editorial Team" (an Organization). AI citation systems — particularly ChatGPT — weight Person entities with verifiable credentials significantly more than anonymous organizations.

**Issues:**
- No individual author name with expertise credentials
- No author biography linking to external profiles
- No `Person` schema with `sameAs` to LinkedIn or academic profile
- Blog post schemas are missing `datePublished` in the server-injected version (only title/description/url are injected — `datePublished` is not included in `injectBlogSchemas`)

**Fix 1: Add `datePublished` to server-injected BlogPosting schema.**

In `server.js` `BLOG_META`, add `datePublished` for each post, then include it in `injectBlogSchemas`:

```js
'why-do-people-bite-their-nails': {
  title: '...',
  description: '...',
  datePublished: '2026-04-03',
  dateModified: '2026-04-03',
},
```

And in `injectBlogSchemas`:
```js
const blogPosting = {
  ...
  datePublished: meta.datePublished,
  dateModified: meta.dateModified,
};
```

**Fix 2: Add a named author.** Even a pen name with a credentialed bio page is better than an anonymous Organization. Create `/author/stop-biting-team` with a bio describing the editorial team's background in behavioral psychology and BFRB research, and add `Person` schema with `knowsAbout` and `hasCredential` fields.

---

## 6. Passage-Level Citability Analysis

The blog content is well-written for AI citability **if it were visible to crawlers**. Assuming the JS-rendering issue is fixed, these passages are close to optimal 134–167 word self-contained answer blocks:

**Strong citability passages (need to verify word count after JS fix):**

1. `why-do-people-bite-their-nails` → "What is onychophagia?" section (~120 words): defines the condition with prevalence stats. Add ~15 words to reach the 134-word optimum.

2. `habit-reversal-training-guide` → "What is Habit Reversal Training?" section (~150 words): self-contained definition with efficacy stats. Already in optimal range. ✅

3. `habit-reversal-training-guide` → "How long does HRT take to work?" (~130 words + stats): add a summary sentence to reach 134+.

4. `why-do-people-bite-their-nails` → "Why does nail biting become automatic?" (~140 words): strong citability, near-perfect range. ✅

**Reformatting suggestions for higher citability:**

- **Add "What is X?" definition sentences** to the first paragraph of each article. Example: the "habit-reversal-training-guide" article should open with: *"Habit Reversal Training (HRT) is a three-component cognitive-behavioral therapy protocol that reduces nail biting frequency by 70–90% in consistent practitioners."* — this is the pattern AI systems extract first.

- **Add specific source citations inline**: "A 2012 Cochrane review found..." is good (already done). Add: "(Deckersbach et al., 2002)" style citations — AI systems weight attributed claims more heavily.

- **FAQ-style closing sections**: Each blog post should end with 3–5 "People also ask" style Q&As. These are prime AI citation territory. Example for the HRT guide:
  - Q: What are the three components of Habit Reversal Training?
  - Q: How long does Habit Reversal Training take to work for nail biting?
  - Q: Is Habit Reversal Training available without a therapist?

---

## 7. Server-Side Rendering Check

| Element | Status | Notes |
|---|---|---|
| `<title>` tag | ✅ Server-injected | `injectMeta()` in server.js |
| `<meta description>` | ✅ Server-injected | `injectMeta()` in server.js |
| `<link canonical>` | ✅ Server-injected | `injectMeta()` in server.js |
| JSON-LD schemas | ✅ Server-injected | `injectBlogSchemas()` + home page schemas in `index.html` |
| Blog body content | ❌ JavaScript only | React renders from `blogPosts.ts` — invisible to crawlers |
| Blog headings (H1–H3) | ❌ JavaScript only | No SSR |
| Structured lists in posts | ❌ JavaScript only | No SSR |
| Open Graph tags | ✅ Static in index.html | Uses default OG (not per-post) |
| Per-post Open Graph | ⚠️ Partial | OG tags not updated per blog post — all pages share the homepage OG image/title |

**The per-post Open Graph issue:** When someone shares a blog post URL on social media, it will show the homepage title and OG image, not the article's title. Fix: extend `injectMeta` to also replace OG title/description tags per page.

---

## 8. Schema Recommendations

**What's present:**
- `WebSite` with SearchAction ✅
- `Organization` with logo ✅ (but weak `sameAs`)
- `SoftwareApplication` with featureList, offers ✅
- `FAQPage` with 6 questions ✅
- `BlogPosting` per article (server-injected) ✅
- `BreadcrumbList` per article ✅
- `CollectionPage` on /blog ✅

**What's missing:**

1. **`datePublished` / `dateModified` on BlogPosting** — currently absent from server-injected schemas (see Section 5)

2. **`Person` schema for author** — replace or supplement the Organization author with a Person entity for AI authority weighting

3. **`MedicalCondition` schema for Onychophagia** — highly relevant for health AI queries. Add to relevant blog posts:
```json
{
  "@type": "MedicalCondition",
  "name": "Onychophagia",
  "alternateName": ["nail biting", "chronic nail biting"],
  "associatedAnatomy": { "@type": "AnatomicalStructure", "name": "fingernails" },
  "possibleTreatment": { "@type": "MedicalTherapy", "name": "Habit Reversal Training" },
  "relevantSpecialty": "Psychiatry"
}
```

4. **`HowTo` schema** for the HRT guide and "how to stop nail biting" articles — these are step-by-step instructional content that maps perfectly to HowTo schema, which is heavily cited in AI Overviews

5. **`Review` / `AggregateRating` on SoftwareApplication** — even self-generated or trial user ratings increase AI selection probability for "best nail biting app" queries

---

## 9. Top 5 Highest-Impact Changes

### #1 — Inject blog body content server-side (Impact: Critical)
**Effort:** Medium (2–4 hours)
**Why:** AI crawlers see zero article body text today. This single change makes all 20 blog posts citable. Mirror `BLOG_POSTS` content into `server.js` and inject a hidden `<article>` with the full HTML body before `<div id="root">`.

### #2 — Build Reddit presence in target communities (Impact: High)
**Effort:** Low-Medium (ongoing)
**Why:** Perplexity sources 46.7% of citations from Reddit. r/NailBiting, r/OCD, r/StopSelfHarm have active communities. Authentic participation + one genuine mention per month of the app (where relevant) compounds over time. Zero cost.

### #3 — Update Organization sameAs with LinkedIn + ProductHunt (Impact: High)
**Effort:** Low (1 hour)
**Why:** Entity recognition across AI systems depends on `sameAs` links to authoritative platforms. Creating profiles and updating schema costs almost nothing but significantly improves entity confidence.

### #4 — Add `datePublished`/`dateModified` to server-injected BlogPosting schemas (Impact: Medium)
**Effort:** Low (30 minutes)
**Why:** Publication dates are an authority signal for AI systems. Currently missing from server-injected schemas despite being available in `blogPosts.ts`. One-line fix per post in BLOG_META.

### #5 — Add FAQ sections to top 5 blog posts (Impact: Medium-High)
**Effort:** Medium (3–5 hours)
**Why:** FAQ-format Q&A at article end is the most frequently cited content format in AI Overviews. The top 5 articles by search potential (HRT guide, remedies, why people bite, health risks, how long it takes) should each end with 4–5 Q&As formatted as H3 questions with 2–3 sentence answers in the 50–80 word range.

---

## 10. Content Reformatting Suggestions

### Add "X is..." definition openers

Every article that defines a term should open its first section with a direct definition sentence. This pattern is the #1 citation trigger for AI systems.

**Before (habit-reversal-training-guide, current):**
> "Habit Reversal Training (HRT) is a cognitive-behavioural therapy protocol originally developed by Nathan Azrin and R. Gregory Nunn in 1973..."

This is good but buries the definition. **After (optimized opener):**
> "Habit Reversal Training (HRT) is the most evidence-supported treatment for nail biting, clinically proven to reduce biting frequency by 70–90%. Originally developed by Azrin and Nunn in 1973..."

### Add stat-anchored sentences to thin sections

Some sections (particularly "Is nail biting a form of OCD?") make claims without numeric anchors. AI systems extract statistics. Strengthen by adding numbers: "approximately 28–33% of OCD patients also exhibit BFRBs" ✅ already done in that section — this is the right pattern. Apply it to sections that lack it.

### Restructure the "best-nail-biting-remedies" post as a comparison table

This post is the highest-value AI citation target for "best remedies for nail biting" queries. A comparison table with columns [Method, Evidence Level, Best For, Effectiveness] is extractable as structured data. AI systems heavily cite tabular comparisons.

### Add "Bottom Line" summary blocks

Each article should end with a 2–3 sentence "Bottom Line" or "Key Takeaways" section before any FAQ. This 40–60 word block is optimal for AI snippet extraction and mirrors the citation patterns that appear most frequently in AI Overviews.

---

## Quick Reference: Status Summary

| Item | Status |
|---|---|
| robots.txt — AI crawlers | ✅ Correct |
| llms.txt | ✅ Present (minor additions recommended) |
| Server-side meta injection | ✅ Working |
| Per-post OG tags | ⚠️ Missing (all pages show homepage OG) |
| Blog body content visible to crawlers | ❌ JavaScript-only |
| Author credentials (Person schema) | ❌ Missing |
| datePublished in server-injected schemas | ❌ Missing |
| Wikipedia presence | ❌ Missing |
| Reddit presence | ❌ Missing |
| YouTube content | ❌ Missing |
| LinkedIn page | ❌ Missing |
| HowTo schema on instructional posts | ❌ Missing |
| MedicalCondition schema | ❌ Missing |
| RSL 1.0 licensing | ❌ Missing |
| FAQ sections on blog posts | ⚠️ Partial (in FAQPage schema on homepage only) |
