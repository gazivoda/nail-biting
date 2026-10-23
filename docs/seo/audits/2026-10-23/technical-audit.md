# Technical SEO audit — stopbiting.today

Audited 2026-10-23, approximately 14:40–14:48 UTC. Read-only inspection against the live deployment and `origin/main`; no edits to the checkout with its unfinished merge.

## Result and limits

No broad crawling or indexing blocker was found on the canonical HTTPS host. Twenty-two canonical HTML pages, including ten of 188 articles, returned 200 with one canonical and one H1, indexable robots directives, English language declarations, substantial server-rendered content, and parseable JSON-LD. This does not establish which URLs Google has indexed or why organic traffic is low; Search Console impressions, selected canonicals, indexing exclusions, manual actions, and acquisition data remain unobserved.

Technical score: not estimated. A field CWV result, search-engine indexing evidence, full schema eligibility validation, and IndexNow submission logs were unavailable. The reproducible baseline result is **22/22 sampled canonical pages pass HTTP/head checks**.

## Category checks

| Category | Status | Evidence |
|---|---|---|
| Crawlability | Pass on apex | robots.txt and sitemap.xml return 200; all normal public pages/resources allowed; only /api/ generally disallowed. Sitemap referenced in robots. All 188 articles linked in the initial /blog HTML. |
| Indexability | Pass on first network visit; warning on repeat browser visit | All 22 sampled canonical pages have one expected canonical and no noindex. Service worker can replace route-specific HTML with the homepage. |
| Security | Apex pass; www fail | Apex has valid HTTPS plus HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy. www presents TRAEFIK DEFAULT CERT and returns 503. |
| URL structure | Warning | Clean descriptive routes and /blog/→/blog 301. Plain HTTP→HTTPS is currently 302 at the proxy. www is unavailable instead of redirecting. |
| Mobile | Pass on tested surfaces | At 390×844, homepage/blog/comparison document scrollWidth equals 390. Comparison table is horizontally scrollable within its own 342px container. Viewport meta present. Main CTAs 44–56px high. Inline links are smaller; no sitewide touch-target failure inferred. |
| Core Web Vitals | Unverified | PageSpeed Insights API returned 429 quota exhaustion. Local unthrottled browser checks are not field CWV. No INP field result or 75th-percentile data available. |
| Structured data | JSON syntax pass; eligibility delegated | All JSON-LD on 22 samples parses. WebSite/Organization/SoftwareApplication sitewide; page-specific BlogPosting/Article/WebPage/CollectionPage/BreadcrumbList and selected FAQPage/MedicalCondition. Parsing is not rich-result eligibility validation. |
| JavaScript rendering | Pass for initial content; repeat-navigation fail | Main article text, links, headings, metadata and JSON-LD arrive in network HTML without JS. Workbox navigation fallback substitutes homepage HTML after SW activation. |
| IndexNow | Partially verified | Root verification key file returns 200 and contains the expected key. scripts/indexnow-ping.mjs supports changed-URL submission and local state. No evidence that it runs after deployment or that the endpoint has accepted submissions. |

## Prioritized confirmed issues

### High: www cannot deliver or redirect

`https://www.stopbiting.today/` resolves to 91.99.19.151. Strict curl fails certificate validation. Diagnostic `curl -vkI` shows a self-signed `CN=TRAEFIK DEFAULT CERT` and HTTP/2 503. Using `-k` was diagnostic only; it does not make HTTPS valid.

Fix: provision a public certificate covering www; configure its HTTPS router at Coolify/Traefik; issue a permanent redirect to `https://stopbiting.today` preserving path/query. Verify the certificate and redirect without `-k`. This requires proxy configuration; a Node-only host redirect cannot repair the TLS handshake or an unmatched proxy router. Target deployment documentation: `COOLIFY_DEPLOY.md`; actual change belongs in Coolify/Traefik.

Traffic implication: visitors and any links using www fail. This does not demonstrate an indexing failure for apex URLs, which currently work.

### High for delivery consistency: SW serves homepage head for public routes

Root cause: `vite.config.ts:118–119`, `workbox.navigateFallback: '/index.html'` with a denylist that excludes API/download/post-data routes but permits all marketing, blog, comparison, legal and tool pages. Live `/sw.js` registers exactly that Workbox NavigationRoute.

Reproduction in an isolated browser:

1. Visit `/` and allow service worker activation.
2. Navigate to `/blog` or `/pricing`.
3. Route UI changes but document title, description, canonical, OG and shell JSON-LD originate from homepage HTML. On `/pricing`, H1 was `$2.99 a month, or $29 a year.` while title remained `Nail Biting App: Stop Biting with AI | Stop Biting` and canonical remained `https://stopbiting.today/`.
4. NavigationTiming showed workerStart >0, transferSize 0, and homepage-sized response body.
5. Unregister SW/clear isolated browser caches and revisit `/blog`: workerStart 0 and canonical correctly `https://stopbiting.today/blog`.

Fix: either restrict app-shell fallback to root or route public HTML through a network-first navigation strategy that caches complete responses by exact URL and preserves non-200 statuses. Test online network content, repeat navigation, unknown 404 routes, and intended root offline operation. Changing only BlogIndex client metadata would leave schema/OG/description and other routes wrong.

Qualification: this demonstrates a repeat-visitor browser bug, not that Googlebot indexed the wrong canonical. Validate Google-selected and rendered canonicals in Search Console before attributing lost traffic. Google recommends robust server-side rendering and warns that crawlers have different browser capabilities. [Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

### Medium: HTTP uses temporary rather than permanent HTTPS redirect

`http://stopbiting.today/` returns 302 then the HTTPS homepage returns 200. `server.js:51–63` already attempts a 301 when forwarded HTTP reaches Node; the live proxy handles the request first. Set permanent HTTP→HTTPS at the proxy and verify one-hop 301/308. Prefer a single canonicalizing redirect when scheme, hostname and path need normalization.

### Low: broad background precache downloads app chunks for public visitors

The live Workbox cache had 21 entries totaling 1,300,313 decoded bytes. It includes charts (269,604B), ComparePage (140,857B), MediaPipe (125,248B), Paddle (11,899B), and Dashboard (20,418B), even when the user only opens public pages. JS execution remains deferred, but broad precaching reduces the network savings intended by route-level lazy imports in `src/App.tsx`.

Consider selective precaching/on-demand caching after measuring actual user impact, preserving intentional offline app support. This is not a measured CWV failure. Target: `vite.config.ts:157–161` and PWA caching policy.

### Low: IndexNow submission automation not evidenced

The key and script exist, but the script explicitly states nothing invokes it automatically. After a successful deploy, submit changed URLs and retain acceptance logs/state, or document the existing manual process. This can help participating engines discover changes; acceptance does not promise indexing. [IndexNow documentation](https://www.indexnow.org/documentation).

## Important passes and avoided false positives

- Sitemap XML is valid: 219 unique HTTPS URLs, below protocol limits, with 18 distinct lastmod dates and no future dates observed. The 22 sampled entries returned 200 without redirects. The entire sitemap was not status-crawled.
- The blog index intentionally renders all 188 articles. `?page=2` returns the same collection with canonical `/blog`, and no pagination UI/links exists. It is not evidence of inaccessible later pages. If pagination is added, use crawlable sequential links and a self-canonical on each real page; Google no longer uses rel=next/prev. [Google pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).
- Unknown public path returns a real 404 and noindex in a direct network request. SW-controlled repeat navigation still needs correction as above.
- Hashed JS/CSS and fonts receive one-year immutable cache headers. JS/CSS/vendor use gzip. Main JS: 56,333 transferred / 196,684 decoded bytes. Vendor: 98,692 transferred / 316,948 decoded. CSS: 13,356 transferred / 70,050 decoded.
- Hero screenshots use WebP: 28,072B and 63,302B responsive candidates. History image is 32,180B with descriptive alt and lazy loading. CSS reserves logo/image layout dimensions; missing literal width/height attributes alone are not proof of CLS. The homepage preloads the responsive hero image.
- The printable PDF returns 200 application/pdf, 167,139B. Its short landing page has a useful downloadable artifact; short word count alone is not thin-content evidence. Calculators similarly provide browser-side functionality.
- Hreflang is N/A: only English page variants were detected. No multilingual URL set exists to validate; no hreflang tags should be invented.
- Programmatic assessment: content is generated from structured source files at build time, but the sampled articles contain 1,012–2,111 words each, descriptive independent titles, real text, references and internal links. No location-page template abuse or automated doorway expansion was observed. Editorial trust and overlap across all 188 posts require content-specialist assessment.

## Scope and evidence files

Applied `seo`, `seo-audit`, `seo-technical`, `seo-page`, `seo-images`, `seo-sitemap`, `seo-hreflang`, `seo-programmatic`, and `agent-browser`; applied performance and visual audit dimensions inline because those are agent roles, not installed standalone skills. No further subagents spawned per parent instruction.

Requests respected public robots rules, used at most five parallel fetches with approximately one-second delay between batches, and inspected fewer than 50 distinct site URLs. No public URLs were submitted to search engines and no account/deployment changes were made.

Machine-readable sampled page evidence: `/tmp/stopbiting-technical-page-evidence.json`. Curl bodies/headers: `/tmp/stopbiting-technical-*`. Mobile screenshots: `/tmp/stopbiting-technical-home-mobile.png`, `/tmp/stopbiting-technical-blog-mobile.png`. PageSpeed failure body: `/tmp/stopbiting-technical-psi.json`.
