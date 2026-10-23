# WS3 (Fewer false alarms) — notes

For the owner, for WS4 / WS5 / WS7a (what they inherit) and for WS13 (release notes). The reference is
`docs/agents/ARCHITECTURE.md` (section 2 has a WS3 update); numbers are in `docs/agents/ws3-eval-report.md`
(**synthetic**: read its first lines before quoting anything).

## What exists

| Feature | Where | Flag |
|---|---|---|
| **"Not a bite"** after an alarm: a small toast (and a button in the minimized window) with Undo; a button on every alarm in History; the old "Not a bite, just my hand nearby" in the post-alarm card now marks instead of deleting | `src/falsePositive/NotABiteSeam.tsx` (toast + minimized-window button), `Log.tsx`, `ReplacementPrompt.tsx` | `false_positive_controls` |
| **Chin-rest rule**: the back of the hand, knuckles or palm on the chin and no fingertip near the lips: no alarm | `src/detection/controls.ts` (`judgeContact`), `engine.ts` | same |
| **Learned poses**: each "Not a bite" remembers six numbers about the pose; a like pose waits longer, then needs a fingertip right at the lips | `src/detection/{pose,learning,controls}.ts`, `src/falsePositive/poseStore.ts` | same |
| **Hand filter**: both / left only / right only; the hand is recorded on the event (`hand`) | `src/detection/handedness.ts`, `engine.ts`, Settings > Detection | same |
| **Optional calibration** (about a minute, two plain-text steps over the person's own camera picture); offered once after the first "Not a bite", never forced | `src/calibration/*`, Settings > Detection | same |
| **False-alarm rate** in words (last 7 days against the 7 before) | History's summary card, Settings > Detection | same |
| **"Not a bite" silences the alarm that is sounding** and keeps it quiet while the hand stays | `requestSilence()` in `controlsRegistry.ts`, engine | same |

Turn on (owner): in Coolify `FEATURE_FLAGS=false_positive_controls` and restart. No rebuild, no env var, no
`.env.example` change, no new dependency, no server change. With the flag off nothing is registered with the engine, the
bridge is not mounted, History and Settings render the same markup as before. Everything below is "flag on".

## The review states, and the one set of predicates (`src/storage/eventModel.ts`)

```
state                  autoDetected  confirmed  falsePositive   isBite  pending ("alarms to review")  alarmOrBite
unreviewed alarm       true          no         no              no      YES                           yes
confirmed bite         true          yes        no              YES     no                            yes
false positive         true          (any)      yes             no      no                            no
manual log ("I bit")   false         n/a        no              YES     no                            yes
urge (urge timer)      false, "urge" n/a        no              no      no                            no
```

- `falsePositive: true` **outranks** `confirmed`, which is left alone, so Undo puts the entry back exactly where it was.
  Undo writes `falsePositive: false` (not "remove the field"), so a later sync sees a newer value.
- `isBite` (store), `isFalsePositive`, `isPendingAlarm`, `isAlarmOrBite` are the predicates. Every counter uses them:
  Today ("alarms to review", "bites"), the streak and best streak (`deriveStreakState` runs after every patch), History
  (summary, week chart "All" and "Bites", the entries line, top trigger, busiest hour), the Paywall's "alerts logged",
  the post-alarm card (hidden for a marked alarm), `coachingStats` (already excluded false positives). One test per counter:
  `src/falsePositive/counters.test.tsx`, `streak.test.ts`.
- "This was a bite" (History's Bite button, or any tag chosen in the post-alarm card) on a marked alarm takes the mark off
  (`confirmIncident` writes `falsePositive: false`), so the two states cannot contradict each other.
- A marked alarm stays in the History list (muted "Not a bite" label and an Undo, with the flag on or off: the mark is
  data) and the entries line says "55 entries, 2 marked not a bite". Manual logs and urges get no "Not a bite" button;
  deleting is what they have.

## What each control does, in numbers (all in `CONTROLS_CONFIG`, `src/detection/controls.ts`)

Distances are in **face widths** (landmarks 234 to 454), corrected for the camera's shape, so they hold at any distance
from the camera.

- **Chin rest**: a knuckle, the wrist or the palm centre within `chinRegionFw = 0.25` of the chin anchor, and the nearest
  fingertip farther than `tipGuardFw = 0.15` from the middle of the lips: that hand does not count on that frame. The
  region is 25 percent wider for the next frame once it has fired (no flicker at the edge). Mouth rules only. It can only
  remove contact, so the dwell restarts, and an alarm already sounding ends like a hand that left.
- **Learned**: `matches` = remembered poses (not older than 30 days, at most 40) that match the current pose (same
  nearest part of the hand, distances and curl within a few hundredths, direction within one 45 degree step). One or
  more: +2 frames (0.4 s) of dwell. Two or more (`strongAt`): +4 frames **and** the nearest part must be a fingertip within
  0.2 face widths of the lips, or the frame does not count. A pose the person recorded as "a fingertip near my lips" in
  calibration is never suppressed. A calibrated "how I rest my chin" pose counts as if rejected twice.
- **Hand filter**: hands whose side is not the chosen one are dropped before any rule sees them (every behaviour, not
  only the mouth). A hand whose side is unknown is always watched: not knowing never switches the alarm off.
- **Silence**: "Not a bite" while an alarm sounds asks the engine to treat frames as misses until the hand has been away
  for two frames, so the sound stops within about 0.4 s and does not restart while the hand rests there. If nothing is
  sounding the request is dropped (it cannot swallow a later, real alarm).

Nothing here can **add** an alarm. It can remove or delay one. The one exception, honestly: a veto in the middle of a long
hold ends that alarm, and if the hand then goes back to the lips a second alarm can start (one episode becomes two): the
alarm time is shorter, the count can be higher. The report lists where it happens (`neg_eye_rub_brief` at low sensitivity).

## What is stored, where, and how to get rid of it

All in the browser's localStorage through `src/storage/kv` (namespace `falsePositive`, reserved by WS0), via
`src/falsePositive/poseStore.ts`. **Never an event field, never in the export file, never synced, never sent.**

| key | holds | bound |
|---|---|---|
| `sb:falsePositive:settings` | `{ handFilter, chinRest }` | tiny |
| `sb:falsePositive:learned` | `[{ at, v: [6 numbers], eventId }]`, the poses of alarms the person rejected | 40 poses, 30 days |
| `sb:falsePositive:alarm-poses` | `[{ at, v: [6 numbers] }]`, the pose at each recent alarm, so a later tap can learn from it | 30 poses, 7 days |
| `sb:falsePositive:calibration` | two distances, up to 12 + 12 poses (six numbers each), a date | one profile |
| `sb:falsePositive:calibration-offered` | `true` once the toast suggested calibrating | one flag |

The six numbers are: which part of the hand is nearest the lips (0 to 3), the nearest fingertip's distance to the lips,
the nearest knuckle or palm point's distance to the chin, the direction the hand points (0 to 7), how closed the hand is,
and where the palm is against the mouth. They say nothing about who someone is or what the room looks like, and no
landmark, frame or picture is ever stored (guard tests: no canvas, image capture, recorder or blob storage in these
folders; `parsePoseVector` accepts nothing but six numbers).

Reset, by the person: Settings > Detection > **Forget what it learned** (removes the learned and the alarm poses, keeps
the settings and the calibration; asks first), **Delete calibration** (one click). Undoing a "Not a bite", deleting the
entry, saying "this was a bite", or a sync from another device that unmarks it all forget that tap's pose
(`reconcileLearned` in the bridge). For a developer: `resetEverything()` in `poseStore.ts`, or delete the `sb:falsePositive:*`
keys. Settings > Data's "Clear all data" does not touch `kv` (WS0's design); this feature's own resets are the ones above.

**Local-only guarantees, with tests**: `src/falsePositive/localOnly.test.ts` (the event whitelist cannot carry a pose:
`toHabitEvent` and the strict `parseWireEvent` drop `pose`, `landmarks`, `calibration` and so on; a whole mark-and-learn flow
writes the pose to `sb:falsePositive:*` and to nothing else, and not to the `stop-biting-state` payload) and
`scripts/falsePositiveGuards.test.mjs` (nothing under `src/detection`, `src/calibration`, `src/falsePositive` calls
`fetch`/`XMLHttpRequest`/`sendBeacon`/WebSocket, names a URL, or imports auth, `apiFetch` or `track`; the pure detection
modules import no storage, store, React or package; the only `events.update` the feature makes sets `falsePositive`).
**WS4:** the sync contract is "HabitEvent fields only" and `falsePositive` is one of them; do not add anything else from
this feature to what travels. `confirmed` still has to travel with it.

## Seams in shared files (each one line, named)

- `src/components/detection/AlertOverlay.tsx`: `<NotABiteSeam surface="main" />` beside `<CoachingSeam />`. The seam and its
  controller import only React and react-dom (`coachingGuards.test.mjs` still passes).
- `src/components/detection/PiPWindow.tsx`: `<NotABiteSeam surface="pip" />` between the status and the Stop control.
- `src/hooks/useDetection.ts` (WS7a's loop): **one changed line**, the hand source:
  `detectHands: (video, ts) => detectHandsWithSides(hand, video, ts)` (plus its import). With the flag off it is exactly
  `.landmarks ?? []`. **One word**: `getModels` is now `export`ed, for the calibration. The loop, scheduling and PiP are
  untouched. WS7a: the engine finds the controls through `createBiteDetector`'s default (`getControls ?? getDetectionControls`),
  so nothing about the loop had to change.
- `src/components/detection/CameraView.tsx`: `handleAlert` spreads `...alarmHandExtras()` into the extras (empty with the
  flag off).
- `src/pages/Dashboard.tsx`: `<FalsePositiveSlot />` beside WS2's slot.
- `src/components/auth/PaywallPage.tsx`: one line, the "alerts logged" selector (**WS9: please keep it**).
- `src/pages/Log.tsx`, `ReplacementPrompt.tsx`, `TodayStats.tsx`, `utils/insights.ts`, `useAppStore.ts` (`isBite`,
  `confirmIncident`), `eventModel.ts` (three predicates): the predicates and the buttons.
- `src/pages/settings/sections/DetectionSection.tsx`: renders `src/falsePositive/DetectionSettings.tsx`;
  `settings.test.tsx` lost `false_positive_controls` from its "sections are empty" case (as WS1 and WS2 did for theirs).
- `src/features/registry.ts`: the flag's description and `before`.
- `docs/agents/ARCHITECTURE.md` (section 2, 3, 12), `scripts/eval-detection/**` (WS1's, now WS3's).

## The evaluation (`npm run eval:detection`), SYNTHETIC

Plays every fixture three ways (see `scripts/eval-detection/README.md`). At medium sensitivity, `nail_biting`, 35 single
scenes (the original 30 plus 5 of WS3's):

| | precision | recall | alarms ok / false |
|---|---|---|---|
| shipped (flag off) | 0.35 | 9 / 9 | 9 / 17 |
| controls (flag on) | 0.41 | 9 / 9 | 9 / 13 |

- On the **original 30** alone: shipped 0.33, 7 of 7 (the number the plan quotes); with the controls 0.35, 7 of 7.
- On the three scenes drawn for the rule (the knuckles on the chin, no fingertip near the lips): 3 false alarms, then 0.
  On `neg_eye_rub_brief` 1, then 0 (incidental: the synthetic wrist hangs near the chin).
- **No effect on the two older chin-rest scenes** (`neg_chin_rest`, `neg_cheek_rest_thinking`): they are drawn with the
  fingers along the jaw and the palm far from the chin, which the plan's literal rule ("palm or knuckles on the chin") does
  not cover. Only learning from taps helps there, and only on repeat visits.
- Bites near the chin (`mouth_bite_thumb_palm_low`, `mouth_bite_fist_fingertip_at_lips`, `cuticle_thumb_to_mouth`): found
  on the same frame as without the controls. Recall lost on any fixture at any sensitivity: none (tested).
- Learning (two sequences: one pose five times, then a real bite): 10 false alarms shipped, 4 with a person tapping
  after each (so 4 taps); both real bites found. The first two rejections still sound; the third does not.
- Sensitivities (precision, shipped to controls): low 0.28 to 0.30, medium 0.35 to 0.41, high 0.41 to 0.50.
- **The ratchet**: `thresholds.json` `withControls.nail_biting.minPrecision` is 0.40 (just under the measured 0.409) and
  `withLearning` 0.33; the shipped bars (0.30 / 0.95) did not move, because that detector did not change. The command
  also checks the plan's acceptance line: fewer false alarms on the chin-rest-rule scenes, and recall within 5 points.
- Precision on these numbers is a property of the fixture mix (scenes drawn to fool the rule). Do not quote it.

### Cost

`node scripts/eval-detection/bench.mjs` (rules only, per frame, Node 24, median of 7 million frames): old detector 20 ns;
new engine flag off 34 to 35 ns (WS1 measured 31; the difference is noise and one null check); flag on 218 ns; flag on with
40 remembered poses 237 ns. A frame is 200 ms and MediaPipe inference (about 23 ms, WS1's measurement, unchanged) is what takes
the time, so the rules are about 0.001 percent of it. **Not measured here:** a whole frame with real MediaPipe on a real
hand and face (the fake camera shows neither, so the rules never run); with the hand filter on the tracker follows two hands
instead of one, which costs more inside MediaPipe (not measured).

Bundle (`build:web`, all chunks): +34.6 KB raw, +12.1 KB gzip in total, of which 10.4 KB raw / 3.6 KB gzip is the calibration
view (loaded only when someone opens it). A landing-page visitor who starts the demo also downloads the shared `controls`
chunk (11.6 KB raw, 4.5 KB gzip: pose, controls, learning, calibration maths) and `controlsRegistry` (1.5 KB), because the
engine imports them; with the flag off none of it runs.

## Decisions and deviations

- **No `cancel()` on WS2's controller.** Marking an alarm while its coaching prompt runs calls the existing `skip()` first,
  so the prompt ends with one result ("not done") on an event that is then outranked by the mark. Tested, including that the
  old timer cannot produce a second result.
- **The shipped bars did not move.** The task said to raise the nail-biting precision bar; `rules.nail_biting.minPrecision`
  stays at 0.30 because the flag-off detector is unchanged (its measured 0.33 became 0.35 only because the fixture mix grew).
  The raised bars are the new `withControls` (0.40, just under the measured 0.409) and `withLearning` (0.33), judged on the flag-on
  runs. Raising the shipped bar would have made the flag-off default fail for no reason.
- **Only the newest alarm entry can silence a sounding alarm.** A tap on an older entry in History never asks the engine to
  go quiet (a long hold is one entry, however old, so no time window is used).
- **The learned rule asks for "a fingertip within 0.2 face widths of the lips", not just "a fingertip nearest".** The plan's
  wording ("require fingertips to be the closest") would not touch the poses people really reject (extended fingers along the
  jaw have a fingertip nearest and 0.3 face widths away).
- **`numHands` goes to 2 while the hand filter is left or right** (and back to 1 for both), through `setOptions` in
  `detectHandsWithSides`. With one tracked hand, "left only" would watch nothing whenever the tracker picked the other hand.
  `getModels` itself still creates the models with `numHands: 1`.
- **"Not a bite, just my hand nearby" in the post-alarm card marks instead of deleting, with the flag on.** The mark keeps
  the entry in History (so it can be undone), keeps it out of every count, and gives the learning its main signal. Flag off:
  unchanged (it deletes).
- **No standalone alarm toast existed**, so the toast is new (top of the screen, 15 seconds, no focus, no backdrop, no
  Escape handling so it never competes with the coaching prompt's).
- **Fixtures and the report.** `ws1-eval-report.md` was regenerated (5 new single-scene fixtures; the two `sequence`
  fixtures are scored apart so they cannot move the shipped bar). Existing fixtures are byte-identical.
- **Where the learning is measured**: only on the sequence fixtures; a single scene has no second visit.

## Known limits

- With the 4-week program view open (it makes the page inert) a calibration opened over it leaves the page as it found it
  when it closes; if the program closes first, the page becomes active while the calibration is still up. Unlikely: the
  calibration is only reached from Settings and from a toast that follows an alarm.
- In development only, React's StrictMode mounts the calibration view twice, so the camera is opened and closed once before
  it stays open (visible as an "ended" stream in the console). Production mounts once.
- A hand filter other than "Both" makes the hand tracker follow two hands, which costs more inside MediaPipe (not measured).
- The false-alarm rate counts alarms the person marked; it understates the truth when many alarms are never reviewed.

## NOT verified here (be honest with yourself before turning the flag on)

- **Anything on a real camera or real hands.** The chin-rest rule, the learned poses and the thresholds (0.25, 0.15, 0.2
  face widths) were tuned on scenes drawn by the person who wrote them. Whether real knuckles on a real chin look like
  this to MediaPipe is unknown. Record real fixtures first (`scripts/eval-detection/README.md`; tag a chin rest
  `negative`, `mouth`, `chin-rest-rule`) and run the command.
- **Which hand is which.** MediaPipe assumes a mirrored picture; the app gives it the raw frame, so its "Left" is mapped to the
  person's right hand (`HANDEDNESS_INPUT_IS_MIRRORED = false`, `handedness.ts`, with a test of the mapping). This follows
  MediaPipe's documentation; it could not be checked (the fake camera has no hands). If left and right are swapped on a
  real device, flip that one constant. Same for `setOptions({ numHands: 2 })`: it ran without error on the real models, and
  whether a second hand is then returned was not seen.
- **The calibration with a real hand.** In headless Chrome with the fake camera it ran end to end (camera attaches, the
  models load, MediaPipe runs at about 5 frames a second on the picture, both steps and the breather run on the clock, the
  app's detection is paused and restored, Escape and Cancel work, a run with no hand says so and saves nothing); it never
  saw a hand or a face.
- **The minimized window.** The button's markup is tested; it was not seen in a real Document Picture-in-Picture window
  (a 240 x 64 strip with a third control: the status text truncates).
- **Safari and Firefox, real screen readers** (announcements are checked in the DOM only), a real alarm sound while tapping
  (the alarm was simulated by adding an alarm event to the store).
- **Real-world accuracy**, anywhere. Nothing here validates a behaviour for marketing: no page was changed.

## Verified, and how

- Existing detection tests unchanged and green: the 120,000-frame equivalence test (plain and as the app builds it), the 61
  golden tests, engine, rules, zones, registry. A new test plays 40 random scenes with neutral controls (chin rest off, both
  hands, nothing learned) and requires frame-for-frame the same events as no controls, with more than 30 alarms in them.
- Flag-off DOM: the signed-in app (Watch, History, Settings, at 1280 and 390 px) was captured from `main` and from this branch
  in headless Chrome, digits normalised (the preview data depends on the clock), and compared: byte-identical.
- Flag-on in headless Chrome (fake camera, Vite dev server): an alarm shows the toast; the button, Enter on it, Undo, the
  post-alarm card's button, History's label/Undo/entries line, the Settings card, the hand filter stored on the device; with
  `hrt_coaching` also on, the prompt and the toast coexist, neither takes the focus, and marking closes the prompt; 390 px
  without horizontal scroll; the toast expires by itself. The calibration flow as above.
- `npm test`: 72 files, 1222 tests, all passing (baseline before WS3: 62 files, 936 tests); `npm run build:web` exit 0; lint
  23 errors / 4 warnings on `src scripts server electron test-utils`, the same files and rules as the baseline (nothing new);
  `node --check server.js` ok (no server file was touched); the two `dist` greps print nothing.

## Owner TODOs

- Decide when to turn `false_positive_controls` on. Read `docs/agents/legal/ws3-privacy.md` first (NEEDS HUMAN REVIEW); the
  Settings text says the numbers "are not synced and are not uploaded", which is true of the code, and the policy should say
  so too. No page of `PrivacyPage.tsx` was edited.
- Record real chin-rest and bite fixtures; if the numbers disagree with the synthetic ones, tune `CONTROLS_CONFIG`
  and the `withControls` bars together.
- Decide whether the rate line is worth keeping (it counts alarms the person marked; unreviewed alarms count as alarms
  but not as false ones, so it understates the truth when many go unreviewed).

## Lessons worth recording

- A browser check found a real bug no unit test could: React's double mount in development made the first (cancelled) camera
  opening clear `video.srcObject` after the second had set it. A cleanup that touches a shared element must check it is
  still the owner (`if (video.srcObject === stream)`).
- The sandbox refuses long compound shell commands that mix a heredoc with other commands in a worktree: write scripts with the
  file tools and run them as one plain command.
- The scratchpad directory is shared by every agent of the session: put your own files in a subfolder (an earlier name
  like `cmp.mjs` may belong to someone else).
- A plan sentence can be satisfied literally and still miss the poses it was written for ("palm or knuckles on the chin" does not
  touch fingers resting along the jaw): measure which fixtures a rule actually changes and say so.
