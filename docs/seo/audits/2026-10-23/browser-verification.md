# Built service-worker browser verification

Origin: `http://127.0.0.1:3218`. Isolated session: `seo-sw-verification`. Date: 2026-10-23.

**Result: 12/12 controlled behavior checks passed; 0 behavior failures after the disclosed local fixture. One pre-existing local HTTP installation limitation was observed.** No application sources, emitted worker bytes, security policies, real accounts, or deployment settings changed during verification. Browser network emulation was restored to online afterward.

## Local-only installation limitation and fixture

The unchanged production CSP includes `upgrade-insecure-requests`. The existing server redirects `/index.html` to `/`. On the local HTTP-only server, Chrome upgraded that redirect target to `https://127.0.0.1:3218/`, where no TLS listener exists. Browser network logs show that exact upgrade; `fetch('/index.html')` fails, while `fetch('/')` succeeds. Worker installation therefore reached `redundant` before activation. This happens before navigation matching and is not caused by the added allowlist.

All **21 precache entries plus the Workbox runtime (22/22 local curl fetches)** were available with final HTTP 200. Index.html required its existing redirect.

To test the emitted worker without changing the server or production policy, one browser-only cache entry was seeded from the real unauthenticated GET / response:

- Cache: `workbox-precache-v2-http://127.0.0.1:3218/`
- Key: `http://127.0.0.1:3218/index.html?__WB_REVISION__=254183cb516517d1eeb9df9524f86923`
- Value: the actual Response returned by `fetch('/')`.

The same unchanged `/sw.js` then installed and activated, and `navigator.serviceWorker.controller.scriptURL` equaled `http://127.0.0.1:3218/sw.js`. These results verify controlled routing/offline behavior, not fresh installation on an HTTP-only origin. Recheck ordinary fresh installation on production HTTPS after deployment.

## Twelve checks

| # | Check | Result |
|---|---|---|
| 1 | Built worker contains root-only navigation allowlist `/^\\/(?:\\?.*)?$/` | PASS |
| 2 | Unchanged worker activates and controls the browser after the one-entry fixture | PASS |
| 3 | Repeat /blog: own title, description, canonical and CollectionPage | PASS |
| 4 | Repeat /pricing: own title, description, canonical and WebPage | PASS |
| 5 | Repeat changed /blog/grow-nails-after-nail-biting: own metadata and #article BlogPosting | PASS |
| 6 | Repeat /compare/ai-detection-apps: own metadata and #article Article | PASS |
| 7 | /blog?page=2 retains /blog canonical and CollectionPage, from network | PASS |
| 8 | Unknown route remains HTTP 404, noindex, no canonical, branded error page | PASS |
| 9 | Unauthenticated /api/user/me remains HTTP 401 application/json, Unauthorized | PASS |
| 10 | CacheStorage contains no runtime public-page HTML or API responses | PASS |
| 11 | Offline / renders React app entry, root canonical, HTTP 200, transferSize 0 | PASS |
| 12 | Offline /?utm_source=offline-check renders the same root app entry | PASS |

For checks 3–6, the worker was active and each real navigation transferred network bytes. Rendered title, description, canonical, and schema entity type/ID tuples exactly matched an independent same-route network fetch. Hardcoded expected canonical and page-entity IDs also matched. Transferred bytes: blog 24,633; pricing 7,675; changed article 10,349; comparison 11,165.

The 404 returned `Page not found | Stop Biting` with H1 `This page doesn't exist.`, and the API body was exactly `{"error":"Unauthorized"}`.

For offline checks, browser network emulation was enabled with `set offline true`, navigation occurred within the page, and a fresh uncached API request failed with a network error. The app entry still rendered `Stop biting your nails.`, 7,936 visible characters, its root canonical, and React-replaced content with transferSize 0. The network probe is the offline evidence; navigator.onLine was inconsistent across navigation in this tooling. These checks do not claim signed-in detection or authentication works without connectivity.

CacheStorage contained the 21 precache assets and one deliberately supported public article JSON entry in the posts cache; no /blog, /pricing, comparison, unknown-route, or /api HTML/data response was runtime cached.

## Artifacts

- Machine-readable evidence: `/tmp/stopbiting-sw-verification.json`
- Emitted worker fetched unchanged: `/tmp/stopbiting-sw-built.js`
- Local redirect headers: `/tmp/stopbiting-sw-index-redirect.headers`
- Offline app-entry screenshot: `/tmp/stopbiting-sw-offline-root.png`

The earlier regression test independently verified 24/24 real Workbox matching cases, including arbitrary future article/comparison URLs, API, downloads, posts, PDFs, root query strings and non-navigation root requests. The parent owns the complete HTTP/schema sweep, full-suite results, integrated build and deployment verification.
