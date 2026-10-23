# Verification — SEO/GEO traffic improvements

Date: 23 October 2026. Base: origin/main 0071bb4. Tests use the isolated SEO worktree and a temporary local database, not the original checkout's unfinished billing merge.

## Source and artifacts

- Baseline: `npm test` passed 119 tests across 18 files before implementation.
- Final integrated `npm test`: **149/149 tests across 20 files pass**. The 24 navigation cases observe the real VitePWA options and use Workbox's real matcher. Six schema cases start the real Express server and check HTTP responses.
- Red/green observed: 16 public navigation cases failed before the allowlist fix; all 24 pass after. All six schema identity checks failed before their corresponding fix and pass after.
- `npm run build:web`: **pass**, including TypeScript project build, 188 per-article JSON files, shared server content, full LLM text and production service worker.
- `npm run seo:check`: **pass**, 188 articles synchronized; sitemap has 219 URLs. Modification dates changed only for the five edited articles and their blog index.
- `npm run og:generate`: nine images changed, 202 unchanged. `npm run og:check`: **pass**, all 211 cards current, no orphaned files. The three cards with changed reading times were visually inspected. Five existing cards exceed the advisory 30KB budget, with largest 34.5KB; this is not a failing gate.
- `node --check server.js` and `git diff --check`: **pass**.
- Targeted ESLint: **pass** for server.js, vite.config.ts, both new regression files and generated blogIndex.ts. The complete article file has ten pre-existing no-useless-escape errors in untouched text; the same ten errors reproduce by linting `git show origin/main:src/data/blogPosts.ts` through stdin. No claim that repository-wide lint is clean.
- Build advisories remain: old Browserslist database, an existing runtime-resolved URL warning and npm's ELECTRON_SKIP_BINARY_DOWNLOAD config warning. These did not fail tests or the build.

## HTTP and structured data

Against the production web build at http://127.0.0.1:3218, a four-worker local sweep checked all **219/219 sitemap URLs**:

- HTTP 200;
- one expected canonical and H1;
- no unintended noindex;
- parseable nonempty JSON-LD;
- article IDs at canonical#article, with canonical WebPage references;
- referenced JS/CSS assets returning HTTP 200.

No failures. Machine-readable results are in local-sweep.json. This full local sweep is separate from the bounded live sample of 22 canonical pages in technical-sample.json. Private index coverage and selected Google canonicals remain unverified.

The OG-only second build preserved the exact built HTML SHA-1 `c7145097e6265ec991a65dc2d084b8057e591cbe` and client asset hashes, so the running local server retained a consistent shell while image files were refreshed.

## Browser verification

The emitted worker contains the root-only navigation allowlist. A local-only setup constraint was diagnosed: the existing production CSP upgrades a redirect from /index.html to HTTPS on 127.0.0.1, while the local server serves HTTP. This predates the change; production security headers were not weakened. All 21 precache URLs and the Workbox runtime returned HTTP 200. For the browser-only fixture, the real homepage response was placed under the worker's exact index.html revision key to bypass that local redirect. The emitted worker stayed unchanged and installed/controlled the page successfully.

**12/12 controlled checks passed:** four public routes (/blog, /pricing, the changed growth article, and /compare/ai-detection-apps) retained their correct title, description, canonical and page entity, exactly matching each route's independent network fetch; blog?page=2 retained the collection canonical; an unknown route remained 404 with noindex and no canonical; the protected API remained HTTP401 application/json; runtime caches contained no public HTML or API responses; offline root and root with a campaign query both rendered the React app, while a new API probe failed offline as expected. Route-specific online responses used the network after active service-worker control. This is a local browser result with the installation fixture, not an assertion that the public deployment has updated yet.

## Report and independent review

- REPORT.pdf was generated with ReportLab: five Letter-size pages, all five rendered and visually inspected for clipping, overflow, headings, lists and source links.
- Reproduce with `uv run --no-project --with reportlab python docs/seo/audits/2026-10-23/render-report.py`.
- A fresh independent reviewer approved the source changes with no blocking findings, after reviewing the full diff, real regression tests, detector code, primary sources and report. Its two follow-ups were completed: stale OG cards refreshed and this verification record added.
- The technical specialist separately reviewed the schema implementation with no findings.

## Release and limits

The user authorized commit and push. Release commands will use a normal fast-forward push from the origin/main-based worktree to remote main, excluding the original checkout's 55 unpublished commits and unfinished merge. Release confirmation will be recorded after remote verification.

Remaining hosting work: www TLS/router repair and proxy HTTP302→permanent redirect. Current GSC outcomes, field CWV and measured AI citations/traffic uplift are unavailable. The report contains a 28-day comparison plan rather than invented results.
