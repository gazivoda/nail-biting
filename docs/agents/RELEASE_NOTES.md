# Stop Biting: release notes for the owner

Written by WS13 on 2026-10-24, first against `main` at b6b16f9 (WS11b merged), then updated after WS12a (localization of the app screens) and the
SEO session's `origin/main` commits were merged. WS12b (the marketing pages in es, de and pt-BR) was merged last and is described below
(section (a), `docs/agents/ws12b-notes.md`); the orchestrator re-ran the gates, the Dockerfile reproduction and the privacy audit on the final tree.

How to read this: every new feature is switched off. With `FEATURE_FLAGS` empty the site behaves as it did before, apart from
the WS11a site fixes (privacy wording, meta tags, FAQ markup), which are meant to be visible. The detail for each workstream is in
its `docs/agents/wsN-notes.md`; this file is the part you need to act on. Where a notes file and the code disagreed, the code
was trusted and the difference is listed in the appendix at the end.

Contents: **Read first** · (a) What was built · (b) The 28 flags, and the order to turn them on · (c) Environment variables and
build arguments · (d) Things only a human can review or verify · (e) Known gaps and what was not verified · (f) Deploy notes ·
(g) Rollback · Appendix: notes versus code · QA results.

---

## Read first (before you flip anything)

1. **Flags are read when the server starts.** Edit `FEATURE_FLAGS` in Coolify (comma separated names), restart, no rebuild. Check
   `https://stopbiting.today/api/features`: all 28 names are listed as `true` or `false`. Unknown names are ignored and logged at boot.
2. **Delete line 24 of `COOLIFY_DEPLOY.md` (`ELECTRON_PROTOCOL=stopbiting`) and make sure the Coolify environment of the web app does
   not set it.** It is a switch for the desktop sign-in flow that applies to the whole server. If it is set, Google sign-in on the
   website redirects to `stopbiting://` instead of setting the cookie, and two server jobs silently stop: the trial follow-up email
   (`server.js:3049`) and the weekly summary email (`server/routes/weeklyEmail.js:167`). Web sign-in works today, so it is almost
   certainly not set, but nothing in the repo proves it. I did not edit that file (it has your uncommitted change in a stash).
3. **The legal pages are code, not flags.** No agent edited `PrivacyPage.tsx`, `TermsPage.tsx`, `RefundPage.tsx`, `LegalPage.tsx` or
   their `server.js` mirrors. Several flags make sentences on those pages untrue the moment they go on (history "stays in your
   browser", "Google sign-in only", "3-day trial", nothing about referrals, gifts or share links). Deploy the matching wording in the
   same release as the flag. The exact sentences are in section (d).
4. **Keep `desktop_app` and `experimental` off.** Desktop sign-in does not work against the hosted server, the Mac app is unsigned and
   the Windows app has never been built (`docs/agents/ws7b-notes.md`). The four experimental behaviours were tuned on scenes drawn by
   the person who wrote the rules. The three `locale_*` flags show a machine translation of the signed-in app that no native speaker has read (section (b)).
5. **Turn `share_links` on a day or two after the deploy that contains it, and together with `event_sync`.** A link shows synced
   history only, and an old service worker can answer `/share/...` with the cached app shell (which loads Google Analytics with the
   token in the address). Details in (f).
6. **Nothing here was run against a real Paddle, Apple, Microsoft or Resend account, a real camera and hand, a real phone, a signed
   desktop build, or Safari, Firefox and Edge.** Section (e) lists what that means flag by flag.
7. **Your Paddle price filter is still in a stash** (`PADDLE_PRICE_IDS`). Restore it after the last push and add the lifetime and gift
   ids to it. Steps in (f).
8. **`TRIAL_DAYS` is a build argument and a runtime variable.** The default stays 3 days. Changing it means setting it in both places
   and hand-editing 4 + 3 sentences. Steps in (f).

### What is live today and what is not (from `tasks/todo.md`)

| | |
|---|---|
| Already on production | PUSH #1, `origin/main` at ffbf29a: WS0 to WS5, WS7b, WS8 to WS11a, all 27 flags off. The only visible differences are the WS11a site fixes. |
| **Moved since** | `origin/main` is no longer ffbf29a: another session (the SEO traffic work) pushed a2f94c5 and 46a484c ("Record verified SEO release...") on top of it. **`main` has since merged it (`f871859`)** and the WS13 branch has merged `main`, so a push after WS13 merges is a fast-forward. If you ever see "rejected, non-fast-forward", `origin/main` moved again: merge it first, then re-run `bash scripts/qa/gates.sh`. |
| Not on production yet | WS6 (phone view), WS7a (background watching), WS11b (feature pages and flag-aware copy), WS12a (localization of the app, flags off), WS12b (localized marketing pages, flags off) and the WS13 fixes, which go out with PUSH #2. |
| Migrations | All 13 additive migrations (list in (f)) came with PUSH #1. WS6, WS7a and WS11b add none. |

---

## (a) What was built

Every paragraph says what it is and what to expect. "Validated" below never means "measured on real people": no real footage exists
yet.

**WS0, Foundation** (`ws0-notes.md`). The shared groundwork. A new history record format ("schema v2") that is a superset of the old
one, so streaks and counts are identical; the first time a browser loads it, the old data is copied once to
`stop-biting-state-v1-backup`. One storage module that all later features use (a lint rule and a test forbid anything else from
touching browser storage). The 27 feature flags, all off. A route registry on the server so features do not pile into `server.js`,
helpers for additive database migrations, a generic `sendEmail`, and seven empty, flag-gated Settings sections.

**WS1, More behaviours** (`ws1-notes.md`, `ws1-eval-report.md`). Detection is now a set of rules per behaviour: nail biting, cuticle
and skin biting (the same mouth rule under another name, so the two are mutually exclusive in the list), nose picking, eye-area
pulling, face skin picking and hair pulling. Settings > Behaviors chooses which to watch; History can filter by behaviour; every alarm
records its behaviour. Nail biting was proved frame for frame identical to the old detector. An evaluation script replays 35 synthetic
landmark scenes (`npm run eval:detection`). Only nail and cuticle biting are marked "validated", and only on drawn scenes; the other
four are "experimental" and stay hidden unless `experimental` is on.

**WS2, Coaching** (`ws2-notes.md`). After an alarm an optional card offers your chosen competing response (15 to 60 seconds, Done or
Skip, Escape closes it); it can never block, delay or silence the alarm. An "I feel an urge" button starts a 60 or 90 second breathing
timer and logs an urge, which is not a bite and does not reset the streak. A 4-week program of 28 short daily lessons, one new
lesson a day, works offline. **The lesson text is a first draft with no clinical input and needs your review.**

**WS3, Fewer false alarms** (`ws3-notes.md`, `ws3-eval-report.md`). A "Not a bite" button (alarm toast, mini window, History) that keeps
the entry out of every count and teaches the detector, a chin-rest rule, a hand filter (both, left, right), an optional one-minute
calibration and a false-alarm rate in words. What it learns is six numbers per tap, kept in the browser only and never sent. On the
synthetic scenes false alarms for nail biting went from 17 to 13 with the same 9 of 9 bites found. Those scenes were drawn to match the rule, so this
is a regression guard, not an accuracy claim.

**WS4, Optional sync and backup** (`ws4-notes.md`). Off until a person switches it on. Only the history record's whitelisted fields
are sent (never video, frames, landmarks, photos or calibration data); the server refuses anything else. Last write wins, deletions
sync, two browsers converge. "Delete synced data" and "Delete everything" in Settings > Data. Export (JSON, CSV) and import work
with no account and no network.

**WS5, Insights, photo diary, weekly email** (`ws5-notes.md`). A History / Insights switch: bites per day and week, last 7 days
against the 7 before, hour-by-weekday heatmap, what sets it off, competing-response and false-alarm rates, milestones (first hour
without a bite, first day, 7 days, 30 days, 100 alarms) with a celebration card and a stats-only share picture. A hands-only photo
diary with a before/after slider, stored only in the browser. An opt-in weekly summary email built from synced events, with a
one-click unsubscribe.

**WS6, Phone companion** (`ws6-notes.md`). On a phone, `/` shows a view with no camera: two big buttons ("I bit", "I feel an urge"),
streak, today's count, recent entries, the breathing timer, an honest line about where entries are stored. Logging takes one or two
taps. Entries sync with the computer when sync is on. The installed app opens offline from a small saved copy of the access facts;
home-screen shortcuts on Android; iOS tags and icons. Not tried on a real phone.

**WS7a, Background watching** (`ws7a-notes.md`). In a hidden Chrome tab detection used to run about once a second (the alarm took
1.2 s in the first minute hidden and 3.0 s after ten minutes); with the flag on it keeps 5 checks a second for the 700 s that were
measured (alarm in 0.4 to 0.5 s). It uses the mini
window's timers, else a same-origin worker, else the old interval. Pause for 15 minutes, 1 hour or until tomorrow; meeting mode
(silent, flash only); work-hours schedule with a "Start watching?" reminder; the desktop tray's pause items work. The cost is CPU
while hidden (12.9 against 2.9 points of one core). The reminder for a closed app was **not** built.

**WS7b, Desktop wrapper** (`ws7b-notes.md`, `docs/DESKTOP_SIGNING.md`). The Electron app that already existed gained a tray icon and
menu, launch at login, native notifications, a camera explanation card, the pause bridge for WS7a, a universal Mac build and a CI
workflow. It is not offered anywhere. Signing in from the packaged app does not work against the hosted API, the Mac build is
unsigned, and Windows was never built.

**WS8, More ways to sign in** (`ws8-notes.md`). Emailed sign-in link, Sign in with Apple, Sign in with Microsoft, next to Google. One
person with the same verified address ends up in one account (Microsoft work and school accounts that do not confirm their address
are asked to use the emailed link once). A method appears only when its flag is on **and** its keys are set. New page `/signin`.
No real provider or mailbox was involved in any test.

**WS9, Pricing, trial, referrals** (`ws9-notes.md`). The trial length is one setting (`TRIAL_DAYS`, default still 3). Behind flags: a
free plan (placeholders: 30 minutes of detection a day, 7 days of History), a Lifetime plan, gift purchases redeemed at `/redeem`,
referral links (30 days for each side by default) and Paddle-localised prices. One function decides access for trial, monthly,
yearly, lifetime, gift, referral credit, free plan and expired. The Paddle webhook is idempotent and handles purchases and refunds.
Nothing was tried against Paddle, even the sandbox.

**WS10, Share link** (`ws10-notes.md`). A signed-in person makes a read-only link (7, 30 or 90 days, or no expiry; at most 5 active)
that opens a calm summary page without sign-in: counts, reasons in five fixed groups (stress, focus, boredom, unknown, other), competing-response rate, streak, and dates only if the
person ticked "detailed". Revoking is immediate. The page is its own document: no analytics, no cookies, `noindex`, no referrer.

**WS11a, Site fixes** (`ws11a-notes.md`). Live today: privacy wording tightened to *Detection runs on your device. No camera data is
sent while it runs.* across blog posts, compare pages, How it works and the PWA guide; keywords tag removed; FAQ markup now matches
the page; the old social image replaced. Behind flags: a testimonials section that stays hidden while its data file is empty
(`social_proof`) and two competitor pages, `/compare/hands-off` and `/compare/habitaware-keen` (`compare_competitors`), whose facts
are marked as needing your verification.

**WS11b, Marketing for the new features** (`ws11b-notes.md`). Six pages that exist only while their own flag is on (otherwise the
normal 404, not in the sitemap or `llms` files): `/features/habit-reversal-coaching`, `/features/phone-companion`,
`/features/share-with-therapist`, `/features/referral-program`, `/features/desktop-app` and `/solutions/cuticle-biting`. Existing
sentences that stop being true with a flag on (history stored in the browser, Google-only sign-in, phone support) now change with the
flag. Pages for skin picking, nose picking and hair pulling were deliberately **not** built: those behaviours are not validated.

**WS12a, Localization of the signed-in app** (Spanish, German, Brazilian Portuguese; `docs/agents/ws12a-notes.md`). Every string of the signed-in
screens now goes through a small translation layer (`src/i18n/`), with machine-drafted catalogs for es, de and pt-BR, one flag per language
(`locale_es`, `locale_de`, `locale_pt_br`, all off). With a flag on, Settings > Account & Sync gets a Language card; a person's choice is kept on
their device and the browser language is never read. Dates, numbers and money follow the language. Lint rules and tests fail any English
that is not translated. Marketing pages, the blog, legal pages, the 28 coaching lessons, server-rendered pages and emails stay English.
**WS12b, Localized core marketing pages** (`docs/agents/ws12b-notes.md`). The home page, /how-it-works, /pricing and /about, with their header, footer,
closing call to action, trial button, pricing section, FAQ, contact form, demo text and 404 page, in Spanish, German and Brazilian Portuguese at `/es`, `/de` and
`/pt-br` (311 messages per language, machine drafts marked NEEDS NATIVE REVIEW). **Three states per language**: flag off (production today) gives the
branded 404, no sitemap entry, no hreflang and no language switcher; flag on with `reviewed = false` gives a page for QA that is `noindex` (meta tag and
`X-Robots-Tag`), not in the sitemap and not named in any hreflang; flag on with `reviewed = true` gives indexable pages with a self canonical, reciprocal
hreflang plus x-default, sitemap alternates, localized meta and JSON-LD and `<html lang>`. A language switcher in the header and footer appears only while a
language is being served; it never redirects by browser language. Not translated: the blog, compare and solutions pages, the WS11b feature pages, the
calculators, the legal pages, llms files and emails. One `reviewed` marker per language covers the app and the marketing pages.

---

## (b) The 28 flags

Columns: **Needs** is the `dependsOn` field in `src/features/registry.ts` (advisory: the server only logs a warning at boot, nothing is
switched off). **Do first** is the `before` field plus what the notes add. Paths are relative to the repo root.

| Flag | What it does | Needs | Do first (human) | Risks |
|---|---|---|---|---|
| `detection_behaviors` (WS1) | Settings > Behaviors, History filter by behaviour. Without `experimental` only nail biting and cuticle/skin biting can be chosen. Opens `/solutions/cuticle-biting`. | | Nothing required. Decide when. | Home hero, home FAQ, `llms.txt` still say "nail biting only" (left on purpose). The OS notification still says "Nail biting detected" for any behaviour. Streak and the "was it a bite" card are not per behaviour. |
| `experimental` (WS1) | Also lists nose picking, eye-area pulling, face skin picking, hair pulling. | `detection_behaviors` | Record real fixtures, set the bars in `scripts/eval-detection/thresholds.json`, promote in `src/detection/registry.ts` (`ws1-notes.md`). Check the nose landmarks (indices 1 and 2) on a rendered mesh. | **Keep off.** Tuned on drawn scenes. Hair pulling needs the camera framed high. |
| `hrt_coaching` (WS2) | Competing-response prompt (still off per person until they choose it in Settings > Alerts), Settings > Alerts, the 4-week program. Opens `/features/habit-reversal-coaching`. | | Read all 28 lessons in `src/data/hrtProgram.json`; set each `reviewed` to `true` and the top-level `status` to `"reviewed"`; make the same edit in `src/coaching/program.test.ts`, which asserts the draft state on purpose. Re-read lessons 9, 11, 12, 17 (they name app screens). | Lesson text overreaching into medical claims. Three different coaching sentences can be on screen (flash, post-alarm card, your response). |
| `urge_timer` (WS2) | "I feel an urge" button and 60/90 s breathing timer. | `hrt_coaching` (advisory only, see appendix) | Nothing required. | An urge is a manual entry that does not count as a bite. A stale tab on an older bundle would count it as one. |
| `false_positive_controls` (WS3) | "Not a bite", chin-rest rule, learned poses, hand filter, calibration, false-alarm rate. | | Publish `docs/agents/legal/ws3-privacy.md` wording. Record real chin-rest and bite fixtures and re-tune `CONTROLS_CONFIG` (`src/detection/controls.ts`). On a real device check left/right: if swapped, flip `HANDEDNESS_INPUT_IS_MIRRORED` (`src/detection/handedness.ts`). | Thresholds (0.25, 0.15, 0.2 face widths) were tuned on drawn scenes. A hand filter other than "Both" makes the tracker follow two hands (CPU not measured). |
| `event_sync` (WS4) | Opt-in sync, "Delete synced data" (Settings > Account & Sync, Data). | | Publish `legal/ws4-privacy.md` and `ws4-terms.md` and edit Privacy sections 2, 3, 4, 7, 8, 9, 11 and Terms section 2 (tables in (d)). Fill `TODO(owner)` hosting provider. Decide the quota (50,000 rows per account, `EVENTS_QUOTA_PER_USER`). Decide whether habit logs count as health data where you operate. Try two real browsers on staging. | The server now keeps habit rows until someone deletes them, including for lapsed accounts. Custom bite reasons are not synced; streak start dates are per device. |
| `data_backup` (WS4) | Export (JSON, CSV) and import, with or without an account. | | Nothing required (portability sentence in `legal/ws4-privacy.md`). | Low. Import shows a preview before it applies. |
| `insights` (WS5) | History > Insights: charts, heatmap, milestones, share picture. | | Look at the charts on your own data. Small wording in `legal/ws5-privacy.md` section 3. | The celebration card appears over the app. Milestones read "time since your last logged bite". |
| `photo_diary` (WS5) | Local-only hand photo diary, weekly reminder strip, Settings > Data card. | `insights` (advisory; alone it shows a "Photos" view) | Publish `legal/ws5-privacy.md` section 2. Try it with a real camera. Decide whether "Delete everything" should also delete photos (it does not today; one call in `src/pages/settings/DataSettings.tsx`). | Photos live only in this browser (IndexedDB) and vanish with site data. A hand photo can identify a person. |
| `weekly_email` (WS5) | Opt-in weekly summary email (Settings > Account & Sync). | `event_sync`, `insights` (the job itself needs only `event_sync`) | Verify the Resend sender domain (`EMAIL_FROM`), send yourself a test week, read the wording, publish `legal/ws5-privacy.md` section 1 and `ws5-terms.md`. Needs `RESEND_API_KEY`; the job does not run if `ELECTRON_PROTOCOL` is set. | The Resend result shape was read from the SDK, not seen live. Opted-in people with a lapsed account still get it. Apple relay addresses need the sending domain registered with Apple. |
| `phone_companion` (WS6) | Phone view, installable shortcuts, offline start. Changes `TrialButton` on phones. | | Try on a real phone (Add to Home Screen, airplane mode on and off). Confirm the Privacy page's local-storage wording covers `sb:phone:grant`. | No real iOS or Android install was tested. On the first visit after the flag turns on, the camera dashboard shows briefly. iOS ignores manifest shortcuts. |
| `background_watching` (WS7a) | Full-rate hidden-tab detection, pause, meeting mode, schedule and reminders. | | Try it with your real camera: start detection, minimise, work elsewhere for ten minutes, check the alarm and the silent meeting mode. Try the desktop tray's pause items. | Only headless Chrome 155 was measured. Hidden-tab CPU costs about 10 points of one core. Safari and Firefox fall back to about once a second. No reminder with the app closed. |
| `desktop_app` (WS7b) | Desktop page and links. Opens `/features/desktop-app`. | | **Do not turn on.** Fix desktop sign-in (server work), sign and notarize (`docs/DESKTOP_SIGNING.md`), build Windows, link the installer on the page (`getDesktopAppContent()` in `src/data/featurePages.ts`). | Two sentences on the page are only true after desktop sign-in works. |
| `signin_magic_link` (WS8) | Emailed sign-in link. Once any `signin_*` is on, "Sign in" and "Start free trial" lead to `/signin`. | | `RESEND_API_KEY`, `EMAIL_FROM` on a Resend-verified domain, and **Resend click and open tracking OFF** for it. Review the composed FAQ answer (d). Publish `legal/ws8-*.md`. | The link works once for 15 minutes. Per-address and per-caller limits exist; there is no `trust proxy` (e). |
| `signin_apple` (WS8) | Sign in with Apple. | | Apple Services ID, return URL `https://stopbiting.today/auth/apple/callback`, domain verification file pasted into `APPLE_DOMAIN_VERIFICATION`, `.p8` key, and register the `EMAIL_FROM` domain for Apple's private relay (steps in `ws8-notes.md`). | Cannot be tested on localhost. Never run against Apple. Without the relay registration, mail to "Hide my email" users is dropped. |
| `signin_microsoft` (WS8) | Sign in with Microsoft. | | Entra app registration, redirect `https://stopbiting.today/api/auth/microsoft/callback`, optional ID-token claims `email` and `xms_edov`, calendar the secret's expiry (24 months at most). | Work and school accounts without `xms_edov` are asked to use the emailed link once. Never run against Microsoft. |
| `free_tier` (WS9) | A free plan (placeholder 30 min/day, 7 days of History). **Accounts whose trial ended or lapsed get the free plan instead of the paywall.** | | Decide the limits (`FREE_TIER_DETECTION_MINUTES`, `FREE_TIER_HISTORY_DAYS`). Publish `legal/ws9-terms.md` section 4. | This changes what expired people see, so watch trial-to-paid conversion. Minutes are counted in the browser and reset by clearing site data. |
| `lifetime_plan` (WS9) | Lifetime card on `/pricing`, lifetime plate in the paywall. **Also the words crawlers and AI assistants read** (`<title>`, description, crawler article, the product node's offers on every page, the noscript nav, `llms.txt`, `llms-full.txt`): they name the Lifetime plan and its price **only while the flag is on and the server has `PADDLE_PRICE_ID_LIFETIME`**, so they follow the card. **These visible English strings follow the flag too, by the same condition, in the page, the crawler article and the FAQPage data (`shared/flagCopy.js` RULES; the catalogs keep today's text):** the `/pricing` FAQ answer "pick the monthly or yearly plan to keep going" (now "pick the monthly, yearly or Lifetime plan"); the question "What is the difference between Monthly and Yearly?" (now "...Monthly, Yearly and Lifetime?") and its answer ("Both plans include" now "Every plan includes", plus the card's own sentence on Lifetime); homepage FAQ 1 ("$2.99 a month or $29 a year" gains "or a one-time Lifetime payment") and FAQ 8 (the same, and "cancel anytime" now says it is for a monthly or yearly plan). No Lifetime price, saving or "best deal" is in them. **The same condition also words, in English and from `LIFETIME_PRICE_USD`, every sentence that quotes Stop Biting's price on the compare and solutions pages and two posts** (lane F, `shared/flagCopy.js` RULES `price-list`, `price-list-short` and sixteen sentences with their own wording): "$2.99/month or $29/year" becomes "$2.99/month, $29/year or $99 once" in sentences, table cells and FAQ answers (and in the FAQPage data), "Stop Biting is a subscription" becomes "a subscription, or a one-time Lifetime plan", and the offer at the foot of every compare and solutions page names the plan. Competitor facts, prices and conclusions, and every title and description, are untouched. **The section heading `pricing.heading` now follows the flag too**, on the homepage section and the `/pricing` page and in the crawler `<h1>`/`<h2>`: "$2.99 a month, <mark>$29 a year,</mark> or $99 once." (your first candidate, with the price in place of "pay once"; the words live in `lifetimeHeadline()` in `shared/flagCopy.js` if you prefer the other highlight). The catalog message is unchanged, so flag off and the other languages say what they said. The es, de and pt-BR pricing FAQ (drafts) still say two plans: a translator words the Lifetime sentences before a language is marked `reviewed`. | | Create the Paddle product; set `VITE_PADDLE_PRICE_ID_LIFETIME` (build) and `PADDLE_PRICE_ID_LIFETIME` (runtime); add `transaction.completed`, `adjustment.created`, `adjustment.updated` to the webhook destination; publish `legal/ws9-terms.md` section 1 and `ws9-refund.md`; one sandbox purchase. **If the Paddle price is ever not $99, change `LIFETIME_PRICE_USD` (runtime variable, restart) to the same number, and the `$99.00` in `src/pages/TermsPage.tsx`, which is your wording and is not read from it.** | A paid lifetime is honoured even with the flag off. Unmatched payments need a hand-made `entitlements` row. The boot log says `[marketing] lifetime_plan: pricing copy names the Lifetime plan ($99 ...)` when the copy is on, and warns when the flag is on without the runtime price id (the card may show, the copy will not). The `/pricing` freshness date does not move when the copy appears (a flag-dependent sentence stays out of the ledger fingerprint, by design). |
| `gift_plan` (WS9) | Gift purchase, `/redeem`. | | Same Paddle steps with `VITE_PADDLE_PRICE_ID_GIFT` and `PADDLE_PRICE_ID_GIFT`; set `GIFT_PLAN_DAYS` to match the product; `EMAIL_FROM` on a verified domain or the buyer's email reaches nobody; `legal/ws9-terms.md` section 2. | A refunded gift that was already redeemed takes access from the recipient (your call, `server/billing/gift.js`). A lost link is a support case. |
| `referrals` (WS9) | Personal `?ref=` link, reward on the referred person's first payment. Opens `/features/referral-program`. | | Set `PADDLE_PRICE_ID_MONTHLY` and `PADDLE_PRICE_ID_YEARLY` (or `PADDLE_PRICE_IDS`) in the **runtime** environment, or no reward is ever paid. Same webhook events as above. Decide `REFERRAL_CREDIT_DAYS`. `legal/ws9-terms.md` section 3. | A second card, a wallet that shows no card, or another email defeats the fraud checks. No cap per referrer. |
| `regional_pricing` (WS9) | Paddle-localised prices on the pricing section and paywall. | | Enable localised pricing in Paddle. Needs `VITE_PADDLE_CLIENT_TOKEN` and the monthly and yearly ids in the build. | Any failure falls back to $2.99 and $29. `Paddle.PricePreview` without an address was not tried. |
| `share_links` (WS10) | Settings > Sharing, `/share/<token>`. Opens `/features/share-with-therapist`. | `event_sync` (not enforced: no `dependsOn`, see appendix) | Publish `legal/ws10-privacy.md` and `ws10-terms.md`. Decide whether `/share/` stays out of access logs. Turn on a day or two after the deploy. | The address is a bearer secret and may appear in host logs. A chat app that previews the link counts as a view. The streak shown can differ from the app's streak. |
| `compare_competitors` (WS11a) | Two competitor pages, indexable and in the sitemap only while on. | | Verify every fact against its source URL (`ws11a-notes.md` tables), then set `needsVerification: false` (`src/data/competitorPages.ts`, 2 places) and redeploy. Decide whether to run these next to the live `vs` pages. Refresh the live `/compare/stop-biting-vs-habitaware`. Re-date both `COMPARE_META` entries in `server.js`. | Competitor facts may be out of date (habitaware.com rate-limited the fact check). |
| `social_proof` (WS11a) | Testimonials on the home and pricing pages. | | Add real, consented entries to `src/data/testimonials.json` following `src/data/README-testimonials.md`, deploy, then turn on. | Hidden anyway while the file is empty. |
| `locale_es`, `locale_de`, `locale_pt_br` (WS12a) | A Language card in Settings > Account & Sync; the signed-in app in that language for people who pick it. | | A native speaker reads `src/i18n/locales/<language>/*.ts` (app: glossary in `ws12a-notes.md`) and `marketing-*.ts` (marketing pages: `ws12b-notes.md`), fixes the wording, sets `export const reviewed = true;` in `src/i18n/locales/<language>/reviewed.ts` (`index.ts` only re-exports it) and flips the matching expectation in `src/i18n/catalogs.test.ts`; then add the flag. Until `reviewed` is true the localized marketing pages are noindex and out of the sitemap; one marker covers the app and the marketing pages. WS12b's catalogs and routes are live only with the flag. | Machine translation of health-adjacent copy; text length changes layouts (German was checked at 390 px: no sideways scroll). |
| `app_analytics` (WS14) | Sends two in-app milestones to Google Analytics as counts with no parameters: `detection_start` (detection really started with the camera on; at most once per page load) and `first_alarm` (the detector fired for the first time on this device). `signin_complete` is NOT behind this flag (it is not a camera signal and the current Privacy wording covers it). | | **Do NOT turn on until the privacy sentence in `docs/agents/legal/in-app-analytics-privacy.md` is approved and applied.** The Privacy Policy says Google Analytics "never receives anything from your camera or your habit log"; these two events are signals from the camera and the habit detector even without parameters. The draft lists every other sentence that changes with it and the exact order (publish the wording first, then the flag). | A person watching their Network tab will see a Google Analytics request at the start of detection and one at the first alarm. The privacy audit passes with the flag on (it checks for images, landmarks and video, not event names), so a green audit does not mean the wording is honoured. A "first alarm" fires once for every existing user's device on its next alarm after the flag is turned on; segment on new users in Google Analytics. |

### Recommended turn-on order

One flag at a time, a day or so apart, watching false-alarm rate, trial-to-paid conversion and churn after each (your plan's own
rule). Restart after each change.

0. **Before any flag:** ship PUSH #2, delete the `ELECTRON_PROTOCOL` line, confirm `/api/features` shows all `false`, and wait a day or
   two so returning visitors' service workers update (this is also what makes step 3 safe).
1. **Local only, nothing to publish:** `data_backup`, `insights`, `urge_timer`, optionally `detection_behaviors` (only cuticle/skin
   biting becomes selectable). Reason: no new data leaves the browser and nothing needs a legal change.
2. **Local, after a short check:** `false_positive_controls` (publish the ws3 privacy text; tune on real fixtures first),
   `background_watching` (after you have tried it on your own camera), `photo_diary` (after the ws5 text and a real-camera try),
   `phone_companion` (after a real phone), and `hrt_coaching` **last of this group**, only after you have read and signed off all 28 lessons.
   Reason: these change what the app does on a person's own device and each has a "try it for real" step nobody could do.
3. **Data on the server, with the legal pages:** `event_sync` first (it is the base for three other features), and
   `share_links` with it or just after, a day or two after the deploy that contains it. Then `weekly_email` once the Resend sender
   domain is verified and you have received a test email. Reason: each stores or reads synced rows and each needs a wording change in the Privacy page and Terms.
4. **Sign-in, one method at a time:** `signin_magic_link` (needs only Resend), then `signin_microsoft`, then `signin_apple` (the most
   setup). The first one you turn on moves every "Sign in" button to `/signin`. Review the generated "Do I need a Google account?" answer first.
5. **Money, sandbox first:** `regional_pricing`, then `lifetime_plan`, `gift_plan` (one at a time, one sandbox purchase each),
   then `referrals` (only after the runtime price ids are set and a full sandbox referral has paid out), and `free_tier` **last**,
   because it replaces the paywall for people whose trial ended.
6. **Marketing:** `compare_competitors` after the verification, `social_proof` after real testimonials. The six `/features/...`
   pages need no extra flag: each opens with its feature flag, so re-read its copy when you turn the feature on.
7. **Not yet:** `desktop_app`, `experimental`; each `locale_*` flag only after a native speaker has read that language.
8. **Analytics, after the legal text:** `app_analytics` only after the sentence in `docs/agents/legal/in-app-analytics-privacy.md` is approved, published in the same release, and its other copies are changed. The draft has the exact steps. `signin_complete` needs no flag and no wording change.

---

## (c) Environment variables and build arguments

**Where to set them in Coolify.** *Build argument* = baked into the site when it is built (the Dockerfile declares 8 `ARG`s: marked
**B** below). *Runtime* = read by the running server (**R**). *Both* = needed in both places with the same value. Which build pack
production uses is not stated anywhere in the repo (see (f)); under the Dockerfile pack the build arguments must be passed as
build arguments, under Nixpacks an ordinary variable that is available at build time is what the build sees (Coolify's wording for
that option cannot be checked from here). A line in a `.env` file is **not** enough for anything marked B.

### New since the project started

| Variable | Set as | Default | Required? | Used for |
|---|---|---|---|---|
| `FEATURE_FLAGS` | R | empty = all off | no | Comma or space separated flag names. Case-insensitive. Unknown names ignored. No "all". |
| `TRIAL_DAYS` | **Both** (B and R) | 3 | no | Trial length, whole number 1 to 90 (anything else is ignored and logged). Boot logs a warning if `dist` and the server disagree. |
| `VITE_PADDLE_PRICE_ID_LIFETIME`, `VITE_PADDLE_PRICE_ID_GIFT` | B | empty | for those plans | The app shows the Lifetime and Gift options only when its id is present in the build. |
| `PADDLE_PRICE_ID_LIFETIME`, `PADDLE_PRICE_ID_GIFT` | R | empty | for those plans | The webhook recognises these two payments as ours. The Lifetime one (or `VITE_PADDLE_PRICE_ID_LIFETIME`, if your host also passes build variables to the running app) also switches on the Lifetime wording on the crawler-facing pages. |
| `LIFETIME_PRICE_USD` | R | 99 | no | The Lifetime list price in whole US dollars, used **only** for the words and the schema of `/pricing`, the homepage, `llms.txt` and `llms-full.txt`. **It must equal the Paddle price**; the visible price comes from Paddle, so nothing else notices a mismatch. Also change the `$99.00` in `src/pages/TermsPage.tsx`. |
| `PADDLE_PRICE_ID_MONTHLY`, `PADDLE_PRICE_ID_YEARLY` | R (also read from the `VITE_` spellings if those happen to exist at runtime) | empty | for referral rewards | A payment is rewarded only if its price is positively one of ours. The `VITE_` ones are build arguments and are normally not in the server's environment. |
| `PADDLE_PRICE_IDS` | R | empty | with a shared Paddle account | Comma separated list of every price id of this app, archived ones included. Read by WS9 code today and by your stashed filter later (see (f)). |
| `REFERRAL_CREDIT_DAYS` | R | 30 | no | Bonus days for each side. Also fills the sentence on `/features/referral-program`. |
| `GIFT_PLAN_DAYS` | R | 365 | no | How long one gift lasts. Must match the Paddle gift product. |
| `GIFT_CODE_EXPIRY_DAYS` | R | never | no | Days after which an unredeemed gift link stops working. |
| `FREE_TIER_DETECTION_MINUTES`, `FREE_TIER_HISTORY_DAYS` | R | 30 and 7 (placeholders) | no | Free plan limits, only when `free_tier` is on. |
| `EVENTS_QUOTA_PER_USER` | R | 50000 | no | Most synced entries one account may store. |
| `APPLE_CLIENT_ID` (the Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | R | empty | for Apple sign-in | The `.p8` contents may use `\n` or be base64. |
| `APPLE_DOMAIN_VERIFICATION` | R | empty | once, for Apple | Contents of Apple's domain file, served at `/.well-known/apple-developer-domain-association.txt` while set. Works without any flag. |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | R | empty | for Microsoft sign-in | The secret's value, not its id. |
| `MICROSOFT_TENANT` | R | `common` | no | `consumers`, `organizations` or one tenant id. |

Optional means optional: with all of the above empty the site behaves as it always did. A sign-in method is offered only when its
flag is on **and** its keys are set (`GET /auth/providers` is the truth).

### Already existing, listed so nothing is missed

| Variable | Set as | Default | Notes |
|---|---|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET` | R | none | Required; the server exits at boot without them. |
| `APP_URL` | R | `http://localhost:<PORT>` | Must be the public `https://stopbiting.today`; Apple refuses anything else. |
| `PORT` (3000), `DATA_DIR` (`/app/data` in Docker) | R | | Mount a persistent volume at `DATA_DIR`; `users.db` lives there. |
| `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` | R | none | `PADDLE_API_KEY` is also needed for gift buyers' emails and `verify-transaction`. |
| `VITE_PADDLE_ENV` | **Both** | | `production` picks the live Paddle API; the server reads `VITE_PADDLE_ENV` or `PADDLE_ENV`. |
| `PADDLE_ENV` | R | | Server-side alternative to `VITE_PADDLE_ENV`. |
| `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_PRICE_ID_MONTHLY`, `VITE_PADDLE_PRICE_ID_YEARLY`, `VITE_FORMSPREE_FORM_ID` | B | | Baked into the bundle. |
| `RESEND_API_KEY`, `EMAIL_FROM` | R | none; the sender falls back to a Resend sandbox address that only delivers to the Resend account owner | Needed for the emailed link and gift emails; without the key the weekly-email and trial follow-up jobs do not start. |
| `ALLOWED_ORIGINS` | R | `http://localhost:5173,http://localhost:3000` (plus `APP_URL`) | Optional CORS allow-list for `/api/`. |
| `ELECTRON_PROTOCOL` | **must be unset** on the web server | | See Read first, item 2. |
| `SOURCE_COMMIT` or `COMMIT_SHA` | R | `unknown` | Shown by `GET /health`. |

`NODE_ENV` is read in one place (`server/routes/index.js`, as `ctx.config.isProduction`) and no route module uses it, so it changes
nothing today. Not Coolify variables: `API_BASE_URL` (the packaged desktop app's server, default `https://stopbiting.today`),
`CHROME_PATH` / `CHROME_NO_SANDBOX` (`npm run og:generate`), the GitHub secrets for desktop signing (`docs/DESKTOP_SIGNING.md`),
and `VITE_WS7A_PROBE` (a measurement build only; never set it in production).

---

## (d) Everything that needs a human to review or verify

### d1. Legal drafts (`docs/agents/legal/`, every file starts with NEEDS HUMAN REVIEW)

| Draft | Turn on with | Covers | Questions it leaves for you or a lawyer |
|---|---|---|---|
| `ws3-privacy.md` | `false_positive_controls` | The six pose numbers kept in the browser, calibration, the "hand" and "not a bite" fields that sync. | Whether to promise the 30-day and 7-day lifetimes. |
| `ws4-privacy.md`, `ws4-terms.md` | `event_sync`, `data_backup` | What is synced, where it is stored, deletion, portability, "sync is not a backup". | Health-data status of habit logs; consent basis; hosting provider `TODO(owner)`; retention after account deletion; backups; whether to state the 50,000 quota. |
| `ws5-privacy.md`, `ws5-terms.md` | `weekly_email`, `photo_diary`, `insights` | Weekly email, photo diary, charts and the share picture. | Separate consent record for the email; email provider terms and region; whether "Delete everything" removes photos. |
| `ws8-privacy.md`, `ws8-terms.md` | `signin_*` | Apple, Microsoft, emailed link; cookies; link records. | Keeping the requester's IP about 24 h; how to refer to Apple's and Microsoft's policies; the "merge accounts on request" sentence promises a process that does not exist in code. |
| `ws9-terms.md`, `ws9-refund.md` | `lifetime_plan`, `gift_plan`, `referrals`, `free_tier`, `regional_pricing` | Lifetime, gifts, referrals, free plan, local prices, refunds, plus Privacy additions (section 6). | Consumer-law withdrawal rights; what a refunded redeemed gift does; chargebacks; the wording "as long as Stop Biting is offered". |
| `ws10-privacy.md`, `ws10-terms.md` | `share_links` | Share links. | Health data; consent record; exclude `/share/` from host logs; cleanup schedule. |
| `in-app-analytics-privacy.md` | `app_analytics` | The sentence on the Privacy page, the About copy ("no detections are transmitted"), their translations and the no-JS mirror; the turn-on order. | Whether "detection started" and "first alarm" count as data from the camera; wording in all four languages; whether to name the two events or only "aggregate counts of three milestones". |
| (none) | `phone_companion` | WS6 wrote no draft. | Confirm the Privacy page's local-storage wording covers `sb:phone:grant` (user id, first name, plan status and dates, grants, free-tier limits; no email, avatar or payment ids). |

### d2. Sentences on the legal pages that become untrue (not edited: rule 8)

Line numbers are as of b6b16f9 and will drift.

| Where | Sentence | Untrue when |
|---|---|---|
| `src/pages/PrivacyPage.tsx:12` (and the `/privacy` text in `server.js`) | "your camera feed never leaves your device, and your habit log stays in your own browser" | `event_sync` (and the camera half should use the approved line) |
| `PrivacyPage.tsx:27` | "These are stored only in your browser (local storage)..." | `event_sync` |
| `PrivacyPage.tsx:85` | "Your habit data never leaves your browser, so we do not hold a copy of it." | `event_sync`, also share links |
| `PrivacyPage.tsx:26, 48, 58` (and the OAuth cookie sentence) | account data "provided by Google when you sign in"; "We use Google OAuth 2.0..."; "Google: sign-in (Google OAuth)" | any `signin_*` |
| `src/pages/TermsPage.tsx:42` | "You must sign in with a Google account to use the Service." | any `signin_*` |
| `TermsPage.tsx:55` and Privacy | "your camera feed never leaves your device" | The approved line is "No camera data is sent while it runs" (`ws11a-notes.md`) |
| `TermsPage.tsx:22`, `RefundPage.tsx:17`, the `/refund-policy` summary in `server.js` | "3-day free trial" | `TRIAL_DAYS` is not 3. Suggested wording that never needs editing again: `ws9-terms.md` section 0. |
| `PrivacyPage.tsx:29` | "Google Analytics records page visits ... It never receives anything from your camera or your habit log." | `app_analytics`. `docs/agents/legal/in-app-analytics-privacy.md` lists every copy: `server.js:2220` and `:2222`, `src/i18n/scopes/marketing-about.ts:26` and `:27`, the es, de and pt-BR copies, `src/i18n/coverage/site.coverage.test.tsx:221` |
| Terms and Refund | nothing about referral credits, gifts, Lifetime, share links, a free plan | `referrals`, `gift_plan`, `lifetime_plan`, `share_links`, `free_tier` |
| `Refund` section 3 ("Refund Eligibility") | speaks of "subscription" payments only | `lifetime_plan`, `gift_plan` (`ws9-refund.md`, point 1) |

### d3. Copy and content to read

| What | Where | Why |
|---|---|---|
| The 28 lessons of the 4-week program | `src/data/hrtProgram.json` | First drafts with no clinical input; `hrt_coaching` must not go on before you read them. |
| The six feature pages (all new prose) | `src/data/featurePages.ts` | Written from the notes, never read against the running features in one session. Do that once on staging. |
| The generated answer to "Do I need a Google account to use it?" | rules in `shared/flagCopy.js`; resolved by `server/marketing/copyFlags.js`; WS8's proposed answer is in `ws8-notes.md` | It describes what Google, Apple and Microsoft hand us and varies with which methods are on and configured. Review before any `signin_*` flag. |
| Competitor facts, with the source URL for each | `src/data/competitorPages.ts` (`needsVerification: true` at two places); tables in `ws11a-notes.md` | Hands Off (`/compare/hands-off`) and HabitAware Keen3 (`/compare/habitaware-keen`). Keen3's $199.00 preorder price also contradicts the live `/compare/stop-biting-vs-habitaware` page, which says HabitAware states no price. |
| Testimonials | `src/data/testimonials.json` (empty), `src/data/README-testimonials.md` | Only real, consented entries; photos need separate consent. |
| Email wording | `server/weeklyEmail/template.js`, `server/auth/magicLinkEmail.js`, `server/billing/giftEmail.js` | Read each once; the weekly email says "A log is a way to notice a habit, not a treatment." |
| `/features/desktop-app` | `getDesktopAppContent()` in `src/data/featurePages.ts` | "It is the same account and the same detection as in the browser" and "the same account, the same plans and the same free trial" are only true after desktop sign-in works. |
| An older claim on a blog post | `src/data/blogPosts.ts`, `stop-biting-app-review`: "You can disconnect from the internet after the initial load and the app functions identically" | The service worker does not cache the models, so this is not true on a fresh profile. |
| Translations | `src/i18n/locales/{es,de,pt-BR}/` (all `reviewed = false`) | Machine drafts; a native speaker must read them before each `locale_*` flag (steps in `ws12a-notes.md`, "Turning a language on"). The 28 coaching lessons and all server-rendered pages stay English. |

### d4. Decisions that are yours (all configurable, safe defaults)

Trial length (default 3; the plan proposed 7) · free-plan limits (30 min a day, 7 days of History are placeholders) · referral reward
(30 days each) · gift length (365 days) and gift link expiry (never) · when bonus days start (saved until the account has no other
access; the alternative would spend a paying referrer's reward on a month already paid) · what a refunded gift does after it was
redeemed (recipient loses it; `gifts.revokeByTransaction` in `server/billing/gift.js`) · whether "Delete everything" should also delete
nail photos · whether to run `/compare/hands-off` and `/compare/habitaware-keen` next to the live `vs` pages · whether tray "until
tomorrow" (08:00, `TOMORROW_RESUME_HOUR` in `src/desktop/trayModel.ts`) and the app's (schedule start, else 06:00) should be the same
· whether `/share/` goes into host access logs · the sync quota.

### d5. Checks that only a person with the real thing can do (NEEDS HUMAN VERIFICATION)

- Nose landmark indices 1 and 2 on a rendered face mesh (`src/detection/zones.ts`; they are not in any exported MediaPipe set).
- Left versus right on a real device (`HANDEDNESS_INPUT_IS_MIRRORED`, `src/detection/handedness.ts`), and that `numHands: 2` really
  returns a second hand.
- Paddle: one sandbox purchase of each product against `server/billing/paddleData.js` (the test payloads were written from
  Paddle's documented shapes, not recorded), and `Paddle.PricePreview` for the visitor's location.
- Apple relay: your sending domain registered with Apple, or mail to "Hide my email" users is dropped.
- Resend: the sender domain, click and open tracking off, a real inbox receiving the magic link and a one-click unsubscribe.
- A real phone: install, shortcuts, offline log, status-bar colour.
- Your own camera with `background_watching`: a real hand while the tab is hidden, the mini window's real size.
- Desktop: everything in `docs/DESKTOP_SIGNING.md` step 6.

---

## (e) Known gaps and what was NOT verified

### Not built

- **A reminder when the app is closed** during scheduled hours (WS7a). The only browser mechanism, Periodic Background Sync, cannot be
  done safely or reliably here. Reminders need the app open in a tab or window, or the desktop app running in its tray. The
  Settings card says so.
- **Pages for skin picking, nose picking and hair pulling** (WS11b). Those behaviours are not validated.
- **Custom bite reasons are not synced.** On another device an entry shows as a plain "Bite".
- **Streak start dates are per device.** Entries converge; a best streak that includes time before a device's own start can differ.
  The share page's streak is days since the newest synced bite, so it can differ from the app's.
- **"Delete everything" keeps nail photos**; "Clear all data" and History's clear-all are local only and not sync-aware (the synced
  copy stays); "Clear all data" does not touch the `sb:*` keys either. The photo diary has no export, by design.
- No auto-update for the desktop app; no merge tool for accounts; no "delete my account" action (deletion is by email).

### Never exercised for real

| Area | What was not done |
|---|---|
| Camera and hands | No real hand or face was seen by any test. All alarms in browser checks were simulated (fake camera or an injected event). Detection rules, chin-rest numbers and learned poses are tuned on drawn scenes. `numHands: 2` and left/right mapping unseen. The photo diary and the calibration were never used with a real hand. |
| Payments | No Paddle account, not even the sandbox (lifetime, gift, referral, refund, localised prices). |
| Sign-in and mail | No Apple, Microsoft or Resend call. Apple's cross-site return, Microsoft consent and optional claims, link scanners, deliverability, spam placement, a one-click unsubscribe from a real mail client: all untested. |
| Browsers | Only headless Chrome (155). Safari, Firefox and Edge were never run: hidden-tab behaviour, Document Picture-in-Picture, Web Share, the Apple return, SameSite cookies, printing the share page. A windowed (non-headless) Chrome, minimised or covered, was not measured. |
| Phones | No real iPhone or Android: install, Add to Home Screen, shortcuts, icon, status bar colour, the phone view's first-visit tour. |
| Assistive technology | No real screen reader anywhere; announcements were checked in the page markup only. |
| Desktop | Unsigned Mac only; Windows never built; the CI workflow never run; tray clicks, launch at login, native notifications, the camera card's Continue and the macOS prompt, a worker under `file://`, detection with the window hidden on a real camera: not seen. |
| Production | `trust proxy`, any CDN in front, the service worker installing in production, hosting access logs. |

### Defects and warts found in existing code (not fixed here)

- **No `trust proxy`** (`server/auth/session.js:59` says so). Behind Coolify's proxy the global rate limits (`/api/` 100 per 15
  minutes, `/api/auth/` 10 per minute) may be one bucket for every visitor. Not verified in production. WS8, WS10 and WS11b built around it (their own routes sit outside `/api/` or read the
  proxy's header); one line, `app.set('trust proxy', 1)`, once you know the proxy chain, would fix it globally.
- **`email.js` treats a failed Resend send as success** (Resend returns `{ error }` and does not throw). The welcome email, the admin
  notice and the trial follow-up cannot tell, and `trialFollowup.js` can mark someone mailed when nothing was sent. The magic link,
  gift and weekly emails check the result.
- **Service worker install.** WS8 saw the worker fail to install against `server.js` in headless Chrome; WS6 traced that to plain
  `http://localhost` (the app sends `upgrade-insecure-requests`, so the redirect of `/index.html` is upgraded to https). Production is
  https, so it is probably fine, but nobody has checked a real install in production.
- **`GET /auth/providers` answers 404** while no sign-in flag is on, so every marketing page logs one console error (the only failing
  Lighthouse best-practices audit on WS11b's pages: 96 instead of 100).
- Out-of-order `subscription.*` webhooks are not guarded; `chargeback_reverse` and partial refunds do not change access.
- `PaywallPage` shows "N days left in your free trial" to a mid-trial Lifetime buyer (one-line fix: gate `trialLeftText` on
  `accessStatus === 'trial_active'`).
- The OS notification still says "Nail biting detected" for any behaviour; the streak and the "was it a bite" card are not per behaviour.
- Desktop: `cameraErrorCopy.ts` says "from the camera icon in your browser's address bar", wrong inside the app. The installers are 240 MB because `dist/` is the whole site.
- With `phone_companion` on, the 125 kB `mediapipe` JS chunk is still downloaded on a phone (the model and wasm are not).
- Phone view, first visit: Lighthouse 75 (LCP 6.0 s) before the flag is cached; returning visits 100.
- Hidden-tab CPU with `background_watching`: about 12.9 against 2.9 points of one core, 18.2 with the mini window.
- A returning visitor whose service worker serves the cached shell does not get the copy-flag marker and sees the old sentences until
  their flag cache refreshes (never wrong in the "on" direction, but can lag). `dateModified` of a page whose copy a rule changed is
  the flag-off date.
- Account deletion by hand leaves rows behind: delete the account's rows in `habit_events` and `habit_event_epochs` (WS4),
  `email_preferences` (WS5), `share_links` (WS10; `removeAllForUser` exists but nothing calls it) and `auth_identities` (WS8).
- The sign-in follow-up "show which methods are linked to my account" in Settings was not built.
- **Blog posts have a layout shift of 0.72 (mobile Lighthouse CLS; performance 54 mobile, 73 desktop).** The article is rendered
  from `dist/posts/<slug>.json` after it is fetched, so the bottom call-to-action block jumps down when it arrives. A CLS above 0.1
  is "poor" in Core Web Vitals. It predates the swarm and was not touched (`docs/agents/lighthouse-report.md`).
- **With every flag off, the build still fetches code for features that are off** (WS13 flags-off report, F2 and F3; the figures are after WS12a):
  the signed-in Watch tab loads 10 more JS files (+24.9 kB gzip) and Settings 3 more (+3.7 kB), the landing page +8.8 kB gzip; the service worker
  precache grows from 49 to 60 entries before WS12a (+58 KiB, 75 requests of its own in the audit after it), so a returning visitor downloads the phone view and the background-watching code once, in the background, although no flag is
  on. No visible change, no request on a page load. Fix if it matters: import those chunks dynamically behind their flag.
- A closed gated OG card (`/og/features-*.png`, `/og/solutions-cuticle-biting.png`) answers 404 gzip-compressed with
  `Vary: Accept-Encoding` instead of plain (F4 in the flags-off report). Harmless.
- **Open accessibility issues** (16, none High; `docs/agents/accessibility-report.md`). Two are contrast fixes that were made and then reverted so the
  flags-off site stays identical, and are yours to take: Settings > Bite reasons has dark-mode placeholders at 2.33:1 (two class names,
  `dark:placeholder:text-stone-600` to `-400`) and the 12 px "Detected!" label is 3.96:1 in light mode (one colour constant); the exact
  one-line changes are in the report ("Recommended, owner decision"). The rest: text-field borders are 1.3 to 2.0:1 against
  the 3:1 that WCAG 1.4.11 asks for, and the switch's off-state track is 1.99:1 in light mode (1.39:1 in dark), both design-token
  decisions; an unreviewed alarm row is wider than the card under about 380 px and its delete button is cut off at 320 px (the
  fix is `flex-wrap`, but the WS3 parity test pins that row's markup); the alarm flash is never announced when
  `false_positive_controls` is off; the coaching card and toast are about 24 Tab stops from the top of the page; the toast
  timeouts are 8 and 15 seconds; heading order on History; a streak colon not hidden from screen readers.

---

## (f) Deploy notes

**Build pack and the Dockerfile.** `COOLIFY_DEPLOY.md:5` says Nixpacks; a `Dockerfile` and a `nixpacks.toml` both exist, and the
history (commit 57aa6b0, "docker: copy trialFollowup.js into the runtime image", a production crash) suggests production runs the
Dockerfile. The repo cannot prove it. Under Nixpacks the whole repo is copied and the question below does not arise. Under the
Dockerfile I checked every import: the runtime image copies `server.js`, `email.js`, `trialFollowup.js`, `server/`, `shared/`, `dist/`
and `node_modules`; `trialFollowup.js` imports `server/db/migrate.js`; `server/**` reaches outside itself only for `email.js` and
`shared/**`; every file the server reads at run time is under `dist/`. The build stage copies `src`, `public`, `scripts`, `shared`,
`index.html`, the tsconfigs and the vite, tailwind and postcss configs, which is all the build reads. **Nothing is missing as of
b6b16f9.** (The Docker daemon was not running when the orchestrator checked, so the stages were reproduced by hand rather than built.)
Any future new top-level server file or directory must be added to the Dockerfile or production crashes at boot.

**Migrations are additive.** They run at every boot, each in a transaction, recorded once in `schema_migrations`, and every flag-off
install runs them too (the tables exist, empty). There is no helper that drops, renames or rewrites, on purpose. The `users` table is
untouched.

| Id | Table(s) |
|---|---|
| `ws4_001_habit_events`, `ws4_002_habit_event_epochs` | `habit_events`, `habit_event_epochs` |
| `ws5_001_email_preferences` | `email_preferences` |
| `ws8_001_auth_identities`, `ws8_002_magic_link_tokens`, `ws8_003_auth_oauth_states` | `auth_identities`, `magic_link_tokens`, `auth_oauth_states` |
| `ws9_001` to `ws9_006` | `paddle_events`, `billing_transactions`, `entitlements`, `gift_codes`, `referral_codes`, `referrals` |
| `ws10_001_share_links` | `share_links` |

(Plus the older `trial_followup_sent_at` column on `users`, added by `trialFollowup.js` when `RESEND_API_KEY` is set.)

**Changing the trial length.** (1) Set `TRIAL_DAYS` as a build argument **and** as a runtime variable, same value. (2) Locally run
`TRIAL_DAYS=<n> npm run seo:sync` and commit `public/llms.txt`, `public/sitemap.xml`, `src/data/pageUpdates.json` (the changed pages get a
`lastmod`, which may be older than today; edit `pageUpdates.json` by hand if you want today's date). `npm run seo:check` says what is
stale; the Docker build does not run it. (3) Hand-edit **4 sentences that speak of both products** (they are true only while our
trial equals Hands Off's 3 days): three in `src/data/comparePages.ts` ("each with a 3-day free trial", "with a 3-day free trial.
Neither records", "Both offer a 3-day free trial") and the Hands Off meta description in `server.js` ("price, privacy, 3-day
trials"); and **3 legal sentences**: `TermsPage.tsx:22`, `RefundPage.tsx:17` and the `/refund-policy` summary in `server.js`. The list
is the `shared` and `legal` entries of `ALLOWED` in `scripts/trialLength.test.mjs`. Everything else follows the constant. The server
warns at boot if `dist` was built with a different value than it runs with.

**Service worker.** `registerType: 'autoUpdate'` with `skipWaiting` and `clientsClaim`: a new deploy takes over on the visitor's
next navigation; the open page is not reloaded and there is no update prompt. The precache grew from 21 entries (WS11a) to 60 (WS11b's
count), and each returning browser downloads the new files once in the background. Because a browser that visited before keeps the
old bundle until the worker updates, the new `/share/` and `/signin` and `/redeem` entries in `navigateFallbackDenylist` only protect
visitors whose worker has updated. That is the reason for the **`share_links` rule: turn it on a day or two after the deploy that
ships it, together with `event_sync`.** Per `tasks/todo.md` that code has been on production since PUSH #1. Detection needs a network
on the very first run of a browser profile (the MediaPipe models are not precached).

**Flags take effect on restart; browsers lag.** `GET /api/features` is `Cache-Control: public, max-age=60` and clients re-ask at most
every 10 minutes (and on reload), so after any flag change expect up to about 10 minutes before an open tab agrees. The server side
is exact at once.

**`COOLIFY_DEPLOY.md`.** Delete line 24 (`ELECTRON_PROTOCOL=stopbiting`). I did not edit the file. Your stashed edit adds one
line to the Notes at the bottom (about `PADDLE_PRICE_IDS`), so deleting line 24 before or after restoring the stash does not conflict.
`docs/DESKTOP_SIGNING.md` says the same.

**Installers you already handed out.** Before WS7b, the Electron build config had `extraResources: data -> data`. A build made on
your machine therefore copied the real `data/users.db` into the installer. WS7b removed that entry and checked the new build
(`app.asar` has no `data/`, no `server.js`, no `node_modules`). I cannot see the old installers. `server.js:720-722` still redirects
`/downloads/Stop-Biting-1.1.0.dmg` and `Stop-Biting-1.1.0-arm64.dmg` (and the 1.0.0 `Nail-Habit-Tracker` files) to GitHub releases
`v1.1.0` and `v1.0.0`. **Open those release assets and look for a `data` folder next to the app's resources** (macOS: `Contents/Resources/`).
If `users.db` is in there, it contains whatever the database held on the machine that built it, and the site's `/downloads/...` links would serve it.

**Your stashed Paddle filter.** `git stash list` in the main checkout shows `2bfc669bb0758757d2021af3984363540ddd7613 On main:
swarm-paddle-wip-2026-10-23` (it touches `server.js`, +26 lines, and `COOLIFY_DEPLOY.md`, +1 line). After the last push, from
`/Users/igorgazivoda/nail-habit-app`: `git stash apply 2bfc669bb0758757d2021af3984363540ddd7613` (**apply, not pop**: the stash stack is
shared with other sessions), build and test, commit, then drop the entry by finding its current `stash@{n}` with `git stash list`.
A plain patch of the same change is in the orchestrator's scratchpad as `preexisting-wip.patch`; `git apply --check` passed on
every merge up to WS11b. Then set `PADDLE_PRICE_IDS` to every price id of this app **including the lifetime and gift ids and any
archived ones**. WS9's hook recognises its own two ids even if you forget, but the server logs a warning and referral rewards need
every price of yours to be known.

**After deploying.**
- Restart after every build: the server caches `dist/index.html` and reads `seo-content.json` and `seo-gated.json` at start, and
  pages that open with a flag are decided at start.
- `npm run seo:check` and `npm run og:check` should say "in sync" (run in a checkout; do not commit generated files by hand).
- `npm run seo:indexnow` (run from a checkout, not the container; `--dry-run` first) submits URLs whose `<lastmod>` moved in the
  checked-in `public/sitemap.xml` to IndexNow. **Pages that are appended to the sitemap at server start (the two competitor pages
  and the six feature pages, while their flag is on) are not in that file, so they are not submitted;** ask the search engines for them yourself if you want them
  indexed quickly. The key file `public/21f3175251594edf918c599f5bdee19f.txt` must stay deployed.
- On the day a gated page goes on, set its `date` in `COMPARE_META` (`server.js`) to that day (it is the Article's `datePublished`).
- `GET /health` reports the commit; compare it with the one you pushed.

---

## (g) Rollback

**Turn every flag off:** set `FEATURE_FLAGS=` (empty) or delete the variable, restart. Every flagged route answers `404
{"error":"Not found"}` at once, the feature pages and `/signin`, `/redeem`, `/share/...` give the branded 404, and the app hides the
features within about 10 minutes of the next visit. To turn one off, remove just its name.

**What stays on regardless of flags** (deliberately):
- The weekly-email **unsubscribe links** (`/api/email/unsubscribe/...`): a dead link is a compliance problem.
- **Paid access.** A Lifetime payment is granted whenever its price id is configured, and a refund still revokes it; gift and
  referral days already granted are honoured. The Paddle webhook hook (`billingWebhook.take`) acts whenever a matching price id is configured.
- `/.well-known/apple-developer-domain-association.txt` while `APPLE_DOMAIN_VERIFICATION` is set.
- The Google sign-in hook for accounts made another way (returns nothing when there are none), the empty tables, and the
  marketing pages' one `GET /auth/providers`.
- The WS11a site fixes, and the larger service-worker precache.
- Data a person already made: a "Not a bite" mark stays visible in History, urge entries stay out of the bite count, `competingResponse` on entries.

**Data left behind when a feature goes off**

| Feature | Server | In the browser (`sb:<namespace>:<key>` unless noted) |
|---|---|---|
| `detection_behaviors` | | `detection:behaviors` (ignored while off: nail biting only) |
| `hrt_coaching`, `urge_timer` | | `hrt:settings`, `hrt:last-prompt-at`, `hrt:program`; urge and competing-response data live on the events |
| `false_positive_controls` | | `falsePositive:settings`, `learned`, `alarm-poses`, `calibration`, `calibration-offered` (Settings > Detection can erase them) |
| `event_sync` | `habit_events`, `habit_event_epochs` rows stay until deleted | `sync:optin`, `sync:state`, `sync:versions`, `sync:notice`, `sync:device-name` |
| `insights`, `photo_diary` | | `insights:milestones`, `insights:photo-diary`, `insights:photo-reminder-snooze`; photo bytes in IndexedDB `stop-biting-local-blobs` |
| `weekly_email` | `email_preferences` rows (opted-in people stop receiving mail when the job stops; unsubscribe still works) | |
| `phone_companion` | | `phone:grant` (not read while the flag is off or after 14 days; removed by sign-out or a 401 or 403) |
| `background_watching` | | `background:state`, `schedule`, `last-reminded`, `cadence` |
| `signin_*` | `auth_identities`, `magic_link_tokens`, `auth_oauth_states`; accounts made this way keep working (Google finds them by address) | `auth:providers` |
| `free_tier`, `lifetime_plan`, `gift_plan`, `referrals` | `paddle_events`, `billing_transactions`, `entitlements`, `gift_codes`, `referral_codes`, `referrals` | `billing:pending-referral`, `pending-gift`, `free-usage` |
| `share_links` | `share_links` rows stay and work again when the flag returns; revoke in Settings > Sharing first if you do not want that | |
| everything | | `flags:last-known`, `app:device-id` |

**Undo the history upgrade (v1 to v2).** Normally nothing needs undoing: the v2 record is a superset of the old one, and an older
bundle reads v2 data fine (it re-labels the payload v1 when it writes; the next load of the new bundle migrates again, harmlessly).
The one difference: an older bundle counts an urge entry as a bite. If you still want a browser's pre-upgrade data back, there is no
screen for it. In that browser's developer tools, copy the value of the localStorage key **`stop-biting-state-v1-backup`** over the
key **`stop-biting-state`** (console: `localStorage.setItem('stop-biting-state', localStorage.getItem('stop-biting-state-v1-backup'))`).
Know what it does: the backup is the raw payload from before the first upgrade on that browser, written once and never overwritten,
so everything logged since is lost on that browser; and unless the code running is older than WS0, the next load migrates it to v2
again. A payload that could not be parsed is kept under `stop-biting-state-corrupt-backup` instead of being overwritten.

**Sync data for one account:** "Delete synced data" in Settings > Data, or `DELETE FROM habit_events WHERE user_id = ?` and
`DELETE FROM habit_event_epochs WHERE user_id = ?`. **Code rollback:** redeploy the earlier commit; the new tables are simply ignored
by older code.

---

## Appendix: where the notes and the code disagree

The code was trusted. Items marked *fixed* were corrected in `ARCHITECTURE.md` by this pass.

| Notes say | Code says |
|---|---|
| `ws2-notes.md:18` "`urge_timer` does not depend on [`hrt_coaching`] technically" (also `ws6-notes.md`, `ws11b-notes.md`) | `src/features/registry.ts:45` has `urge_timer.dependsOn: ['hrt_coaching']` and `server/features.js` `FLAG_DEPENDS_ON` agrees. Behaviour: only a boot-time warning when `urge_timer` is on and `hrt_coaching` is off. The button is gated by `urge_timer` alone (`src/coaching/CoachingDashboardSlot.tsx:17` and `:21`). |
| `ws5-notes.md:12` and `:171`: with only `photo_diary` on, the view is called "Photos" | `registry.ts:74` `photo_diary.dependsOn: ['insights']`: works alone, with a boot warning. Likewise `weekly_email` lists `insights` (`registry.ts:79`) although the job needs only `event_sync`. |
| `ws10-notes.md:12` explains `share_links` has no `dependsOn` | Correct (`registry.ts:145-149`), but a link shows nothing without synced history, so treat `event_sync` as a prerequisite. |
| `ws8-notes.md:232` "new accounts get their trial length from `TRIAL_MS` in `server/auth/accounts.js` (3 days...)" | `server/auth/accounts.js:17-22` imports and re-exports `TRIAL_MS` from `shared/plans.js`; `TRIAL_DAYS` controls it. `ws9-notes.md` is right. |
| `ws1-notes.md` "30 committed synthetic fixtures", nail-biting precision 0.33 | WS3 added 5 scenes: `ws1-eval-report.md` now has 35 fixtures and precision 0.35 (0.33 is the original-30 figure). |
| `ws8-notes.md` finding 5 "the service worker may not install against `server.js`" | `ws6-notes.md` found the cause: plain-http local testing only (see (e)). |
| `ws4-notes.md` points to `src/pages/Settings.tsx:542` for the "log stays in this browser" sentence | It is at `Settings.tsx:551` and now goes through `copy(...)` (WS11b made it flag-aware). |
| `.env.example:10` says the desktop app "loads from the embedded Express server" | `electron/main.ts:83-84` uses `API_BASE_URL` or `https://stopbiting.today`; no server ships in the app (`ARCHITECTURE.md` section 10). Not edited here. |
| `ARCHITECTURE.md` (before this pass) said: no event history stored server-side; all seven Settings sections empty; only Settings reads a flag; precache 21 entries; "WS8 must check" `ELECTRON_PROTOCOL` | *Fixed.* All were stale (WS4; every section has content; Watch tab, History and others read flags; 60 entries; WS8 checked and could not verify production). |
| `COOLIFY_DEPLOY.md:5` says Nixpacks | A Dockerfile exists and appears to be what production runs; unverifiable from the repo (see (f)). |

---

## QA results

Run by WS13 on 2026-10-24 on the branch `worktree-agent-a69ebea783dc66ca0`, headless Chrome 155 on macOS, Node 24. First on
`main` at b6b16f9 plus the WS13 commits, then again after merging `main` (which by then held **WS12a, the localization of the app screens, and
the SEO session's `origin/main` commits**) into the branch (merge `3be2efc`, conflicts resolved, see `accessibility-report.md`). The numbers
below are the merged tree's unless a line says otherwise. **WS12b (the marketing pages in es, de and pt-BR) was merged after this was written; the orchestrator re-ran the
gates and the Dockerfile reproduction on the final tree (all pass) and a privacy audit; re-run Lighthouse if you want fresh numbers** (commands at the end). Reports: `privacy-audit-report.md`, `flags-off-diff-report.md`, `accessibility-report.md`,
`lighthouse-report.md`.

### Gates (`bash scripts/qa/gates.sh`, one command)

| Gate | Result |
|---|---|
| `npm run build:web` | exit 0 |
| `npm test` | 174 files passed + 1 skipped (the real-browser privacy smoke, which runs with `PRIVACY_AUDIT=1`); 3,559 tests passed, 2 skipped (before WS12a and the merge: 152 files / 2,885 tests; before WS13: 151 files / 2,842) |
| lint, scoped to `src server scripts electron shared` | 23 errors / 4 warnings: the pre-existing baseline, same files and rules (plain `npm run lint` also walks `.claude/worktrees/*`) |
| `node --check` | `server.js`, `email.js`, `trialFollowup.js`, every file under `server/` and `shared/`: 85 files, 0 failures |
| `npm run electron:typecheck`, `seo:check`, `og:check`, `eval:detection` | all pass |
| dev-only code in the bundle (`seedPreviewData`, `previewKind`, `dev-override`, `readDevOverrides`, `__sbProbe` over `dist/assets`) | 0 files |
| secret scan of `git diff ffbf29a..HEAD` (added lines: API keys, private keys, JWTs, provider tokens) | 0 hits. The base is ffbf29a, not `origin/main`, because `origin/main` moved (see below) and ffbf29a was already scanned for push #1 |
| the owner's uncommitted Paddle patch (`PADDLE_PRICE_IDS`) | `git apply --check` clean on the merged tree |
| Dockerfile reproduced by hand (`bash scripts/qa/docker-repro.sh`; docker was not used) | stage 1 builds from only the files the Dockerfile copies; stage 3 boots `server.js` from only the files it copies; 23 key routes answer as expected; all 27 flags off; server log clean. Production dependencies are not reproduced (`node_modules` is the repo's), see (f) |

**`origin/main` and `main`.** `origin/main` moved to 46a484c while the swarm worked (another session's SEO commits on top of push #1). `main`
has since merged it (`f871859`), and this branch has merged `main`, so it contains all of it; a push of `main` after this branch is merged is a
fast-forward. (Earlier in this QA the same merge was tried in a scratch worktree: clean, all gates green.)

### Privacy audit (`npm run privacy:audit`; 5 minutes of detection per mode, fake camera, real server, real sign-in)

| Mode | Verdict | Requests | `/api/events/*` | Hosts contacted |
|---|---|---|---|---|
| flags off (production as shipped) | **PASS** | 118 | 0 | own origin, `www.googletagmanager.com`, `www.google-analytics.com` |
| sync OFF (flag on, nobody opted in) | **PASS** | 130 | 0 | same |
| sync ON (opted in through the UI) | **PASS** | 140 | 8 POSTs, 9 event records, only whitelisted keys | same |
| sync OFF, probe build (real alarms, real landmark data in the page) | **PASS** | 133 | 0 | same |
| sync ON, probe build | **PASS** | 142 | 8 POSTs, 11 events, all 12 whitelisted keys seen, nothing else | same |
| canary (the page sends images, landmarks, a beacon to a stranger on purpose) | **CAUGHT** 11 of 11 | | | |

No request carried image data, landmarks, frames or video; the diary photo's bytes (4 fingerprints, raw/hex/base64/percent-encoded)
appear in no request; the service worker (active, 65 requests of its own) and its code have no upload path. **What it cannot
prove:** a real hand or face (Chrome's fake camera is a test pattern; the probe build injects generated landmarks), Safari or
Firefox, the desktop app, Paddle checkout. Details and limits: `privacy-audit-report.md` section 5. **The table is the 5-minute run on the
tree before the merge. After the merge (WS12a, origin/main) all four normal modes were run again at 90 seconds: flags off, sync off, sync on PASS
(135, 150 and 154 requests; sync on sent 4 POSTs with 7 events and only whitelisted keys; the service worker, now with 75 precache requests, is
still the only other context), canary CAUGHT. The 5-minute set and the probe-build runs will be refreshed after WS12b.**

### Flags off against production (`flags-off-diff-report.md`)

With every flag off the tree behaves like production apart from changes that each trace to WS6, WS7a, WS11b or WS12a. Re-verified on the
merged tree against production (46a484c): **23 of 25 signed-in and signed-out DOM captures identical in body, title, console errors and every
pixel** at 1280 and 390 px, light and dark; the 2 others (390 px Watch tab) differ in 236 of 329,160 pixels, sub-pixel anti-aliasing of one line
because "Free trial: N days left." became one translated string instead of three text nodes (same text, same layout; cause verified in
`Dashboard.tsx`); **91 HTTP responses: 66 identical, the other 25 are the same 25 as before** (19 pages differing in the same 6 head lines of WS6, `sw.js`,
the entry bundle, 2 closed OG cards, 2 new icon files). Nothing unexplained. Findings: F2/F3 (extra JS fetched and precached with flags off:
**the landing page now downloads +8.8 kB gzip and the signed-in Watch tab +10 files / +24.9 kB gzip compared with production, roughly twice what it
was before WS12a**), F4 (a gzip quirk on closed OG cards), F5 (WS6 head tags are unconditional). The two accessibility fixes that were visible with
every flag off (Bite reasons placeholder classes, "Detected!" label colour; commit `2d5491c`) **were reverted** on the coordinator's decision and
are recommendations (O15, O16 below). The two reflow fixes that remain only act when something is marked "Not a bite" or in the phone view.

### Accessibility (`accessibility-report.md`)

29 surfaces with every UI flag on, light and dark, 1280 / 390 / 320 px: real Tab walks, focus indicators by pixel comparison, Escape
and focus return, accessibility tree, live regions, reduced motion, contrast, target size, reflow, axe 4.13 in every state.
**29 issues found: 13 fixed (with tests), 16 open, none High** (list in (e); two of the open ones are the reverted contrast fixes). After the
merge with WS12a the touched surfaces were re-checked in English and in German (`docs/agents/a11y-audit/a23_de.mjs`): focus hand-offs, one
announcement per step, no churn, no sideways scroll at 390 px, contrast: all OK. Lighthouse accessibility 100 on all
9 reachable URL and form-factor combinations, and 100 on all 16 site-page runs below. Not verified: a real screen reader, Safari,
Firefox, forced colours, 200 % zoom, the Picture-in-Picture strip.

### Lighthouse (`lighthouse-report.md`, local server, 3 runs, medians)

SEO 100 and accessibility 100 on all 8 pages, mobile and desktop (including the WS11b feature page and the WS11a compare page with
their flags on). Best practices 100 except `/` (92-96: the console 404 of `/auth/providers`, see (e)). Performance: 93-94 mobile and 100
desktop on `/`, `/how-it-works`, `/pricing`, `/about`; 78 mobile / 97 desktop on the compare and feature pages (the same as the compare page
that already existed); **blog post 54 mobile / 73 desktop because of a layout shift of 0.72** (not from the swarm). Installability: Chrome
reports no errors and no manifest errors with `phone_companion` off and on (Lighthouse 13 has no PWA category).

### Re-run after WS12 or any merge

```
git merge origin/main                          # first, see above
bash scripts/qa/gates.sh                       # build, tests, lint, syntax, typecheck, seo/og, eval, leaks, secrets, Paddle patch
bash scripts/qa/docker-repro.sh                # the Dockerfile by hand
npm run privacy:audit                          # 5 min per mode, sync off and on (add --mode all for flags-off and the canary)
node scripts/lighthouse/run.mjs --runs 3 && node scripts/lighthouse/report.mjs
```

