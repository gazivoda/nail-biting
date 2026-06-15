# GEO Technical SEO Audit — stopbiting.today
Date: 2026-06-15

## Technical Score: 84/100 — Good

Technically solid foundation. Crawlability, security, URL structure, and asset delivery are strong. The two areas pulling the score down are both GEO-relevant: **server-side rendering** (only the blog template renders body content into raw HTML — all marketing/conversion pages ship an empty `<div id="root">`) and **Core Web Vitals** (client-side rendering of the homepage delays LCP, estimated from page characteristics since no CrUX field data is available).

## Score Breakdown
| Category | Score | Status |
|---|---|---|
| Crawlability | 15/15 | Pass |
| Indexability | 11/12 | Pass |
| Security | 9/10 | Pass |
| URL Structure | 8/8 | Pass |
| Mobile Optimization | 9/10 | Pass |
| Core Web Vitals | 10/15 | Warn |
| Server-Side Rendering | 9/15 | Warn |
| Page Speed & Server | 13/15 | Pass |

*Status: Pass = 80%+ of category points, Warn = 50–79%, Fail = <50%*

## AI Crawler Access
robots.txt is deliberately and correctly configured — search/citation crawlers allowed, training-only crawlers blocked.

| Crawler | User-Agent | Status | Recommendation |
|---|---|---|---|
| GPTBot | GPTBot | ✅ Allowed | Keep |
| OpenAI Search | OAI-SearchBot | ✅ Allowed | Keep |
| ChatGPT browse | ChatGPT-User | ✅ Allowed | Keep |
| Claude | ClaudeBot | ✅ Allowed | Keep |
| Perplexity | PerplexityBot | ✅ Allowed | Keep |
| Googlebot | Googlebot | ✅ Allowed (via `*`) | Keep |
| Bingbot | bingbot | ✅ Allowed (via `*`) | Keep |
| Common Crawl | CCBot | ✅ Allowed (intentional, commented) | Keep |
| Google AI training | Google-Extended | ⛔ Blocked (deliberate) | Does NOT affect Google Search / AI Overviews indexing — only opts out of Gemini *training*. Confirm this is the intended trade-off. |
| ByteDance | Bytespider | ⛔ Blocked | Training-only crawler — fine to block |
| Anthropic (training) | anthropic-ai | ⛔ Blocked | Training-only — ClaudeBot (citations) is separately allowed, so Claude citations still work |
| Cohere | cohere-ai | ⛔ Blocked | Training-only — fine |
| Apple Intelligence | Applebot-Extended | ➖ Not specified | Consider adding an explicit Allow if Apple Intelligence presence is desired |
| Amazon | Amazonbot | ➖ Not specified | Defaults to `*` Allow — fine |

**No citation crawler is blocked. No fatal access issues.** This is a model robots.txt.

---

## Critical Issues (fix immediately)
None. No crawler-blocking, no domain-level noindex, key pages return 200, sitemap valid.

---

## Warnings (fix this month)

1. **SSR gap on all non-blog pages (Category 7).**
   Raw HTML for `/`, `/pricing`, `/about`, `/how-it-works`, `/blog` (index), `/compare/*`, and `/solutions/*` contains `<div id="root"></div>` with **0 `<p>` and 0 `<h1>`** (verified `curl -A ClaudeBot`). Only the `/blog/:slug` template injects body content (off-screen `<article id="ssr-blog-content">` via `server.js` ~line 1263). AI crawlers don't execute JS, so these pages exist to them as `<head>` schema only.
   **Fix:** Extend the existing blog SSR injection to the homepage, `/how-it-works`, `/compare/*`, and `/solutions/*`. The comparison-table HTML already lives in `server.js` (~line 1045) — it just isn't injected on those routes.

2. **Core Web Vitals — LCP risk from client-side rendering (Category 6).**
   No CrUX field data available; estimated from characteristics. TTFB is excellent (~0.10s), but the homepage paints nothing until ~280KB (gzip) of JS parses and React renders. On mobile this likely lands LCP in the 2.5–4.0s "needs improvement" band. Blog pages fare better (text is in raw HTML). **Verify with Lighthouse mobile + PageSpeed Insights**, and note that fixing Warning #1 (SSR) also directly improves LCP on the affected pages.

3. **www subdomain has an invalid TLS certificate.**
   `https://www.stopbiting.today/` fails certificate verification (`unable to get local issuer certificate`) rather than redirecting cleanly to the apex. Any inbound link or manual entry of `www.` breaks. The apex (canonical) cert is valid.
   **Fix:** Issue a cert covering `www` and 301-redirect `www → apex`.

4. **HTTP→HTTPS uses a 302 (temporary) redirect.**
   `http://stopbiting.today/` returns **302**, not a **301**. Search engines treat 301 as the canonicalization signal; 302 can dilute it.
   **Fix:** Change the HTTP→HTTPS redirect to 301.

---

## Recommendations (optimize this quarter)

1. **Add IndexNow.** No key file at `/.well-known/` and no reference in `server.js` (404). ChatGPT and Bing Copilot both use Bing's index — IndexNow gives near-instant Bing re-indexing on publish, accelerating AI visibility on two platforms. Add a key file + ping Bing on blog publish/update.

2. **Enable Brotli compression.** Responses serve `content-encoding: gzip` even when `br` is requested. Brotli typically saves another 15–20% over gzip on text/JS — helps LCP/INP on the CSR pages.

3. **Add a CDN.** No CDN signals detected (no `CF-Ray`/`X-Cache`/`X-Served-By`; appears to be the origin Node server). TTFB from this location is excellent (~100ms), but global users have no edge caching. A CDN (Cloudflare in front of the origin) would also absorb traffic spikes and add the `www` redirect + TLS cleanly.

4. **Add `Permissions-Policy` header.** All other key security headers are present (HSTS, a detailed CSP, `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`). `Permissions-Policy` (e.g. restrict `camera` to self) is the one gap — and notable since camera access is the product's core.

5. **Reduce initial JS bundle.** `vendor` (586KB) + `index` (382KB) uncompressed (~280KB combined gzip) exceed the 200KB-compressed comfort threshold. `mediapipe` (122KB) appears separately bundled — confirm it's lazy-loaded only when detection starts. Code-split further to improve INP/LCP.

6. **301-redirect URL casing/trailing-slash variants.** `/Blog` (uppercase) and `/blog/` (trailing slash) both return 200 rather than redirecting to the canonical lowercase, no-slash form. Self-referencing canonical tags currently mitigate the duplicate-content risk, but explicit 301s are cleaner.

---

## Detailed Findings

### Category 1 — Crawlability: 15/15 (Pass)
- robots.txt syntactically valid, well-commented, references sitemap. **3/3**
- AI crawlers: all citation/search crawlers allowed; only training-only crawlers blocked. **5/5**
- sitemap.xml valid, 63 URLs, **`<lastmod>` present on all 63**. **3/3**
- Crawl depth: flat architecture, all pages within ~2 clicks of home. **2/2**
- noindex: every sampled page carries `<meta name="robots" content="index, follow">`; no erroneous noindex. **2/2**

### Category 2 — Indexability: 11/12 (Pass)
- Canonical: self-referencing on homepage, blog, and compare pages. **3/3**
- Duplicate content: −1 for www TLS failure + `/blog` vs `/blog/` vs `/Blog` all 200 (mitigated by canonicals). **2/3**
- Pagination: no problematic paginated indexable sets. **2/2**
- Hreflang: single-language site, N/A, no errors. **2/2**
- Index bloat: 63 URLs, all genuine content. **2/2**

### Category 3 — Security: 9/10 (Pass)
- HTTPS: enforced; apex cert valid; −1 for invalid `www` cert and 302 (not 301) HTTP→HTTPS. **3/4**
- HSTS: `max-age=31536000; includeSubDomains`. **2/2**
- `X-Content-Type-Options: nosniff`. **1/1**
- `X-Frame-Options: SAMEORIGIN`. **1/1**
- `Referrer-Policy: strict-origin-when-cross-origin`. **1/1**
- CSP: present and detailed (scoped script/connect/frame/img/style/font sources, `object-src 'none'`, `upgrade-insecure-requests`). **1/1**
- *Gap:* no `Permissions-Policy` (see Recommendation #4).

### Category 4 — URL Structure: 8/8 (Pass)
- Clean, readable, lowercase, hyphenated URLs (`/blog/habit-reversal-training-guide`). **2/2**
- Logical hierarchy (`/blog/`, `/compare/`, `/solutions/`). **2/2**
- No redirect chains (HTTP→HTTPS is a single hop; note it's 302 — see Warning #4). **2/2**
- No parameter-based duplicate pages. **2/2**

### Category 5 — Mobile Optimization: 9/10 (Pass)
- Viewport: `width=device-width, initial-scale=1.0, viewport-fit=cover`. **3/3**
- Responsive layout (Tailwind-based build, dedicated landing-page spec). **3/3**
- Tap targets / font sizes / contrast: assessed from markup, **not field-tested on a device** — −1 pending real-device verification. **3/4** combined for tap+font.

### Category 6 — Core Web Vitals: 10/15 (Warn) — *estimated, no field data*
- LCP: CSR homepage delays largest paint until JS parses/renders → estimated "needs improvement" on mobile. **2/5**
- INP: light post-load interactivity → estimated good. **4/5**
- CLS: empty root hydrates to a single late paint; off-screen SSR article won't shift visible content → estimated good, minor late-paint risk. **4/5**
- **Action:** validate with Lighthouse mobile + PSI field data; SSR fix (Warning #1) improves LCP directly.

### Category 7 — Server-Side Rendering: 9/15 (Warn) — GEO-critical
- Main content in raw HTML: blog posts fully SSR'd (✅, `<article>` + H1/H2 + 1,400–1,900 words); all other templates empty root (❌). **4/8**
- Meta + structured data in raw HTML: full title/description/canonical/OG + rich JSON-LD on every page. **4/4**
- Internal links in raw HTML: blog body links present, but primary navigation is JS-rendered. **1/3**

### Category 8 — Page Speed & Server: 13/15 (Pass)
- TTFB ~0.10s (excellent, well under 800ms). **3/3**
- Page weight: 12KB HTML; JS ~1.1MB uncompressed (~300KB gzip), mediapipe bundled separately; total transfer < 2MB. **2/2**
- Images: content is text/SVG-based — essentially no raster images to optimize (a performance win); only `og-image.png`. **3/3**
- JS bundles: vendor+index ~280KB gzip exceeds the 200KB threshold. **1/2**
- Compression: gzip enabled (Brotli not). **2/2**
- Caching: static assets `cache-control: public, max-age=31536000, immutable` with content-hashed filenames. **2/2**
- CDN: none detected (origin Node server). **0/1**

---

*Method: raw HTML fetched with `curl -A ClaudeBot` to reproduce non-JS AI-crawler view; HTTP headers, redirects, TTFB, and TLS checked via curl; SSR mechanism confirmed against `server.js`; bundle sizes from local `dist/assets`. Core Web Vitals estimated from page characteristics — no CrUX field data was available.*
