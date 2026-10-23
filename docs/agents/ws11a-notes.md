# WS11a (Marketing site fixes): notes

Short version for the owner and for WS13. Reference material is in `docs/agents/ARCHITECTURE.md` section 8; the
corrections WS11a suggests for that file are at the end of this one.

## Read this first: two decisions for the owner before `compare_competitors` goes on

1. **The two new comparison pages overlap live pages.** `/compare/stop-biting-vs-hands-off` and
   `/compare/stop-biting-vs-habitaware` already exist, are in the sitemap and were verified (2026-09-10 and
   2026-10-05). The plan asked for `/compare/hands-off` and `/compare/habitaware-keen`. They are built as asked, but
   written for a different question (what the product is, its price, who it suits, where we differ) and each links to
   its `vs` sibling. They still sit close to the `vs` pages in search. Decide whether to run both, or to leave the flag
   off. Never gate or remove the live pages: that would de-index them.
2. **The facts on both pages are marked NEEDS HUMAN VERIFICATION** (`needsVerification: true` in
   `src/data/competitorPages.ts`). A person opens every source URL in the table below and confirms the wording, then sets
   it to `false` and turns the flag on.

## What exists now

### 1. Social card and theme colour for `/how-it-works`
Already correct on this base, so nothing to switch: `/how-it-works` serves `og:image` and `twitter:image` =
`https://stopbiting.today/og/site.png`, and every route serves `theme-color #F7F7F1` (index.html, the SSR shell and the
PWA manifest agree; the only `#020617` left is Electron's window background in `electron/main.ts`, which is not web
meta). Verified by curl and now pinned by `scripts/marketingSite.test.mjs`. One loose end fixed: `public/og-image.png`
(the old card, which the server.js comment said "holds the same bytes for old shares") is now a byte-for-byte copy of
`public/og/site.png`, so old shares show the current card.

### 2. Privacy wording
Approved line: *Detection runs on your device. No camera data is sent while it runs.* Stop Biting's own overclaims were
replaced, keeping the sign-in / payment / network truth:

- 7 blog posts (`how-ai-can-help-stop-nail-biting`, `webcam-privacy-nail-biting-app`, `mediapipe-ai-detection-explained`,
  `nail-biting-laptop-working-from-home`, `stop-biting-vs-mavala-stop`, `nail-biting-cure`, `stop-biting-app-review`), all
  with `dateModified` bumped to 2026-10-23. Removed: "no server endpoint to send data to", "zero camera-related network
  requests", "100% on-device with nothing transmitted", "Nothing is recorded or sent anywhere", "no cloud dependency",
  "runs offline thereafter", and a leftover desktop-app paragraph ("SQLite database... Uninstalling the app removes all
  data... no user analytics", false: the site uses Google Analytics and there is no desktop build marketed).
- `comparePages.ts`: desk-workers ("nothing is transmitted", also in its FAQ answer, so the FAQPage schema followed) and the
  Hands Off / Nailed copy ("never leaves your machine", "nothing is sent while detection runs").
- How it works: spec row "no network access" -> "runs on your device" (React and the server.js mirror); the FAQ answer
  "Nothing." -> "It is processed frame by frame on your device...".
- Homepage privacy section: "watching never does" removed (React and server.js mirror).
- `PWAGuideModal.tsx`: "Works offline: ... no internet needed" -> "Runs on your device: no camera data is sent while detection
  runs" (the service worker does not cache the models, ARCHITECTURE section 14).
- `public/llms.txt` key facts ("works fully offline", "camera feed never leaves it"), `PRODUCT.md` (3 lines), the off-site
  kit (`outreach-templates.md`, `alternativeto-listing.md` tags `no-tracking` and `works-offline`).
- A stale comment in `scripts/sync-seo.mjs` that quoted the old figure.

**What is deliberately still there** (the zero-grep applies to Stop Biting's own absolute claims):

| Where | Text | Why it stays |
|---|---|---|
| `src/pages/Landing.tsx`, `index.html` (FAQ answer + FAQPage JSON-LD), `server.js` home article | "Your camera never leaves your device." (h2), "Your camera feed is never uploaded, streamed, or stored anywhere outside it." | Camera-scoped, owner-reviewed (commit 0071bb4), and the next sentence carries the qualifier. Change as one edit in all four places if you want it gone. |
| `PrivacyPage.tsx`, `TermsPage.tsx` and their `server.js` mirrors | "your camera feed never leaves your device" | Legal pages: not edited (rule 8). **NEEDS HUMAN REVIEW** to align them. |
| `HowItWorks.tsx`, `server.js` | "Incident logging: timestamped log stored locally, never transmitted" | True today. WS4 (opt-in sync) makes it false when on; WS11b rewrites it. |
| `comparePages.ts` | NailBiteMenu, SmartBehavior, Nailed, Hands Off quotations ("No accounts, no cloud, 100% local processing", "works 100% offline", "no servers, no analytics") | Attributed, verbatim, from the dated FACT-CHECK LOG. Not ours to paraphrase. |
| `docs/agents/*`, `docs/press/one-pager.md`, `docs/off-site-kit/reddit-and-community-drafts.md` | the retired phrases quoted as "do not write this" | They forbid the phrases. |
| `LANDING_PAGE_SPEC.md`, `docs/seo/*`, `docs/superpowers/plans/*`, root `*-ANALYSIS.md` / `*-PLAN.md` | old design specs and audit reports | Historical, unpublished. Not edited. Do not reuse their copy. |

### 3. Meta
The meta keywords tag is gone (index.html was the only source; no route re-added it). Static `og:description` and
`twitter:description` no longer say "Science-backed ... to stop onychophagia for good". Every route already had its own
description; the test checks that 16 representative pages each have a distinct one and no keywords tag. The JSON-LD
`keywords` property on SoftwareApplication is schema, not meta keywords, and was left.

### 4. Social proof (`social_proof`, off)
`src/components/site/Testimonials.tsx` (+ `testimonialsModel.ts` validator, `testimonialsData.ts` loader),
`src/data/testimonials.json` (`[]`), `src/data/README-testimonials.md` (fields, consent rules, photo rules, how to turn on).
Mounted with one line each in `Landing.tsx` (before pricing) and `PricingPage.tsx`. No testimonial section existed on the
homepage (the founder's "Why this exists" stays as the one honest piece of proof). With an empty file it returns before
mounting the flag hook: no heading, no spacing and no `/api/features` request. An entry needs `consent: true`; a photo
needs `photoConsent: true` and a `/testimonials/...` path. The crawler copy in `server.js` is built from
`seo-content.json` by the same validator. No Review/AggregateRating markup, by design.
Verified with a temporary populated file (reverted, not committed): flag on shows the consented entry in the client and
the raw HTML and drops the unconsented one; flag off shows nothing in either.

### 5. Comparison pages (`compare_competitors`, off)
- Copy: `src/data/competitorPages.ts` (`GATED_PAGE_MAP`), paths in `src/data/gatedComparePaths.ts`, meta in `COMPARE_META`
  in `server.js` (entries carry `flag: GATED_FLAG`).
- Flag off: server answers the branded 404 (noindex, no canonical) for both URLs; the client route renders nothing until the
  flag is known and then the 404 view; neither URL is in `sitemap.xml`, `llms.txt`, `llms-full.txt` or the noscript site
  nav; the copy is not in `dist/seo-content.json` but in `dist/seo-gated.json`, which the server reads and answers 404 for;
  the copy is a separate JS chunk fetched only when the flag is on and excluded from the service-worker precache
  (`vite.config.ts` `globIgnores`, one line).
- Flag on: 200, self-canonical, indexable; `sitemap.xml` gains two `<url>` entries at start-up, dated from the freshness
  ledger (flag off: the handler is not registered and `express.static` serves the file byte for byte); the noscript site
  nav lists them. **The visible React footer never listed any comparison page, so there was nothing to add there**; adding
  a flag hook to every page's footer would add an `/api/features` request to every marketing page view, so the server-side nav
  is the only "footer" that changes.
- Tooling: `sync-seo.mjs` dates the flagged pages in the ledger (never writes them into the sitemap or llms.txt) and checks
  their meta against their body; `generate-seo-content.mjs` writes `seo-gated.json`; `generate-og-images.mjs` renders their cards.
- To turn on: set `FEATURE_FLAGS=compare_competitors` in Coolify and restart. To turn off: remove it and restart.

### 6. Structured data
`SoftwareApplication` with three offers is in the shell and so on every route; `FAQPage` exists on `/`, `/pricing`,
`/how-it-works`, every compare page with an FAQ section and the two posts that render one. Fixed because they did not match what
the page shows: **`/pricing`** listed two questions that appear nowhere on the page (the page renders four others) and
**`/how-it-works`** listed three of five and used a dash where the page has a colon; both now equal the rendered FAQ word for
word, and a test renders the React pages and compares. No ratings, reviews or SearchAction anywhere (asserted).

## NEEDS HUMAN VERIFICATION: every competitor fact, with its source (read 2026-10-23)

Hands Off (`/compare/hands-off`)

| Fact on the page | Source |
|---|---|
| "a desktop app"; "Download for Mac" / "Download for Windows"; no browser version found | https://handsoffapp.com/ |
| "supports 5 common BFRBs, such as nail biting, skin picking, eyebrow/eyelash pulling, ear picking, and nose picking" | https://handsoffapp.com/ |
| "3 days free, then €2.99 monthly" (only plan shown; no annual or lifetime plan found) | https://handsoffapp.com/ |
| "All processing happens locally on your device, no webcam data ever leaves your computer"; "No video gets recorded"; "Fully GDPR compliant"; "No personal data is collected, stored, or shared with third parties during habit tracking" | https://handsoffapp.com/ |
| "full-screen alert"; three alert styles; sensitivity "from high ... to low" | https://handsoffapp.com/ and https://handsoffapp.com/faq |
| "daily detection counts, current streak length, weekly trends, and longest streak" | https://handsoffapp.com/faq |
| "The only network activity is a lightweight authentication check every 5 minutes to verify your subscription"; continues working offline with a grace period | https://handsoffapp.com/faq |
| "only works during computer use since it requires webcam access" | https://handsoffapp.com/faq |
| Made by Lennert Soffers, "struggling with nail biting for over 20 years" | https://handsoffapp.com/ |
| Not repeated: "70-90% reduction in episodes within the first week" (no study given) | https://handsoffapp.com/faq |

HabitAware Keen3 (`/compare/habitaware-keen`)

| Fact on the page | Source |
|---|---|
| "Preorder: Keen3 + 1 Year Pro Membership", **$199.00 USD**, "Estimated to ship in January 2027" (price confirmed twice: the page and the store's own product feed `.../keen3-bracelet.js`, 19900 cents) | https://habitaware.com/products/keen3-bracelet |
| "Includes one year of Keen3 Pro"; "After that, Pro is $99/year"; "vibrations and lessons keep working without Pro" | https://habitaware.com/products/keen3-bracelet |
| "evidence-based buzzing bracelet"; hair pulling, skin picking, nail biting; "90-Day Guarantee"; the pilot-study sentence (about hair pulling) and "A randomized controlled trial is now underway" | https://habitaware.com/ |
| motion sensors that "record the repetitive way you do the behavior"; "false alarms still happen"; up to two behaviours per band; works best with "behaviors related to hand/wrist motions near the head and face"; free app, iOS 13.0+ / Android 6.0+; "battery ... lasts a full day"; "designed for kids (ages 8+) and adults"; "cannot physically stop you" | https://habitaware.com/pages/faq-v1 |
| refund policy effective May 1, 2025 lists the Keen2 bracelet's 90-day returns and does not mention Keen3 | https://habitaware.com/policies/refund-policy |
| Not repeated: user and therapist counts, "90% show improvement", "100% of participants said they'd recommend it". Not assessed: the pilot study itself | https://habitaware.com/ |

How the facts were read: raw page text fetched with `curl` for handsoffapp.com (home, FAQ) and habitaware.com (home, FAQ,
refund policy), the Keen3 price from both the page (WebFetch) and the store's JSON feed. habitaware.com rate-limited
repeated requests (HTTP 429), so re-check the Keen3 page by hand.

Also for the owner: **the live `/compare/stop-biting-vs-habitaware` page (checked 5 October) says HabitAware's pages "do not
state a bracelet price".** HabitAware now lists Keen3 at $199.00 as a preorder (the product page is dated 9 October). That page
was not touched; refresh it, or it contradicts the new one once both are live.

## For WS9 (trial-length constant swap)

WS11a did not touch any "3-day" sentence, but it added or moved some. After merging, re-run the swap over: `src/data/competitorPages.ts`
(our own "3-day free trial", 6 places; **leave "3 days free" in the Hands Off quotations and sentences alone, that is Hands
Off's trial, not ours**), `server.js` `PRICING_FAQS` (now the same four answers as `PricingPage.tsx`, so two copies to keep in
step). The static `og:description` in `index.html` no longer mentions the trial. After the swap run `npm run seo:sync`
again: the freshness ledger fingerprints these pages.
`scripts/marketingSite.test.mjs` asserts the FAQ text is identical on both sides, so a swap that misses one copy fails there.

## Owner TODO

- [ ] Verify the tables above, then set `needsVerification: false` in `src/data/competitorPages.ts` and decide the overlap question.
- [ ] Testimonials: collect real, consented ones, add them following `src/data/README-testimonials.md`, deploy, then set `FEATURE_FLAGS=social_proof`.
- [ ] Align the privacy and terms pages' "camera feed never leaves your device" with the approved line (NEEDS HUMAN REVIEW; not edited).
- [ ] No env vars or `.env.example` changes. Flags are in `src/features/registry.ts`; nothing new was added.

## Tests added

- `scripts/marketingSite.test.mjs` (boots the real `server.js` on a free port with a scratch `DATA_DIR`, flags off and on;
  skipped when `dist/` is not built, so run `npm run build:web` first): gating (404, noindex, no canonical, absent from sitemap,
  llms files, noscript nav, `seo-content.json`, `seo-gated.json` 404), flag on (200, canonical, sitemap +2 with ledger dates,
  nav links), no testimonial markup while empty, no meta keywords + distinct descriptions, social card and theme colour, the
  retired-phrase zero-grep over served pages and generated files, JSON-LD required fields on 9 pages, FAQPage equals the
  crawler copy and the rendered React FAQ.
- `server/marketing/gatedPages.test.js`, `src/data/competitorPages.test.ts` (sources on every fact row, marker, no logos or
  ratings, retired phrases absent from all blog and compare copy), `src/components/site/testimonials.test.tsx`,
  `src/pages/comparePage.test.tsx`.

## Suggested corrections to ARCHITECTURE.md (not edited here, to keep wave-1 merges clean)

- Section 5 / 8: `server.js` now keeps `const { flags } = registerRoutes(...)` and reads it in page handlers; a COMPARE_META entry
  with `flag` is a flagged page. `dist/seo-gated.json` is the unpublished copy (never served).
- Section 5: "pages that never read a flag make none": still true for every page except the two gated compare URLs (client route).
- Section 8: `generate-seo-content.mjs` also writes `dist/seo-gated.json` and `testimonials` into `seo-content.json`.
- Section 9: the service-worker precache has 21 entries; `competitorPages-*.js` is deliberately excluded.
- Section 14: `scripts/sync-seo.mjs` contains a literal NUL byte (`parts.join('\x00')`); edit it with a bytes-safe script.
- Sub-agent/tooling gotcha: `export` in front of `const NAME =` / `function NAME(` in `comparePages.ts` would stop
  `sync-seo.mjs` from following shared sections (it matches the declaration at line start), moving every page's freshness date.
  The helpers are exported with a trailing `export { ... }` list for that reason.
