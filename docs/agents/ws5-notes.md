# WS5 (Progress and insights) — notes

For the owner and for WS13 (release notes). Reference: `docs/agents/ARCHITECTURE.md`. Legal drafts (**NEEDS HUMAN REVIEW**):
`docs/agents/legal/ws5-privacy.md`, `ws5-terms.md`.

## What exists, and the flag for each

| Feature | Flag | Where | Default |
|---|---|---|---|
| Charts: bites per day (30 days) and per week (8 weeks), last 7 days against the 7 before, hour x weekday heatmap, what sets it off, competing-response rate (WS2), false-alarm rate (WS3) | `insights` | History > **Insights** (a switch under the History title) | off |
| Milestones list (first hour, first day, 7 days, 30 days, 100 alarms), celebration card shown once each, optional share card (PNG, stats only) | `insights` | the same view; the celebration card appears over the app | off |
| Nail photo diary: guided hands-only capture, weekly in-app reminder, before/after slider, delete one / all, stored only in this browser | `photo_diary` | inside the Insights view (the view is called **Photos** if only this flag is on); a "Photo diary" card in Settings > Data; a reminder strip above the History list | off |
| Weekly summary email: opt-in, built from synced events, one-click unsubscribe | `weekly_email` | Settings > Account & Sync ("Weekly summary email"); server job and routes | off |

`FEATURE_FLAGS=insights,photo_diary,weekly_email` (and `event_sync`, which the email needs) in Coolify, restart, no rebuild.
No new environment variable. The email uses the ones that already exist: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`. No new
dependency. `.env.example` is unchanged.

## With every flag off, nothing is different (how this was checked)

- DOM of Watch, History and Settings at 1280 and 390 px, signed-in preview fixture, `main` against this branch, both on a Vite
  dev server with no flags: identical after normalising digits (`ws2-domcmp` style comparison; main against main was run first
  to measure the noise: identical). The first run of a cold dev server differs because lazy modules are still loading; run it
  twice.
- The set of non-analytics requests is the same (`/api/features`, the MediaPipe files).
- `Log.insights.test.tsx` shows the page is byte-identical apart from the switch when a flag is on.
- Server: `/api/email/weekly` is 404 with the flag off, no job timer starts without the flag and `RESEND_API_KEY`
  (tests spy on `setInterval`); the only server-side difference is an empty table `email_preferences`, created by an additive
  migration, and a neutral 404 page (instead of the catch-all one) for `/api/email/unsubscribe/<junk>`.
- Service worker: the lazy chunks of these features are precached so they work offline. Precache goes from 38 entries / 1,401.6
  KiB (main) to 47 entries / 1,477.9 KiB, downloaded once in the background when the worker updates. The entry chunk grew 404
  bytes (136 bytes gzip); `Log-*.js` grew about 3 kB (switch, reminder, hooks).
- `grep -l "dev-override\|readDevOverrides" dist/assets/*.js` and `grep -l "seedPreviewData\|previewKind" dist/assets/*.js` print
  nothing.

## Event semantics (the predicate, for WS3 and WS13)

A **bite** in every chart, milestone and in the email is what History already calls one: hand-logged, or an alarm the person
confirmed; never an urge-timer entry, never an alarm marked "Not a bite", never a deleted entry. Unreviewed alarms are not bites
(they count in "Alarms and bites" and in the 100-alarm milestone).

- **Client**: `src/insights/predicate.ts` (`countsAsBite`, `countsAsAlarm`, `countsAsEntry`, `isRaisedAlarm`). They are built on
  WS3's shared predicates (`isBite`, `isFalsePositive`, `isAlarmOrBite`); WS5 has no predicate of its own after the merge. If WS3's
  definition changes, only those shared functions change.
- **Server (weekly email)**: `server/weeklyEmail/summary.js`: `isCountedBiteEvent` and `isFalsePositiveEvent` (the swap point).
  Server code cannot import from `src/`, so this is a second copy of the same rule. `server/weeklyEmail/parity.test.js` pushes
  one mixed history through both (7 zones x 4 weeks, including the daylight-saving weeks and a year boundary) and compares bites
  this and last week, the bites on each of the seven days, percent change, alarms to review and the top reason. It fails if
  either side drifts.

## Why Insights is a view inside History, not a new URL

A new top-level path needs `server.js` (its `KNOWN_ROUTES`, a flag-aware 404) and the service worker's navigation fallback; WS2
hit the same wall and built the program as an in-app view. A segmented switch in `Log.tsx` needs neither: three small hunks
(imports and a lazy chunk; the switch and an early return for the Insights view; the reminder strip). With both flags off the
switch renders nothing and `Log` renders what it did. `useInsightsAvailability()` reads the flags with `useFeatures()`, which the
Watch tab already requests, so there is no new `/api/features` request.

## Charts

- **HTML and CSS, not recharts and not SVG.** Flex columns for the bars, a CSS grid for the heatmap. Reasons: the labels stay at a
  readable size on a phone (a scaled SVG shrinks its text), the markup is real in a server-side render (recharts'
  `ResponsiveContainer` renders an empty box without a DOM, so the 0 / 1 / 10,000 render tests would have had nothing to assert),
  and no extra bundle (the `charts` chunk with recharts is only loaded by the History chart, as before). No new dependency.
- Pure maths in `src/insights/aggregate.ts` (`computeInsights`, one pass over the history, `computeInsightsMemo` keeps the last
  result). **10,000 events: 1.6 ms** (local zone), 22 ms with a named IANA zone; 40,000 events: 5 ms. The app keeps at most 5,000
  (`MAX_INCIDENTS`); the tests go to 40,000 and check it grows linearly. Time budgets in the tests are 10 to 100 times looser than
  the measurements so a slow machine does not flake.
- Calendar maths is in `src/insights/zone.ts` (`localZone()` for the browser, `zoneFor('Area/City')` for tests and for anyone
  else's zone). A property test walks a year of days in 15 zones, including half-hour and 45-minute offsets, +14 and -11, and the
  zones that moved clocks at midnight, and checks that every "start of day" is the first instant of its date.
- Windows: "last 7 days" means the last 7 calendar days including today, against the 7 before. The heatmap and the reasons card take
  a period (30 days, 90 days, all) and stop at the end of today. Weeks start on Monday.
- A free-tier account (WS9) sees charts over the same days its History list shows (`useHistoryWindow`), with the same "older
  entries are saved on this device" sentence. Milestones use the whole history, like the streak.
- Empty states are designed: no events gives a deep card that says what will appear and a Go to Watch button, with the milestones
  below it (they have real progress from the first minute); under 7 entries a note says the charts say more after a week or two.
  A competing-response card or a false-alarm card with no data shows only when its feature flag is on, with a sentence about how to
  fill it.

## Milestones

- **Definitions** (`src/insights/milestones.ts`, pure, clock injected): a streak milestone is the first time there was a gap of 1
  hour / 24 hours / 7 days / 30 days between two bites, from the start of the record to the first bite, or from the last bite to
  now. It is the streak the Watch tab shows (time since the last logged bite), measured in milliseconds, so daylight saving cannot
  move it. "First alarm-free hour" is called "First hour without a bite" because an unreviewed alarm does not break the Watch
  tab's streak, and the milestone should agree with the big number. The count milestone is the 100th alarm that still stands
  (not deleted, not marked "Not a bite"; reviewed or not) and is called "100 alarms" in the copy, because not every alarm is a bite.
- **What it cannot know**: whether the app was watching. A gap is "time since your last logged bite" and the text says exactly that.
- **Once each, ever** (`kv insights/milestones`). The first time the feature runs on a device it records what is already reached
  without a screen (a person who turns Insights on with a 12-day streak is not greeted with "1 hour" from two weeks ago); after
  that every new milestone is celebrated, the longest streak milestone only if several arrive together, the others recorded quietly.
  Clearing History does not reset it. Never within a minute of an alarm. The list in Insights keeps a "View card" for everything
  reached (this is how to see the card on demand).
- **Celebration card**: a labelled dialog (`role="dialog"`, `aria-modal`), focus on Continue and kept on its buttons while open, Escape closes, focus returns, fades up
  only under `motion-safe`, the brand's dashed rings behind, no picture of the habit. It sits at `z-[55]`, under the coaching card.
- **Share card** (`src/insights/shareCard.ts`): a 1080 x 1080 PNG drawn on a canvas with the figure, one plain sentence, the date it
  was reached, the app's name and `stopbiting.today`. No photo (this version has no way to add one, which satisfies "no photo unless
  the user adds it" by not offering it), no name, no email, no other number. Handed to the Web Share sheet where the browser can
  share files, otherwise downloaded. Verified in headless Chrome by capturing the PNG the button produces and looking at it.

## Nail photo diary

Fork B's notes, condensed. Code is in `src/photos/`; behaviour and the guard tests are named in `ws5-privacy.md`.

- **Local only.** Bytes in IndexedDB through `localBlobs` (`stop-biting-local-blobs`, collection `photo-diary`); a small list in
  `kv insights/photo-diary`; one JPEG per photo, at most 1,280 px on the long side, at most 104 photos. Never in sync, export, the
  weekly email or the share card.
- **Capture.** A separate `getUserMedia` for the capture only; every track is stopped on save, discard, cancel, error, unmount and
  when the page is hidden. Hands only: a neutral rounded rectangle with four corner marks and the sentence "Place your hands flat
  in the frame, nails facing the camera". Nothing is drawn of a hand, mouth, face or figure (the guard test fails on `<img>`, svg
  paths and emoji in `src/photos`). The saved photo is mirrored like the preview.
- **A camera that detection is using**: the capture asks anyway; on "busy" it explains that watching is using the camera and offers
  "Stop watching and try again", which calls the store's existing `setCameraEnabled(false)`. It never starts or stops detection
  otherwise.
- **Permission denied, no camera, insecure context**: own small error mapper with plain messages and a retry.
- **Viewing and compare**: photos are drawn to canvases via `createImageBitmap`, never as `<img src="blob:...">`, because the CSP
  (`server.js`, untouchable here) has no `blob:` image source. The slider is two stacked canvases and a native range input.
- **Reminder**: in-app only, a strip above History once the newest photo is 7 days old; "Not now" snoozes a day. No Notification API.
- **Works offline**: it uses no network at all; its code chunks are in the precache.
- **Tests that carry the "no photo data in any request" acceptance**: `src/photos/photoNetwork.test.tsx` (throwing spies on fetch,
  XHR, sendBeacon, WebSocket, EventSource, Image and Request around the whole lifecycle), `scripts/photoGuard.test.mjs` (40 checks: no
  network or sync imports under `src/photos`, no photo-like key in WS4's `SYNC_EVENT_FIELDS` or the server's `EVENT_KEYS`, sync and
  backup never mention the photo store, the service worker caches no photo; it also reads `dist/sw.js` when a build exists), and a
  real-browser run with the network watched and again with it switched off.
- **Known gap**: WS4's "Delete everything" does not delete photos (the Settings > Data card says so). One call from
  `DataSettings.tsx` would; that file is WS4's. Owner decision, noted in the legal draft.

## Weekly summary email

- **Routes** (`server/routes/weeklyEmail.js`, registered in `ROUTE_MODULES`): `GET /api/email/weekly` and `PUT /api/email/weekly
  { enabled, timezone? }` (flag `weekly_email`, then sign-in, per-account rate limit; the browser never sends an address; no
  account email means `400 no_email`). `GET` and `POST /api/email/unsubscribe/:token` are **not gated by the flag and need no
  sign-in**, on purpose: a dead unsubscribe link after the flag goes off is a compliance problem and honouring a token only
  reduces processing. They are under `/api/` so the service worker's navigation fallback leaves them alone and they pass the CORS
  check (an email click and a mail provider's one-click POST both carry no `Origin`). `GET` shows a confirmation page and never
  changes anything (link scanners open links); `POST` unsubscribes (browser form, or RFC 8058 one-click). A forged or truncated token
  gets the same neutral 404 page as an unknown account.
- **Token**: `base64url(userId).base64url(HMAC-SHA256(per-account random secret, "weekly-summary-unsubscribe:v1:" + userId))`,
  verified with a constant-time compare after looking the secret up. Rotating the secret kills old links.
- **Table** `email_preferences(user_id, weekly_summary, timezone, unsubscribe_secret, last_sent_week, opted_in_at, updated_at)`
  (migration `ws5_001`, additive).
- **Job** (`server/jobs/weeklyEmail.js`): hourly, in process, started in `register()` only when `weekly_email` is on,
  `RESEND_API_KEY` is set and the server is not the desktop wrapper's (`ELECTRON_PROTOCOL`), with `.unref()`. For each opted-in
  account with synced events, it works out the last completed ISO week in that person's own time zone and sends between 8 and 72
  hours after it ended, only if the week ended after they opted in and there was a bite in either week. **Claim, then send**:
  `UPDATE email_preferences SET last_sent_week = week WHERE ... last_sent_week < week` must change one row before anything is
  sent (a restart, a second container during a rolling deploy, or two overlapping ticks cannot double-send); if the send throws or
  returns `{ error }`, the claim is put back and the next tick retries inside the window. **The Resend SDK returns `{ data, error }`
  and does not throw on an API error**, so the job checks the result (`isSendSuccess`); the older emails in `email.js` still do not
  (left as they were). At most 200 sends per tick.
- **Content**: bites logged that week, change against the week before (whole percent, left out when the week before had none),
  the reason picked most often (built-in reasons only; needs 3 tagged bites and one reason twice), the weekdays with the fewest bites
  logged, alarms waiting for review. Plain and branded like `email.js`; no image, no name, no address in the body, no claim of a
  cause, "A log is a way to notice a habit, not a treatment." Headers `List-Unsubscribe` and `List-Unsubscribe-Post`.
- **Settings card** (`src/pages/settings/WeeklyEmailSettings.tsx`, mounted with one line in `AccountSyncSection.tsx`; lazy, so
  nothing is downloaded while the flag is off): toggle, a hint when sync is off, an error state; sends the browser's time zone.

## Verified, and how

- `npm run build:web` exit 0; `npm test` 116 files / 2,223 tests (main was 95 / 1,739), all pass, under TZ UTC, America/New_York,
  Pacific/Auckland, Asia/Kolkata and America/Sao_Paulo for `src/insights`; lint scoped to src, server, scripts, electron, shared:
  23 errors / 4 warnings, the same as before this work (none in WS5 files); `node --check` on `server.js` and every server file
  added or touched; `npm run seo:check` clean.
- Insights in headless Chrome against the Vite dev server (`?preview=subscribed&ff=insights`): switch, all three chart kinds,
  series and period switches, empty state (after `clearHistory`), 1280 and 390 px, light and dark (screenshots looked at: no
  horizontal scroll, 44 px controls), celebration (card appears, focus on Continue, Escape closes, no return, not repeated after a
  reload, no request of any kind), share card PNG captured and looked at, flags off shows nothing.
- Photo diary in the real Insights view (fake camera): empty state, capture, save, bytes in IndexedDB, no request during capture
  and save, the diary's own camera tracks all ended, no reminder right after a photo, reminder when the photo is 8 days old and its
  button opens the diary, Settings > Data card, `photo_diary` alone gives a "Photos" view with no charts. Fork B's separate run: 82
  checks including offline.
- Weekly email against the real `server.js` on a temporary port with dummy env: flag on applies the migration and answers 401
  without a session and a neutral 404 for a forged token; flag off answers 404 and starts no job.

## NOT verified

- A real camera and real hands (the fake camera is a green test pattern); a busy camera and a permission denial (not producible with
  fake-camera flags, tested through the mapper and controller only); the "Stop watching and try again" button against real
  detection; Safari and Firefox; a real screen reader (labels checked in the markup only).
- Real email delivery through Resend, a real mail client's one-click POST and its rendering (simulated with `fetch`/curl), the
  sender domain, spam placement. The Resend result shape was read from SDK 6.12, not observed live.
- The Web Share sheet: headless Chrome says it can share files but has no sheet, so the download path was exercised for real and
  the share path with a stub (a PNG file named for the milestone is handed over).
- The weekly-email Settings card in a browser (rendered in node; it needs a signed-in session against a server with the flag on).
- The photo diary offline with the real service worker: fork B's offline run used a harness page with no worker, and the
  integration run in the real Insights view stayed online (it watched requests and saw none, and the diary uses no network
  API at all, but "reload the app while offline and open the diary from the precache" was not tried). The diary's code chunks are
  in `dist/sw.js`'s precache (checked).
- The production server's HTML: the flags-off comparison above used Vite dev servers (main and this branch, second capture after
  the lazy modules had warmed), not `server.js` serving `dist/` as WS4's comparison did. A different method, not a known gap; the
  server-side difference was checked separately (404s with the flags off, no job).
- Daylight-saving behaviour beyond Node's own time-zone data.

## Owner TODOs

1. Read and publish the right parts of `docs/agents/legal/ws5-privacy.md` and `ws5-terms.md` with each flag (they depend on the WS4
   wording for sync). Decide whether "Delete everything" should also delete photos.
2. Email: verify the sender domain (`EMAIL_FROM`), send yourself a test week, read the wording, confirm Resend's terms. When you
   delete an account by hand, delete its `email_preferences` rows as well as its `habit_events` rows.
3. Try the diary with a real camera (Mac, Windows, a phone-width window).
4. Turn flags on in this order: `insights` (look at the charts on your own data), `photo_diary`, then `event_sync` + `weekly_email`.

## Seams in shared files (each small)

- `src/pages/Log.tsx`: imports, `useInsightsAvailability()` + a `view` state, an early return for the Insights view, the switch and
  `<PhotoReminder />` under the title.
- `src/App.tsx`: one import and `<MilestoneHost />` in the signed-in app (it renders nothing and downloads nothing with `insights`
  off).
- `src/pages/settings/sections/AccountSyncSection.tsx`: one import and `<WeeklyEmailSettings />`.
- `src/pages/settings/sections/DataSection.tsx`: one import and `<PhotoDiarySettings />`.
- `server/routes/index.js`: one import and one entry.
- `docs/agents/ARCHITECTURE.md`: file map, the email note, the ownership table.
- Not touched: detection files, `AlertOverlay`, `PiPWindow`, sync code, Paddle, marketing pages, `server.js`, `email.js`,
  `vite.config.ts`, the CSP, `Dockerfile` (`COPY server ./server` already covers `server/jobs` and `server/weeklyEmail`).

## Deviations from the plan, and why

- Charts are HTML/CSS, not recharts or SVG (above).
- "First alarm-free hour" is "First hour without a bite", and "100 bites caught" is "100 alarms" in the copy (above).
- The share card cannot include a photo at all (the plan allowed it if the person adds one).
- The unsubscribe routes ignore the flag (above).
- Milestone baseline on first run (above), not in the plan.
- The photo diary has no export, by design.

## Known limits

- A milestone is "time since the last logged bite": a person who does not open the app for 30 days "reaches" the 30-day
  milestone (the Watch tab's streak says the same). Only the longest of several streak milestones that arrive together is shown.
- `weekly_email` counts all behaviours, like History. A winning custom bite reason is not named in the email (labels are not synced).
- People with lapsed access still receive the email if they opted in and have bites (no subscription check).
- Two tabs of one browser each run a milestone check; the second usually sees the first's record in `kv` and shows nothing, but two checks in the same instant could both show the card once.
