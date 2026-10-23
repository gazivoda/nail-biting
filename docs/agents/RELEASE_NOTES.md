# Stop Biting: release notes for the owner

Written by WS13 on 2026-10-24 against `main` at b6b16f9 (WS11b merged). WS12 (localization) is **not** in this file yet:
it lands later and the WS13 agent will update this file after it.

How to read this: every new feature is switched off. With `FEATURE_FLAGS` empty the site behaves as it did before, apart from
the WS11a site fixes (privacy wording, meta tags, FAQ markup), which are meant to be visible. The detail for each workstream is in
its `docs/agents/wsN-notes.md`; this file is the part you need to act on. Where a notes file and the code disagreed, the code
was trusted and the difference is listed in the appendix at the end.

Contents: **Read first** · (a) What was built · (b) The 27 flags, and the order to turn them on · (c) Environment variables and
build arguments · (d) Things only a human can review or verify · (e) Known gaps and what was not verified · (f) Deploy notes ·
(g) Rollback · Appendix: notes versus code · QA results.

---

## Read first (before you flip anything)

1. **Flags are read when the server starts.** Edit `FEATURE_FLAGS` in Coolify (comma separated names), restart, no rebuild. Check
   `https://stopbiting.today/api/features`: all 27 names are listed as `true` or `false`. Unknown names are ignored and logged at boot.
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
   the person who wrote the rules. The three `locale_*` flags do nothing until WS12 lands.
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
| Not on production yet | WS6 (phone view), WS7a (background watching), WS11b (feature pages and flag-aware copy), WS12 (when it lands) and the WS13 fixes, which go out with PUSH #2. |
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

**WS12, Localization** (Spanish, German, Brazilian Portuguese). Pending. The flags `locale_es`, `locale_de`, `locale_pt_br` exist and
do nothing yet. All machine translations will need native review before a locale flag goes on.

---

## (b) The 27 flags

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
| `lifetime_plan` (WS9) | Lifetime card on `/pricing`, lifetime plate in the paywall. | | Create the Paddle product; set `VITE_PADDLE_PRICE_ID_LIFETIME` (build) and `PADDLE_PRICE_ID_LIFETIME` (runtime); add `transaction.completed`, `adjustment.created`, `adjustment.updated` to the webhook destination; publish `legal/ws9-terms.md` section 1 and `ws9-refund.md`; one sandbox purchase. | A paid lifetime is honoured even with the flag off. Unmatched payments need a hand-made `entitlements` row. |
| `gift_plan` (WS9) | Gift purchase, `/redeem`. | | Same Paddle steps with `VITE_PADDLE_PRICE_ID_GIFT` and `PADDLE_PRICE_ID_GIFT`; set `GIFT_PLAN_DAYS` to match the product; `EMAIL_FROM` on a verified domain or the buyer's email reaches nobody; `legal/ws9-terms.md` section 2. | A refunded gift that was already redeemed takes access from the recipient (your call, `server/billing/gift.js`). A lost link is a support case. |
| `referrals` (WS9) | Personal `?ref=` link, reward on the referred person's first payment. Opens `/features/referral-program`. | | Set `PADDLE_PRICE_ID_MONTHLY` and `PADDLE_PRICE_ID_YEARLY` (or `PADDLE_PRICE_IDS`) in the **runtime** environment, or no reward is ever paid. Same webhook events as above. Decide `REFERRAL_CREDIT_DAYS`. `legal/ws9-terms.md` section 3. | A second card, a wallet that shows no card, or another email defeats the fraud checks. No cap per referrer. |
| `regional_pricing` (WS9) | Paddle-localised prices on the pricing section and paywall. | | Enable localised pricing in Paddle. Needs `VITE_PADDLE_CLIENT_TOKEN` and the monthly and yearly ids in the build. | Any failure falls back to $2.99 and $29. `Paddle.PricePreview` without an address was not tried. |
| `share_links` (WS10) | Settings > Sharing, `/share/<token>`. Opens `/features/share-with-therapist`. | `event_sync` (not enforced: no `dependsOn`, see appendix) | Publish `legal/ws10-privacy.md` and `ws10-terms.md`. Decide whether `/share/` stays out of access logs. Turn on a day or two after the deploy. | The address is a bearer secret and may appear in host logs. A chat app that previews the link counts as a view. The streak shown can differ from the app's streak. |
| `compare_competitors` (WS11a) | Two competitor pages, indexable and in the sitemap only while on. | | Verify every fact against its source URL (`ws11a-notes.md` tables), then set `needsVerification: false` (`src/data/competitorPages.ts`, 2 places) and redeploy. Decide whether to run these next to the live `vs` pages. Refresh the live `/compare/stop-biting-vs-habitaware`. Re-date both `COMPARE_META` entries in `server.js`. | Competitor facts may be out of date (habitaware.com rate-limited the fact check). |
| `social_proof` (WS11a) | Testimonials on the home and pricing pages. | | Add real, consented entries to `src/data/testimonials.json` following `src/data/README-testimonials.md`, deploy, then turn on. | Hidden anyway while the file is empty. |
| `locale_es`, `locale_de`, `locale_pt_br` (WS12) | Nothing yet. | | WS12 must land; then native review of each machine translation. | |

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
7. **Not yet:** `desktop_app`, `experimental`, `locale_es`, `locale_de`, `locale_pt_br`.

---

## QA results

<!-- WS13-QA-RESULTS: the WS13 agent fills this in -->
