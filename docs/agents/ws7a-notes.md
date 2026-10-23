# WS7a (Keep watching in the background, browser) — notes

For the owner and for WS13 (release notes). The reference is `docs/agents/ARCHITECTURE.md` section 15; this file has what was
built, how it was measured (all numbers below come from `docs/agents/ws7a-measurements/`, printed by
`node scripts/background-probe/tables.mjs`), and what is NOT verified. Flag: `background_watching` (off by default).

## What exists

| Feature | Where | With the flag off |
|---|---|---|
| **Detection keeps its rate in a hidden tab**: 5 checks a second (was 1, or 2 with the mini window) | `src/hooks/useDetection.ts` (one block), `src/background/{hiddenSource,ticker,tickWorker,appTicker,tickHost}.ts` | the loop is exactly what it was |
| **Pause** for 15 minutes / 1 hour / until tomorrow, **resume**, auto-resume, survives a reload, cannot get stuck | `src/background/pauseMachine.ts` (pure reducer), `watchStore.ts` (kv `background:state`), `BackgroundSlot.tsx` (Watch tab card), `PausedOverlay.tsx`, `CameraToggle` note | not shown, never read |
| **Meeting mode** (30 / 60 / 120 minutes): silent, flash only, still logs | same; the alarm itself is in `useDetection.startBiting` | off |
| **Pause state in the mini window** (Paused until ..., Pause / Resume) | `PiPWindow.tsx` | the strip is what it was |
| **Desktop tray**: `stopbiting:desktop-command` pause / resume / start / stop drive the same state machine; state reported back | `src/background/wiring.ts` (`connectDesktop`), `BackgroundRunner.tsx` | tray pause items stay disabled (contract) |
| **Schedule** (days, hours, overnight) and the **"Start watching?" reminder** | `src/background/{schedule,scheduleStore,reminders,ScheduleSettings}.tsx`, Settings > Schedule | the section is not shown |
| **A note when the background ran slowly** (browsers that slow hidden tabs) | `src/background/cadence.ts`, `BackgroundSlot.tsx` | off |

Turn on (owner): in Coolify `FEATURE_FLAGS=background_watching` and restart. No rebuild, no env var, no `.env.example` change, no
server change, no new dependency. Check `GET /api/features`.

## What I measured, and what it decided

Method (scripts in `scripts/background-probe/`, results in `docs/agents/ws7a-measurements/`): headless Chrome 155 (`--headless=new`)
on macOS, fake camera, driven over the DevTools protocol with Node's built-in WebSocket (no puppeteer). A tab is made hidden by
opening a second tab in the same window (`visibilityState` is `hidden`). Every run is a real wait: 30 s visible, **700 s hidden**
(past the 5-minute mark where Chrome applies intensive timer throttling), 30 s visible again. Two kinds of run:

1. **Probe page** (`run-probe.mjs`): one page with several candidate tick sources side by side (main-thread `setInterval`,
   a `setTimeout` chain, `requestAnimationFrame`, a dedicated worker's timers, an AudioWorklet), in four conditions.
2. **The real app** (`run-app.mjs`): the built bundle behind a throwaway copy of `server.js` (so the real security policy applies),
   signed in as a throwaway user, real MediaPipe on the fake camera. Detection steps are counted from outside by hooking WebGL
   `texImage2D` (two video uploads per step); no app code is involved in the counting. CPU is the browser's own process CPU time.

**Which build each number comes from.** The 700 s tables (A and B, and the CPU and idle tables) were produced from the build of commit
`220e7e7`. Three small edits came after it and do not change the loop's timing: a plain conditional instead of `??=`, the background
step counters held in an object (the first form made the compiler-based `react-hooks` lint silently skip `useDetection`; the baseline
lint error in that file is back, so lint is 23/4 as before), and the lazy `useNotifications` import. The final tree was re-checked on
its own build: a short hidden run with a synthetic hand (flag on: alarm 447 ms at 20 s hidden and 567 ms at 60 s, 5 checks a
second, `app-final-check-hidden.json`; flag off: 1156 ms and 2808 ms, `app-final-check-flagoff.json`, which also shows that no
cadence note is written with the flag off), the pause / reload / meeting scenarios (Table D), and the flag-off HTML comparison against a
build of current main.

To re-run (Chrome at `/Applications/Google Chrome.app`, or set `CHROME_BIN`; ports are yours to choose; results go to
`docs/agents/ws7a-measurements/` unless `RESULTS_DIR` is set; nothing here touches `.env`, `data/` or your dev ports):

```bash
npm run build:web                                   # the build to measure (VITE_WS7A_PROBE=1 npm run build:web for a probe build)
node scripts/background-probe/run-probe.mjs camera 3311 30 700 30        # plain | camera | camerapip | audio
node scripts/background-probe/run-app.mjs after-hidden 3241 hidden 75 700 30 dist background_watching   # label port hidden|pip visible hidden back dist [flags]
INJECT_VISIBLE=1 INJECT_AT=20,650 node scripts/background-probe/run-app.mjs ...   # with a probe build: time the alarm
node scripts/background-probe/run-pause.mjs 3261 dist                    # pause, reload, resume, meeting mode (probe build)
node scripts/background-probe/dom-compare.mjs 3271 distA distB [flags]   # flag-off sameness of two builds
node scripts/background-probe/shots.mjs 3251 dist /tmp/shots             # screenshots of the new screens
node scripts/background-probe/tables.mjs                                 # the tables below, from the result files
```

### Table A. The probe page: ticks per second, by hidden time

**no camera**

| window (s since hidden) | page `setInterval` 100 ms (10/s) | page `setTimeout` chain 200 ms (5/s) | animation frames | worker timer 100 ms (10/s) | worker chain 200 ms (5/s) |
|---|---|---|---|---|---|
| -29..0s | 9.92 | 4.92 | 59.36 | 9.95 | 4.85 |
| 0..10s | 1 | 1 | 0 | 4.3 | 3.8 |
| 10..60s | 1 | 1 | 0 | 4 | 3.68 |
| 60..180s | 1 | 1 | 0 | 5.1 | 3.68 |
| 180..300s | 1 | 1 | 0 | 7.63 | 3.86 |
| 300..360s | 0.02 | 0.02 | 0 | 7.37 | 3.83 |
| 360..480s | 0.02 | 0.02 | 0 | 7.32 | 3.79 |
| 480..600s | 0.02 | 0.02 | 0 | 6.35 | 3.43 |
| 600..660s | 0.02 | 0.02 | 0 | 7.55 | 3.85 |
| 660..701s | 0.32 | 0.17 | 1.75 | 7.03 | 3.92 |

**camera on**

| window (s since hidden) | page `setInterval` 100 ms (10/s) | page `setTimeout` chain 200 ms (5/s) | animation frames | worker timer 100 ms (10/s) | worker chain 200 ms (5/s) |
|---|---|---|---|---|---|
| -29..0s | 9.92 | 4.92 | 59.33 | 10.06 | 4.89 |
| 0..10s | 1 | 1 | 0 | 10 | 4.8 |
| 10..60s | 1 | 1 | 0 | 10 | 4.86 |
| 60..180s | 1 | 1 | 0 | 10 | 4.88 |
| 180..300s | 1 | 1 | 0 | 10 | 4.92 |
| 300..360s | 1 | 1 | 0 | 10 | 4.92 |
| 360..480s | 1 | 1 | 0 | 10 | 4.92 |
| 480..600s | 1 | 1 | 0 | 10 | 4.92 |
| 600..660s | 1 | 1 | 0 | 10 | 4.92 |
| 660..701s | 1.28 | 1.14 | 1.73 | 10.12 | 4.99 |

**camera on + mini window open**

| window (s since hidden) | page `setInterval` 100 ms (10/s) | page `setTimeout` chain 200 ms (5/s) | animation frames | worker timer 100 ms (10/s) | worker chain 200 ms (5/s) |
|---|---|---|---|---|---|
| -29..0s | 10.04 | 4.99 | 60.23 | 10.04 | 4.85 |
| 0..10s | 10 | 4.9 | 60 | 10 | 4.9 |
| 10..60s | 10 | 4.96 | 60 | 10 | 4.86 |
| 60..180s | 10 | 4.96 | 60.01 | 10 | 4.88 |
| 180..300s | 10 | 4.97 | 59.99 | 10 | 4.92 |
| 300..360s | 10 | 4.97 | 59.88 | 10 | 4.92 |
| 360..480s | 10 | 4.97 | 56.62 | 10 | 4.91 |
| 480..600s | 10 | 4.96 | 60 | 10 | 4.92 |
| 600..660s | 10 | 4.97 | 60 | 10 | 4.92 |
| 660..701s | 10.12 | 5.04 | 60.75 | 10.12 | 4.99 |

**camera on + audio worklet**

| window (s since hidden) | page `setInterval` 100 ms (10/s) | page `setTimeout` chain 200 ms (5/s) | animation frames | worker timer 100 ms (10/s) | worker chain 200 ms (5/s) | audio worklet (5/s) |
|---|---|---|---|---|---|---|
| -29..0s | 9.92 | 4.93 | 59.36 | 10.06 | 4.89 | 5.03 |
| 0..10s | 1 | 1 | 0 | 10 | 4.9 | 5 |
| 10..60s | 1 | 1 | 0 | 10 | 4.86 | 5 |
| 60..180s | 1 | 1 | 0 | 10 | 4.88 | 5 |
| 180..300s | 1 | 1 | 0 | 10 | 4.92 | 5 |
| 300..360s | 1 | 1 | 0 | 10 | 4.92 | 5 |
| 360..480s | 1 | 1 | 0 | 10 | 4.92 | 5 |
| 480..600s | 1 | 1 | 0 | 10 | 4.92 | 5 |
| 600..660s | 1 | 1 | 0 | 10 | 4.92 | 5 |
| 660..701s | 1.28 | 1.14 | 1.75 | 10.12 | 4.99 | 5.06 |

### Table B. The real app, before and after

Detection steps per second. The "visible" row of the probe-build runs includes a 10 s stretch with an injected hand (the model is not called then), and so do the 10 to 60 s and 600 to 660 s rows of the runs with `INJECT_AT`; the two "before" runs have no injection (visible: 4.7 a second, the rate of the animation-frame loop):

| hidden time (s) | before, hidden | before, hidden + mini window | flag off, hidden (probe build) | flag on, hidden | flag on, hidden + mini window |
|---|---|---|---|---|---|
| visible, before hiding | 4.67 | 4.73 | 3.73 | 3.83 | 3.85 |
| 0 to 10 | 1 | 2 | 2 | 5 | 5 |
| 10 to 60 | 1.02 | 2.02 | 1.7 | 4.42 | 4.42 |
| 60 to 180 | 1.03 | 2.03 | 1.03 | 5.03 | 5.03 |
| 180 to 300 | 1.03 | 2.03 | 1.03 | 5.03 | 5.03 |
| 300 to 360 | 1.03 | 2.03 | 1.03 | 5.03 | 5.03 |
| 360 to 480 | 1.03 | 2.03 | 1.03 | 5.03 | 5.03 |
| 480 to 600 | 1.02 | 2.03 | 1.03 | 5.03 | 5.03 |
| 600 to 660 | 1.03 | 2.03 | 1.02 | 4.53 | 4.53 |

Alarm latency in ms, from "a hand is on the mouth" to the alarm starting (synthetic hand through the real loop; probe builds):

| run | tab visible | hidden 20 s | hidden 650 s | alarm logged each time |
|---|---|---|---|---|
| flag off, hidden (probe build) | 643 | 1165 | 2977 | yes |
| flag on, hidden | 600 | 480 | 439 | yes |
| flag on, hidden + mini window | 542 | 457 | 415 | yes |

Video frames in the hidden tab were new (not a repeat of one picture) at every checkpoint: before, hidden: yes; before, hidden + mini window: yes; flag off, hidden (probe build): yes; flag on, hidden: yes; flag on, hidden + mini window: yes.

### Table C. CPU, percent of one core

| run | visible: renderer | visible: GPU | hidden: renderer | hidden: GPU | hidden: browser |
|---|---|---|---|---|---|
| before, hidden | 17.1 | 7.6 | 2.9 | 0.7 | 0.2 |
| before, hidden + mini window | 17.3 | 7.7 | 12.9 | 8.8 | 0.3 |
| flag off, hidden (probe build) | 16.4 | 6.8 | 3 | 0.6 | 0.3 |
| flag on, hidden | 16.7 | 6.5 | 12.9 | 1.6 | 0.2 |
| flag on, hidden + mini window | 16.5 | 6.8 | 18.2 | 7.9 | 0.3 |

### Table D. Pause, reload, meeting mode in the real app (`run-pause.mjs`, raw)

```json
{
 "uiPauseReloadResume": {
  "stepsBefore": 19,
  "cameraBefore": true,
  "clicked": true,
  "cameraDuringPause": false,
  "stepsDuringPause_10s": 0,
  "panelSaysPaused": true,
  "stored": "{\"v\":1,\"pausedUntil\":1792782204403,\"meetingUntil\":null}",
  "trayState": "n/a (browser)",
  "afterReload": {
   "stepsIn6s": 0,
   "camera": false,
   "panelSaysPaused": true
  },
  "resumeClicked": true,
  "resumedAfterMs": 1508,
  "cameraAfterResume": true,
  "storedAfterResume": null
 },
 "expiredPauseOnLoad": {
  "stepsIn5s": 24,
  "camera": true,
  "panelSaysPaused": false,
  "stored": null
 },
 "desktopPauseWhileHidden": {
  "pausedUntilStored": true,
  "cameraWhilePaused": false,
  "visibility": "hidden",
  "resumedLateByMs": 213,
  "cameraAfter": true,
  "stepsIn5sAfterResume": 25
 },
 "meetingMode": {
  "control": {
   "alarms": 1,
   "audioContexts": 1,
   "notifications": 0,
   "logged": 1
  },
  "meetingClicked": true,
  "panelSaysMeeting": true,
  "inMeeting": {
   "alarms": 1,
   "audioContexts": 0,
   "notifications": 0,
   "logged": 1
  },
  "endClicked": true,
  "afterMeeting": {
   "alarms": 1,
   "audioContexts": 1,
   "notifications": 0,
   "logged": 1
  }
 }
}
```

### Table E. Idle CPU (detection switched off, tab visible; `run-idle.mjs`)

| detection switched off, tab visible, 90 s | renderer | GPU | browser | workers running |
|---|---|---|---|---|
| flag off | 1.79 | 7.37 | 1.14 | [] |
| flag on | 1.44 | 6.22 | 1.11 | [] |


### What the numbers say

- Hidden with the camera on and no mini window: main-thread timers are clamped to **one a second and stay there for the whole 700 s**
  (an active camera capture exempts the page from the *intensive* throttling that cuts timers to one a minute after 5 minutes: the
  no-camera row shows that cut), and `requestAnimationFrame` stops. **A dedicated worker's timers keep their full rate** for the
  whole run. That is the mechanism.
- With the Document Picture-in-Picture window open the opener page is not throttled at all (animation frames 60 a second, timers at
  their nominal rate). Before WS7a the loop could not use that: `processFrame` returns early when `document.hidden`, so only the
  500 ms interval ran (**2 checks a second**, not 5), while 60 animation frames a second woke the page for nothing.
- Video frames keep arriving in a hidden tab at the camera's rate and are *new* (a hash of a 32x24 copy of the picture differs
  1.2 s apart, at every checkpoint of every run), so the faster loop is not re-reading a stale frame.
- An AudioWorklet delivered 5 ticks a second but left the main-thread timers throttled, and needs an audio context running (it needs
  user activation on a real browser). Not used: the worker does the job with no side effects.
- Dwell is counted in frames (three hits in a row), so the alarm latency is three step intervals: 0.6 s at 5 checks a second, about
  3 s at one a second. The "before" alarm latency in the tables is exactly that (1.2 s in the first minute hidden, 3.0 s after ten
  minutes; 0.6 s visible). After: 0.4 to 0.5 s at 20 s and at 650 s hidden, with or without the mini window (Table B).
- **CPU**: visible, no change (renderer 16.7 flag on / 16.4 flag off / 17.1 before). Hidden, keeping 5 checks a second costs about
  10 points of one core more than 1 a second (12.9 vs 2.9; with the mini window the page also keeps drawing: GPU 7.9). Detection
  switched off: no measurable cost, no worker (Table E). That is the price of the feature and is why it is behind a flag.

### What ships (the mechanism)

While the tab is hidden and the flag is on, the loop is ticked, in this order of preference, by:
1. **the mini window's own timers** (`pipWindow.setInterval(tick, 200)`, `hiddenSource.ts`), when the Document Picture-in-Picture
   window is open (`usePictureInPicture` tells `tickHost.ts`);
2. **a dedicated worker** (`tickWorker.ts`, 286 bytes, same-origin file under `/assets/`: the page's policy `worker-src 'self'`
   refuses blob workers, so a worker made from a string would have failed in production only; the rig runs the real policy);
3. nothing better: the **500 ms `setInterval` that was always there**, which also takes over if the worker cannot start or dies.

Never two at once. The worker exists only while a hidden tab is being ticked (created on hide, ended on show); a visible tab keeps the
`requestAnimationFrame` loop untouched (the CPU table shows the visible cost is unchanged). While a hidden source drives the loop the
animation-frame callback parks itself (no 60 wake-ups a second with the mini window open) and re-arms on show. A tick that arrives
less than 150 ms after the last check is dropped, so a busy main thread cannot cause a burst of catch-up checks.
The alarm sound repeats from the worker's timer while hidden (four beeps a second for the default sound; a hidden page's own timer
gives one a second). The same worker (one, shared) runs the 1 s clock that ends a pause.

## Pause, meeting mode, and what each does to the camera

| State | Inference | Camera | Alarm | Tray (`DesktopState`) |
|---|---|---|---|---|
| running | yes | on | sound and/or flash as set | `watching: true, paused: false` |
| **paused** until T | **no** | **released** where the browser remembers camera consent (Chromium: permission `granted`); otherwise the stream stays open and only inference stops | none (nothing runs) | `watching: false, paused: true, pausedUntil: T` |
| **meeting** until T | yes | on | **flash only**: no sound, no OS notification, no native tray alert, no app badge; still logged | `watching: true, paused: false` |
| stopped | no | off | none | `watching: false, paused: false` |

- **Decision, camera on pause: release it** (the indicator light goes off, nothing is computed) **where the browser will give it back
  without asking.** The check is `navigator.permissions.query({name:'camera'})`; where it does not answer (Firefox, Safari) or does not say
  `granted`, an automatic resume in a tab nobody is looking at could stall on a permission prompt, so there the stream stays open and
  only inference stops. The pause note says which one happened. Resume starts the camera again with `getUserMedia`.
- **Pause is an overlay on the camera switch, not a change of it.** `cameraEnabled` is dropped on every reload and starts `true`; a pause
  that flipped it would end on refresh. So the app store is untouched and `CameraPanel`/`CameraView` gate on the pause state
  (`inferenceEnabled`, `cameraStreamEnabled`). Stop clears a pause; Start after Stop runs.
- **Auto-resume and "cannot get stuck"**: every pause and meeting has an end time. `tick(now)` at or after it returns to running; the
  clock is the worker's 1 s tick, plus a check when the tab becomes visible / focused / online. A stored end time is accepted on load
  only if it is in the future and no more than 27 hours (pause) or 12 hours (meeting) away, so a wrong clock cannot leave watching off.
  Measured, three runs: a 1-minute pause begun with the tab hidden ended 0.16 s, 0.21 s and 1.2 s after its end time (the clock ticks once a second; the harness polls once a second).
- **"Until tomorrow"**: the next local time at the start of the person's scheduled hours (if the schedule is on and has days), else
  **06:00**, and always at least 2 hours away, built from calendar fields so a clock change moves it with the clock. The tray (WS7b)
  sends minutes computed from a fixed **08:00**; so tray and in-app "until tomorrow" can differ by a couple of hours. To align them,
  change `TOMORROW_RESUME_HOUR` in `src/desktop/trayModel.ts` (WS7b's file, left alone).
- **Free-tier meter (WS9)**: `useFreeTierMeter` adds a second only while the store's `detecting` is true. `CameraView` now computes
  `detecting` with `isDetecting(...)`, which is false the moment the state is paused (even in the one render where the detector's own
  status has not caught up). So paused time is never counted. Hidden-tab time is counted like visible time: the meter's own 1 s
  `setInterval` keeps ticking once a second in a hidden tab with the camera on (measured: main-thread timers hold 1/s for 700 s), and
  it counts a second per tick. Nothing here double-counts and the meter's "turn the camera off at the limit" path goes through
  Stop, which clears a pause. Tests: `watchStore.test.ts` ("what counts as detecting").
- **Other nudges**: the periodic "Hands check" notifications (`useNotifications.ts`) are skipped during a pause or a meeting.
- **Two tabs**: state is per tab (kv change events are not shared across tabs), as the camera switch always was.

## Schedule and reminders

- Settings > Schedule: one switch ("Remind me to start watching"), days (Monday first), from/to time. A window belongs to the day it
  **starts** on; an end that is not after the start means the next morning. Start = end is not accepted.
- **Permission is asked only when the switch is turned on, after the card has said why** (`planTurnOn`): already granted -> switch on,
  ask nothing; never asked -> an explanation with "Allow notifications" / "Not now" (the browser prompt is shown by the first button
  only); blocked -> says how to allow it in the site settings and leaves the reminder off; unsupported -> says so. A source guard test
  (`scripts/backgroundGuards.test.mjs`) fails if `requestPermission` is called from anywhere else.
- **A reminder is shown only when**: the schedule is on, now is inside a window, none was shown for that window (window id =
  date + start time, no UTC offset, so the repeated hour of a fall-back day is one window), nothing is watching, the person has not
  paused, the app is not in front of them (`visible` and focused), and permission is `granted`. A "not now" because the app is in
  front does not use up the window. Evaluated every 30 s while the app is open and on visibility change. Click: `window.focus()`.
  In the desktop app it goes through `window.desktop.notify` (native; works with the window hidden in the tray).
- DST and zones are tested (`schedule.test.ts` switches `TZ`: New York spring-forward and fall-back, London clocks back, Sydney, Kolkata).
- **The "app closed during scheduled hours" reminder is NOT built.** The only browser mechanism is Periodic Background Sync in an
  installed Chromium PWA, and it cannot be done safely or reliably here: (1) `vite-plugin-pwa` is in `generateSW` mode, so a
  `periodicsync` / `notificationclick` handler means adding `workbox.importScripts` with a hand-written script to the service worker that
  every visitor runs (a 404 on that file would stop the worker installing); (2) the worker cannot read `localStorage`, where the schedule
  lives, so the schedule would have to be mirrored into the Cache API or IndexedDB on every change; (3) Chrome decides when a periodic sync
  fires (site engagement, at best about every 12 hours), so a "your hours have started" note could arrive at the wrong time; (4) it only
  works in an installed PWA on Chromium desktop. The reminder therefore needs the app open in a tab or window (or the desktop app
  running in its tray). The Settings card says so in plain words. Nothing fakes it.

## Browser support

| | Hidden-tab rate | Mini window | Reminders | Verified |
|---|---|---|---|---|
| Chrome 155 desktop, headless | **full (5 a second)**, mini window or not | Document PiP, strip with Pause / Resume | yes (needs permission) | yes, tables above |
| Edge, other Chromium desktop | expected the same (same engine) | yes | yes | **no** |
| Chrome, windowed (not headless) | expected the same | yes | yes | **no** (OS window occlusion and minimise are not simulated here) |
| Firefox | worker if the browser lets it run at full rate, else the 500 ms interval (about once a second) | no Document PiP | yes | **no** |
| Safari | same as Firefox | no Document PiP | partly (permission model differs) | **no** |
| Electron (desktop app) | the window is never throttled (WS7b: `backgroundThrottling: false`, measured) so the normal loop runs; the pause clock and tray bridge work the same | none needed | native notifications | partly (timers measured by WS7b; the tray clicks and a real camera were not) |
| Phones | no detection (WS6 is a logging view) | n/a | n/a | n/a |

What degrades where nothing better exists: checks fall back to the old once-a-second interval, so an alarm takes about 3 s instead of
0.6 s while the tab is hidden. What the person sees: the Watch tab card says "Some browsers slow background tabs down, so checks can
be less frequent there" while the flag is on, and after any stretch of 30 s or more in the background that ran under 3 checks a second
it adds "While this tab was in the background, checks ran about once a second instead of 5" (with the Minimize advice only where a mini
window exists). That note is measured, not assumed.

## Files

Added: `src/background/*` (32 files, 10 of them tests), `scripts/backgroundGuards.test.mjs`, `scripts/background-probe/*` (measurement and
screenshot tooling, not shipped), `docs/agents/ws7a-measurements/*` (results).
Changed (the seams, named): `src/hooks/useDetection.ts` (imports, the tick-source block, `silent`/`repeat` in `startBiting`, the
`withProbe(` wrapper around `source` — WS3's `detectHands` line inside it is byte-identical), `src/hooks/usePictureInPicture.ts`
(tells `tickHost`), `src/components/detection/CameraView.tsx` (gate, `isDetecting`, effective alert type, `<PausedOverlay />`),
`PiPWindow.tsx` (label, Pause/Resume; WS2's and WS3's seams untouched), `src/components/dashboard/CameraPanel.tsx` and `CameraToggle.tsx`
(camera stream gate; one optional prop), `src/pages/Dashboard.tsx` (`<BackgroundSlot />`), `src/App.tsx` (`<BackgroundHost />`),
`src/hooks/useNotifications.ts` (one line), `src/pages/settings/sections/ScheduleSection.tsx`, `src/pages/settings/settings.test.tsx`
(`background_watching` removed from the empty-sections fixture; `share_links` left for WS10), `src/features/registry.ts` (flag text),
ARCHITECTURE.md (sections 2, 12, 15).

## Verified, and how

Per area: pure logic by vitest (`src/background/*.test.*`, `scripts/backgroundGuards.test.mjs`);
the real app in headless Chrome by `run-app.mjs`, `run-pause.mjs`, `dom-compare.mjs`, `shots.mjs`.

**Flag off, nothing changes**: the signed-in app's HTML (Watch, History, Settings; 1280 px light and dark, 390 px) captured from a
build of main and from this branch with the same user, camera and flags, digits masked: byte-identical (`dom-compare.mjs`; the
positive control, flag on, differs as it should). The hidden-tab loop with the flag off measures as before (flag-off row of the tables).
No timer, worker or listener of WS7a is created: `useWatchGate` returns a constant and subscribes to nothing, `BackgroundHost` renders
null, `silentNow` and `quietNow` read the flag first. What a visitor can notice is download size only (`scripts/background-probe/compare-dist.mjs`, build of current main against this branch,
all chunks): the main bundle `index.js` +0.8 KB raw / +0.3 KB gzip (the lazy host and the flag read); the chunk the landing demo loads
when someone starts it (`useDetection`) +2.5 KB raw / +1.0 KB gzip, plus a shared 3.1 KB (1.3 KB gzip) `watchStore` chunk; the signed-in
app's `Dashboard` +6.7 KB (1.6 KB gzip) and `Settings` +5.6 KB (1.5 KB gzip); `BackgroundRunner` 2.9 KB and the worker 0.3 KB, which
load only with the flag on. Total across all chunks +29.5 KB raw / +10.9 KB gzip; the service worker precache goes from 51 to 60
entries (+29 KiB). No new dependency.

## NOT verified here (be honest with yourself before turning the flag on)

- **A real hand on a real camera** while the tab is hidden. The alarm latency numbers come from a synthetic hand fed to the real
  loop, engine and alarm (`probeHook.ts`, a build-time define, absent from production bundles: `grep __sbProbe dist/assets/*.js` prints
  nothing). MediaPipe's own speed on a real face is unchanged (WS1 measured it).
- **A windowed (non-headless) Chrome**, minimised or covered by other windows; **Edge, Firefox, Safari**; a **real Document
  Picture-in-Picture window** on a desktop. Headless opens one (it is a real second window and it unthrottles the page, as measured), but
  larger than the 300x64 the app asks for (240x64 with the flag off), so the strip's layout was checked by emulating that size
  (`shots.mjs`), not in a window of that size.
- **The tray** (clicks) and **the desktop app end to end**: the bridge round trip is tested with the real bridge and fakes, not
  through Electron. A worker loaded from `file://` in the packaged app is untested; if it is refused the ticker falls back to timers
  (and the packaged window is not throttled anyway).
- **Notification display** (headless never shows one): the decision logic, the permission flow and the click handler are tested,
  the OS notification itself was not seen. The meeting-mode "no OS notification" is tested by the source guard and the alarm
  code path, and the AudioContext count (0 in meeting mode, 1 after) was measured in the browser; a real notification was not.
- **Screen readers.** The pause and meeting notes are `role="status"` regions; nothing was read aloud.
- **Periodic Background Sync / a reminder with the app closed**: not built (above).

## Owner TODOs

- Decide when to turn `background_watching` on; try it on your own machine first with the real camera: start detection, press
  Minimize, work in other windows for ten minutes, bring a fingertip to your lips, and check the alarm is quick (and in meeting mode,
  silent). Check the tray's Pause items in the desktop app.
- Decide whether tray "until tomorrow" (08:00) and in-app "until tomorrow" (schedule start, else 06:00) should be the same time.
- Privacy wording: nothing new leaves the device (schedule, pause state and cadence note are local `kv` values; no network call in
  `src/background`, guard-tested). No change to the privacy page is needed for this workstream.

## Deviations from the plan, and why

- The plan says to run the loop "in the PiP window, a worker, or wherever the browser doesn't throttle it". Both are used (mini window
  first, worker otherwise), chosen by measurement. The loop itself still runs on the main thread (MediaPipe needs the page's video
  element); only the **clock** moved.
- Closed-app reminder: documented gap (above).
- "Meeting mode" has a length (30 / 60 / 120 minutes) so it cannot stay on forever by mistake.
- Pause releases the camera only where the browser remembers consent (above).

## Lessons worth recording

- **A blob worker works in Vite's dev server and is refused by this site's own security policy** (`worker-src 'self'`). Measure through
  the real server (the rig serves the build behind a copy of `server.js`), not the dev server.
- **`requestAnimationFrame` returning early on `document.hidden` is a bug when the page is not really throttled** (mini window open):
  the old code ran at 2 checks a second there and woke 60 times a second doing nothing.
- **A keyed-by-name chunk comparison between two builds lies when two chunks share a name** (`index`, `actions`); compare totals.
- **React's compiler lint (`react-hooks/purity`) rejects `Date.now()` in render**: keep a timestamp in the store, set when the state
  changes, and derive text from it.
- **A lint error that disappears can mean the compiler gave up on the function.** `if (flag) steps++` on a captured `let` made the
  `react-hooks` compiler rules skip all of `useDetection` (lint went 23 to 22 errors, which looked like an improvement). Check by
  adding a deliberate `Date.now()` in render and seeing whether `react-hooks/purity` fires; keep counters in an object.
- **The store merges alarms less than 30 s apart into one episode**: a test that fires two alarms in a row sees one logged event.
- The sandbox refuses long compound shell commands in a worktree and any command whose program is a variable: write scripts with the
  file tools and run them as one plain command.
