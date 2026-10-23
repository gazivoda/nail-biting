# Flags-off sameness: does the merged tree behave like production?

WS13 item 2. Question: with every feature flag off, does the tree at `main` (b6b16f9) behave like what is live?
Answer, with the evidence below: **yes, apart from a list of differences that each trace to a documented workstream
change (WS6, WS7a, WS11b). Nothing unexplained was found.** Two of those differences are larger than the workstream
notes say (extra JS fetched with every flag off, F2, and the precache, F3) and one is an undocumented, harmless header
quirk (F4). They are under "Findings" (section 8).

## 1. Baselines and method

There are two baselines, because another session pushed SEO work on top of the swarm's first push.

| Label | What | Commit |
|---|---|---|
| **A** | the swarm's last push: WS0-WS5, WS7b-WS11a, all flags off | `ffbf29a` |
| **S** | what is live: A + the SEO session (29 files, `git diff --stat ffbf29a 46a484c`) | `46a484c` (= `origin/main`) |
| **B** | this tree: A + WS6, WS7a, WS11b (54 commits) | `b6b16f9` (clean checkout, not the shared worktree) |
| **M** | B merged with S: what the next push would produce (`git merge-tree` is clean) | scratch merge commit `b5cb8b8` (tree `fff44e0`), never pushed |

Why four. A to B isolates the swarm. A to S isolates the SEO session. S to M is the real deployment diff. B to M and
A to S must be the same set of changes, which is the proof that the two sessions do not interfere.

Each tree was checked out into its own scratch git worktree, `node_modules` symlinked, and built with `npm run build:web`
(exit 0 in all four; precache 49 / 49 / 60 / 60 entries). **B was rebuilt from a clean checkout of b6b16f9, not taken from
the shared worktree's `dist/`**: `dist/seo-content.json` and a few other generated files in that worktree were rewritten at
00:48:30 (a content script, not a build) while this work ran. The shared `dist/` differs from the clean build of the same commit in one thing only: the `workbox-*.js` file name
that `sw.js` points at (`workbox-74048807.js`; all four clean checkouts give `workbox-3266fc27.js`; the file contents are equal).
All scratch worktrees were removed afterwards.

Tools (all in `scripts/flags-off-diff/`, Node ESM, no dependencies; commands at the end):

| Script | What it does |
|---|---|
| `dist-diff.mjs` | file-by-file diff of two `dist/` folders; chunks paired by un-hashed name; JS chunks classed `alias-only` / `rename-only` when only the minifier's names differ; CSS rule diff |
| `sw-diff.mjs` | precache list and route table of two service workers |
| `snapshot-all.mjs`, `http-snapshot.mjs` | boot the **real `server.js` of each checkout** (its own `server/`, `shared/`, `dist/`) with `FEATURE_FLAGS` empty and fetch 91 requests |
| `http-diff.mjs`, `attribute.mjs` | URL-by-URL diff (status, every header, body); four-way attribution and a "do the two edits commute" check |
| `dom-all.mjs`, `dom-snap.mjs`, `dom-diff.mjs` | real headless Chrome with a fake camera: DOM, head, network requests, console errors, screenshots and a pixel diff |
| `weight.mjs` | bytes a visitor downloads, per capture |
| `rig.mjs`, `lib.mjs` | the server rig (a copy of `scripts/background-probe/rig.mjs` that copies the server from the checkout under test) and the normalisation helpers |

Normalisation (the lesson about hashes): `name-<8 chars>.<ext>` asset references and `workbox-<hash>.js` are rewritten
to their un-hashed form in names and in every file's content; `"generatedAt"` build timestamps are blanked; static-file
mtimes are pinned in the rig (so `Last-Modified` is comparable); the rig user's dates are fixed. A second fetch of every
non-API URL gave the same bytes (0 unstable of 91). Ports 3214 and 3215 only, Chrome 4214 and 4215.

## 2. Summary

| Level | Compared | Identical | Expected (swarm) | SEO session | **Unexplained** |
|---|---|---|---|---|---|
| `dist/` files, A to B (531 files in B) | 531 | 469 byte-identical + 19 same code with other minifier names = **488** | **43** (22 added, 18 changed chunks/CSS, `index.html`, `sw.js`, `seo-gated.json`) | 0 | **0** |
| `dist/` files, S to M (what a deploy changes) | 531 | 488 | 43 (the same 43, same sizes) | 0 (already live) | **0** |
| `dist/` files, A to S (the SEO session alone) | 509 | 492 | 0 | **17** | 0 |
| HTTP, 91 requests, four-way attribution | 91 | **61** | **12** swarm only | **5** SEO only | **0** |
| HTTP, requests touched by both sessions | 13 | | all 13: swarm half = head tags / SW / entry bundle | all 13: SEO half = JSON-LD ids etc. | **0** (11 text pages commute exactly; `sw.js` and `index.js` checked structurally) |
| DOM captures per build (section 6): A to B, 25 captures | 25 identical in body, title, console errors and every pixel; 16 also identical in head and requests | 9 differ only in extra chunk requests (E5) and 25 in head tags (E1) | 0 | **0** |
| DOM, S to M (the deploy) | 25 identical to the eye; 16 in everything | the same 9 | already live | **0** |

Of the 91 HTTP requests, 25 differ between A and B (19 HTML pages, `/sw.js`, the entry bundle, 2 closed OG cards,
2 new icon files) and 66 are identical in status, every header and the body.

## 3. `dist/` files

### 3.1 A to B: every difference (62 files)

Added (22):

| Files | Explanation |
|---|---|
| `assets/PhoneView.js` (13.6 kB), `icons/apple-touch-icon-152x152.png`, `-167x167.png`, `shortcut-bite-96x96.png`, `shortcut-urge-96x96.png` | WS6 phone companion (lazy chunk and icons). `ws6-notes.md` file table |
| `assets/BackgroundRunner.js`, `appTicker.js`, `silent.js`, `watchStore.js`, `scheduleStore.js`, `reminders.js`, `tickWorker.js` | WS7a background watching (`ws7a-notes.md`, "What exists"). `tickWorker.js` is the 286-byte worker; nothing imports it, only `new Worker(new URL(...))` with the flag on |
| `assets/statusText.js`, `api.js`, `events.js`, `actions.js#3` | chunk graph reshuffle: code that used to sit in `runtime.js`, `SyncSettings.js`, `desktopHost.js` and an `actions` chunk is now shared (strings checked: `/api/events/sync`, `stopbiting:desktop-command`, etc. moved, none lost) |
| `og/features-habit-reversal.png`, `features-phone-companion.png`, `features-share-with-therapist.png`, `features-referral-program.png`, `features-desktop-app.png`, `solutions-cuticle-biting.png` | WS11b social cards of the six gated pages. The server answers 404 for them with the flag off (checked, section 5) |

Changed (40, of which 19 are the same code):

| Files | Verdict |
|---|---|
| 8 chunks `alias-only`: `CoachingStatsLine`, `InsightsView`, `Log`, `PhotoDiary`, `ProgramView`, `competitorPages`, `index.js#1`, `milestones` | identical code; only the names the entry chunk gives its exports changed (`ad` became `aq`) because the entry chunk gained exports |
| 11 chunks `rename-only`: `BlogPost`, `MilestoneRunner`, `PaywallPage`, `Program`, `RedeemPage`, `SegmentedControl`, `SignIn`, `apiFetchRequest`, `programProgress`, `state`, `usePhotoRecords` | identical code after canonical renaming of the minifier's 1-2 letter names |
| `assets/index.js#2` (the entry bundle, +11,625 B raw, +3,528 B gz) | WS11b flag-copy rules and hook, WS6 phone decision and head, WS7a lazy host and flag read. `ws11b-notes.md` says "about 8 kB raw / 2.2 kB gzip" for its part, `ws6-notes.md` "about 2.5 kB", `ws7a-notes.md` "+0.8 kB": 11.3 kB in sum, matches |
| `assets/Dashboard.js` (+8,323 B), `Settings.js` (+5,753 B), `useDetection.js` (+2,611 B) | WS7a (pause card, schedule section, hidden-tab loop) and WS6 (phone decision). Source diffs read: with the flag off `useWatchGate` is a constant, `startHidden()` calls `startBgInterval()`, `silentNow()` is false, `repeat` is `undefined`, `usePhoneView()` is false |
| `assets/ComparePage.js` (+992 B) | WS11b: flag-aware compare page and the feature-page view |
| `assets/CalibrationView.js`, `HeroDemo.js`, `DataSettings.js`, `PhotoDiarySettingsCard.js`, `SharingSettings.js`, `WeeklyEmailCard.js`, `SyncRunner.js` (+32 to +95 B each) | new side-effect `import"./appTicker.js"` style lines: Rollup now makes these chunks depend on the new shared chunks (see Finding F2) |
| `assets/SyncSettings.js` (-1,766 B), `desktopHost.js` (-251 B), `runtime.js` (-1,025 B), `actions.js#2` (-54 B) | code moved into the new shared chunks |
| `assets/vendor.js` (+505 B) | new lucide icons / library code used by the new components |
| `assets/index.css` (+2,033 B) | **+16 rules, 0 removed, the shared rules keep their order.** New utility classes only (safe-area padding, `min-h-16`, focus-visible outline, a hover variant). A new selector cannot restyle existing markup |
| `index.html` (+846 B) | WS6 head tags: 3 `apple-touch-icon` links with sizes (152, 167, 180) in place of one, and `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`. Unconditional (the shell), so also on the legal pages. Documented: `ws6-notes.md` "Flags off, before and after" (1) |
| `seo-gated.json` (+67,813 B) | WS11b: the copy of the six gated pages. **Never served**: `GET /seo-gated.json` is 404 in all four builds (checked) |
| `sw.js` (+720 B) | see 3.3 |

Unchanged, and worth saying: `sitemap.xml`, `llms.txt`, `llms-full.txt`, `robots.txt`, `manifest.webmanifest`,
`seo-content.json` (after blanking `generatedAt`), every `posts/*.json`, every other OG card, fonts, images, the
mediapipe models and wasm, `favicon*`, `logo*`.

### 3.2 A to S: the SEO session's 17 files (not the swarm's)

`llms.txt`, `llms-full.txt`, `sitemap.xml` (5 `lastmod` dates), `seo-content.json`, 8 `posts/*.json`, 3 OG cards
(`best-apps-to-stop-nail-biting`, `bfrb-guide`, `grow-nails-after-nail-biting`), `sw.js` (+28 B: the
`NavigationRoute` `allowlist: [/^\/(?:\?.*)?$/]`), `assets/index.js#2` (-23 B: blog data). Source: `git diff --stat ffbf29a 46a484c`
(`vite.config.ts`, `server.js` +25 lines, `blogPosts.ts`, `blogIndex.ts`, `public/*`).

### 3.3 The service worker

`node scripts/flags-off-diff/sw-diff.mjs`, A to B:

* precache 49 to 60 entries (1493.34 KiB to 1551.61 KiB, +58.3 KiB raw). Removed: `manifest.webmanifest` (WS6,
  `manifestOutOfPrecache` in `vite.config.ts`, so that the flag-aware manifest can reach returning visitors). Added: the
  11 new chunks above (28.5 kB raw, 11.9 kB gzip) plus a third `actions` chunk; the rest of the growth is the changed chunks.
* routes: one **new** runtime route, `brand-static` (CacheFirst, fonts `*.woff2` and `logo*.svg`, 12 entries, 30 days),
  WS6. Same four other routes, same denylist (`/api/`, `/downloads/`, `/posts/`, `/signin`, `/redeem`, `/share/`).
* `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`, the navigation fallback to `/index.html`: unchanged.
* S and M carry the SEO `allowlist` as well as WS6's `brand-static` route: both edits are in M (the precache change
  is the same 49 to 60 on top of S). `/?action=bite` matches the SEO allowlist regex `^\/(?:\?.*)?$`.

## 4. Chunk sizes

`node scripts/background-probe/compare-dist.mjs <A dist> <B dist>` (WS7a's script; its names collide where several chunks
share a name, `index.js` is the small entry stub and `index.js#2` the entry bundle):

```
chunk                       before   after    delta  gzDelta
BlogPost.js                   9894    9899        5        6
CalibrationView.js           10459   10553       94       51
ComparePage.js              141771  142763      992      392
Dashboard.js                 30902   39225     8323     2263
DataSettings.js              15576   15671       95       48
HeroDemo.js                   5282    5376       94       46
PhotoDiarySettingsCard.js     1708    1776       68       35
ProgramView.js                1589    1591        2        5
RedeemPage.js                 4433    4438        5        4
Settings.js                  33001   38754     5753     1530
SharingSettings.js           14115   14183       68       36
SignIn.js                    11186   11187        1        3
SyncRunner.js                 9757    9789       32        9
SyncSettings.js               6773    5007    -1766     -616
WeeklyEmailCard.js            4191    4259       68       40
actions.js                     715     746       31       11
desktopHost.js                4654    4403     -251      -87
index.js                      3635    3636        1        3
index.css                    78073   80106     2033      289
index.js#2 (entry bundle)   227031  238656    11625     3528
runtime.js                    1535     510    -1025     -361
useDetection.js              28448   31059     2611     1072
vendor.js                   324631  325136      505      123
new: BackgroundRunner 2908, PhoneView 13642, actions#3 661, api 1029, appTicker 1293, events 336,
     reminders 901, scheduleStore 2718, silent 315, statusText 2018, tickWorker 286, watchStore 3101
total raw 1526846 -> 1585418 (+58572), gzip 462139 -> 482811 (+20672)
```

* **Entry JS (`index.js#2`): +11,625 B raw, +3,528 B gzip** (67,388 to 70,916). With the stylesheet and the vendor chunk,
  what `dist/index.html` names (the landing page's first load, 3 files): 629,735 to 643,898 B raw, 182,572 to 186,512 B gz,
  **+3,940 B gzip**.
* In S to M the same table has the same rows and deltas (total +58,572 raw; gzip +20,620 because the SEO session changed
  `index.js#2` by -23 B raw).

What a visitor downloads (`weight.mjs`: the JS and CSS the browser actually requested in the real-Chrome captures,
gzipped), A to B, every flag off:

| Page load | A | B | Delta |
|---|---|---|---|
| landing page and every marketing page (3 files: entry, vendor, CSS) | 182,572 B gz | 186,512 B gz | **+3,940 B, no new request** (entry +3,528, CSS +289, vendor +123) |
| a blog post (+ `BlogPost` chunk) | 185,988 | 189,934 | +3,946 |
| a compare or solutions page (+ `ComparePage`) | 218,259 | 222,591 | +4,332 |
| signed in, Watch tab (13 files, 18 files) | 252,760 | 263,877 | **+11,117 B and 5 more requests**: `appTicker`, `silent`, `watchStore`, `scheduleStore`, a third `actions` chunk (3.8 kB gz); the rest is the entry, `Dashboard` (+2,263), `useDetection` (+1,072) |
| signed in, History | 83,639 | 83,645 | +6 |
| signed in, Settings (adds `reminders` and the schedule section) | 10,898 | 12,903 | **+2,005 B and 1 more request** |

The landing demo (`HeroDemo`) and the calibration screen import the same three chunks (`appTicker`, `silent`,
`watchStore`, 2.2 kB gz); that is from the import graph (the demo needs a click, it was not started in the captures).
For a visitor whose service worker installs, the precache grows from 49 to 60 entries, +58.3 KiB raw (section 3.3).

## 5. HTTP: 91 requests against the real server, flags off

`FEATURE_FLAGS` empty; `/health`, `/api/features` and the boot log confirm "flags on: none". The 91 requests: 22 pages and
error probes (home, how-it-works, pricing, about, blog and a post, legal pages, tools, `/terms`, `/refund`, `/signin`, `/redeem`,
`/share/<id>`, an unknown URL, `/downloads/...`), 9 `/compare/*` and `/solutions/*` (7 published, 2 `/compare/*` and
`/solutions/cuticle-biting` gated, so 3 of the 9), 8 feature-page URLs (5 pages, `/features`, 2 data files), 22 generated, static
or hashed files (sitemap, llms, robots, manifest, `sw.js`, `seo-content.json`, `seo-gated.json`, a post JSON, OG cards, icons,
fonts, `.well-known/apple-developer-domain-association.txt`, the IndexNow key, the workbox file and the entry bundle under
their hashed names), 20 API and `/health` calls signed out and 10 signed in (a minted `nh_session` for the rig user).

### 5.1 What did not change (61 requests identical in all four builds; 66 identical between A and B)

The gated pages answer the same branded 404 (status, headers and body) in every build: `/compare/hands-off`,
`/compare/habitaware-keen`, `/solutions/cuticle-biting`, the five `/features/*`, `/features`, the two `/page-data/*` URLs, and
`/seo-gated.json` (a plain-text 404). Also identical: `/api/features` (all 27 flags false), `/health`, `/manifest.webmanifest`
(`public, max-age=0`, no shortcuts: `phone.js` did not engage), `/robots.txt`, `/sitemap.xml` and the two llms files in A, B (they differ in S
and M only by the SEO session), every `/api/...` call in the list, signed out and signed in:

| Request | Status in A, B, S, M |
|---|---|
| `POST /api/events/sync`, `GET /api/events/status` (signed out and in) | 404 `{"error":"Not found"}` |
| `POST /api/auth/magic-link/request` and `/verify`, `GET /api/auth/apple`, `/api/auth/microsoft` | 404 |
| `GET /api/auth/google` | 302 (to Google, `state` blanked) |
| `GET /api/user/me` | 401 signed out, **200** signed in (same JSON) |
| `GET /api/share/links`, `POST /api/share/links` (both) | 404 |
| `GET/PUT /api/email/weekly` (flag-gated) | 404 |
| `GET` and `POST /api/email/unsubscribe/<bad token>` (deliberately not gated) | 404 "This link does not work" page, `Cache-Control: no-store`, `noindex` (the handler ran) |
| `GET /api/referrals/me`, `/api/billing/gift-info`, `POST /api/billing/verify-transaction` | 404 |
| `GET /api/phone/ping` | 404 (there is no phone API; WS6 has only the manifest route) |
| `GET /signin`, `/redeem`, `/share/<id>`, `/share/<id>/data.json` | branded 404 (as `ws8-notes.md`, `ws9-notes.md`, `ws10-notes.md` say) |
| `/sitemap.xml`, `/llms.txt`, `/llms-full.txt` | the built files, byte for byte (no gated entries) |

The **content security policy is byte-identical on every URL** (`worker-src 'self'` unchanged, so the 286-byte tick
worker needs no policy change). `Last-Modified` of `/` and every page is unchanged (WS11b's ledger rows did not move any
existing date). The no-script site navigation is unchanged (`GATED_NAV` is empty).

### 5.2 Differences, A to B (25 requests), all expected

| Request(s) | Difference | Cause |
|---|---|---|
| 19 HTML pages: `/`, `/how-it-works`, `/pricing`, `/about`, `/blog`, `/blog/how-to-stop-nail-biting`, `/editorial-policy`, `/privacy`, `/terms-and-conditions`, `/refund-policy`, 3 tools, 2 compare, 2 more compare, 2 solutions | exactly 1 line removed, 11 added in the head, +846 B, nothing else (body, JSON-LD, status, headers equal) | WS6 head tags (3.1) |
| `GET /sw.js` | body | 3.3 |
| `GET /assets/index.js` (entry) | body | 3.1 |
| `GET /icons/apple-touch-icon-152x152.png`, `/icons/shortcut-bite-96x96.png` | 404 to 200 | WS6 icons. Served with the flag off. The two shortcut icons are referenced by nothing while `phone_companion` is off (only the flag-on manifest names them); the two touch icons are referenced by the new head tags |
| `GET /og/features-phone-companion.png`, `/og/solutions-cuticle-biting.png` | **status 404 and body identical; one header differs: `Vary: Accept-Encoding` present, and the 404 page is now gzip-compressed** | WS11b, see Finding F4 |

### 5.3 SEO session, A to S (18 requests)

`/sitemap.xml` (5 `lastmod` values), `/llms.txt`, `/llms-full.txt`, `/seo-content.json`, `/og/bfrb-guide.png`, `/sw.js`, the
entry bundle, and the JSON-LD of `/`, `/pricing`, `/about`, `/blog`, the blog post and the compare and solutions pages
(`@id: ...#article` fragments, `Person.sameAs`, preload line). These are `git diff ffbf29a 46a484c`, not the swarm's.

### 5.4 Interaction: do the two sessions' edits commute?

`attribute.mjs`: of the 13 requests both sessions touched, the **11 text pages commute exactly**: M's lines equal S's lines
minus what the swarm removed (A to B) plus what the swarm added; headers and status as expected. `sw.js` and
`index.js` are minified one-liners, so a line-multiset check says nothing; they were checked structurally instead
(section 3.3 and 3.1: M carries S's `allowlist` and B's `brand-static` route and 60 entries; the entry bundle's size
changes are +11,625 B and -23 B in both orders). `dist/` is additive too: S to M changes exactly the files A to B changes, with the
same sizes (minus the 23 B and 28 B of the SEO session), and B to M changes exactly the 17 files A to S changes.

Caveat: `lineDiff` in the scripts is set-based, which is why `sitemap.xml` A to S prints `-0 +0` even though 5 `lastmod`
dates changed (both dates occur elsewhere in the file). The change is in `git diff ffbf29a 46a484c -- public/sitemap.xml`.

### 5.5 Positive control (without it, "identical" would mean nothing)

The same 91 requests against B with `FEATURE_FLAGS=hrt_coaching,phone_companion,share_links,referrals,desktop_app,
compare_competitors,event_sync,signin_magic_link,gift_plan,background_watching`: only 23 are identical. The server
logged `[marketing] pages open (flag on)` for the seven pages; `/compare/hands-off`, `/compare/habitaware-keen` and the five
`/features/*` go from 404 to 200; `/api/features` shows `true`s; `POST /api/events/sync` goes from 404 to 401; `/signin` and
`/redeem` from 404 to 200; the sitemap grows from 219 to 226 URLs and `llms.txt` lists `features/`; the manifest gains
the shortcuts "I bit" and "I feel an urge" and `Cache-Control: no-cache`; every 200 page carries
`<meta name="sb-copy-flags" content="event_sync phone_companion">`; the closed OG cards turn into PNGs. So each of the
flag-off facts above is a real switch.

## 6. DOM in a real browser, signed out and signed in, at 1280 and 390 px

Headless Chrome (macOS, `--headless=new`, fake camera and auto-granted permission, service worker bypassed, clean profile
per build, reduced motion), against the real `server.js` of each tree with `FEATURE_FLAGS` empty, the rig user signed in
with a minted `nh_session`. 25 captures per build, each with its body HTML (digits masked, clock-dependent), head, title,
network requests, console errors and a PNG screenshot:

* signed out, 1280 px light: `/`, `/how-it-works`, `/pricing`, `/about`, `/blog`, a blog post, a compare page, a solutions
  page, `/privacy`, a calculator; `/` at 390 px (11 captures);
* signed in: Watch, History and Settings at 1280 light, 1280 dark, 390 light, 390 dark (12 captures; 390 px is
  `Emulation.setDeviceMetricsOverride` with touch emulation, and `scrollWidth <= innerWidth` is asserted);
* Watch with detection actually running on the fake camera (real MediaPipe models, 15 s), then stopped (2 captures). The
  video and canvas are hidden for that screenshot; the DOM is not.

| Compared | Identical to the eye (body, title, every pixel, console errors) | Identical in everything (also head and requests) | What differs |
|---|---|---|---|
| **A to B** (the swarm) | **25 of 25** | 16 of 25 | head: WS6 tags in all 25, plus `modulepreload` links of lazy chunks in 14 signed-in captures; **requests: 9 captures load extra chunks** (E5): Watch (4 captures, plus the detecting one) +`appTicker`, `silent`, `watchStore`, `scheduleStore` (and a third `actions`, which the name normalisation hides), Settings (4) +`reminders`; History and every signed-out page: none |
| **S to M** (what a deploy changes) | **25 of 25** | 16 of 25 | exactly the same 9 captures with exactly the same requests |
| **A to S** (the SEO session) | 24 of 25 | 3 of 25 | `/blog` (three article titles and summaries in the list); the JSON-LD in the head in 22 captures (the signed-in app is served from `/`, so it carries the home page's schema) |
| **B to M** | 24 of 25 | 3 of 25 | the same SEO changes: `/blog` and the head JSON-LD |

* **Pixels: 25 of 25 screenshots are byte-identical between A and B**, including the 12 signed-in shots at 1280 and 390 px,
  light and dark, the three tabs. (`dom-diff.mjs` would have reported the differing pixel count and its bounding box.)
* **No sideways scroll anywhere**: 25 of 25 captures per build have `scrollWidth <= innerWidth` at both widths.
* **Detection running** (flag off): "Detection active" in both, the same body HTML, the same single console message in both
  (MediaPipe's `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.`), stopped state identical.
* localStorage keys are equal in every capture; no console error or page exception differs.
* Noise that was filtered, and why: the page's Google Tag Manager image beacon is blocked by the site's own `img-src` and
  logged as an error in some captures of any build (runs of the 11 signed-out captures: A 0 and 1 captures, M 4, 0 and 2, B 0, 0 and 0, S 0 and 0).
  The landing page's screenshot carousel asks for `/shots/app-history-390.webp` on a timer, in some runs and not others (A in 3 of 3
  runs, B in 1 of 3). Neither is compared. Both are third-party or timing effects, not build differences.

## 7. Expected differences: the ledger

| # | Workstream | What differs with every flag off | Verified as described? | Larger than the notes say? |
|---|---|---|---|---|
| E1 | WS6 | `index.html` head: 3 touch icons with sizes and 4 mobile web app meta tags, on all 19 shell pages | yes, matches `ws6-notes.md` (1) | no. Visible only when a page is added to a home screen: on iOS the label becomes "Stop Biting" instead of the page title, iPads get their own icon sizes, and iOS before 16.4 opens it standalone. The manifest already says `display: standalone` |
| E2 | WS6 | `manifest.webmanifest` out of the service worker precache; `brand-static` cache for fonts and logos; 4 new icon files served | yes | no. The served manifest is still the built file, byte for byte |
| E3 | WS6 | `PhoneView` chunk (13.6 kB) | yes: never requested in any signed-in or signed-out capture | no, but see F3: it is in the service worker's precache, so a visitor whose worker installs does download it (4.9 kB gz); the notes record the precache growth and also say a flag-off visitor "never downloads" it |
| E4 | WS7a | 12 new chunks; `tickWorker`, `BackgroundRunner` unused | yes: only requested with the flag on | no for `BackgroundRunner`/`tickWorker`. Both are precached (2.9 kB + 0.3 kB) |
| E5 | WS7a | extra chunks fetched with the flag off | partly | **yes**. `ws7a-notes.md` names `watchStore` (1.3 kB gz) for the landing demo and says a visitor "can notice download size only". In fact `useDetection`, `HeroDemo` and `CalibrationView` import `appTicker`, `silent` and `watchStore`, and the Watch tab also loads `scheduleStore` and a third `actions` chunk: **5 extra requests and +11.1 kB gz on the signed-in Watch tab** (3.8 kB gz of it new chunks), **1 extra request (`reminders`) and +2.0 kB gz on Settings**. Body HTML, title, console errors and pixels are identical; `<link rel="modulepreload">` lines for them appear in the head |
| E6 | WS7a | the detection loop, alarm, notifications | yes | no. Read in the diff: every new branch is guarded by `isFeatureOn('background_watching')`, `silentNow()` (false when off), `hiddenDriven` (false) or `useWatchGate` (constant). `startHidden()` with the flag off is `startBgInterval()` |
| E7 | WS11b | entry bundle +~8 kB raw / 2.2 kB gz of copy rules and hook; `ComparePage` +1 kB; `seo-gated.json` +68 kB; 6 OG cards in `dist` | yes | no. `ws11b-notes.md` says the rule sentences "are in the JavaScript and in the service worker's precache of every visitor with every flag off". The six pages' copy is not in the app |
| E8 | WS11b | marketing pages learn the flags from `<meta name="sb-copy-flags">` | yes: absent with every flag off (no page body differs from A beyond E1), present with `event_sync phone_companion` on (5.5) | no |
| E9 | WS11b | six pages, their data, OG cards, sitemap and llms entries | yes: all absent or 404 (5.1) | the 404 for the closed cards has a different `Vary` and is compressed (F4) |
| E10 | WS12a | does not exist in this tree | n/a | n/a |

## 8. Findings

**Verdict: with every flag off, tree B (and the merge M) serves what production serves, apart from the differences in
sections 3 to 7. No difference is unexplained. Nothing is gated wrongly: every page, API route, social card and data file of
a flagged feature is a 404 (or the built file, byte for byte) and the sitemap, llms files, CSP and caching of every
published page are unchanged.** The positive control (5.5) shows the checks can see a flag.

| # | Kind | Finding |
|---|---|---|
| F1 | **UNEXPLAINED** | none |
| F2 | Documentation says less than the build does (WS7a) | With every flag off the signed-in Watch tab loads **5 more JS files** (`appTicker`, `silent`, `watchStore`, `scheduleStore`, a third `actions` chunk) and Settings **1 more** (`reminders`), **+11.1 kB and +2.0 kB gzip** in total. `useDetection`, `HeroDemo`, `CalibrationView` and the settings chunks import the new shared chunks statically (Rollup's chunk graph), so the code is fetched although nothing in it runs. No visible effect (body HTML, pixels, console errors identical in 25 captures). The `ws7a-notes.md` sentence "what a visitor can notice is download size only" is true; the list that follows it (`watchStore` only) is incomplete. Fix if it matters: make the flag-off path not import them (dynamic import behind `isFeatureOn`), the same trick WS7a used for `BackgroundRunner` |
| F3 | Documented, but the notes contradict each other (WS6, WS7a) | `PhoneView` (13.6 kB, 4.9 kB gz), `BackgroundRunner`, `tickWorker` and 8 other new chunks are in the **service worker precache** (49 to 60 entries, +58.3 KiB raw; the 11 new names are 28.5 kB raw / 11.9 kB gz). A visitor whose worker installs downloads them although no flag is on; the page load itself never requests them. `ws6-notes.md` records "49 precache entries become 51, with the PhoneView chunk" and, a line later, that a flag-off visitor "never downloads" it; `ws7a-notes.md` records 51 to 60. Both are true: never on a page load, always for the precache |
| F4 | Undocumented, harmless (WS11b) | A closed gated card (`/og/features-*.png`, `/og/solutions-cuticle-biting.png`) still answers the same 404 page, but now with `Vary: Accept-Encoding` and **gzip-compressed**. Mechanism: the new `app.use('/og', ...)` wrapper calls `sendHtml` while `req.path` is mount-relative (`/features-phone-companion.png`), so the compression filter's `INCOMPRESSIBLE_PATHS = /^\/(?:og\|fonts)\//` no longer matches. `/og/nope.png` (falls through to the catch-all, full path) is unchanged. Verified with `Accept-Encoding: gzip` against A and B. Real cards (PNG, declined by content type) are unaffected |
| F5 | Behaviour you may not expect (WS6) | The head tags are in the shell, so they are on every page including the legal pages, with the flag off: on iOS, "Add to Home Screen" now says "Stop Biting" (it used the page title), iPads get their own icon sizes and iOS before 16.4 opens it full screen. The two shortcut icons are served (200) but referenced by nothing while `phone_companion` is off. Both documented in `ws6-notes.md` as "only read when someone adds the app to a home screen" |
| F6 | Process | The shared worktree's `dist/` was partly regenerated by something other than a build during this check (`seo-content.json`, `seo-gated.json`, `llms-full.txt` and `posts/*.json` have a later mtime than `index.html`: a content script, not `vite build`), and its `sw.js` names a different `workbox-*.js` than any clean build of the same commit. Verify releases from a clean checkout, as done here. `workbox-*.js` names are not reproducible between checkouts, so compare `sw.js` after normalising them (`lib.mjs`) |
| F7 | Integration | M (B merged with `origin/main`) builds, and the two sessions' changes are exactly additive in `dist/` and in 11 of 13 shared pages (5.4). Both edit `sw.js` (SEO: navigation `allowlist`; WS6: `brand-static`, manifest out of the precache); both are present in M. `/?action=bite` still matches the SEO allowlist |
| F8 | Same in every build, not a regression | `/signin`, `/redeem`, `/share/<id>` are the branded 404 with every flag off (documented), and `GET /api/phone/*` does not exist (WS6 has only the manifest route) |

### Not verified, and why

* The service worker was not installed in the browser: over plain `http://localhost` Chrome upgrades the shell's redirect to
  https and workbox's precache fails (`ws6-notes.md`, "Local testing pitfall"). Its behaviour is read from the generated
  `sw.js`, not observed.
* One signed-in user (trial running). The expired-trial paywall, subscribed and free-tier states were not captured.
* Detection ran on Chrome's fake camera only: the loop starts, the status text says "Detection active" and nothing differs from A;
  no hand was injected, so the alarm path with the flag off was read in the source diff, not run (WS7a's own flag-off alarm
  timing, `app-final-check-flagoff.json`, covers that).
* No real phone, no Electron build (`npm run build` was not run), no flag-on behaviour beyond the positive control.

## 9. Reproduce

```
# four clean checkouts, built with npm run build:web (see section 1), then, with TMPDIR set to a scratch folder:
node scripts/flags-off-diff/dist-diff.mjs A=<A>/dist B=<B>/dist S=<S>/dist M=<M>/dist --pair A,B --pair A,S --pair S,M --pair B,M
node scripts/flags-off-diff/sw-diff.mjs <A>/dist/sw.js <B>/dist/sw.js
node scripts/background-probe/compare-dist.mjs <A>/dist <B>/dist
node scripts/flags-off-diff/snapshot-all.mjs 3214 <out> A=<A> S=<S> B=<B> M=<M>
node scripts/flags-off-diff/http-diff.mjs <out> A B
node scripts/flags-off-diff/attribute.mjs <out>
node scripts/flags-off-diff/dom-all.mjs 3214 4214 <out2> A=<A> S=<S> B=<B> M=<M>
node scripts/flags-off-diff/dom-diff.mjs <out2> A B 4214
node scripts/flags-off-diff/weight.mjs <out2> A=<A>/dist B=<B>/dist
```
