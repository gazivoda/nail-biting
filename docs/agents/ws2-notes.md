# WS2 (Post-alarm coaching, urge timer, 4-week program) — notes

For the owner, for WS3 and WS7a (the seams), and for WS13 (release notes). Reference material is in
`docs/agents/ARCHITECTURE.md`; this file says what WS2 added and where it touches shared code.

## What exists

| Feature | Flag | Where it shows | Default |
|---|---|---|---|
| Competing-response prompt after an alarm (countdown ring, Done / Skip, Escape) | `hrt_coaching` | a card over the app, and a one-line strip in the minimized window | **prompt OFF** until the person turns it on in Settings > Alerts |
| Settings > Alerts card: when to prompt (Off / Once an hour / Every alarm), length 15 to 60 s, pick a response or write your own, the stat, link to the program | `hrt_coaching` | Settings | prompt Off, 30 s, "Clench your fists" |
| "I feel an urge" button and 60 / 90 s breathing timer, logs a manual event with trigger `urge` | `urge_timer` | Watch tab, under "I just bit my nails" | n/a |
| 4-week program: 28 short daily lessons, progress saved locally | `hrt_coaching` | a quiet text link on the Watch tab, and a link in Settings > Alerts; opens a full-screen view | not started |
| Stat: share of alarms followed by a finished competing response | `hrt_coaching` | Program view and the Alerts card (only once there is a prompted alarm) | hidden until there is data |

Turn on (owner): in Coolify set `FEATURE_FLAGS=hrt_coaching,urge_timer` (either one alone also works) and restart. No
rebuild. Then each person opts in to the prompt under Settings > Alerts. **Do not turn `hrt_coaching` on in production
before the lessons are reviewed (below).** `urge_timer` does not depend on it technically.

No new env var, no `.env.example` change (both flags were already listed by WS0), no new dependency, no server change.

## The seams (for WS3 and WS7a)

Each is one line in a shared file. Both are `CoachingSeam` from `src/coaching/CoachingSeam.tsx`.

1. **`src/components/detection/AlertOverlay.tsx`**: `<CoachingSeam surface="main" />`. `AlertOverlay` is rendered by
   `DetectionSurface`, which the landing-page demo also renders, so the file became
   `AlertOverlay = <><CoachingSeam/>{visible && <AlertFlash/>}</>` (the old body is the unchanged `AlertFlash`).
   The seam is deliberately store-free; `scripts/coachingGuards.test.mjs` fails if anything under it imports the store,
   the storage module, flags or auth. WS3's "Not a bite" goes next to this line. The flash is still mounted only
   while `visible`.
2. **`src/components/detection/PiPWindow.tsx`**: `<CoachingSeam surface="pip" />`, first child of the root div. While a
   prompt runs it covers the 240x64 strip with one row (ring, two lines of text, Done, Skip) and leaves PiPWindow's own
   3 px red alert border visible around it. WS7a: if you change the window size, the strip is `position:absolute;
   inset:3px`, so it follows; it clamps the text to two lines.

Other shared-file lines (all flag-gated, all render nothing with the flags off):
`Dashboard.tsx` `<CoachingDashboardSlot />` (bridge, urge timer, program link), `App.tsx` `<ProgramHost />`
(a tiny static component; the view itself, the flag check and the lesson text are lazy chunks, so the main bundle that
landing visitors download only grew by about 1.2 kB gzip),
`sections/AlertsSection.tsx` `return <CoachingSettings />`.

## Why the overlay can never block, delay or silence the alarm

- **Order.** `useDetection.startBiting` starts the sound and sets the alert status, and only then calls `onAlert` ->
  `logIncident`. Coaching hears about an alarm only when the history changes, after the sound is already playing. No
  coaching file imports the detector, the camera, the alarm sound or Picture-in-Picture code (guard test 2).
- **The one piece inside the alarm path** is the store listener in `src/coaching/watcher.ts`. It does a single pure check
  and defers everything else with `queueMicrotask`; it is wrapped in try/catch so a throw cannot travel back up through
  `logIncident` into `startBiting` (which would skip the tab-title flash and the notification). Tested with throwing
  settings, storage and history.
- **Optional and dismissible in every state.** `session.ts` is a pure state machine; `skip` works from running, finished
  and idle and always ends idle (tests: "every state can be left with one Skip", "nothing can resurrect the session").
  Escape skips, in whichever document the card lives in; Skip is a real button; there is no modal, backdrop, focus trap
  or `aria-modal`; focus is never moved to the card.
- **Results are saved once.** Each offer yields at most one result. The countdown is timestamp-based, so throttled timers
  in a hidden tab do not matter.
- **If nobody can see it, it is not counted.** The controller counts mounted surfaces; if the camera is stopped (the
  overlay unmounts) mid-countdown the session is dropped with no result, so an unseen countdown never becomes "done".

## Data

- Alarm event: `competingResponse: { done, durationSec }` (WS0's field), written with `events.update`. Done = `done:true`
  with the seconds spent; time up = `done:true`, full length; Skip / Escape = `done:false` with the seconds spent. Alarms
  that were not prompted have no `competingResponse`.
- **Urge event: a manual event, `triggers:['urge']`** (stored `tag: 'urge'`), logged when the timer starts (the urge
  happened), with `competingResponse` saved when it ends. **It is not a bite.** Every manual event used to be a bite, so
  without a change an urge would have reset the streak. `isUrge()` (new, `src/storage/eventModel.ts`) is applied in
  `isBite` (`useAppStore.ts`, so streak, best streak and `lastBiteTime` ignore it), in History (a calm green "Urge" /
  "Urge, timer finished" pill, not red), in Today's bite count, in the History summary and "Bites" chart, and in the
  "All" chart (which is "alarms and bites"). `Log.tsx`'s own copy of the predicate now calls `isBite`, so there is one
  definition again. An alarm someone confirms with the tag `urge` is still a bite (tested).
  Do NOT add `urge` to `PRESET_TAGS` (it is the answer list for "what set the bite off").
  Consequence for WS3: `isBite` is the one place to add `falsePositive`; Log and Today follow it now.
  A stale tab running the previous bundle would count an urge entry as a bite; only matters while `urge_timer` is on.
- kv (namespace `hrt`): `settings`, `last-prompt-at`, `program`. Nothing else, nothing synced. When WS4 syncs events,
  `competingResponse` and the urge entries travel with them as ordinary `HabitEvent`s.
- Stats (`src/utils/coachingStats.ts`, pure, for WS5): alarms (not manual, deleted or `falsePositive`) from the first
  alarm that had a prompt, followed = `competingResponse.done`. `rate` is `null` (not 0%) when there are no alarms.
  Alarms the "once an hour" setting did not prompt count as not followed; `completedOfPrompted` is the other reading.

## The prompt policy

`off`, `every` (every alarm event; alarms less than 30 s apart are already one event in the store), `hourly` (the first
alarm event when the last prompt shown is at least a rolling 60 minutes old; a clock moved backwards allows a prompt).
Only a prompt that was actually shown moves the hour. A new alarm during a running prompt does not stack or restart it.

## The 4-week program: NEEDS HUMAN REVIEW

`src/data/hrtProgram.json` starts with `"status": "NEEDS HUMAN REVIEW"`; every lesson has `"reviewed": false`. All 28
lessons are first drafts, written from scratch, with no clinical input. Rules the draft follows, enforced by
`src/coaching/program.test.ts`: plain and practical, no medical or outcome claim, no percentage, study or "proven",
no promise ("will stop"), no en or em dash, no emoji, text only (no image fields), and an app is not a clinician
(the disclaimer and lesson 27 say so). The page shows a yellow banner in **development builds only** while any
lesson is unreviewed; production shows no marker.

Before turning `hrt_coaching` on: read all 28 lessons (one file), edit or delete anything that overreaches, set each
`reviewed` to `true` and the top-level `status` to `"reviewed"` (the tests then need the same edit: they assert the
draft state on purpose). Four lessons name app UI and go stale if it moves: 9 and 11 ("Settings, under Alerts"),
12 ("15 to 60 seconds"), 17 (the History tab's busiest hour). Lesson 11 describes the prompt: re-read it if the
prompt behaviour changes.

Index: Week 1 Awareness (1 What this program is, 2 The moment you notice, 3 Where your hands usually are, 4 Using the
alarm as a second pair of eyes, 5 What comes just before, 6 Where you are when it happens, 7 Week 1 look back).
Week 2 Competing response (8 What a competing response is, 9 Choosing yours, 10 Practise when it is quiet, 11 Using it
when the alarm sounds, 12 How long to hold it, 13 When you do not feel like it, 14 Week 2 look back). Week 3 Trigger
mapping (15 What a trigger is, 16 Feelings, 17 Time and place, 18 Activities and things nearby, 19 Changing the setup,
20 An if-then plan, 21 Week 3 look back). Week 4 Slips and staying with it (22 A slip is information, 23 The 'might as
well' moment, 24 Getting back on track in a minute, 25 Hard days, 26 People who can help, 27 When an app is not enough,
28 Your plan from here).

**Unlocking** (`src/coaching/programProgress.ts`): lesson 1 opens when the person presses Start; lesson N+1 opens on the
first local calendar day after lesson N was marked done. At most one new lesson a day; a missed day or month loses
nothing and creates no backlog, streak or "behind" state (tested, including month/year edges and a clock set back).
Dates are local `YYYY-MM-DD` strings. If you would rather unlock by calendar day from the start date, it is a
three-line change in `unlockedCount`.

## Deviations from the plan, and why

- **The program is an in-app full-screen view, not a URL.** `server.js` answers any path outside `KNOWN_ROUTES` with the
  branded 404, and a flagged page would also have to 404 while its flag is off; both need `server.js`, which this
  workstream may not touch. The view opens from the Watch tab link or the Alerts card, closes with Back, Escape or a
  button, makes the app behind it `inert`, and works offline. The "one route line in App.tsx" is the one
  `<ProgramHost />` line. If a URL is wanted later: add `/program` to `KNOWN_ROUTES` (404 when the flag is off) and a path
  branch in `App.tsx`.
- **The urge button is a sibling of `PanicButton`, not an extension of it.** `PanicButton` records a bite and resets the
  streak; the urge button records an urge. It borrows PanicButton's pattern (button, sheet, confirmation with Undo,
  polite live region).
- **The prompt starts when the alarm event appears, not "after the flash".** The flash ends 300 ms after the hand leaves
  and sound-only users never see it; the countdown must outlive both.
- Settings: `settings.test.tsx` (WS0) listed `hrt_coaching` in its "sections render nothing while empty" case; the
  Alerts section has content now, so that one flag was removed from that one test (the case still covers the others).

## Known limits and follow-ups

- **Three different coaching sentences can be on screen** with the prompt on: the flash's fixed "Press your thumb to each
  fingertip.", `ReplacementPrompt`'s rotating `SUGGESTIONS` line, and the user's chosen response. `SUGGESTIONS[0]` is
  reused as a preset. Unifying them is a follow-up: the flash is in the light chunk and cannot read settings (the
  controller could carry the text).
- One `GET /api/features` per signed-in page load now happens on the Watch tab (it used to be only Settings). It is the
  only observable difference with every flag off.
- The seam ships in the chunk the landing demo loads (`useDetection-*.js`: +6.5 kB raw, +2.1 kB gzip over the pre-WS2
  build: card, controller, state machine). It is inert there and store-free (guard test 1). Other deltas vs the pre-WS2
  build: main `index-*.js` +3.7 kB raw / +1.2 kB gzip (ProgramHost and the view state), `Dashboard-*.js` +11.6 kB raw (bridge,
  urge timer, settings model), and new lazy chunks `Program-*.js` (21.9 kB, the lesson text) and `ProgramView-*.js`
  (1.6 kB), precached by the service worker so the program opens offline.
- `PaywallPage` "alerts logged" counts urge entries (it counts `incidents.length`). Cosmetic.
- "Not a bite" in `ReplacementPrompt` deletes the event while a countdown runs; the countdown finishes and its save is a
  no-op (`events.update` returns undefined). No crash, no bad data.
- The minimized-window strip is verified in an iframe standing in for the Document PiP window (same cross-document
  portal mechanism), not in a real Document Picture-in-Picture window. The video-PiP fallback shows no custom UI, as
  before. Buttons in the strip are 52x24 px, below the 44 px touch target, because the window is 240x64.
- Focus returns to the program link on close in Chrome; Safari does not focus buttons on click, so there focus stays on
  the page.
- The card is a fixed element in a portal on `<body>` (so it shows over every tab); it sits at `z-60`, above the
  program view (`z-55`) and below the onboarding tour (`z-200`).

## Verified, and how

Pure logic (state machine, policy, watcher with throwing dependencies, settings, program unlocking, stats, breathing,
urge-not-a-bite through the real store): vitest, 448 tests in the whole suite at the end (39 files; baseline was 27 files and 260 tests). Source guards
(`scripts/coachingGuards.test.mjs`, mutation-checked): the seam stays light, no coaching file touches the detector,
sound or camera, no network call, no image or non-allowlisted icon, every entry point behind its flag.

Browser, headless Chrome with a fake camera against `vite --port 5202` (`?preview=subscribed&ff=...`; scripts were
throwaway, in the session scratchpad): prompt after an alarm (new alarm event), Escape / Skip / Done / time-up each save
the right `competingResponse`, no focus stolen, polite announcement, over every tab, reduced motion (ring hidden,
number kept), 390 px, prompt above the program view with Escape dismissing only the prompt, camera stopped
mid-prompt, urge timer (logged as manual/`urge`, streak and bite count unchanged, History pill, reduced motion),
program (start, mark done, tomorrow lock, inert background, Back button, focus return); each flag alone; the minimized
strip in a 240x64 iframe (fits, Escape and Done work from that document, the red alert border stays visible); with
every flag off the signed-in app's DOM (Watch, History, Settings at 1280 and 390 px, with the onboarding tour dismissed)
is identical to the pre-WS2 build when both are captured at the same clock time (digits and times normalised: the
preview fixtures and the "most bites" insight depend on the time of day); and the whole flow again with the network
switched off (no fetch/XHR/beacon attempted).

NOT verified: a real camera (nothing here needs one, but the alarm itself was simulated by adding an alarm event), a real
Document Picture-in-Picture window, real screen readers (announcements checked in the DOM only), Safari and Firefox,
the production bundle signed in (the preview fixtures are dev-only; the built chunks were checked by grep).
