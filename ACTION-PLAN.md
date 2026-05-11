# SEO Action Plan: stopbiting.today

**Generated:** 2026-05-11  
**Overall Score:** 53/100 → Target: 72/100 in 30 days  
**Source files referenced:** `server.js`, `src/data/blogPosts.ts`, `public/sitemap.xml`, `src/pages/Landing.tsx`

---

## Critical (Fix Immediately — Hours, Not Days)

### C1. Fix Twitter Card Bug
**File:** `server.js` (line ~1274 area — where `twitter:title` and `twitter:description` are set)  
**Problem:** All blog posts show homepage Twitter Card title and description.  
**Fix:** Use the same per-page meta values already used for `og:title`/`og:description`:
```js
// Find this pattern and fix it to use meta.title and meta.description:
<meta name="twitter:title" content="${meta.title}" />
<meta name="twitter:description" content="${meta.description}" />
```

### C2. Add `image` to BlogPosting Schema — Unlock Article Rich Results
**File:** `server.js` (BlogPosting schema injection block)  
**Problem:** `image` property missing → blocks Google Article rich results site-wide.  
**Fix:** Add to every BlogPosting schema:
```json
"image": {
  "@type": "ImageObject",
  "url": "https://stopbiting.today/og-image.png",
  "width": 1200,
  "height": 630
}
```

### C3. Fix www Subdomain — 503 → 301 Redirect
**Action:** DNS/hosting configuration only (not code).  
**Problem:** `www.stopbiting.today` returns 503.  
**Fix:** Add a 301 redirect at your hosting provider from `https://www.stopbiting.today` → `https://stopbiting.today`. Check Vercel/Netlify/Render redirect config.

### C4. Fix HTTP→HTTPS Redirect — 307 → 301 Permanent
**Action:** Hosting/server configuration.  
**Problem:** `http://stopbiting.today` returns 307 Temporary instead of 301 Permanent. Link equity is not passed through 307.  
**Fix:** Change to 301 in your hosting platform's redirect config.

---

## High Priority (Fix This Week)

### H1. Shorten Blog Post Title Tags
**File:** `server.js` (pageTitle construction, ~line 1274)  
**Problem:** All 40 blog post `<title>` tags exceed 60 characters (some reach 111 chars). Google truncates and rewrites them.  
**Fix:** Cap the base title at 45 characters before appending `| Stop Biting`:
```js
const MAX_TITLE = 45;
const baseTitle = meta.title.length > MAX_TITLE 
  ? meta.title.substring(0, MAX_TITLE).trim() + '…' 
  : meta.title;
const pageTitle = `${baseTitle} | Stop Biting`;
```
Or use a dedicated `seoTitle` field in `blogPosts.ts` (preferred — more control).

### H2. Trim Meta Descriptions to 150-160 Characters
**File:** `src/data/blogPosts.ts`  
**Problem:** 26 of 40 blog post meta descriptions exceed 160 characters. The homepage description is 203 characters.  
**Fix:** Audit and edit each `description` field. Target 150-160 characters with the value proposition in the first 120 characters.  
**Homepage fix:**  
Current (203 chars): "Break the nail biting habit with on-device AI detection. Uses your webcam to catch onychophagia in real-time — 100% private, no data leaves your device. Science-backed habit reversal techniques included."  
Suggested (145 chars): "Break the nail biting habit with on-device AI detection. Your webcam catches each bite in real-time — 100% private, zero data leaves your device."

### H3. Fix /about, /pricing, /faq Canonical Tags
**File:** `server.js` (route handling for non-blog routes)  
**Problem:** These pages return 200 but serve the homepage canonical `https://stopbiting.today/`. They cannot be independently indexed.  
**Fix:** Each route needs its own `<link rel="canonical">`, unique `<title>`, `<meta name="description">`, and Open Graph tags injected in `<head>`. Add route-specific handling in `server.js` similar to how blog routes are handled.

### H4. Scope FAQPage Schema to Homepage Only
**File:** `server.js` (schema injection)  
**Problem:** The 6-question FAQPage schema (with homepage-level questions) appears on every page including blog posts about ADHD, OCD, and teenagers.  
**Fix:** Move the FAQPage injection out of the global head injection and into the homepage-only section. Blog posts should only get FAQPage schema if they contain actual FAQ content specific to that post.

### H5. Add Paid Pricing to SoftwareApplication Schema
**File:** `server.js` (SoftwareApplication schema block)  
**Problem:** Schema only shows $0 free trial — AI models can't answer "how much does it cost?"  
**Fix:** Add two Offer objects:
```json
{
  "@type": "Offer",
  "name": "Monthly",
  "price": "2.99",
  "priceCurrency": "USD",
  "billingIncrement": "P1M"
},
{
  "@type": "Offer", 
  "name": "Annual",
  "price": "29.00",
  "priceCurrency": "USD",
  "billingIncrement": "P1Y"
}
```

### H6. Update Stale "2025" References to 2026
**File:** `src/data/blogPosts.ts` (nail-biting-statistics entry)  
**Problem:** Title says "(2025 Research Data)" but today is May 2026. Signals stale content.  
**Fix:** Change to "(2026 Research Data)" or remove the year from the title entirely.

### H7. Fix lastmod Mismatch in Sitemap
**File:** `public/sitemap.xml` line 327  
**Problem:** `nail-biting-and-perfectionism` shows `lastmod: 2026-04-28` but `blogPosts.ts` line 1437 shows `dateModified: 2026-04-23`.  
**Fix:** Change the sitemap entry to `2026-04-23` (or update `blogPosts.ts` to `2026-04-28` if the content was genuinely modified then).

---

## Medium Priority (Fix This Month)

### M1. Add Named Author to Blog Posts
**Files:** `server.js` (BlogPosting schema), `src/data/blogPosts.ts`, `src/pages/Landing.tsx`  
**Problem:** Zero author attribution on any page. E-E-A-T score is near-zero without named humans.  
**Actions:**
1. Create `/about` page with founder name, photo, bio, credentials
2. Add `author.name` and `author.url` to BlogPosting schema — change from Organization to Person
3. Add visible "Written by [Name]" byline to each blog post template
4. Add Person schema JSON-LD to `/about` page

### M2. Add Internal Links to Hidden SSR Article Content
**File:** `server.js` (SSR article generation)  
**Problem:** The `<article id="ssr-blog-content">` element (visible to AI crawlers, not to users) contains zero `<a>` links. AI crawlers cannot discover related posts from the crawlable content.  
**Fix:** Add 3 contextual `<a href>` links within the generated SSR article pointing to related posts. These are the same related posts already shown in the JS-rendered UI — just add them to the SSR article text.

### M3. Add Visible Publication Dates to Blog Posts
**File:** Blog post template component  
**Problem:** Dates exist in schema but readers and AI models can't see them in the page content.  
**Fix:** Add "Published: [Month YYYY]" and "Last reviewed: [Month YYYY]" to the blog post header.

### M4. Add External Citation Links in Blog Posts
**File:** `src/data/blogPosts.ts` (blog post content)  
**Problem:** Studies are named (Ghanizadeh 2015, Cochrane 2012, etc.) but never linked.  
**Priority posts to fix first:** nail-biting-statistics, nail-biting-adhd, habit-reversal-training-guide  
**Fix:** For each named study, add a hyperlink to the PubMed abstract or DOI. Example:
- "Ghanizadeh 2015 meta-analysis" → `https://pubmed.ncbi.nlm.nih.gov/...`
- "2012 Cochrane review" → `https://www.cochranelibrary.com/...`

### M5. Change og:type to "article" on Blog Posts
**File:** `server.js` (Open Graph injection for blog routes)  
**Problem:** All pages use `og:type: "website"`. Blog posts should use `og:type: "article"`.  
**Fix:** Add conditional to blog route handling.

### M6. Create /llms-full.txt
**Action:** Generate from `blogPosts.ts` content  
**Problem:** llms.txt is a good index but lacks full article bodies for AI systems that read full text.  
**Fix:** Write a script that reads all blog post content from `blogPosts.ts` and outputs a Markdown-formatted `/llms-full.txt` with full article bodies and source URLs.

### M7. Fix Soft 404 — Non-Existent Routes Should Return HTTP 404
**File:** `server.js` (catch-all route handler)  
**Problem:** Every non-existent URL returns HTTP 200 with the homepage shell.  
**Fix:** Maintain a list of known valid routes. For any request not matching a known route, return HTTP 404 with a static "Page not found" response (not the SPA shell):
```js
const KNOWN_ROUTES = ['/', '/blog', '/about', '/pricing', '/faq', /* ... blog slugs */];
app.get('/{*path}', (req, res) => {
  if (!KNOWN_ROUTES.includes(req.path)) {
    return res.status(404).send('<h1>404 - Page not found</h1>');
  }
  res.sendFile('index.html');
});
```

### M8. Add Contact Information
**Problem:** No email address or contact method visible anywhere on the site.  
**Fix:** Add support email to footer and /about page. Required by GDPR/CCPA (privacy policy must have a contact method).

### M9. Add Homepage Links to Top Blog Posts
**File:** `src/pages/Landing.tsx`  
**Problem:** Homepage links to /blog but not to any specific post.  
**Fix:** Add a "Featured Guides" section with 2-3 links to highest-intent posts: habit-reversal-training-guide, nail-biting-statistics, nail-biting-cure.

---

## Strategic (30-90 Day)

### S1. Address the Hidden SSR Article — Cloaking Risk
**Risk Level:** High (Google Manual Action risk as site grows)  
**Problem:** Blog content is served in `<article style="position:absolute;left:-9999px">` — crawlers see it, users don't. This is structurally a cloaking pattern.  
**Fix options:**
- **Option A (Recommended):** Migrate to Astro or Next.js for static site generation (SSG). Blog posts are static content and don't need client-side rendering. SSG pre-renders full HTML — same content for crawlers and users, no hiding required.
- **Option B (Lower effort):** Remove the CSS hiding. Make the SSR article visible to users as a server-rendered article that the React app then enhances when JS loads (progressive enhancement pattern). This requires UI work to ensure the server-rendered article looks acceptable before JS hydrates.

### S2. Build Brand Authority Footprint
**Current brand mentions:** ~0 on all major AI-cited platforms  
**Priority actions:**
1. Launch on Product Hunt (creates indexed page + discussion + backlinks)
2. Submit to AlternativeTo, G2, Capterra (AI tools recommendation context)
3. Create LinkedIn company page
4. Create Twitter/X profile
5. Update Organization `sameAs` schema with all live profile URLs
6. Submit a PR to the Wikipedia "Onychophagia" article to reference the statistics page as an external resource (requires the page to meet Wikipedia's notability criteria — the statistics aggregation page is the strongest candidate)

### S3. Consider Unblocking CCBot
**Problem:** CCBot is blocked, removing the site from Common Crawl — the training corpus for LLaMA, Mistral, GPT-3, and many open-weight models.  
**Decision factors:** All blog content is already publicly available and you want AI citation. The argument for blocking CCBot (preventing training without attribution) is largely symbolic — the content is already accessible to GPTBot and ClaudeBot.  
**Recommendation:** Unblock CCBot. The content you want AI models to cite is the same content CCBot would train on.

### S4. Expand Thin Content
**Posts under 600 words:**
- `nail-biting-cure` (~420 words) — highest-intent keyword, needs expansion to 1,000+ words
- `mediapipe-ai-detection-explained` (~650 words) — add technical depth and diagrams

### S5. Add Images to High-Priority Blog Posts
Start with 5 highest-traffic posts. Options:
- Data visualization charts (especially for nail-biting-statistics)
- Simple infographic showing HRT steps
- App screenshot for best-apps post
Each image needs descriptive alt text.

---

## Quick Reference: Files to Edit

| Issue | File | Location |
|---|---|---|
| Twitter Card bug | `server.js` | twitter:title/description meta injection |
| Title tag length | `server.js` | `const pageTitle = ...` (~line 1274) |
| BlogPosting image | `server.js` | BlogPosting JSON-LD block |
| Paid offers schema | `server.js` | SoftwareApplication offers array |
| FAQPage scope | `server.js` | Schema injection — move to homepage only |
| Meta descriptions | `src/data/blogPosts.ts` | Each post's `description` field |
| Stale "2025" in title | `src/data/blogPosts.ts` | nail-biting-statistics entry |
| lastmod mismatch | `public/sitemap.xml` | line 327 |
| Blog post content/citations | `src/data/blogPosts.ts` | blog post content fields |
| Homepage featured links | `src/pages/Landing.tsx` | Hero/CTA section |
| Soft 404 | `server.js` | catch-all route handler |
