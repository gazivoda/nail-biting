# WS13 accessibility report (item 3)

Scope: every new overlay and screen from workstreams WS1 to WS10, with every UI feature flag ON, plus the pages that host them.
Measured on 24 October 2026 on a local run of this tree (base `b6b16f9` plus the fix commits below), headless Chrome 155 on macOS.
Light and dark themes, 1280 px and 390 px (and 320 px for reflow). No real screen reader and no real assistive technology were used:
every statement about what a screen reader "hears" is a statement about the page's accessibility tree and live regions.

Result in one line: 29 surfaces checked, 1 not reachable (the mini-window strip). 29 issues found: 14 fixed, 15 open (13 findings and 2
notes, none High). Lighthouse accessibility is 100 on all 9 reachable URL and form-factor combinations (that number alone proves little: see
"Not reached or not verified").

## Method and tools

| What | How |
|---|---|
| Build under test | `VITE_WS7A_PROBE=1 VITE_BUILD_TARGET=web npx vite build --outDir <scratch>/dist-a11y`. The probe hook lets the real detector see a hand, so the real alarm, coaching prompt and "Not a bite" toast appear without a hand. The probe was built only into a scratch folder; `./dist` was never touched. |
| Server | A copy of the real `server.js` on port 3216 with every UI flag on (`hrt_coaching ... compare_competitors`), dummy provider keys so Apple, Microsoft and the emailed link show, a temp database with one signed-in trial user, and a share link made through the real API. |
| Browser | Chrome (`--headless=new`, fake camera, debug port 4216; 4217 for Lighthouse), driven over the DevTools protocol with Node's built-in WebSocket. Real key events (`Input.dispatchKeyEvent`), real mouse events. |
| Lighthouse | 13.5.0, accessibility category only (axe-core engine), `--port=4217`, local server only. |
| axe-core | 4.13 injected into each state (rule tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice), light and dark. |
| Tab walk | Real Tab presses from the top of the page; records each stop (name, role, `:focus-visible`, outline), flags traps, unreachable controls and wrap-around. |
| Focus indicator | Pixel comparison of the element's neighbourhood unfocused vs focused (after a keyboard event so `:focus-visible` applies), 19 controls in light and dark (38 checks), not only computed styles. |
| Escape and focus | Escape on every overlay, then where focus is; focus on open; Tab cycle inside modals. |
| Roles, names, states | `Accessibility.getFullAXTree`, scoped per surface; every button, slider, switch, radio, image, dialog must have a name. |
| Live regions | A MutationObserver on every `aria-live`, `role=status`, `role=alert`, `role=timer`: how often the text changes in each state ("spam" = more than about one change a second for many seconds). |
| Reduced motion | `Emulation.setEmulatedMedia prefers-reduced-motion: reduce`, then `document.getAnimations()`, the CSS rules, and the JS (DetectionWave reads `matchMedia`). |
| Contrast | Computed styles; every colour resolved by painting it on a 1x1 canvas and reading the pixel (Chrome returns `oklch()`), translucent layers composited from the nearest opaque ancestor, large-text threshold 3:1 else 4.5:1, disabled controls exempt. Colour transitions are switched off during the measure (a first pass measured mid-transition colours and invented a failure). Sanity anchor: black on white = 21. Backgrounds that are gradients or images are listed as "needs review" (only the lime highlighter word in each page title). Non-text (text fields, switches): boundary or fill against what is around it, 3:1. |
| Target size | WCAG 2.2 AA 2.5.8: 24 x 24 CSS px, with the spacing exception and the inline-link exception. 44 px is reported too, as guidance. |
| Reflow | 320 CSS px wide (400 percent zoom), page must not scroll sideways and nothing may be cut off. |

Harness: `docs/agents/a11y-audit/` (scripts, not run by `npm test`, not linted). To repeat: `A11Y_DIR=/tmp/ws13-a11y`, build the probe into
`$A11Y_DIR/dist-a11y`, `node docs/agents/a11y-audit/rig-server.mjs` (leave it running), then `node docs/agents/a11y-audit/a1_alarm.mjs` and the
other `aN_*.mjs`; `bash docs/agents/a11y-audit/run-lh.sh` then `node docs/agents/a11y-audit/lh-sum.mjs` for Lighthouse. axe-core comes from the
npx cache that Lighthouse fills (`AXE_JS` overrides). Ports 3216, 4216 and 4217 are hard-coded.

## Lighthouse accessibility scores (local server, final build)

| Page | Mobile | Desktop |
|---|---|---|
| /signin | 100 | 100 |
| /share/&lt;token&gt; (public summary) | 100 | 100 |
| / signed out (landing) | 100 | not run |
| /pricing | 100 | not run |
| / signed in (Watch tab, session cookie) | 100 | 100 |
| /redeem (signed in) | 100 | not run |

Caveat: Lighthouse starts a clean browser profile, so the signed-in `/` runs were audited with the onboarding tour dialog open on top of the
Watch tab. History, Settings and every overlay have no URL of their own; they were checked with axe-core and the hand-written checks below.

## Surfaces

Keyboard = Tab order logical, no trap, every control reachable. Focus = visible indicator (pixel check). Esc/focus = Escape behaviour and where
focus goes. AT = roles, names, live regions. Motion = behaviour under prefers-reduced-motion. Contrast = lowest text ratio, light / dark (WCAG
4.5, large 3). Status: pass, fixed (by this work), or open (issue number in the next section).

| # | Surface | Keyboard | Focus | Esc / focus | AT | Motion | Contrast L / D | axe | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Watch tab (camera card, streak, session, today, buttons) | 18 stops, wraps, no trap | yes | n/a | all named; "Watching" status | pulse and ping stop | 5.9 / 4.6 (streak colon 2.2, decorative) | 0 violations, both themes | pass (O9) |
| 2 | Alarm flash ("Hands down") | none (pointer-events off) | n/a | n/a | not a live region | steady, no fade | 11.8 / 15.0 | 0 | pass (O5) |
| 3 | Coaching prompt and countdown ring | Done, Skip reachable, but ~24 Tab stops from the top (portal at the end of body) | yes | Escape = Skip; focus is never moved (by design) | polite status says it once; ring and ticking number aria-hidden | ring hidden, number kept, fade removed | 8.3 / 8.3 | 0 | pass (O6, O7) |
| 4 | "Not a bite" toast (offered, marked, Undo, Calibrate link) | same as 3 | yes | Escape left alone (by design); the button keeps focus and becomes Undo | polite status: "Alarm. If it was a false alarm..." then "Marked as not a bite..." | none | 5.9 / 5.1 | 0 (region: portal outside landmarks, O14) | pass (O7) |
| 5 | Post-alarm card (reasons) | 6 buttons, 44 px | yes | none | h2 + named buttons | fade removed | 5.9 / 5.2 | 0 | pass (O12) |
| 6 | Urge timer: choose, running, logged | focus goes to Start, then Stop, then Undo | yes | Escape closes or stops; focus returns to the trigger or lands on Undo | **was**: only the start message; **now** also "Breathe in" / "Breathe out" at each phase | circle hidden, text "Breathe in 2, 58 seconds left" | 7.1 / 8.2 | 0 | **fixed** (F2) |
| 7 | Pause and meeting controls (Watch tab card) | pills 44 px | yes | n/a | status with end time | none | see 1 (same page) | 0 | **fixed** (F8); O11 |
| 8 | Pause panel over the camera frame | one button | yes | n/a | status | none | 9.3 / 9.3 | 0 | **fixed** (F9); O11 |
| 9 | Calibration dialog | focus on open, Tab cycle stays inside (page is inert), exits to browser chrome like any modal | yes | Escape closes, focus returns to Calibrate | dialog, aria-modal, labelled; **was** a live region ticking every second | none | 7.4 / 9.8 | 0 | **fixed** (F1) |
| 10 | Milestone celebration dialog | focus on Continue, trap works, Shift+Tab ok | yes | Escape closes, focus returns to the control focused before | dialog, aria-modal, labelled by the heading; status for the share result | fade removed | 6.5 / 6.5 | 0 | pass |
| 11 | Share card (the PNG) | n/a | n/a | n/a | the sheet carries text ("Stop Biting: First day without a bite. Reached ...") | n/a | lime on deep 11.9, white 15.4, 80 percent white 10.3, 75 percent 9.2 | n/a | pass |
| 12 | Photo diary: capture panel | heading takes focus, 3 buttons | yes | Close and Cancel; focus returns to the Take button; **was** lost after the first photo | status regions (opening, counting, saved) | none | 8.4 / 9.4 | 0 | **fixed** (F6) |
| 13 | Photo diary: before/after slider | native range: arrows, Home, End, PageUp and PageDown all work | yes (browser ring) | n/a | name "Reveal the earlier photo", `aria-valuetext` "The earlier photo is shown across N percent of the picture" (DOM attribute; Chrome's tree does not list it as `valuetext`, see limits) | none | 6.5 / 9.4; Before/After pills white on 60 percent black, worst case over a white photo 5.7 | 0 | pass (O1 for the two date selects) |
| 14 | Photo diary: grid and two-step delete | focus goes to Keep | yes | Escape does nothing (O13) | group labelled by the question | none | 6.5 / 7.3 | 0 | pass (O13) |
| 15 | History list (rows, per-row Not a bite, Undo, delete) | 232 controls reachable; the hover-only buttons appear on focus | yes | n/a | every row button named with the time | none | 5.9 / 4.7 | 1 moderate (heading-order, O8) | pass; **fixed** header reflow (F14); O3, O8 |
| 16 | Insights (week card, daily and weekly bars, heatmap, reasons, milestones list) | 10 controls | yes | n/a | each chart is `role=img` with a sentence (**was** `figure role=img`, invalid) | none | 7.1 / 8.2 | 0 after fix | **fixed** (F3) |
| 17 | Settings (all sections, 45 Tab stops) | logical, wraps | yes (34 solid 2 px, 8 native) | n/a | 113 AX nodes, none unnamed | none | 5.7 / 4.6 after fix | 0, both themes | **fixed** (F12); O1, O2 |
| 18 | Settings > Alerts (coaching: segmented radios, slider, presets, custom field) | radio groups: roving tab stop, arrows; slider: arrows, Home, End | yes | n/a | radiogroups and slider named | none | 5.9 / 4.6 | 0 | pass |
| 19 | Settings > Detection, Behaviors | switches and radios | yes | n/a | named | none | 7.1 / 8.2 | 0 | pass |
| 20 | Settings > Schedule and the notification permission flow (explain, denied, granted, days, times) | Allow, Not now | yes | n/a | region "Allow notifications"; denied and unanswered are `role=status`; **was** silent, focus stayed on the switch | none | 8.4 / 9.4 | 0 | **fixed** (F7) |
| 21 | Settings > Account and Sync, Weekly summary email | switches | yes | n/a | "Weekly summary email is on" announced once; sync status polite | none | 8.4 / 9.4 | 0 | pass |
| 22 | Settings > Sharing (make, copy, revoke) | create button, link field (selected, focused), Copy, Done, Revoke, confirm (Keep focused) | yes | n/a | **was** an `aria-label` on a plain div (ignored); "Copied", "Link revoked" announced | none | 8.0 / 9.4 | 0 (1 needs-review gone) | **fixed** (F4, F5); O1 |
| 23 | Settings > Data, Photo diary card, Refer a friend, Appearance, Privacy | confirm groups focus the safe button | yes | Cancel returns focus to the top of the page (O12) | confirm groups named | none | 7.8 / 4.7 | 0 | pass (O1, O12) |
| 24 | Sign-in page `/signin` (Google, Apple, Microsoft, emailed link, sent, error, finish) | 8 stops | yes (3 px) | n/a | landmarks, one h1, field labelled, errors are alerts; **was** focus lost after the link was sent | none | 6.2 (light-only page) | 0 | **fixed** (F10); O1 |
| 25 | Public share page `/share/<token>` (desktop, 390, 320; light and dark by media query; 404 page) | one button (Print) | yes | n/a | landmarks, headings, each SVG chart `role=img` with its data in the name | none | 7.8 / 9.2 | 0 | pass |
| 26 | Phone view at 390 px (touch emulation): log, tag chips, Undo, urge timer, recent list | 10 stops | yes | n/a | status announces "Bite logged..." once; **was** focus lost after Undo | circle hidden | 6.3 / 4.6 | 0, both themes | **fixed** (F11); O4 |
| 27 | 4-week program view (dialog) | focus on open, page inert | yes | Escape closes, focus returns to the link | dialog, labelled | none | 7.4 / 9.4 | 0 | pass |
| 28 | Paywall and gift redemption | Back, Sign out; code field | yes | n/a | named | none | 5.5 / 5.5 | 0 | pass (the Paddle plan buttons were not reachable) |
| 29 | Onboarding tour, install prompt (existing, but they sit on top of the new screens) | tour: focus on Next | yes | Escape closes the tour | dialog, labelled | none | 8.4 / 5.2 | 0 (install prompt: region, O14) | pass |
| 30 | Mini window strip (Document Picture-in-Picture) | not reachable in headless Chrome | | | | | | | not verified |

Targets: every control on the phone view is at least 44 px; the Watch tab, History (desktop), Settings, dialogs and the sign-in page have no
interactive control under 24 px other than inline links inside sentences (exempt) and 16 px native radio inputs sitting inside 44 px labels. On
History at 390 px, 32 controls are between 37.5 and 44 px (AA passes, platform guidance does not: O15). The strip's own buttons are 52 x 24 px
(WS2 notes), exactly the AA minimum.

Reduced motion in one place: the alarm flash holds steady instead of fading, `.animate-pulse`, `.animate-ping`, `.animate-fade-up` are switched
off by the rules in `src/index.css`, every other transition is cut to 0.01 ms, the coaching ring and the breathing circle are hidden and
replaced by the number or by the words, and `DetectionWave` does not start its animation frame loop. No state kept a running animation under
the emulation.

## Fixes made

All class-level or markup-level; no colour token and no layout was redesigned. Each commit is separate and touches only the files listed.

| # | File | What and why | Test | Commit |
|---|---|---|---|---|
| F1 | `src/calibration/CalibrationView.tsx`, `steps.ts` | The seconds left and frame count sat inside four `aria-live` blocks, so each 15 s step produced a new announcement every second (measured 1.2 changes a second). The step instruction is now one always-present polite region (`stepAnnouncement`, the same text for the whole step); the numbers stay on screen outside any live region. After the fix: 0 live changes in 6 s. | `steps.test.ts` | 39665b2 |
| F2 | `src/coaching/UrgeTimer.tsx` | The breathing picture and ticking text are `aria-hidden`, so assistive technology only heard "Breathing timer started" and then nothing: the guide did not exist for it. A polite `sr-only` region now says the phase word ("Breathe in", "Breathe out") when it changes, never the seconds (about 10 announcements a minute, which is the feature). `Breathing` is exported for the test. | `coachingUi.test.tsx` (3 tests) | 39665b2 |
| F3 | `src/insights/ui/BarSeries.tsx`, `HeatmapGrid.tsx` | `<figure role="img">` is not allowed (axe `aria-allowed-role`); now `<div role="img">`, and the heatmap legend `figcaption` (outside any figure) is a `div`. Same look. | `insightsUi.test.tsx` | 2d9f251 |
| F4 | `src/pages/settings/SharingSettings.tsx` | `aria-label` on a plain div is ignored by assistive technology ("What this link will show"); it is now `role="group"`. | `sharingSettings.test.tsx` | 2d9f251 |
| F5 | same file | "Done" on the new-link panel and "Yes, revoke this link" remove the button that had focus; focus fell to the top of the page. It now goes to "Make a share link". | verified in Chrome | 2d9f251 |
| F6 | `src/photos/PhotoDiary.tsx` | After the first photo the page turns from "no photos" to "your photos"; the Take button that had focus was replaced a moment later and focus was lost. Focus is set again when the list arrives. | verified in Chrome | 6fe8500 |
| F7 | `src/background/ScheduleSettings.tsx` | Turning the reminder on opened an explanation that nothing announced, with focus staying on a switch that still said "off". The Allow button now takes focus; "Not now" puts focus back on the switch. | verified in Chrome | 6fe8500 |
| F8 | `src/background/BackgroundSlot.tsx` | "Resume now" and "End meeting mode" remove themselves; focus now goes to the first pause choice. | verified in Chrome | 6fe8500 |
| F9 | `src/background/PausedOverlay.tsx` | Same for the pause panel over the camera frame: focus goes to the camera card's Stop button. | verified in Chrome | f016a8f |
| F10 | `src/pages/SignIn.tsx` | After "Email me a sign-in link" the form is replaced; focus now lands on "Check your inbox". | verified in Chrome | 6fe8500 |
| F11 | `src/phone/LogToast.tsx` | Undo removes the toast and its own button; focus now goes to "I bit". | verified in Chrome | 6fe8500 |
| F12 | `src/pages/Settings.tsx` **(pre-existing, visible with every flag off)** | `dark:placeholder:text-stone-600` on the two "Bite reasons" fields: stone-600 is the dark end of the inverted dark scale, 2.33:1 (needs 4.5). Now `stone-400`: 5.45:1 dark, light unchanged (5.68). | measured both themes | 2d5491c |
| F13 | `src/components/DetectionWave.tsx` **(pre-existing, only while the wave spikes)** | The red "Detected!" label was 3.96:1 at 12 px on the white card. On a light page it is now `oklch(50% .18 25)`: 6.61:1 (dark keeps the old red, 4.74:1). | measured both themes | 2d5491c |
| F14 | `src/pages/Log.tsx` | At 320 px the WS3 line "N entries, M marked not a bite" (`shrink-0 whitespace-nowrap`) pushed "Clear all" off the screen and made the page scroll sideways by 10 px. With marked alarms the line may now wrap; with none marked the class string is exactly the old one. | `falsePositive/ui.test.tsx` | f32b80c |

**Flags-off note for the integration diff.** F12 changes two class names in Settings > Bite reasons, which exists with every flag off, so a flags-off
DOM comparison against `main` will show them (and F13 changes an inline colour only while an alarm spikes the wave). Both are in one commit
(`2d5491c`); revert it if the flags-off diff must stay byte-identical. Nothing else here changes flags-off markup (F14 keeps the old class string
when nothing is marked; the other files render only with a flag on).

Checks run for the code changes, on the final tree: `npx tsc -b` exit 0; `npx vitest run` 152 files passed, 1 skipped (the privacy smoke
test), 2885 tests passed, 2 skipped; `npx eslint src scripts server electron test-utils` 23 errors and 4 warnings, the same count as the
baseline (the two errors in `DetectionWave.tsx` are among them and are not mine); each fix above re-measured in Chrome on a fresh probe build.

## Open issues

Severity: High blocks a task for keyboard or assistive-technology users; Medium is a WCAG 2.2 AA failure or a serious barrier with a workaround;
Low is a best practice, a minor barrier or a deliberate trade-off; Info is a note. None is High.

| # | Sev. | Issue | Where | Suggested owner and fix |
|---|---|---|---|---|
| O1 | Medium | Text fields, selects and time inputs have a boundary of 1.34 to 1.99:1 against the card (light) and 1.39:1 (dark); WCAG 1.4.11 asks 3:1 for what identifies a control. My own check, not an axe rule (Lighthouse and axe are green). Affects the sign-in email field, gift code, the Bite reasons fields, referral link, share note and expiry, schedule times, coaching custom field, the two photo date selects. Existing forms and flags-off screens are affected too, so it is a design-token decision. | `border-stone-200/300` + `dark:border-ink-400` on fields; `INPUT` in `SignIn.tsx` | Design system owner (WS0 tokens / WS11b). Use `border-stone-400` (about 3.6:1) and a lighter dark border on fields only. |
| O2 | Medium | Switch, off state: the track is 1.99:1 against the card in light (1.39:1 in dark) and the white thumb is 1.99:1 against the track in light. The on state is fine (15.7:1). Same check as O1. Affects every switch in Settings and the camera card's "Show camera feed". | `Toggle` in `src/pages/settings/ui.tsx`, `CameraToggle.tsx` | Same owner. `bg-stone-400` for the off track in light (thumb stays white). |
| O3 | Medium | Reflow: at 320 px (and the "Not a bite" label wraps to three lines at 360 px) an alarm still to review has three buttons (Bite, Not a bite, delete), wider than the card; the delete button is cut off at 320 px. Under about 380 px wide only. (The header part is F14.) | `src/pages/Log.tsx` row (`group flex items-center gap-3 px-5 py-2.5`) | WS3. Add `flex-wrap` so the buttons drop to their own line. It changes the row class with the flag off too, which `falsePositive/ui.test.tsx` pins, so change both on purpose. |
| O4 | Low | Reflow: at 320 px the streak card is 286 px wide at minimum (three 64 px segments), so the phone view and the Watch tab scroll sideways by 6 px (more once the streak has days). Existing, visible with flags off. | `Segment` in `StreakHero.tsx` (`min-w-[64px]`) | Whoever owns the Watch tab. Smaller `min-w` under 360 px. |
| O5 | Low | The alarm flash has no announcement. With `false_positive_controls` on, the toast says "Alarm. ..."; with it off nothing is announced to assistive technology (the sound, the tab title and the notification are the other channels). | `AlertOverlay.tsx` `AlertFlash` | WS2/WS3/WS7a. Give the flash message `role="alert"` and let the toast say only the "Not a bite" part while the flash is visible, so there is one announcement. |
| O6 | Low | The coaching card and the "Not a bite" toast are portals at the end of `<body>`, so a keyboard user passes about 24 stops before reaching Done, Skip or Not a bite. Deliberate (it never steals focus), but the alarm moment is the one where the controls should be close. | `CoachingSeam.tsx`, `NotABiteSeam.tsx` | WS2/WS3. Mount the portal container as the first child of `<body>` (DOM order is Tab order), or add a skip link. |
| O7 | Low | Time limits: the toast disappears after 15 s, its Undo after 8 s, the urge "logged" note after 8 s (WCAG 2.2.1, not essential). The same action stays in History (Not a bite, Undo), so nothing is lost. | `controller.ts` `OFFER_MS`, `MARKED_MS`; `UrgeTimer.tsx` | Pause the timeout while the toast has hover or focus. |
| O8 | Low | Heading order: History's day headings are `h3` directly under the page `h1` (axe `heading-order`, moderate, best practice). `h2` would be right but changes the flags-off markup. | `Log.tsx:358` | Owner of History, with the flags-off diff in mind. |
| O9 | Low | The streak's ":" is `text-white/25` (2.24:1) and is not `aria-hidden`; it is punctuation between hours and minutes, so decorative, but a screen reader reads "colon". | `Colon` in `StreakHero.tsx` | Add `aria-hidden="true"`. |
| O10 | Low | In dark mode the selected segment's fill is 1.27:1 against the track; the selection reads through the lime text and the bolder weight (not colour alone, but weak). | `SegmentedControl.tsx` | Add a ring or a lighter fill for the selected segment. |
| O11 | Low | While paused, two `role="status"` regions say the same "Paused until ..." (the panel and the pause card), and "Detection off" is a third. | `PausedOverlay.tsx`, `BackgroundSlot.tsx` | WS7a. Keep one. |
| O12 | Low | Focus falls to the top of the page after: Cancel on "Delete everything", choosing a reason on the post-alarm card, and Keep on History's "Clear all" (the same pattern as F5 to F11). | `DataSettings.tsx`, `ReplacementPrompt.tsx`, `ClearAllButton` | One line each: focus the control that opened the question. |
| O13 | Low | Escape does not cancel the inline two-step confirms (photos, data, History). The safe button has focus, so it is one key either way. | `TwoStepDelete.tsx`, `DataSettings.tsx` | Add an Escape handler to the confirm group. |
| O14 | Info | Axe `region` (best practice): the toast, the coaching card and the install prompt are outside every landmark. | portals | None needed for the toasts; `role="region"` and a name on the install prompt if wanted. |
| O15 | Info | History at 390 px: 32 controls between 37.5 and 44 px (the row buttons). Passes 2.5.8 (24 px), not the 44 px guidance. | `Log.tsx` | None. |

## Not reached or not verified

- The mini-window strip (Document Picture-in-Picture): headless Chrome does not open one. Its buttons are 52 x 24 px (WS2 notes), colours are inline, and its Escape, focus ring and the strip's `role=status` are untested.
- Paddle checkout and the paywall's plan buttons (they need Paddle's script and a price id); only the paywall shell was checked.
- Real screen readers (NVDA, JAWS, VoiceOver, TalkBack): announcements were checked in the accessibility tree and live regions only. Whether a region inserted together with its text is read out differs between them; where that matters the regions are always present (F1, F2, the toast, the coaching card) or focus is moved (F6, F7, F10).
- Chrome's accessibility tree does not report `aria-valuetext` of a range as `valuetext` (a hand-made `role=slider` showed the same), so the slider's value text was verified as a DOM attribute, not in the tree.
- Safari, Firefox, Windows high contrast (`forced-colors`), text spacing overrides, 200 percent text-only zoom, voice control, switch access.
- The installed PWA, the Electron wrapper and its tray.
- Apple, Microsoft and emailed-link sign-in were shown with dummy keys; the sign-in request was answered by the test harness (`Fetch.fulfillRequest`), so no mail was sent and no provider was contacted.
- Lighthouse and axe cover roughly a third of WCAG; the rest here is the hand-written checks above, which are a sample (one seeded history, one fake camera, one viewport per check).
