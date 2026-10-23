# WS11b (Marketing for new features): notes

> ## STOP: keep `desktop_app` OFF until desktop sign-in works
>
> **`/features/desktop-app` is built, gated and tested, and its flag (`desktop_app`) must stay OFF in production until the
> owner has fixed desktop sign-in.** `docs/agents/ws7b-notes.md` ("Known gaps before a public release"): **signing in from the
> desktop app does not work against the hosted API today** (`ELECTRON_PROTOCOL` is a switch for the whole server, and the
> packaged app has no sign-in button that calls `openGoogleAuth`). The macOS build is also **not signed or notarized**
> (`docs/DESKTOP_SIGNING.md`), the Windows build has never been built or run, and no installer is linked from anywhere. The owner
> removed desktop claims from the site on purpose earlier; this page puts them back only when the flag goes on.
> The copy was written for the app as it will be AFTER those fixes. Sentences that are only true after desktop sign-in works:
> "It is the same account and the same detection as in the browser" (intro), "the same account, the same plans and the same free
> trial" (section "What does it share with the web app?"). Before turning the flag on, also decide where the installer is linked
> from (nothing on the page points at `/downloads/*`, whose v1.1.0 entries predate the current app) and add that link to
> `getDesktopAppContent()` in `src/data/featurePages.ts`. A `TODO(owner)` comment above that function says the same.

For the owner and for WS12 / WS13. Reference: `docs/agents/ARCHITECTURE.md` section 8 ("Pages and copy behind flags (WS11b)"),
sections 12 and 14.

## What exists

Every page is invisible while its flag is off, which is production today (all 27 flags off). Each page opens with its OWN flag and
no other (tested one flag at a time).

| Page | Flag | Say what | Before the flag goes on |
|---|---|---|---|
| `/features/habit-reversal-coaching` | `hrt_coaching` | the competing-response prompt after an alarm (optional, never delays the alarm), the four-week program in general terms, and, with `urge_timer` also on, the urge timer. Plainly "not a treatment" | **Review all 28 lessons** (`src/data/hrtProgram.json`, NEEDS HUMAN REVIEW, ws2-notes). The page describes them only as "28 short lessons, four weeks: noticing, a competing response, what sets it off, slips". Check that Settings > Alerts reads as the page says |
| `/features/phone-companion` | `phone_companion` | the phone screen: two buttons, two taps, streak, recent entries, installable, no detection on the phone; "entries stay on the phone" unless `event_sync` is on | Try it on a real phone (ws6 "NOT verified"). Confirm the Privacy page's local-storage wording covers `sb:phone:grant` (ws6 TODO). Turning it on also changes `TrialButton` on phones (below) |
| `/features/share-with-therapist` | `share_links` | the read-only summary link: what it shows, what it never shows (the scope table of ws10), expiry, revoke, no sign-in for the viewer | Publish the ws10 legal drafts. **Turn `event_sync` on first** (a link shows synced history; with sync off every link says "no history yet"). Decide whether to keep `/share/` out of access logs (ws10 TODO) |
| `/features/referral-program` | `referrals` | the personal link; when the reward is paid (first payment, not a renewal); when the days start; what is checked | Everything in ws9-notes "Paddle: what the owner must do" (webhook events, price ids, `PADDLE_PRICE_IDS`) or no reward is ever paid. Publish the ws9 terms/refund drafts. The page reads `REFERRAL_CREDIT_DAYS` at start-up |
| `/features/desktop-app` | `desktop_app` | **see the banner above** | **Do not turn on.** Fix desktop sign-in, sign and notarize, link the installer |
| `/solutions/cuticle-biting` | `detection_behaviors` | "the same mouth alarm as nail biting, logged under another name; early; tried on made-up scenes only; no accuracy figure" | Decide when to turn `detection_behaviors` on at all (ws1-notes). Nothing else |

To turn a page on: add its flag to `FEATURE_FLAGS` in Coolify and restart (no rebuild). To turn it off: remove it and restart. The
server logs `[marketing] pages open (flag on): ...` at start-up. Check with `curl -s -o /dev/null -w "%{http_code}"
https://stopbiting.today/features/<name>` and `/sitemap.xml`. On the day a page goes on, set its `date` in `COMPARE_META` (`server.js`)
to that day: it is the Article's `datePublished` (all six say 2026-10-23, the day they were written).

### What a flag being on does to a page, and how

| | Flag off | Flag on |
|---|---|---|
| The URL | the branded 404 (noindex, no canonical), same as any unknown address | 200, indexable, self-canonical, Article + BreadcrumbList + FAQPage |
| `/page-data<path>.json` (what the page renders from) | the same 404 | the page's resolved copy, `noindex` |
| `/og/<card>.png` | 404 (the six cards exist in `dist/og` and the server hides them) | served |
| `sitemap.xml`, `llms.txt`, `llms-full.txt` | the built files, byte for byte | the page is appended at start-up, with its ledger date |
| noscript site navigation | not listed | listed |
| `dist/seo-content.json`, the JS bundle | not in it | not in it (the page renders from JSON the server resolves) |

`dist/seo-gated.json` holds the copy and is never served (404).

### Other flags change what a page says

The pages say what is true with only their own flag on. A sentence that depends on another flag is wrapped in a marker the server
resolves at start-up: `{{if event_sync}}...{{else}}...{{end}}`. Used for: sync (phone, share, coaching pages), `urge_timer`
(coaching and phone pages; the whole "What is the urge timer?" section disappears without it). The referral reward is the
placeholder `{{REFERRAL_CREDIT}}`, filled from `REFERRAL_CREDIT_DAYS` ("one month" by default, "14 days" if set to 14). Nothing
hard-codes a month.

## Existing copy that is no longer true with a flag on (made flag-aware)

`shared/flagCopy.js` `RULES`: the source files keep today's sentence exactly (that is what keeps the site byte-identical with every
flag off); a rule says what to say instead while a flag is on. The server applies it to the crawler article, the FAQPage data, the
served `llms-full.txt`, `seo-content.json` and `/posts/*.json`; the browser applies it through `useFlagCopy`. Where it applies
(each rule is in `scripts/flagCopySources.test.mjs` with the files that carry its text):

| Flag | What changes |
|---|---|
| `event_sync` | "Each alert is logged in your browser" (home FAQ 1 and its FAQPage); "Your history is stored in this browser, so it doesn't follow you" (home); "your history lives in this browser: clear the site's data and it's gone" (home privacy); "Signing in and paying use the network" (home, How it works FAQ); About's log sentence; the How it works spec row and its crawler line; Settings > Privacy card; two blog posts (`how-ai-can-help-stop-nail-biting`, `stop-biting-app-review`) |
| `signin_magic_link`, `signin_apple`, `signin_microsoft` | "Do I need a Google account to use it?" (answer composed from the methods that are on; **NEEDS HUMAN REVIEW**, it describes what each provider hands us, as ws8 asked); "Sign in with Google (it opens in a new tab)" (home hero note and How to start); three "requires a Google sign-in" sentences on the NailBiteMenu comparison. A method counts only when its flag is on AND its keys are configured (`/auth/providers` in the browser, `createCopyIsOn` on the server) |
| `phone_companion` | the home FAQ "Does Stop Biting work on a phone?"; `TrialButton` on a phone (below) |

`TrialButton` (WS6 left this for me): on a phone it used to send the visitor's link to a computer, because signing up on a phone
spent the trial on a screen that could not detect anything. With `phone_companion` on, a phone gets the ordinary "Start free trial"
button, and the home FAQ answer then points at the link on the phone screen after sign-in (the "Email me the link" button is gone from
the page while the flag is on).

How the three views stay identical (tested in every state, `scripts/featurePages.test.mjs`): the home FAQ in the React page, the
crawler article and the FAQPage JSON-LD are compared question for question with sync on, phone on, both, Microsoft on and
configured, and Microsoft's flag on but not configured (which changes nothing); every rule's sentence is compared in the React
page and in the article for the home page, About and How it works.

**How a marketing page learns the flags, and the flags-off request delta (none).** A marketing page makes no request for the flags
(`/api/features` counts against the shared `/api/` limits, which WS8 flagged as possibly one bucket behind the proxy, and WS11a
refused a footer hook for the same reason). The server writes `<meta name="sb-copy-flags" content="event_sync phone_companion">` into
every 200 page, listing only those two flags and only the ones that are on (`copyMarkerTag` in `sendHtml`, `server.js`); the browser
reads it synchronously at first render (`src/features/copyFlags.ts`). With both off the tag is not written and the page is byte for
byte what it was, so with every flag off the client's request set is also unchanged (no new request on any page). The sign-in methods
come from `/auth/providers`, which these pages already fetched.

Flag-state limits worth knowing:
* **A returning visitor whose service worker serves the cached app shell gets no marker** (the shell is a static file). For them the
  copy follows the app's last answer from `/api/features` if it is under ten minutes old (a visit to the signed-in app refreshes it),
  and otherwise says what it has always said. Unknown is treated as off, never as on, so the worst case is the old sentence (for
  example "history is stored in this browser") on an anonymous returning visit while sync is on. Crawlers and first visits are exact.
* `dateModified` and `Last-Modified` on a page whose copy a rule changed are the ledger's (the flag-off text's date). The ledger
  fingerprints the page sources, which hold the flag-off text. Not a false date, but not "the day the flag went on" either.
* The service-worker-cached shell has no embedded page data, so a feature page fetches `/page-data<path>.json` there (a blank
  moment, no flash of a 404).

## Deliberately NOT built, and what the owner must do first

Plan rule 4: a new detection behavior is not advertised until it is validated. Only synthetic fixtures exist (`ws1-notes`), and
only nail biting and cuticle/skin biting (the same mouth rule) are `validated`, on synthetic scenes, which is a regression guard
for a rule that already shipped, not a measurement on people. So:

* **`/solutions/skin-picking`, `/solutions/nose-picking`, `/solutions/trichotillomania` do not exist**, and nothing else claims
  that the app detects nose picking, skin picking or hair pulling. The cuticle page says outright that it makes no claim about them.
* The home hero, the home FAQ "detects nail biting only", `llms.txt` ("It detects nail biting only") and the how-it-works FAQ were
  **not changed**, as instructed. When `detection_behaviors` goes on, "nail biting only" becomes slightly stale (cuticle and skin
  biting can be chosen); that is a deliberate owner decision, not an oversight.
* To be able to build those pages the owner must: record real landmark fixtures for each behavior (dev recorder:
  `scripts/eval-detection/recorder/record.html`), save them under `scripts/eval-detection/fixtures/real/`, set `minPrecision`,
  `minRecall` and `promotion.minRealEvents` in `scripts/eval-detection/thresholds.json`, run `npm run eval:detection`, then change
  the behavior's `validation` to `'validated'` in `src/detection/registry.ts` (and the lists in `registry.test.ts` and
  `eval.test.mjs`). WS1's nose landmark indices (1 and 2) also still need checking on a rendered mesh. Even then, hair pulling
  needs the camera framed higher, and any page must say that.

## Stale sentences in the owner's pages (NOT edited: rule 8)

`PrivacyPage.tsx`, `TermsPage.tsx`, `LegalPage.tsx`, `RefundPage.tsx` and the `server.js` mirrors of `/privacy`, `/terms-and-conditions`,
`/refund-policy` were not touched. These sentences become wrong when a flag is on (drafts: `docs/agents/legal/ws4-*.md`, `ws8-*.md`,
`ws9-*.md`, `ws10-*.md`):

| Where | Sentence | Wrong when |
|---|---|---|
| `PrivacyPage.tsx` ~12 (and the `/privacy` mirror in `server.js`, "your habit log stays in your own browser") | "your camera feed never leaves your device, and your habit log stays in your own browser" | `event_sync` |
| `PrivacyPage.tsx` ~27 | "These are stored only in your browser (local storage)... They are not ..." | `event_sync` |
| `PrivacyPage.tsx` ~85 | "Your habit data never leaves your browser, so we do not hold a copy of it." | `event_sync`; also the share link's summaries |
| `PrivacyPage.tsx` ~26, ~58, ~77 | account data "provided by Google when you sign in"; "Google: sign-in (Google OAuth)"; the OAuth cookie | `signin_*` |
| `TermsPage.tsx` ~42 | "You must sign in with a Google account to use the Service." | `signin_*` |
| `TermsPage.tsx` ~55, and Privacy | "your camera feed never leaves your device" | the approved line is "No camera data is sent while it runs" (ws11a-notes) |
| `TermsPage.tsx` section 3, `RefundPage.tsx` section 2, the `/refund-policy` article summary in `server.js` | the trial length typed as "3-day" (ws9: edit with the legal review if `TRIAL_DAYS` changes) | `TRIAL_DAYS` not 3 |
| Terms and Refund | nothing about referral credits, gift codes, lifetime, or share links | `referrals`, `gift_plan`, `lifetime_plan`, `share_links` (ws9 and ws10 drafts) |

Also not changed, for the owner to look at: the four sentences ws9 flagged ("each with a 3-day free trial", "identically ... with
a 3-day free trial", "Both offer a 3-day free trial", and "price, privacy, 3-day trials" in the Hands Off meta description). They
are true while `TRIAL_DAYS` is 3 (it is) and must be rewritten by hand if it changes (`scripts/trialLength.test.mjs` lists them).
`src/data/blogPosts.ts` `stop-biting-app-review` also says "You can disconnect from the internet after the initial load and the
app functions identically", an older claim that WS11a's retired-phrase list does not catch and the service worker does not
support (it does not cache the models, ARCHITECTURE section 14).

## Owner TODO

- [ ] Keep `desktop_app` off (banner). Fix desktop sign-in, sign, notarize, then link the installer on the page.
- [ ] Review the generated sign-in answer ("Do I need a Google account to use it?") before any `signin_*` flag goes on.
- [ ] Review the six pages' copy once (all of it is new prose in `src/data/featurePages.ts`), and set `date` on the day each goes on.
- [ ] Per flag, the "Before the flag goes on" column above.
- [ ] Update the legal pages (table above) in the same release as the flag they depend on.
- [ ] Decide about the `/page-data` and `/og` routes behind your proxy (nothing to configure; they are ordinary GETs).
- [ ] No new env var, no `.env.example` change, no new dependency, no Dockerfile change (the new files sit in `server/` and `shared/`,
  which are already copied). `REFERRAL_CREDIT_DAYS` (ws9) is read by the referral page at start-up.

## Seams (everything outside the new files)

`server.js` (named; each small): imports; one block before the `/og` and `/posts` mounts (copy flags, reading `seo-gated.json`,
the `/og` card guard, the `/posts` handler that exists only while a copy rule is active); the SEO content is passed through the
rules when one is active; the gated-page state is rebuilt per page flag (it was one flag); the sitemap, `llms.txt`, `llms-full.txt`,
`seo-content.json` and `/page-data` handlers (each registered only when needed); `homeShell` (the homepage FAQPage block);
`injectSsrArticle`, `faqPageSchema` and the How it works schema apply the rules; six `COMPARE_META` entries with `gated: true`;
the gated handler embeds the page data; `sendHtml` writes the copy-flags marker (nothing while both flags are off). `src/pages/Landing.tsx`, `About.tsx`, `HowItWorks.tsx` (copy goes through `useFlagCopy`; the
text is unchanged with flags off), `Settings.tsx` (**the one edit to a page the architecture calls frozen, made on the
orchestrator's instruction**: the Privacy card's log sentence), `ComparePage.tsx` (feature pages, flag-aware compare pages, no hub in
a feature page's breadcrumb), `TrialButton.tsx`, `App.tsx` (one `/features/` condition). `scripts/sync-seo.mjs` (edited in bytes:
four registrations), `generate-seo-content.mjs`, `generate-og-images.mjs`. Changed tests: `scripts/marketingSite.test.mjs` (with
`compare_competitors` on, `llms.txt` and `llms-full.txt` now list the two competitor pages, which they did not), `comparePage.test.tsx`,
`server/marketing/gatedPages.test.js`. Generated and committed: `src/data/pageUpdates.json` (six ledger rows), six `public/og/*.png`.

## Verified, and how

- **Flags off is byte-identical to main.** Main (c3b3510, with WS7a) built in a scratch directory against this branch, both with
  `FEATURE_FLAGS` empty: `dist/` **464 files identical** (HTML, JSON, text, XML, manifest, fonts, images; hashed names and
  `generatedAt` normalised); the differences are `seo-gated.json` (never served), `sw.js` (precache revisions: the same 60 entries,
  hashes of rebuilt chunks) and the six new cards in `dist/og` (hidden by the server). **243 server responses** (every sitemap URL,
  every blog post, `llms.txt`, `llms-full.txt`, `sitemap.xml`, `seo-content.json`, `/api/features`, `/signin`, `/redeem`, `/share/...`,
  the six new URLs, their data files and cards, `/sw.js`, `/manifest.webmanifest`, an unknown URL): **485 of 486 files identical** (status,
  content type, cache headers, `X-Robots-Tag`, `Location`, body, hashed names normalised), the one difference being the `sw.js` body above.
- **Flags on.** `scripts/featurePages.test.mjs` boots the real `server.js` (56 tests): all off, then each flag alone with all six pages
  checked (200 for its own page, 404 for the other five and their data files), indexable and self-canonical, Article/Breadcrumb/
  FAQPage equal to the visible text, in the sitemap with its ledger date, in `llms.txt`/`llms-full.txt`/nav, no `{{` anywhere; the
  referral page with `REFERRAL_CREDIT_DAYS` unset and `14`; the coaching, phone and sharing pages with and without sync and the urge
  timer; the copy in five flag states, compared between the React page, the crawler article and the FAQPage data. Headless Chrome
  rendered the real page (one h1, the crawler article removed) with the flag on and the server's 404 with it off.
- **Lighthouse 13.5.0**, local server on port 3211 with a scratch database and dummy keys, each page with its flag on: **SEO 100,
  accessibility 100 on all six**; best practices 96 on all six, the one failing audit being the console error for
  `GET /auth/providers` returning 404 while no sign-in flag is on (WS8's behaviour on every marketing page, nothing to do with
  these pages). Run with `--only-categories=seo,accessibility,best-practices`; simulated throttling.
- `npm test`: **150 files / 2834 tests**; main (c3b3510, with WS7a) is 146 / 2684, and the task started at 135 / 2501. WS11b adds 4
  files and 150 tests: `shared/flagCopy.test.js`, `scripts/flagCopySources.test.mjs`, `scripts/featurePages.test.mjs`,
  `src/data/featurePages.test.ts`, plus new cases in `server/marketing/gatedPages.test.js` and `src/pages/comparePage.test.tsx`. `npm run build:web`: exit 0. `node --check` on `server.js`,
  `server/marketing/*.js`, the three scripts. `eslint src server scripts electron shared`: **23 errors / 4 warnings, the baseline**,
  no new problem by file and rule. `npm run seo:check`: in sync. `npm run og:check`: exit 0. The two dev-leak greps print nothing.
  Retired privacy phrases: zero in `dist/seo-gated.json`, `llms*.txt`, `seo-content.json`, `featurePages.ts` and everything the server serves.
- JS size: the entry chunk grew by about 8 KB raw / 2.2 KB gzip (the rules and the hook, shared by Landing, About, How it works and
  `TrialButton`), `ComparePage` by 1.0 KB raw / 0.4 KB gzip. **Deliberate, stated plainly:** the replacement sentences of the copy
  rules ("turn on sync", "Apple, Microsoft or an emailed link", the phone answer) are therefore in the JavaScript and in the service
  worker's precache of every visitor with every flag off (not rendered, not in any HTML, sitemap, llms file or schema). The six
  pages' copy is not. Keeping the rules out of the entry chunk would mean fetching them by flag, which brings back the request.

## NOT verified

- A real phone, the real "Add to Home Screen", a real therapist opening a share link, a real Paddle account (the referral page repeats
  ws9's facts, which ws9 itself could not check against Paddle), real Apple or Microsoft sign-in, real mail, the desktop app (never
  run), Windows, Safari and Firefox, a screen reader, Googlebot rendering a flag-on page.
- That every sentence on the six pages matches the product. The facts came from the workstream notes (ws2, ws6, ws7b, ws9, ws10,
  ws1) and were spot-checked in code only for the coaching presets, the referral windows (30 days in the browser, 7 days to
  attach) and the Behaviors labels. Nobody has read these pages against the running features with the flags on in one session; do
  that once on staging.
- The service-worker case (a returning visitor with the cached shell) was reasoned and unit-tested, not run against an installed worker.
- With `phone_companion` on, `TrialButton` on a real phone.
- `desktop_app`: nothing about the desktop app was exercised; the page repeats ws7b.

## Deviations from the plan, and why

- **Pages render from JSON the server resolves, not from bundled copy** (WS11a's competitor pages bundle theirs in a lazy chunk). The
  feature pages need flags and an environment number the browser does not have, and a bundled copy would put six unreleased pages'
  text in every visitor's JavaScript.
- **`/features/<name>`** is a new URL prefix (the plan's examples use `/solutions/` for audiences). The cuticle page is under `/solutions/`.
- **No page for skin picking, nose picking, trichotillomania** (above). No change to the hero or the "nail biting only" FAQ.
- **`Settings.tsx` edited** (one sentence), though ARCHITECTURE says nobody edits it.
- WS11a's test expectation that `llms.txt` never lists the competitor pages was reversed (the task asks for gated pages in llms when on).
- Blog posts follow the sync flag too (two sentences), through the same rules, which needed the server to serve `/posts/*.json` itself
  while a rule is active.

## Lessons worth recording

- `sync-seo.mjs` fingerprints a page from every string literal reachable from its handler. Variant copy must live outside it
  (a rules file applied by calls with arguments), or the freshness date and the sitemap's lastmod move with every flag off.
- A copy rule's replacement must never contain its own source text, or the second application stacks.
- A closed gated page's social card is a static file with the page's title on it: hide it in the server too, not only the page.
- Heredocs that mention `git` or write many files trip the sandbox's "too complex" guard; write scripts with the file tool and run them.
