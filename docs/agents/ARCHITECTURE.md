# Stop Biting — Architecture (written by WS0, verified against the code)

Every agent after WS0 reads this first, then `docs/agents/PLAN.md` (your workstream), `docs/agents/SWARM_RULES.md`
and `tasks/lessons.md`. Claims here name the file and function so you can check them. Line numbers are left out on
purpose; they rot. If something here is wrong, fix it in your PR and say so in your report.

Contents: 1 Stack and file map · 2 Detection · 3 History, streak, event schema v2 · 4 Storage module ·
5 Feature flags · 6 Server: routes, auth, Paddle, database · 7 Settings shell · 8 Marketing pages, meta, schema ·
9 PWA · 10 Electron · 11 Tests and tooling · 12 File ownership map · 13 Rules for later agents ·
14 Gotchas · 15 Background watching and Picture-in-Picture (WS7a)

---

## 1. Stack and file map

| Layer | What |
|---|---|
| Client | Vite 5, React 19, TypeScript (strict, `erasableSyntaxOnly`), Tailwind 3, Zustand 5 (`persist` to localStorage), `recharts`, `lucide-react`, `date-fns`. No router library: `src/App.tsx` switches on `window.location.pathname`. |
| Detection | `@mediapipe/tasks-vision` (WASM) running in the page, fed by `getUserMedia`. |
| Server | One Express 5 file, `server.js`, plus `server/` (route registry, flags, DB helpers). ESM, Node 22 in Docker (Node 24 locally). |
| Data | SQLite via `better-sqlite3`, `data/users.db` (never commit). Users and subscriptions only; **no event history is stored server-side today**. |
| Email | `resend` through `email.js`. |
| Auth | Google OAuth, HS256 JWT in an HttpOnly cookie (`nh_session`), `Authorization: Bearer` for Electron. |
| Payments | Paddle (checkout via `@paddle/paddle-js` on the client, webhook + verify + portal on the server). |
| Hosting | Coolify. `Dockerfile` (3 stages) or `nixpacks.toml`. **Pushing `main` auto-deploys.** |
| Desktop | Electron wrapper in `electron/` (see section 10). |

```
server.js                 Express app: security middleware, SQLite init, Google auth, Paddle, then
                          registerRoutes(...), then static files + every server-rendered page route
server/
  features.js             feature flags (FLAG_NAMES, createFlags, createRequireFeature)
  db/migrate.js           additive-only SQLite migration helpers
  routes/index.js         the route registry (ROUTE_MODULES, buildContext, registerRoutes)
  routes/features.js      GET /api/features
  routes/_example.js      worked example of a flagged route module
  routes/billing.js       WS9: lifetime, gifts, referrals, free tier (flagged); hooks for the webhook and /api/user/me
  billing/                WS9: entitlements, gift codes, referrals, purchases, webhook hook (see ws9-notes.md)
  routes/share.js         WS10: read-only share links (flag share_links): owner API + public page and JSON
  share/                  WS10: links.js (table + store), tokens.js, summary.js (THE whitelist), page.js (self-contained HTML)
  routes/weeklyEmail.js   WS5: opt-in weekly summary email (weekly_email): preferences, unsubscribe pages
  weeklyEmail/            WS5: week bounds in a time zone, the summary maths, the unsubscribe token, the template
  jobs/weeklyEmail.js     WS5: the hourly in-process job (only with weekly_email on and RESEND_API_KEY set)
shared/                   WS9: plans.js (TRIAL_DAYS and the other plan numbers), access.js (the one access decision);
                          plain JS + .d.ts, imported by src/, server/, scripts/ and vite.config.ts
email.js                  Resend: welcome, feedback, admin notice, generic sendEmail()
trialFollowup.js          hourly job: one email 24 h after a trial ends
src/
  App.tsx                 path-based routing; AuthProvider > AppRouter (Landing | Paywall | tabbed app)
  main.tsx                React root + service worker registration
  store/useAppStore.ts    THE persisted store (history, streak, settings) + migrations
  storage/                the storage module (section 4): adapter, kv, deviceId, blobs, events facade
  insights/               WS5: pure aggregation (aggregate.ts), milestones, share card, zone maths; ui/ = the Insights view
  photos/                 WS5: the local-only nail photo diary (flag photo_diary); never imports sync or network code
  features/               feature flags on the client (section 5)
  hooks/                  useDetection, biteDetector, useCamera, usePictureInPicture, useStreak, ...
  components/detection/   CameraView, DetectionSurface, AlertOverlay, PiPWindow, ...
  components/dashboard/   StreakHero, TodayStats, ReplacementPrompt, PanicButton, CameraPanel, ...
  pages/                  Landing, Dashboard, Log, Settings, Pricing, About, HowItWorks, Blog*, Compare*, legal
  pages/settings/         Settings section registry and one file per new section (section 7)
  contexts/AuthContext    session, apiFetch, access status
  utils/                  access, trial, insights, time, track, ...
  data/                   blogPosts.ts, comparePages.ts (content; also read by build scripts), pageUpdates.json
  dev/preview.ts          DEV-ONLY fixtures: /?preview=trial|subscribed|paywall
scripts/                  sync-seo.mjs, generate-seo-content.mjs, generate-og-images.mjs, indexnow-ping.mjs
test-utils/               shared test helpers (in-memory storage adapter, in-memory SQLite, test HTTP server)
electron/                 main.ts, preload.ts
public/                   static files copied to dist/ (fonts, og images, mediapipe-models, mediapipe-wasm, ...)
docs/agents/              this file, PLAN.md, SWARM_RULES.md, per-workstream notes
```

Commands: `npm test` (vitest), `npm run build:web` (the site; **judge TypeScript by this**, it runs `tsc -b`),
`npm run build` is the Electron renderer build (`base './'`), `npm run lint`, `npm run dev` (vite + `node server.js`).
Never bind ports 3000 or 5173; use `PORT=32NN` / `vite --port 52NN` with NN = your workstream number.
`server.js` exits at boot without `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`; for a local run use
throwaway values, `DATA_DIR=<scratch dir>` so `users.db` stays out of the repo, and leave `RESEND_API_KEY` unset
(that disables the trial follow-up job).

---

## 2. Detection today

Everything below runs in the browser; no frame leaves the page.

**Camera.** `src/hooks/useCamera.ts` calls `getUserMedia` (front camera, 640x480 ideal, no audio) and classifies
failures (`insecure-context`, `permission-denied`, `no-camera`, `unavailable`).

**Models.** `src/hooks/useDetection.ts`, `getModels()`: loads once per page (module-level `cachedHand`, `cachedFace`).
`FilesetResolver.forVisionTasks(assetUrl('mediapipe-wasm'))`, then `HandLandmarker` (`numHands: 1`,
`minHandDetectionConfidence 0.5`, `minHandPresenceConfidence 0.4`, `minTrackingConfidence 0.4`) and `FaceLandmarker`
(`numFaces: 1`, same confidences), both `runningMode: 'VIDEO'`. Assets: `public/mediapipe-wasm/*`,
`public/mediapipe-models/{hand,face}_landmarker.task`; `assetUrl()` resolves them relative to the bundle so it works
under `http://` and Electron's `file://`. `vite.config.ts` aliases `@mediapipe/tasks-vision` to its ESM bundle.

**Loop.** `useDetection(videoRef, enabled, sensitivity, alertType, alertSound, alertVolume, onAlert)` returns
`{ status }` (`idle | loading | watching | alert | error`). Inference runs at most every `INFERENCE_INTERVAL_MS = 200`
(5 fps) from a `requestAnimationFrame` loop (`processFrame`). When `document.hidden`, rAF is throttled, so a
`setInterval` of 500 ms (`startBgInterval`) runs `runInference()` instead, started by a `visibilitychange` handler.
Changing sensitivity or alert settings does not restart the loop: they are read through refs.

**The rule (hand near mouth).** `src/hooks/biteDetector.ts`:
- `isFingertipNearMouth(hands, faces, threshold)`: the mouth point is the midpoint of face-mesh landmarks 13 and 14
  (inner lips). A hit is any fingertip (`FINGERTIP_INDICES = [4, 8, 12, 16, 20]`: thumb, index, middle, ring, pinky)
  of any detected hand closer than `threshold` (2-D Euclidean distance in normalised image coordinates, so it depends
  on the camera's aspect ratio). Wrist, palm and knuckles never count. Only the first face is used.
- **Sensitivity** is `THRESHOLDS = { low: 0.18, medium: 0.12, high: 0.08 }` keyed by `DetectionSensitivity`, stored in
  the app store as `detectionSensitivity` (default `medium`), changed in Settings, passed to the detector as
  `getSensitivity()` on every frame.
- **Dwell.** `createBiteDetector({ getVideo, getSensitivity, source, onBiteStart, onBiteEnd })` keeps counters:
  `REQUIRED_CONSECUTIVE_FRAMES = 3` hits in a row (about 600 ms at 5 fps) before `onBiteStart()`, which is then called
  on every further hit frame (the caller dedupes); `REQUIRED_MISSES_TO_CLEAR = 2` misses before `onBiteEnd()`.
  A missing or not-ready video (`readyState < 2`), or an inference exception, counts as a miss, so a firing alarm
  can always stop.
- The detector is pure (the landmark source is injected) and is tested in `biteDetector.test.ts`.
- **WS1 update.** The counting above now lives in `src/detection/` (`zones.ts` face zones, `rules.ts` one `ZoneRule`
  per behaviour, `engine.ts` the frame loop, `registry.ts` labels and the `validated | experimental` level).
  `biteDetector.ts` keeps every export and delegates to the engine; with the default selection (nail biting alone) it
  makes the same decision on every frame as the old code (`src/detection/equivalence.test.ts`). `createBiteDetector`
  takes an optional `getBehaviors()`, and `onBiteStart` now receives the behaviour. Which behaviours run comes from
  `kv('detection', 'behaviors')` through `effectiveBehaviors()`, which is always just nail biting while the
  `detection_behaviors` flag is off. `useDetection` takes an optional trailing `behaviors` list and calls
  `onAlert(behavior)`; `CameraView.handleAlert` passes it to `logIncident(..., { behavior })`. Details and the
  evaluation harness: `docs/agents/ws1-notes.md`, `scripts/eval-detection/README.md`.

- **WS3 update (fewer false alarms, flag `false_positive_controls`).** `createEngine`/`createBiteDetector` take an optional
  `getControls()` (default: the registry in `src/detection/controlsRegistry.ts`, which is empty until the flag is on and the
  app's `FalsePositiveBridge` fills it). With none, the engine takes exactly the path above. With controls: the **hand filter**
  (`both|left|right`, as the person sees it; `src/detection/handedness.ts` maps MediaPipe's label, which assumes a mirrored
  picture, to the person's own hand; unknown sides are always watched), the **chin-rest rule** (`judgeContact` in
  `src/detection/controls.ts`: knuckles, wrist or palm within 0.25 face widths of the chin and no fingertip within 0.15 of the
  lips: the frame is a miss), **learned poses** (six numbers from `src/detection/pose.ts` per "Not a bite" tap, kept in `kv`
  namespace `falsePositive`, max 40, 30 days; a like pose waits 2 frames longer, two like poses need a fingertip within 0.2
  face widths) and **silence** (`requestSilence()` stops the alarm that is sounding and keeps it quiet until the hand has gone).
  Controls can only remove or delay an alarm. The one line in `useDetection.ts` is the hand source
  (`detectHandsWithSides`); `getModels` is exported for the calibration. Details: `docs/agents/ws3-notes.md`.

- **WS7a update (background watching, flag `background_watching`).** With the flag on, while the tab is hidden the loop is ticked by
  a source the browser does not slow down (the mini window's timers, else a dedicated worker) at the visible rate instead of the 500 ms
  `setInterval`, which stays as the fallback; `processFrame` parks itself while a hidden source drives the loop. The loop can be paused
  (inference off, camera released) and the alarm can be silenced (meeting mode). With the flag off every path above is exactly what it
  was. Measurements, mechanism, pause semantics: section 15 and `docs/agents/ws7a-notes.md`.

**Alarm.** `useDetection.startBiting`: starts the sound (`startAlarm(sound, volume)`, Web Audio, profiles
`alarm | chime | buzz | chirp | whistle`), sets status `alert`, calls `onAlert()` once, flashes the tab title, and
when the tab is hidden sets the app badge and a `Notification` if permission is granted; also
`window.electronAPI?.onBiteDetected?.()`. `stopBiting` stops the sound and returns to `watching` after 300 ms.
The visual flash is `DetectionSurface` -> `AlertOverlay` (`showFlash` from `CameraView` when `alertType` is `flash`
or `both`).

**Logging an alarm.** `CameraView.handleAlert = () => logIncident('auto-detected', true)`. The store merges alarms
less than `AUTO_EPISODE_MS` (30 s) after the previous alarm of the same behavior into one episode. An alarm is not
a "bite" until the user confirms it (`ReplacementPrompt` -> `confirmIncident`), which is what breaks the streak.

**The landing demo** (`components/demo/HeroDemo.tsx`) reuses `useCamera` + `useDetection` with fixed settings and
**must never touch `useAppStore`** (a visitor's demo must not create history). Do not import the store, or anything
that imports it, from marketing-page code. `src/storage/kv.ts` and `flags.ts` are safe; `src/storage/index.ts` is not.

---

## 3. History, streak and the event schema (v2)

### Where it lives

One Zustand store, `src/store/useAppStore.ts`, persisted with the `persist` middleware:
- localStorage key **`stop-biting-state`** (the persist `name`; **never change it**, a new name orphans every
  user's history).
- Payload `{ "state": {...}, "version": STATE_VERSION }`. `STATE_VERSION` is **2**. `partialize` drops
  `cameraEnabled`, `showCameraFeed`, `detecting`.
- `migrate: migrateState(persisted, version)` runs when the stored version differs. Steps chain (`version < 1`,
  then `version < 2`), are non-destructive and idempotent (running one again on its own output changes nothing).
- A backup of the raw old JSON is made before the first migration writes: see "The v1 -> v2 migration" below.
- `createAppStore(storage?)` builds a store (tests inject storage); `useAppStore` is the app's instance.
  In a browser the persist storage is `createStatePersistStorage()` (src/storage/persistStorage.ts). Where there is
  no localStorage (node tests) the store is memory-only, as it always was.

Persisted fields: `incidents`, `tombstones`, `firstOpenTime`, `historyStartTime`, `lastBiteTime`, `bestStreakMs`,
`bestStreakFloorMs`, settings (`detectionSensitivity`, `alertType`, `alertSound`, `alertVolume`, `remindersEnabled`,
`reminderIntervalMinutes`, `theme`, `customTags`, `weekChartMetric`).

### Streak maths (unchanged, and it must stay identical)

- A **bite** is `isBite(inc) = !inc.autoDetected || inc.confirmed === true` (exported). Unconfirmed alarms are
  "alarms awaiting review" and never break a streak.
- `lastBiteTime` = timestamp of the newest bite. Current streak = `now - (lastBiteTime ?? firstOpenTime)`
  (`useStreak`).
- `bestStreakMs = max(bestStreakFloorMs, computeBestStreak(incidents, historyStartTime))`: the longest gap between
  consecutive bites, starting from `historyStartTime`. All streak fields are *derived* by `deriveStreakState` after
  every history action; nothing accumulates.
- Retention: `MAX_INCIDENTS = 5000` newest incidents are kept. `pruneIncidents` drops the oldest, banks their best
  streak into `bestStreakFloorMs` and moves `historyStartTime` forward. Only `logIncident`, `insertEvent` and
  `replaceEvents` can grow the list, so only they prune.

### The record

`src/storage/eventModel.ts` holds the types and all the pure functions. The canonical type is `HabitEvent`, field for
field the one in PLAN.md (WS0):

```ts
type HabitEvent = {
  id: string; ts: number; source: 'alarm' | 'manual';
  behavior: 'nail_biting' | 'cuticle_skin_biting' | 'nose_picking' | 'eye_area_pulling' | 'face_skin_picking' | 'hair_pulling';
  hand?: 'left' | 'right' | 'unknown'; triggers?: string[]; falsePositive?: boolean;   // falsePositive: WS3
  competingResponse?: { done: boolean; durationSec?: number };                          // WS2
  deviceId?: string; updatedAt: number; deleted?: boolean;
};
```

What is **stored** in `state.incidents` is a `StoredEvent`: **a superset of the v1 `Incident` and of `HabitEvent`**.

| field | v1 | v2 record | notes |
|---|---|---|---|
| `id`, `timestamp`, `tag`, `autoDetected`, `confirmed?` | yes | kept exactly | what every existing screen reads |
| `ts` | | yes | always equals `timestamp` |
| `source` | | yes | always `autoDetected ? 'alarm' : 'manual'` |
| `behavior` | | yes | default `'nail_biting'` |
| `updatedAt` | | yes | `= ts` on migration, bumped by every later change |
| `deviceId`, `hand`, `triggers`, `falsePositive`, `competingResponse` | | optional | written only when known |
| `deleted` | | never in `incidents` | deleted entries move to `tombstones` |

Why a superset instead of renaming fields: the streak and statistics code reads `timestamp`, `autoDetected` and
`confirmed` and is left untouched, so the numbers are identical by construction; and an older bundle (a stale
service-worker copy, or a rollback of the deploy) that reads v2 data still works. `timestamp` and `autoDetected` never
change after an event is created, so `ts` and `source` cannot drift from them. **`tag` is the single stored source of
the primary trigger**; `triggers` is only stored when a caller supplies an explicit list, and `toHabitEvent` derives
`triggers` from `tag` otherwise (`'auto-detected'`, the "no trigger chosen" marker, yields none).

**`confirmed` is not in the plan's `HabitEvent`, but every count and streak depends on it.** It travels as an extra
field (`HabitEventWire = HabitEvent & { confirmed?: boolean }`). Anything that merges, syncs or exports events (WS4,
WS10) must carry it unchanged. WS3: "Not a bite" sets `falsePositive: true`; `isBite` returns false for it, and
`isFalsePositive` / `isPendingAlarm` / `isAlarmOrBite` (`eventModel.ts`) are the other three predicates every counter uses. The state
table (unreviewed alarm, confirmed bite, false positive, manual log, urge) is at the head of the predicates in `eventModel.ts` and in
`docs/agents/ws3-notes.md`. The pose numbers that "Not a bite" teaches are NOT an event field and never travel with events.

`Incident` (`src/types/index.ts`) is what screens import: the five v1 fields required, the v2 fields optional, so
v1-shaped literals still type-check.

**Tombstones.** `state.tombstones: Tombstone[]` (minimal: id, ts, source, behavior, updatedAt, deviceId, `deleted: true`;
no tag or trigger; newest first, capped at `MAX_TOMBSTONES = 1000`). `deleteIncident` writes one, `restoreIncident`
(History's Undo) removes it. No screen or statistic reads them; they exist so WS4 can tell other devices about a
delete. `clearHistory` and `clearAllData` reset the list; WS4 must handle "clear while sync is on" itself (its
"Delete everything" flow), because a local clear drops the tombstones.

### The v1 -> v2 migration

- `migrateState(state, version)` -> `upgradeStateEvents` -> `upgradeIncident` per record. It fills `ts`, `source`,
  `behavior: 'nail_biting'` and `updatedAt = ts` **only where absent**, keeps every other field (including fields it
  has never heard of), keeps ids (an id that is not a usable string is replaced by a generated uuid, which no version
  has ever written), never invents `deviceId`, never prunes, never reorders.
- **Backup first.** `createStatePersistStorage().getItem` reads the raw JSON string; if its `version` is lower than
  `STATE_VERSION` it copies that string, untouched, to **`stop-biting-state-v1-backup`** (any payload older than v2,
  including v0, uses that key) unless the key already exists. This happens before zustand runs `migrate` and before
  anything is written back. The copy is wrapped in try/catch: if storage refuses it, the app logs a warning and still
  migrates (the migration is non-destructive). A payload that is not valid JSON is kept under
  `stop-biting-state-corrupt-backup` instead of being silently overwritten. `lastBackupResult()` reports what happened.
- **Rollback / stale tab.** An older bundle reading v2 data keeps working and, when it writes, re-labels the payload
  v1 (it does not know about `tombstones` but keeps unknown keys). The next load runs the migration again on
  already-decorated records: idempotent, nothing lost.
- **Size.** A migrated record is about 210 bytes (was about 130) and a new one about 260 (it also carries
  `deviceId`); 5000 records is about 1.3 MB, plus one backup copy of the old payload. Well inside the 5 MB quota, but
  do not add more per-record bulk without checking.
- Fixtures of the exact v1 persisted JSON (manual logs, tags, custom tags, gaps, empty, pruned, 10,000 events, v0) are
  in `src/storage/fixtures/v1State.ts`; `migration.test.ts` (pure functions) and `persistence.test.ts` (real zustand
  store over an injected adapter) cover count, ids, timestamps, idempotence, unknown fields, identical streak and
  statistics before and after, and the preview-fixture data.

### Every reader and writer of the event shape (complete as of WS0)

Writers of `incidents` / `tombstones`:
- `useAppStore.ts`: `logIncident` (creates; alarms and manual logs; accepts `extras` for behavior/hand/triggers),
  `confirmIncident`, `deleteIncident`, `restoreIncident`, `insertEvent`, `patchEvent`, `replaceEvents`,
  `clearHistory`, `clearAllData`, `pruneIncidents`, `migrateState`.
- Callers of those actions: `CameraView.tsx` (`logIncident('auto-detected', true)`), `PanicButton.tsx`
  (`logIncident(tag, false)`, then reads `getState().incidents[0].id` and `deleteIncident` for its undo),
  `ReplacementPrompt.tsx` (`confirmIncident`, `deleteIncident`), `Log.tsx` (`deleteIncident`, `restoreIncident`,
  `confirmIncident`, `clearHistory`), `Settings.tsx` (`clearAllData`).
- `src/dev/preview.ts` (DEV only) writes v1-shaped incidents straight into the store with `setState`; the storage
  facade normalises such records on read.
- `src/storage/index.ts` (`events.*`) is the facade for everything new.

Readers (fields they read):
- `Log.tsx`: `incidents`; `isConfirmedBite` (`autoDetected`, `confirmed`); `biteTagLabel` (`tag`); `BiteInsights`,
  `WeekChart`, the grouped list and the counts (`timestamp`, `tag`, `autoDetected`, `confirmed`); `weekChartMetric`.
- `Dashboard.tsx` itself reads no event fields; its children do:
  `TodayStats.tsx` (`incidents`, `timestamp`, `autoDetected`, `confirmed`), `ReplacementPrompt.tsx` (`incidents`,
  `autoDetected`, `confirmed`, `timestamp`), `StreakHero.tsx` (`lastBiteTime`, via `useStreak`), `PanicButton.tsx` (see above).
- `useStreak.ts`: `lastBiteTime`, `firstOpenTime`, `bestStreakMs`. Only consumer: `StreakHero`.
- `utils/insights.ts`: `topTrigger(bites)` reads `tag`; `peakHour(bites)` reads `timestamp`. Called from `Log.tsx`.
- `components/auth/PaywallPage.tsx`: `incidents.length` ("alerts logged" copy).
- `useAppStore.ts` internals: `isBite`, `latestBiteTime`, `computeBestStreak`, `deriveStreakState`, `pruneIncidents`.
- Tests: `useAppStore.test.ts`, `insights.test.ts`, `storage/*.test.ts`.
- Not readers: `HeroDemo.tsx` (deliberately never touches the store), `HowItWorks.tsx` (copy only).

When you add a reader, prefer `events.list(query)` from `src/storage`; it returns canonical `HabitEvent`s and applies
filters (behavior, source, time, trigger, falsePositive).

### Adding a field to the event

Change `HabitEvent` in `eventModel.ts` (PLAN says changes go through WS0's module: say so in your report), then keep
five places consistent: `toHabitEvent`, `fromHabitEvent`, `createStoredEvent`/`patchStoredEvent` (if writable),
`parseWireEvent` in `src/storage/index.ts` (if it can arrive from a file or the network), and a test. Fields must be
optional; never rename or remove an existing one; never change what `isBite` means without checking Log, Dashboard
and the streak.

---

## 4. The storage module (`src/storage/`)

**Rule: no other workstream calls `localStorage`, `sessionStorage` or `indexedDB` directly.** Enforced two ways: an
ESLint rule in `eslint.config.js` (`no-restricted-globals` + `no-restricted-properties`, scoped to `src/**`) and
`scripts/storageGuard.test.mjs` (runs the real ESLint config, so `npm test` catches it even though `npm run lint` has
pre-existing errors). Exempt: `src/storage/**` and four files that predate it, whose keys are part of the shipped app
(`AuthContext.tsx`: `sb_has_session`, Electron `nh_token`; `OnboardingTour.tsx`: `onboarding_v1_done`;
`usePWAGuide.ts`: `pwa_guide_snoozed_until`; `usePWAInstall.ts`: `pwa_install_dismissed`). The list is
`STORAGE_ALLOWLIST` in `eslint.config.js`; do not add to it. `electron/main.ts` injects a script string that writes
`nh_token`; that is outside `src/`.

| Import | Use for | Weight |
|---|---|---|
| `src/storage` (index) | `events`, `settings`, `localBlobs`, `getDeviceId`, types | pulls in the app store; app code only |
| `src/storage/kv` | `kv` (namespaced key-value) | light: adapter only; safe on marketing pages |
| `src/storage/blobs` | `localBlobs`, `blobStorageStatus` | light |
| `src/storage/deviceId` | `getDeviceId()` | light |
| `src/storage/eventModel` | types and pure event functions | no store, no DOM |

**Events.** `events.add(input)`, `events.get(id)`, `events.update(id, patch)` (behavior, hand, triggers,
falsePositive, competingResponse, confirmed; stamps `updatedAt`; `id`, `ts`, `source` are immutable),
`events.softDelete(id)` (tombstone), `events.list(query)` / `events.count(query)` (`EventQuery`: `behavior`
(one or many), `source`, `since`/`until`, `trigger`, `falsePositive`, `includeDeleted`, `order`, `limit`),
`events.exportAll()` -> `HabitExport` (`{ format: 'stop-biting-events', version: 2, exportedAt, deviceId, anchors,
events, tombstones }`; includes the streak anchors so an import restores streaks exactly),
`events.replaceAll(exportOrList)` -> `{ imported, skipped }` (malformed entries are skipped and counted),
`events.merge(incoming)` (last write wins by `updatedAt`; `deleted: true` events remove; for sync),
`events.subscribe(fn)`, and `parseWireEvent(x)` (strict validation of anything arriving from outside).
Everything goes through the store, so streak fields are re-derived and persistence is the usual persist path.
**Which to call for what:** a live alarm must be logged with `logIncident(tag, true, extras)` (the store action; it
holds the 30 s per-behavior episode merge, and `extras` carries `behavior` and `hand`). `events.add` does **not** merge
episodes: use it for manual logs from new surfaces (phone view, urge timer), import and sync, not for detection.

**Settings.** `settings.get()` / `settings.update(patch)` for the core fields the store already owns (sensitivity,
alert type/sound/volume, reminders, theme, week-chart metric). New settings do not go in the store (do not reshape
persisted state): use `kv`.

**Key-value.** `kv.get(ns, key, fallback)`, `kv.set(ns, key, value)` (returns false if storage refused),
`kv.remove`, `kv.keys(ns)`, `kv.subscribe(ns, key, fn)`. Stored as JSON under `sb:<ns>:<key>`. Namespaces are the
typed list `KV_NAMESPACES` in `kv.ts`, one per area (`app flags detection falsePositive hrt sync insights phone
background desktop auth billing share marketing i18n`); add a name there if you need one. Never store tokens or
anything secret here.

**Device id.** `getDeviceId()`: random uuid, generated once, persisted in `sb:app:device-id`; held in memory if
storage is unavailable. Identifies a browser profile, not a person. `logIncident` and `events.add` stamp it on new
events (existing events keep none).

**Local-only blobs.** `localBlobs.put/get/delete/keys/clear(collection, key, blob)` over IndexedDB
(`stop-biting-local-blobs`). There is deliberately no export, sync or upload helper: **nothing in this store may be
sent over the network** (nail photos, WS5). Falls back to memory when IndexedDB is unavailable;
`blobStorageStatus().persistent` says which.

**Failure handling.** `adapter.ts` is the only code that touches Web Storage. `readRaw/writeRaw/removeRaw` never throw.
With no localStorage at all (node, blocked), the module uses an in-memory adapter for the page load
(`storageStatus().persistent === false`). A write the browser refuses (full quota, private window) is kept in an
in-memory overlay so the same page still reads it back, and `writeRaw`/`kv.set` return false. The persist wrapper
swallows write failures instead of throwing into the caller (`lastStateWriteFailed()`).
Only reading is probed at start-up: a full quota must not stop saved history from loading.

**Tests.** Inject an adapter: `setStorageAdapter(createMemoryAdapter())` (or `test-utils/memoryStorage.ts`:
`useMemoryStorage`, `createFlakyAdapter` for quota and read failures), reset with `setStorageAdapter(null)`.
To test hydration build a store: `createAppStore(createStatePersistStorage(STATE_VERSION))`.

---

## 5. Feature flags

Every new user-facing feature ships behind a flag, **off until the owner turns it on**. The flags are runtime, not
build-time: no rebuild, no redeploy of code.

**How the owner turns a flag on.** In the Coolify environment for the app, set
`FEATURE_FLAGS=event_sync,data_backup` (comma or space separated, case-insensitive, names from
`src/features/registry.ts`) and restart the app. Unlisted flags are off. Unknown names are ignored and logged at boot
(`[features] ignoring unknown flag(s)...`), so a typo enables nothing; a flag whose prerequisite is off logs a
warning. There is no `all`. `.env.example` lists every name and the `FEATURE_FLAGS=` line. Check the result at
`GET /api/features`.

**Server** (`server/features.js`): `FLAG_NAMES`, `parseFlags(raw)`, `createFlags(env)` -> `{ all(), isOn(name),
enabled(), names }`, `createRequireFeature(flags)`. In a route module: `ctx.flags.isOn('x')` and
`ctx.requireFeature('x')`, a middleware that answers `404 {"error":"Not found"}` while the flag is off and **throws at
registration time on a mistyped name** (the server fails to boot rather than leaving a route dark forever).
SSR'd marketing pages in `server.js` can read the same flags: `import { createFlags } from './server/features.js'`
(create it once, after `.env` has been loaded; do not create it at import time in a module that is imported before
`process.loadEnvFile()` runs, because ESM imports are hoisted above it).

**Endpoint.** `GET /api/features` (`server/routes/features.js`): public, no auth, no PII, `Cache-Control: public,
max-age=60`, body is a flat map with **every** known flag present as `true` or `false`.

**Client** (`src/features/`): `registry.ts` is the typed registry (`FEATURES`: owner, description, `dependsOn`,
`before`; `FeatureName`). `flags.ts` (React-free): `isFeatureOn(name)`, `getFlags()`, `refreshFlags()`,
`ensureFlags()`, `subscribeFlags()`. `useFeature.ts`: `useFeature('name')` and `useFeatures()` hooks.
Resolution order: dev override (DEV only) > last answer from `/api/features` (re-asked at most every 10 minutes, and
when a long-lived tab becomes visible) > the last-known answer cached through `kv` (`flags:last-known`) so offline use
behaves the same > **off**. A failed request never clears what is known and never turns anything on. The first
component that calls `useFeature` triggers one `/api/features` request per page load; pages that never read a flag
make none (today only Settings does).

**Dev override.** `?ff=event_sync,insights` (remembered across reloads; `?ff=` clears) or
`localStorage['sb:flags:dev-override'] = '["event_sync"]'`. It only ever turns flags **on**, only in the Vite dev
server: the code is behind `import.meta.env.DEV` and is absent from production bundles. After every build:
`grep -l "dev-override\|readDevOverrides" dist/assets/*.js` must print nothing (as must
`grep -l "seedPreviewData\|previewKind" dist/assets/*.js`).

**Adding a flag.** Add it to `FEATURES` in `registry.ts` and to `FLAG_NAMES` in `server/features.js` (and
`FLAG_DEPENDS_ON` there if it has a prerequisite) and to the list in `.env.example`.
`server/features.test.js` fails if the two lists differ. Registered flags (27): `detection_behaviors`, `experimental`
(WS1); `hrt_coaching`, `urge_timer` (WS2); `false_positive_controls` (WS3); `event_sync`, `data_backup` (WS4);
`insights`, `photo_diary`, `weekly_email` (WS5); `phone_companion` (WS6); `background_watching` (WS7a);
`desktop_app` (WS7b); `signin_magic_link`, `signin_apple`, `signin_microsoft` (WS8); `free_tier`, `lifetime_plan`,
`gift_plan`, `referrals`, `regional_pricing` (WS9); `share_links` (WS10); `compare_competitors`, `social_proof`
(WS11a); `locale_es`, `locale_de`, `locale_pt_br` (WS12). `social_proof` additionally hides itself while its data
file is empty; that check is the feature's, not the flag's.

---

## 6. Server: routes, auth, Paddle, database

### Request pipeline in `server.js` (in order)

1. `http -> https` 301 (from `X-Forwarded-Proto`), then a canonicalising 301 for page URLs (lower-case, collapse `//`,
   strip trailing slash, `/index.html` -> `/`; never `/api`, `/assets` or `/share/` (WS10: share tokens are mixed case)).
2. `compression`, `Permissions-Policy`, `helmet` (CSP lists Paddle, GA, Formspree), CORS for `/api/` only
   (`ALLOWED_ORIGINS` + `APP_URL`), `cookieParser`.
3. `express.json({ limit: '10kb' })` for everything except `/api/paddle/webhook` (which needs the raw body).
   **A route that needs a bigger body (WS4 sync batches) cannot raise this per route**: the global parser runs first and
   rejects with 413. Exempt your path in that one condition in `server.js` (like the webhook) and add a larger
   parser inside your route module.
4. Rate limits: `/api/` 100 requests / 15 min / IP (`apiLimiter`), `/api/auth/` 10 / min. Background sync must fit.
5. SQLite init (next section), `getUser/saveUser`, `signToken`, `authMiddleware`.
6. `GET /health`, Google OAuth routes, `/api/user/me`, the three Paddle routes.
7. **`registerRoutes({...})`** (the registry, below).
8. `GET /downloads/:file` (302 to GitHub releases), then static + server-rendered pages (section 8), ending in the
   `/{*path}` catch-all, which returns the branded 404.
9. `startTrialFollowupJob` (web only), `app.listen`.

### The route registry (`server/routes/`)

`server.js` makes one import and one call, placed after the built-in auth/Paddle routes and **before static files and
the page catch-all** (otherwise `/api/...` would fall into the HTML 404; verified with a real request):

```js
registerRoutes({ app, db, authMiddleware, getUser, saveUser, signToken,
  findUserByEmail: email => stmtFindByEmail.get(email) ?? null, config: { APP_URL, ELECTRON_PROTOCOL } });
```

`buildContext` completes it into `ctx`: `app`, `db`, `authMiddleware` (sets `req.userId`), `getUser(id)`,
`saveUser(user)`, `findUserByEmail(email)`, `signToken(userId)`, `sendEmail({ to, subject, html, text, headers })`
(`email.js`, Resend), `flags`, `requireFeature(name)`, `config` (`APP_URL`, `ELECTRON_PROTOCOL`, `isProduction`).
Secrets are not in `ctx`; modules read their own env vars. To give modules something new, extend the object in
`server.js` (one line) and the list in `buildContext`'s comment.

A module is `{ name, migrations?, register(ctx) }`. A workstream adds `server/routes/<name>.js` and one import plus one
entry in `ROUTE_MODULES` in `server/routes/index.js`. `registerRoutes` runs every module's migrations first, then every
`register`. Worked example (`server/routes/_example.js`, gated by `experimental`):

```js
export default {
  name: 'example',
  migrations: [ /* { id: 'example_001', up: h => h.createTable('CREATE TABLE IF NOT EXISTS ...') } */ ],
  register({ app, authMiddleware, requireFeature, flags }) {
    app.get('/api/_example/ping', requireFeature('experimental'), authMiddleware, (req, res) =>
      res.json({ ok: true, userId: req.userId, experimental: flags.isOn('experimental') }));
  },
};
```

Gate order: `requireFeature` first (an off feature is a 404 for everyone, signed in or not), then `authMiddleware`.
`server/routes/routes.test.js` shows how to boot a registry against an in-memory DB and call it over HTTP.

**Deploy trap.** The Docker runtime image copies files by name (`COPY server.js email.js trialFollowup.js ./`, then
`COPY server ./server`). A new top-level file or directory imported by `server.js` must be added to the Dockerfile or
production crashes at boot (commit 57aa6b0 was exactly this). A test checks the `COPY server` line.

### Database

`server.js`: `new Database(join(DATA_DIR, 'users.db'))` with `DATA_DIR` env (default `./data`; Docker sets
`/app/data`, mount a volume), `journal_mode = WAL`, then `CREATE TABLE IF NOT EXISTS users (...)`:
`id` (Google sub), `email`, `name`, `avatar`, `trial_end_date`, `subscription_status`
(`trial | active | paused | cancelled | expired`), `subscription_plan` (`monthly | yearly`), `subscription_end_date`,
`paddle_subscription_id`, `paddle_customer_id`, `created_at`. There is also a legacy
`ALTER TABLE users DROP COLUMN paypal_subscription_id` in a try/catch, and `trialFollowup.js` adds
`trial_followup_sent_at` (only when `RESEND_API_KEY` is set). `getUser` lazily flips an expired trial to `expired`.
Prepared statements: `stmtGet`, `stmtFindByEmail`, `stmtUpsert`.

`share_links` (WS10, additive migration `ws10_001_share_links`): `id`, `user_id`, `token_hash` (SHA-256 of the token, unique),
`scope` JSON `{"detailed":bool}`, `label`, `created_at`, `expires_at`, `revoked_at`, `last_viewed_at`, `timezone`. The token is
never stored. Details, endpoints and the privacy tests: `docs/agents/ws10-notes.md`.

**New tables and columns** go through `server/db/migrate.js`, additive only: `createTable` (must be
`CREATE TABLE IF NOT EXISTS`), `createIndex` (`CREATE [UNIQUE] INDEX IF NOT EXISTS`), `addColumn(table, column,
definition)` (checks `PRAGMA table_info` first; rejects `PRIMARY KEY`/`UNIQUE` and `NOT NULL` without `DEFAULT`),
`runMigrations(db, steps)` (each step in a transaction, recorded once in `schema_migrations`). There is no helper to
drop, rename or rewrite, on purpose. Tests use an in-memory database (`test-utils/memorySqlite.js`).

### Auth

- `GET /api/auth/google`: sets a 5-minute `oauth_state` cookie, redirects to Google (`profile`, `email`).
- `GET /api/auth/callback`: checks `state` against the cookie (skipped when `ELECTRON_PROTOCOL` is set), exchanges the
  code, verifies the id token, **creates the user on first sign-in with a trial of `TRIAL_MS`
  (`shared/plans.js`, `TRIAL_DAYS` env, default 3 days)**,
  sends the welcome + admin emails, signs a JWT (`signToken`, HS256, 14 days), then either sets the `nh_session`
  HttpOnly cookie and redirects to `/` (web) or redirects to `stopbiting://auth?token=...` (when `ELECTRON_PROTOCOL`).
  Errors redirect to `/#auth_error=...`.
- `POST /api/auth/signout` clears the cookie. `GET /api/user/me` (`authMiddleware`) returns the user row.
- `authMiddleware` accepts the `nh_session` cookie or `Authorization: Bearer`; sets `req.userId`.
- `ELECTRON_PROTOCOL` is a **global switch** for the whole server (redirect URI, state check, redirect target, trial
  follow-up job off). Whether production has it set is unverified (see Gotchas).
- Client: `src/contexts/AuthContext.tsx`. `apiFetch(path, init)` sends `credentials: 'include'`, adds the Electron
  bearer token, throws `API error <status>` on non-2xx. On mount it calls `/api/user/me`; `sb_has_session` in
  localStorage only chooses the initial status (`loading` vs `no_auth`) so the landing page renders without waiting.
  `AccessStatus = 'loading' | 'no_auth' | 'trial_active' | 'subscribed' | 'paywall'`, derived by
  `computeAccessStatus(user)` in `src/utils/access.ts` (`active`/`paused` -> subscribed; unexpired non-cancelled trial
  -> trial_active; else paywall). `App.tsx` `AppRouter` renders Landing, PaywallPage or the tabbed app from it.
  `?preview=trial|subscribed|paywall` fixtures load `src/dev/preview.ts` by dynamic import behind
  `import.meta.env.DEV` only.

### Paddle

- Client: only `components/auth/PaywallPage.tsx` loads Paddle (`initializePaddle` from `@paddle/paddle-js`, lazy chunk
  `paddle`). Env: `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_PRICE_ID_MONTHLY`, `VITE_PADDLE_PRICE_ID_YEARLY`,
  `VITE_PADDLE_ENV` (build-time; passed as Docker build args). `openCheckout(priceId)` opens the overlay with
  `customData: { userId }` and the user's email. On `checkout.completed` it posts the transaction id to
  `POST /api/paddle/verify-subscription`, waits, refreshes the profile and polls it for up to 90 s. The "Start free
  trial" buttons (`TrialButton`, `PricingSection`) are plain links to `/api/auth/google`, not Paddle.
- Server env: `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `VITE_PADDLE_ENV` or `PADDLE_ENV` (selects `api.paddle.com`
  vs sandbox).
- `POST /api/paddle/webhook` (raw body, HMAC-SHA256 `Paddle-Signature` `ts=...;h1=...` check in
  `verifyPaddleWebhookSignature`): `subscription.created|activated|updated` -> active (+ plan from the billing
  interval, end date), `paused`, `resumed`, `canceled` -> cancelled, `transaction.payment_failed` -> expired. User is
  found by `custom_data.userId`, else by customer email. WS9 (no flag; it acts whenever the matching price id is
  configured): right after the signature check and the JSON parse, `app.locals.billingWebhook.take(event, res)`
  (`server/billing/webhook.js`) ignores an event id it has already handled (table `paddle_events`), handles
  `transaction.completed` (lifetime, gift, first payment for referrals) and `adjustment.*` (refund, chargeback) itself,
  and records the other events once the handlers below have answered 2xx. The subscription handlers are unchanged.
  Out-of-order delivery of `subscription.*` is still not guarded (`ws9-notes.md`).
- `POST /api/paddle/verify-subscription` (auth): looks the transaction up via the Paddle API, then the subscription;
  accepts `active`/`trialing`; writes the same fields. `GET /api/paddle/portal-session` (auth): returns the Paddle
  customer-portal URL.
- The owner's uncommitted Paddle price-id filter (`PADDLE_PRICE_IDS`, `isOurPaddleData`) is not in this base; see
  SWARM_RULES.md. WS9 edits these handlers in place, in small functions.

### Email

`email.js`: `sendWelcomeEmail`, `sendFeedbackEmail` (the trial follow-up), `sendAdminNotification`, and the generic
`sendEmail({ to, subject, html, text, headers })` added by WS0 for route modules. Sender is `EMAIL_FROM`
(falls back to a Resend sandbox address that only delivers to the account owner). `FROM` is read at import time.
**The Resend SDK returns `{ data, error }` and does not throw on an API error**, so `await sendEmail(...)` can "succeed"
with `error` set (the older emails ignore this). WS5's job treats `result.error` (or no `data`) as a failure
(`isSendSuccess` in `server/jobs/weeklyEmail.js`); do the same in anything new.

---

## 7. Settings shell (`src/pages/settings/`)

**Decision: the existing cards stay exactly where they were in `Settings.tsx`; the seven new sections are added as
separate cards after "Bite reasons".** Reason: moving "Detection and alarm", "Periodic reminders" and "Alarm sound" into
section files would re-order or re-pair live cards in a two-column grid for no user benefit and risk a visible change
for every existing user; leaving them costs nothing, because later workstreams add their own cards and never need to
edit those. (Verified: Settings rendered in headless Chrome before and after, light and dark, 1280 px and 390 px:
screenshots byte-identical.) `Section`, `Row` and `Toggle` moved verbatim to `settings/ui.tsx` so section files can use
them without importing the page.

| id | Title | Owner | Shown when any of | File |
|---|---|---|---|---|
| `detection` | Detection | WS3 | `false_positive_controls` | `sections/DetectionSection.tsx` |
| `alerts` | Alerts | WS2 | `hrt_coaching` | `sections/AlertsSection.tsx` |
| `behaviors` | Behaviors | WS1 | `detection_behaviors` | `sections/BehaviorsSection.tsx` |
| `schedule` | Schedule | WS7a | `background_watching` | `sections/ScheduleSection.tsx` |
| `account-sync` | Account & Sync | WS4 (+WS8, WS5, WS9) | `event_sync`, `signin_*`, `weekly_email`, `referrals` | `sections/AccountSyncSection.tsx` |
| `data` | Data | WS4 (+WS5) | `data_backup`, `event_sync`, `photo_diary` | `sections/DataSection.tsx` |
| `sharing` | Sharing | WS10 | `share_links` | `sections/SharingSection.tsx` |

`meta.ts` (ids, titles, owners, flags, `visibleSections(flags)`), `sectionComponents.ts` (id -> component),
`SettingsSlots.tsx` (the flag-aware renderer, a fragment of grid children rendered once in `Settings.tsx` after Bite
reasons). Every section file is an empty component returning `null` with a header comment and a template. So with all
flags off nothing is added; with a flag on but no content, still nothing. **Each workstream edits only its own section
file.** Cards should be `fullWidth` unless they pair, follow DESIGN.md (pills, hairlines, no shadows), and gate single
controls inside the card with `useFeature`. To add a section: id in `meta.ts`, file, line in `sectionComponents.ts`.
The existing "Data" card (Clear all data) stays in `Settings.tsx`.
Dark-mode tokens are the other way round than they look (lessons.md): `ink-300` is the darkest surface, `ink-400` the
border; cards use `bg-ink-50` + `border-ink-400`.

---

## 8. Marketing pages, meta tags and schema

**Server-rendered shell.** For every content route `server.js` reads `dist/index.html` once at start (the shell),
rewrites head tags per request and injects schema and a crawler-readable article. `React createRoot().render()` then
replaces `#root`, so the injected article disappears for JS users (`html.js #ssr-page-content { display: none }`).
Helpers (all in the `distPath` block of `server.js`): `injectMeta(html, { title, description, canonical, ogType,
ogImage })` (title, description, canonical, og/twitter tags, author), `schemaTag` / `injectSchema` / `breadcrumbSchema`
/ `faqPageSchema` / `visibleConditionSchema`, `injectSsrArticle`, `injectNoscriptNav` (a hard-coded `SITE_NAV`),
`sendHtml(res, html, status, lastModified)` (`Cache-Control: no-cache`, optional `Last-Modified`). React does not
rewrite head tags on marketing pages (BlogPost sets `document.title` and canonical only). The shell still carries
static `keywords`, `robots`, `theme-color #F7F7F1`, the GA loader and the WebSite, Organization and SoftwareApplication
JSON-LD; FAQPage is kept on `/` only and MedicalCondition is stripped and re-emitted per page when the page text
names it.

**Routes.** `/`, `/blog`, `/blog/:slug`, `/about`, `/pricing`, `/how-it-works`, `/privacy`, `/terms-and-conditions`,
`/refund-policy`, `/editorial-policy`, three `/tools/*` pages, and one handler per entry of `COMPARE_META` (the
`/compare/*` and `/solutions/*` pages). Static serving order: `/assets`, `/fonts`, `/og` (1 year, immutable), `/posts`
(5 min, noindex), a noindex rule for stray `.json`/`.txt`, then `express.static(distPath)`.
`KNOWN_ROUTES` + the `/{*path}` catch-all return the branded `NOT_FOUND_HTML` with status 404 for any GET that no
handler matched.

**Build outputs.** `scripts/generate-seo-content.mjs` runs from the vite `closeBundle` hook
(`generateSeoContent()` in `vite.config.ts`) and writes `dist/seo-content.json`, `dist/posts/<slug>.json` and
`dist/llms-full.txt` from `src/data/blogPosts.ts`, `comparePages.ts`, `related.ts`, `editorialPolicy.ts` and
`pageUpdates.json`. `server.js` loads `seo-content.json` at start (so **restart the server after every build**).
`BlogPost.tsx` renders from `dist/posts/<slug>.json`: a new post field must go through the generator.
`scripts/sync-seo.mjs` (`npm run seo:sync`, `seo:check`) regenerates `public/sitemap.xml`, `public/llms.txt`,
`src/data/blogIndex.ts` and the freshness ledger `src/data/pageUpdates.json`, and checks titles, descriptions and
mirrored facts. `scripts/generate-og-images.mjs` renders the 1200x630 cards (needs Chrome; PNGs are committed).
`scripts/indexnow-ping.mjs` is manual. **Do not run seo:sync or og:generate in a workstream** (SWARM_RULES); the
orchestrator regenerates.

**Adding a marketing page** (WS10 share page, WS11; the WS6 phone view is not a page, see section 9): client branch in `src/App.tsx`; a server handler
(or at least a `KNOWN_ROUTES` entry, otherwise a direct hit 404s); for indexable pages `CORE_PAGES` and
`PAGE_SOURCES` in `sync-seo.mjs` (the file contains binary bytes: use `grep -a` and edit in bytes) and the llms.txt
key-page list. Pages that must stay private use `noindex` and are kept out of the sitemap. A page that exists only
while a flag is on must 404 on the server while it is off (`flags.isOn`) so it cannot be indexed.

**Pages and copy behind flags (WS11b).** Two mechanisms, both off with every flag off (the served site is byte-identical).
1. *Pages that exist only while a flag is on.* Copy: `src/data/featurePages.ts` (`FEATURE_PAGE_MAP`); path -> flag:
   `src/data/featurePagePaths.ts` (`FEATURE_PAGE_FLAGS`, the one place a page's flag is written down); meta: `COMPARE_META` in
   `server.js` with `gated: true`. `generate-seo-content.mjs` writes copy, `flags` and each page's `llmsFull` block to
   `dist/seo-gated.json`, which the server reads and never serves. At start-up the server keeps the pages whose OWN flag is on
   (`openGatedPages`, `server/marketing/gatedPages.js`) and resolves their markers and placeholders once; that one copy is the
   article, the schema, the llms block and the JSON the browser renders from. Closed page: the branded 404 for the page, for
   `/page-data<path>.json` and for its `/og` card (the card guard is before the `/og` mount). Open page: also spliced into
   `sitemap.xml`, `llms.txt`, `llms-full.txt` and the noscript nav at serve time (those handlers are registered only when a page
   is open). The browser renders a feature page from `<script id="sb-page-data">` in its HTML, else from `/page-data<path>.json`
   (`ServerComparePage` in `ComparePage.tsx`), so no copy or path rides in the JS bundle. `sync-seo.mjs` dates and checks them
   like the competitor pages (`FEATURES` in its source list).
2. *Sentences on existing pages that stop being true with a flag on.* `shared/flagCopy.js` holds `RULES` (the exact source text,
   the flags, the replacement) and `{{if flag}}..{{else}}..{{end}}` markers for the new pages. The sources keep today's text; the
   server applies `flagAware` in `injectSsrArticle`, `faqPageSchema`, the homepage FAQPage block, the SEO content loaded at boot and
   (only while a rule is active) the served `llms-full.txt`, `seo-content.json` and `/posts/*.json`; the browser applies it through
   `useFlagCopy` (`src/features/useFlagCopy.ts`, which asks for the flags at idle, only when its cached answer is stale).
   `scripts/flagCopySources.test.mjs` fails when a source sentence is reworded and its rule stops matching. A sign-in method counts
   as on only when its keys are configured (`server/marketing/copyFlags.js`).

**A page whose address contains a secret** (WS10 `/share/<token>`) must not be the app's HTML shell: that shell loads
Google Analytics (`index.html`) and the app bundle. `server/share/page.js` renders a self-contained document (inline style
and one inline script allowed by hash in its own CSP, no third party, no cookie, `no-store`, `noindex`,
`Referrer-Policy: no-referrer`). Keep any new secret-bearing page the same way, add its prefix to the canonicalising
redirect's exemptions in `server.js` if the secret is mixed case, and to the service worker denylist (a worker that answers
it from the cached shell loads Google Analytics with the secret in the address; WS10 reproduced exactly that with the
denylist entry removed).

---

## 9. PWA

`vite.config.ts` includes `VitePWA` only when `VITE_BUILD_TARGET=web` (what `build:web`, the Dockerfile and nixpacks use).
`registerType: 'autoUpdate'`, `injectRegister: null`; `src/main.tsx` registers `/sw.js` on window load with errors
swallowed. The generated worker has `skipWaiting` + `clientsClaim`, so a new deploy takes over on the next navigation
(the open page is not reloaded; there is no update prompt). Manifest (generated, `dist/manifest.webmanifest`): name
"Stop Biting: AI Nail Habit Tracker", `display: standalone`, `orientation: portrait-primary`, theme/background
`#F7F7F1`, icons 192, 512 and a maskable 512 in `public/icons/`, `screenshots: []`. Workbox: precache of the app shell
(21 entries), `navigateFallback: '/index.html'` with a denylist for `/api/`, `/downloads/`, `/posts/`, `/signin` (WS8), `/redeem` (WS9) and `/share/` (WS10); runtime caches:
`/assets/*.js|css` StaleWhileRevalidate, `/posts/<slug>.json` NetworkFirst (3 s), `/icons/*.png` CacheFirst.
MediaPipe wasm and models are excluded from precache and not runtime-cached (browser HTTP cache only), so detection
needs a network on the very first run of a profile. `/api/*` is never cached by the worker.
Install UI: `usePWAInstall` (captures `beforeinstallprompt`, key `pwa_install_dismissed`), `PWAInstallPrompt`
(banner), `usePWAGuide` + `PWAGuideModal` (iOS/Chromium instructions, key `pwa_guide_snoozed_until`).
**A browser that has visited keeps the old bundle until the worker updates** (lessons.md): unregister the worker or use
a fresh headless Chrome profile before judging a UI change.
**WS6 (flag `phone_companion`).** The phone view is not a URL: it is `/` on a phone (or a computer that lists no
camera), chosen by `src/phone/phoneDecision.ts`, so `start_url` stays `/` and no server page has to 404 while the flag is
off. The manifest on disk is unchanged; while the flag is on `server/routes/phone.js` answers `GET /manifest.webmanifest`
with the same file plus two home-screen `shortcuts` (`/?action=bite`, `/?action=urge`; iOS ignores shortcuts), and with
the flag off it calls `next()` so `express.static` serves the file byte for byte. For that to work the worker must not
precache the manifest: `manifestOutOfPrecache()` in `vite.config.ts` removes the entry through vite-plugin-pwa's
`api.extendManifestEntries` (workbox's `manifestTransforms` never sees that entry; verified). Also added: a CacheFirst
`brand-static` runtime cache for `/fonts/*.woff2` and `/logo*.svg` (offline type), iOS head tags and 152/167 touch icons
in `index.html`, and `src/phone/offlineGrant.ts` (the installed app opens offline from the access facts last saved
online; see `docs/agents/ws6-notes.md`).

---

## 10. Electron wrapper

`electron/` (`main.ts`, `preload.ts`, `tray.ts`, `prefsFile.ts`, `assets/`), the desktop logic in `src/desktop/`,
`src/types/electron.d.ts`; builder config in `package.json` `"build"` (appId `today.stopbiting.app`; mac dmg+zip
**universal** with hardened runtime and `build/entitlements.mac.plist`; win nsis+portable; linux AppImage+deb;
output in `release/`, ignored by git). Renderer = `npm run build` output (`base './'`, no PWA) loaded with `loadFile`; the
main process (`main.js`, ES module) and the preload (`preload.cjs`, CommonJS, self-contained) are built by
`vite.electron.config.ts` and `vite.electron.preload.config.ts` into `dist-electron/` (ignored by git). No server code,
`data/` or `.env` ships in the app (commit 2b633d6, and WS7b removed the leftovers). `npm run electron:typecheck`
checks `electron/` (`tsc -b` does not).
- `API_BASE`: `http://localhost:${PORT||3000}` in dev, `API_BASE_URL || https://stopbiting.today` when packaged. When
  packaged, a `webRequest.onBeforeRequest` hook redirects `file://.../api/...` requests to `API_BASE`.
- Sign-in: `open-google-auth` IPC fetches `/api/auth/google` and opens Google in the system browser; the callback
  deep-links `stopbiting://auth?token=...` (single-instance lock; `open-url` on mac, `second-instance` on Windows);
  main writes `nh_token` into the renderer's localStorage and fires an `electron-auth` event; `apiFetch` then sends
  `Authorization: Bearer`. **This does not complete against the hosted server today** (global `ELECTRON_PROTOCOL`, no
  sign-in button in the packaged app): see `docs/agents/ws7b-notes.md`, "Known gaps".
- Window hides to the tray on close; tray menu: Open, status, Start/Stop watching, Pause 15 min / 1 h / until tomorrow
  or Resume, Launch at login, Quit (menu content is `src/desktop/trayModel.ts`). Detection keeps running with the
  window hidden (`backgroundThrottling: false`, Chromium switches, a power-save blocker while watching).
- Preload exposes `window.electronAPI` (`notify`, `onBiteDetected`, `openExternal`, `openGoogleAuth`, `isElectron`;
  unchanged for callers, arguments now validated in main) and `window.desktop` (`onCommand`, `sendState`, `notify`,
  `camera.*`; typed by `DesktopAPI` in `src/desktop/ipc.ts`). `src/main.tsx` loads `src/desktop/desktopHost.tsx` by
  dynamic import only when `window.desktop` exists, so a browser never downloads it (and the service worker does not
  precache the chunk).
- Pause and tray commands: the web app receives a cancelable DOM event `stopbiting:desktop-command` and reports pause
  state with `stopbiting:desktop-state`. The contract, owned by WS7b and consumed by WS7a, is in
  `docs/agents/ws7b-notes.md`.
- The macOS camera prompt waits for an in-app explanation: main holds the page's first `getUserMedia` request until the
  user presses Continue on the card (`DesktopCameraNotice`).
- **Not present**: auto-updater, `globalShortcut`, a signed build. Signing and the CI workflow
  (`.github/workflows/desktop.yml`, tag `desktop-v*` or manual) are documented in `docs/DESKTOP_SIGNING.md`. Existing
  claims of a signed v1.1.0 live only in a comment in `server.js`.
- The desktop app is **not marketed** on the site (removed on purpose); marketing is WS11b behind `desktop_app`.

---

## 11. Tests and tooling

- vitest 3, `environment: node`, no jsdom (not installed; you may not add dependencies). `vitest.config.ts` includes
  `src/**/*.test.{ts,tsx}`, `server/**/*.test.{js,ts}`, `scripts/**/*.test.{js,mjs,ts}`. `npm test` takes about a second.
- `src/` is type-checked by `tsc -b` (`build:web`) **including test files**, and `tsconfig.app.json` has only
  `types: ["vite/client"]`: no Node types in `src/`. A test that needs `node:fs` or similar belongs in `scripts/` or
  `server/` (plain JS, not type-checked).
- Render React in node with `react-dom/server` `renderToStaticMarkup` (see `settings.test.tsx`); there is no DOM.
- Helpers in `test-utils/`: `memoryStorage.ts` (`createMemoryAdapter`, `createFlakyAdapter`, `useMemoryStorage`,
  `resetStorage`), `memorySqlite.js` (`createMemoryDb({ users })`), `testServer.js` (`startTestServer(app)` on an
  ephemeral port; use global `fetch`; no supertest).
- Fixtures of the v1 persisted state: `src/storage/fixtures/v1State.ts`.
- Baseline before WS0: 18 files / 119 tests. `npm run lint` has pre-existing errors (23 errors, 7 warnings at the
  start of WS0): do not add new ones, compare by file and rule.
- Verifying the server: `GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x JWT_SECRET=<32+ chars> PORT=32NN
  DATA_DIR=<scratch> node server.js`, then `curl`. Restart after every build (it caches `dist/index.html`).
- Headless Chrome without puppeteer: launch with `--remote-debugging-port` and drive it over CDP using Node's global
  `WebSocket` (a 60-line script is enough; WS0 used it for before/after DOM and screenshots).

---

## 12. File ownership map (extends the hot zones in SWARM_RULES.md)

| Area | Owner | Seam WS0 created |
|---|---|---|
| Event type, migrations, `eventModel.ts`, `persistStorage.ts`, store `STATE_VERSION` | WS0, then frozen: changes via a small PR, noted in your report | `logIncident(tag, autoDetected, extras)`, `patchEvent`, `insertEvent`, `replaceEvents` |
| `src/storage/*` (facade, kv, blobs, deviceId, adapter) | WS0 | `events`, `settings`, `kv`, `localBlobs`, `getDeviceId`; new kv namespace = one line in `KV_NAMESPACES` |
| Feature flags: `src/features/registry.ts`, `server/features.js` | WS0 | adding a flag = both lists + `.env.example` |
| `server.js` | nobody adds inline code | the single `registerRoutes({...})` call; WS9 edits Paddle handlers in place; a bigger-body exemption for WS4 is the one allowed extra line |
| `server/routes/<ws>.js` | that workstream | `ROUTE_MODULES` (one import + one entry each) |
| `server/db/migrate.js` | WS0 | `h.createTable / createIndex / addColumn` |
| `email.js` | WS0 added `sendEmail`; WS8/WS5 call it, new templates go in their own module | `ctx.sendEmail` |
| Insights, milestones, share card: `src/insights/**` | WS5 | `src/insights/predicate.ts` is the one place the charts decide what a bite is (it uses WS3's shared predicates); the weekly email keeps a server copy, kept equal by `server/weeklyEmail/parity.test.js` |
| Photo diary: `src/photos/**` | WS5 | local-only; guarded by `scripts/photoGuard.test.mjs`. Nothing under it may import sync, backup, auth or call the network |
| History's second view: `Log.tsx` | WS5 added the History / Insights switch (3 small hunks) | `useInsightsAvailability()`, `<HistoryInsightsSwitch />`, `<PhotoReminder />`, lazy `InsightsView` |
| `Dockerfile` | WS0 added `COPY server ./server`; WS9 `COPY shared ./shared` (both stages) and the `TRIAL_DAYS`, lifetime and gift build args | any new top-level server path must be copied |
| `shared/plans.js`, `shared/access.js` | WS9 | the trial length, free-tier / referral / gift numbers, and the access decision; edit them, not copies of them |
| Detection rule: `biteDetector.ts`, `src/detection/**` (zones, rules, registry, engine), `scripts/eval-detection/**` | WS1 then WS3 | extras on `logIncident` carry `behavior`/`hand`; `getBehaviors` on `createBiteDetector` |
| Detection loop / PiP: `useDetection.ts` loop, `usePictureInPicture.ts`, `PiPWindow.tsx`; `src/background/**` | WS7a | the WS1/WS2/WS3 seams in those files are kept byte for byte (guard: `scripts/backgroundGuards.test.mjs`); later work adds through `src/background/` |
| Desktop shell: `electron/**`, `src/desktop/**`, `vite.electron*.config.ts`, `build/`, `.github/workflows/desktop.yml` | WS7b | `src/desktop/ipc.ts` is the contract with the Electron side; WS7a consumes `stopbiting:desktop-command` and reports with `stopbiting:desktop-state` (docs/agents/ws7b-notes.md) |
| Alarm UI: `AlertOverlay.tsx`, `CameraView.tsx` `handleAlert` | WS2 mounts coaching overlay; WS3 mounted `<NotABiteSeam />` beside it (and in `PiPWindow.tsx`) | `handleAlert` is the one-line seam for `{ behavior, hand }` (`alarmHandExtras()`) |
| Share links: `server/routes/share.js`, `server/share/**`, `src/share/**`, `SharingSettings.tsx` | WS10 | `buildShareView` in `server/share/summary.js` is the ONLY thing a link reveals; add a field there and in its exact-key-set tests, never anywhere else |
| `Settings.tsx` | frozen; nobody edits it (WS9 may touch `PlanSection` for plans) | `<SettingsSlots />` |
| `src/pages/settings/sections/*.tsx` | one workstream per file (table in section 7) | |
| `src/pages/settings/meta.ts`, `sectionComponents.ts` | WS0; add a section = a line in each | |
| Marketing copy: `Landing.tsx`, FAQ data, meta/schema strings, `comparePages.ts` | WS11a wording; WS9 mechanical trial-length constant swap; WS11b, WS12 last | |
| Feature pages, flag-aware copy: `src/data/featurePages.ts`, `featurePagePaths.ts`, `shared/flagCopy.js`, `server/marketing/**`, `src/features/useFlagCopy.ts` | WS11b | add a page = copy + map entry + path/flag + `COMPARE_META` entry (`gated: true`); change a sentence on an existing page = a rule in `RULES` and a line in `scripts/flagCopySources.test.mjs`; never edit the source sentence |
| `App.tsx` routes | one added line per route | |
| Phone view: `src/phone/**`, `server/routes/phone.js`, `scripts/generate-phone-icons.py` | WS6 | `Dashboard.tsx` renders `<PhoneView>` when `usePhoneView()` is true (lazy); `App.tsx` passes `onNavigate`; `TabBar` and `PWAGuideModal` read `usePhoneViewActive()`; `AuthContext` calls `resolveFailedSession` / `clearGrant`; `index.html` PWA head tags |
| `useAppStore.ts` | do not reshape persisted state; new persisted data goes through `kv` or `events` | |
| `src/index.css`, `tailwind.config.js` | do not change tokens (a change reaches every surface; see lessons) | |
| `PrivacyPage`, `TermsPage`, `LegalPage`, `RefundPage` | nobody; drafts go to `docs/agents/legal/` | |

---

## 13. Rules for later agents (short)

1. Everything new is behind a flag in `src/features/registry.ts` and off by default; with all flags off nothing
   user-visible changes.
2. Persistent data: `src/storage` only. New server data: additive migrations only. Never drop or rewrite a table or a
   field.
3. History reads through `events.list`; writes through `events.*` or the store actions. Never write `incidents`
   directly (`setState` on `incidents` bypasses streak derivation).
4. Privacy: no camera frames, landmarks or photos leave the device; only `HabitEvent` records may sync, opt-in. Never
   write "100% private", "no cloud, no server" or "nothing leaves your device". Approved line: *Detection runs on your
   device. No camera data is sent while it runs.*
5. Never depict the habit (no hand-to-mouth or biting illustration, icon or animation, anywhere).
6. No new dependencies. No made-up facts. No medical claims.
7. Run before you report: `npm test`, `npm run build:web`, `node --check` on touched server files, `npm run lint`
   compared to baseline by file and rule, and the two dist greps in section 5.

---

## 14. Gotchas found while building WS0

- **`persist` with no storage returns early and defines no `store.persist`.** In node tests the store is memory-only;
  to test hydration build a store with `createAppStore(storage)`.
- **Persisting a store with thousands of records on every `set`** (zustand stringifies the whole state): an in-memory
  persist in node tests would turn a 5000-iteration test into minutes. That is why node keeps persistence off.
- **ESM imports are hoisted above `process.loadEnvFile()`** in `server.js`. Anything that reads `process.env` at import
  time (`email.js` reads `EMAIL_FROM` that way) sees the environment before `.env` is loaded in dev. `createFlags` is
  called inside `registerRoutes`, after the load.
- **`ELECTRON_PROTOCOL` is global.** If production sets it (`COOLIFY_DEPLOY.md` says to), the web OAuth callback would
  redirect to `stopbiting://` instead of setting the cookie. The production value is unverified; WS8 must check before
  adding sign-in methods.
- **Trial length** is now one constant, `TRIAL_DAYS` in `shared/plans.js` (default 3, env override, build and runtime).
  Copy spells it with `${TRIAL_*}` tokens (`{{TRIAL_*}}` in `index.html`); `scripts/trialLength.test.mjs` fails when a
  literal reappears. `scripts/sync-seo.mjs` fills the tokens before its extractors run.
- **`PWAGuideModal` says "Works offline: detection runs fully on-device, no internet needed"**, but the worker does not
  cache the models. WS11a/WS6: do not repeat that claim.
- The persisted payload grew by about 60 percent with v2 (see section 3). `MAX_INCIDENTS` is still 5000.
- `src/storage/index.ts` imports the store, which hydrates from localStorage at import. Importing it from a marketing
  page would break the "demo never touches the store" guarantee. Use `src/storage/kv` there.
- **(WS11b) A flag-dependent sentence must not enter the freshness basis of a page.** `scripts/sync-seo.mjs` fingerprints a page
  from every string literal reachable from its handler (`literals`, `refsText`, depth 4). A variant sentence or a flag name added to
  `homeArticleHtml()` would move `/`'s ledger date, so `sitemap.xml`'s lastmod and `Last-Modified` change with every flag off. Rules
  live in `shared/flagCopy.js` and are applied by calls with arguments (`copyHtml(...)`), which the extractor treats as transforms.
  After any copy edit `npm run seo:check` must still say "in sync".
- **(WS11b) A copy rule's replacement must not contain its own source text**, or applying the rule twice (the server applies it in
  several places) would stack: `shared/flagCopy.test.js` checks idempotence in every flag state. Rule texts also avoid `& < > " \`,
  so they are safe in HTML and in JSON.
- **(WS11b) `String.replace` with a string replacement treats `$&`, `` $` `` and `$'` specially.** Page copy has dollar amounts; use a
  function replacement when injecting copy (`injectMeta` does; so does the `sb-page-data` block).
- **(WS11b) The gated state is decided once, at start-up**, because flags change only on a restart: nothing about a gated page is
  recomputed per request, and the handlers that serve it are registered only when it is open.

---

## 15. Background watching and Picture-in-Picture (WS7a, flag `background_watching`)

Details, every table and the "not verified" list: `docs/agents/ws7a-notes.md`. Raw results and the measuring scripts:
`docs/agents/ws7a-measurements/`, `scripts/background-probe/` (`node scripts/background-probe/tables.mjs` prints the tables below
from the result files).

### 15.1 What the browser does to a hidden tab (measured)

Chrome 155, headless (`--headless=new`), macOS, fake camera; the tab is made hidden by opening a second tab; **700 s hidden** (so past
Chrome's 5-minute intensive timer throttling). Ticks per second by condition, with a nominal 10 a second for the 100 ms timers and 5
for the 200 ms chains (`run-probe.mjs`; the full per-window tables are in the notes):

| hidden, condition | page `setInterval` 100 ms (10/s) | page `setTimeout` chain 200 ms (5/s) | animation frames | worker timer 100 ms (10/s) | worker chain 200 ms (5/s) | audio worklet (5/s) |
|---|---|---|---|---|---|---|
| no camera, 10-60 s | 1 | 1 | 0 | 4 | 3.68 | - |
| no camera, 300-360 s | 0.02 | 0.02 | 0 | 7.37 | 3.83 | - |
| no camera, 600-660 s | 0.02 | 0.02 | 0 | 7.55 | 3.85 | - |
| camera on, 10-60 s | 1 | 1 | 0 | 10 | 4.86 | - |
| camera on, 300-360 s | 1 | 1 | 0 | 10 | 4.92 | - |
| camera on, 600-660 s | 1 | 1 | 0 | 10 | 4.92 | - |
| camera on + mini window open, 10-60 s | 10 | 4.96 | 60 | 10 | 4.86 | - |
| camera on + mini window open, 300-360 s | 10 | 4.97 | 59.88 | 10 | 4.92 | - |
| camera on + mini window open, 600-660 s | 10 | 4.97 | 60 | 10 | 4.92 | - |
| camera on + audio worklet, 10-60 s | 1 | 1 | 0 | 10 | 4.86 | 5 |
| camera on + audio worklet, 300-360 s | 1 | 1 | 0 | 10 | 4.92 | 5 |
| camera on + audio worklet, 600-660 s | 1 | 1 | 0 | 10 | 4.92 | 5 |

Read it as: the page's own timers are clamped to 1 a second as soon as the tab is hidden and `requestAnimationFrame` stops; **with the
camera capturing they stay at 1 a second** (the no-camera case shows the cut to 1 a minute after 5 minutes that capture avoids);
**a dedicated worker's timers keep their full rate**; **with the Document PiP window open the page is not throttled at all**; an audio
worklet ticks but leaves the page's timers throttled. Camera frames keep arriving in the hidden tab and are new (checked at every
checkpoint of every run).

The real app, detection steps per second by hidden time (counted from outside by hooking WebGL `texImage2D`: two uploads per step),
before and after, and the alarm latency measured through the real loop with a synthetic hand (`run-app.mjs`, a `VITE_WS7A_PROBE`
build; `flagoff-hidden` is the same build with the flag off, i.e. today's behaviour):

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

Before WS7a: **1 check a second** while hidden (2 with the mini window open: `processFrame` returned early on `document.hidden`, so
only the 500 ms interval ran, while 60 animation frames a second woke the page for nothing). Dwell is counted in frames (three in a
row), so the alarm took three step intervals: **1.2 s in the first minute hidden and 3.0 s after ten minutes** (the browser slows
the tab after 10 s), against 0.6 s visible. After: **5 a second, hidden or not, with or without the mini window, for the whole
700 s**, and the alarm in **0.4 to 0.5 s** at 20 s and at 650 s hidden.

CPU, percent of one core (sum over the browser's processes of a type; same machine, same fake camera; "visible" is the 65 s before
hiding, "hidden" the last 638 s):

| run | visible: renderer | visible: GPU | hidden: renderer | hidden: GPU | hidden: browser |
|---|---|---|---|---|---|
| before, hidden | 17.1 | 7.6 | 2.9 | 0.7 | 0.2 |
| before, hidden + mini window | 17.3 | 7.7 | 12.9 | 8.8 | 0.3 |
| flag off, hidden (probe build) | 16.4 | 6.8 | 3 | 0.6 | 0.3 |
| flag on, hidden | 16.7 | 6.5 | 12.9 | 1.6 | 0.2 |
| flag on, hidden + mini window | 16.5 | 6.8 | 18.2 | 7.9 | 0.3 |

Reading it: **visible, nothing changed** (renderer 16.7 with the flag on, 16.4 off, 17.1 before: noise). **Hidden, the price of keeping
the rate**: the renderer works about five times as often, 12.9 against 2.9 points of one core; with the mini window the page also keeps
drawing (GPU 7.9). With the detection switched off the feature costs nothing measurable (renderer 1.4 flag on, 1.8 flag off, no worker
running). Idle:

| detection switched off, tab visible, 90 s | renderer | GPU | browser | workers running |
|---|---|---|---|---|
| flag off | 1.79 | 7.37 | 1.14 | [] |
| flag on | 1.44 | 6.22 | 1.11 | [] |

### 15.2 The mechanism

`useDetection.ts`, in the effect that runs the loop:
- visible: unchanged, the `requestAnimationFrame` loop at 5 checks a second;
- hidden, flag off: unchanged, the 500 ms `setInterval` (`startBgInterval`);
- hidden, flag on (`isFeatureOn('background_watching')`, read when the tab becomes hidden): `createHiddenSource`
  (`src/background/hiddenSource.ts`) ticks `runInference` every 200 ms from, in order, **the Document PiP window's timers**
  (`pipWindow.setInterval`; `usePictureInPicture` registers the window in `src/background/tickHost.ts` and forgets it on `pagehide`),
  then **a dedicated worker** (`src/background/tickWorker.ts` through `ticker.ts` / `appTicker.ts`), and if neither is available
  `onLost` re-enables the 500 ms interval. Never two sources at once. The animation-frame callback parks itself while a hidden source
  drives the loop and re-arms on show. A tick less than 150 ms after the last check is dropped (`HIDDEN_MIN_GAP_MS`).
- **The worker is a same-origin file** (`new Worker(new URL('./tickWorker.ts', import.meta.url), { type: 'module' })`, 286 bytes,
  `/assets/tickWorker-*.js`), because the page's CSP is `worker-src 'self'` (`server.js`, untouched): a blob worker works under Vite's dev
  server and is refused in production (a guard test pins both). It is precached like any chunk. It is created only when something needs a
  tick (a hidden tab, a running pause clock, an alarm repeating while hidden) and ended when nothing does.
- The alarm sound repeats from the same worker while the tab is hidden (flag on); otherwise from `setInterval`, as before.
- While the tab is hidden the checks are counted (`src/background/cadence.ts`). A stretch of 30 s or more under 3 checks a second is
  remembered (kv `background:cadence`) and the Watch tab says so in words: how a browser that slows hidden tabs and offers nothing better
  is reported honestly.
- Rejected, with numbers: an audio keep-alive (5 ticks a second, but the page's timers stay throttled, and it needs an audio context
  running); doing the inference inside the worker (MediaPipe reads the page's `<video>`; only the clock needed to move).

### 15.3 Pause and meeting mode

`src/background/pauseMachine.ts` is a pure reducer: `stopped | running | paused(until) | meeting(until)`, events `start`, `stop`, `pause`,
`pauseUntil`, `resume`, `meeting`, `tick(now)`. `watchStore.ts` holds the one live copy and saves `{pausedUntil, meetingUntil}` in
`kv('background', 'state')`; `restoreWatch` drops anything expired, unreadable, in the past, or more than 27 h (pause) / 12 h (meeting)
away, so a pause cannot get stuck. **The camera switch (`cameraEnabled`) is not touched**: pause is a gate over it (`inferenceEnabled`,
`cameraStreamEnabled`, read by `CameraView` and `CameraPanel`), because that field resets to on at every load and a pause that flipped
it would end on refresh.
- **Paused**: no inference; `detecting` is false (`isDetecting`), so the tray reads `watching:false, paused:true` and **WS9's free-tier
  meter, which counts a second only while `detecting` is true, never counts paused time**; the camera is released where the browser
  remembers consent (`shouldReleaseCamera`: permission `granted`), otherwise kept open so the automatic resume cannot stall on a
  prompt. Resume restarts the camera.
- **Meeting**: inference and camera stay on; `startBiting` plays no sound and raises no notification, badge or native alert
  (`silentNow()`); the screen flash stays; the alarm is logged as always. The periodic "Hands check" nudges are skipped during either.
- **The mini window** (`PiPWindow.tsx`, the WS2 and WS3 seams untouched) shows "Paused / until 3:45 PM" or "Watching / silent until 4:30 PM" on two lines and a Pause (15 minutes) / Resume button; with the flag on the window is requested 300 px wide instead of 240 so that fits.
- Both end by themselves (`runExpiryClock`: a 1 s worker tick, plus a check when the tab becomes visible, focused or online). A pause
  survives a reload; Stop clears it. "Until tomorrow" = the start of the person's scheduled hours, else 06:00, at least 2 h away (the
  tray's fixed 08:00 is WS7b's, so the two can differ).

### 15.4 Desktop bridge (the WS7b contract)

`src/background/wiring.ts` `connectDesktop`, run by `BackgroundRunner` (only with the flag on): `stopbiting:desktop-command` `pause` /
`resume` -> the machine and `preventDefault()`; `start` while paused -> resume (`preventDefault()`), otherwise the machine starts and the
bridge's default switches the camera on; `stop` -> the machine stops and the bridge switches the camera off. The state goes out as
`stopbiting:desktop-state {paused, pausedUntil}` on every change and once at start (repeated at 0.5, 2 and 5 s, because the bridge is
loaded by a dynamic import that may finish later). Flag off: no report, so the tray keeps its pause items disabled, as the contract says.
Tested against the real `createDesktopBridge` in `src/background/wiring.test.ts`.

### 15.5 Schedule and reminders

`schedule.ts` (pure, clock injected): weekdays and one daily window; an overnight window belongs to the day it starts on; window id =
date + start time (no UTC offset, so the repeated hour of a fall-back day is one window). `decideReminder`: schedule on, inside a window,
none shown for it, not watching, not paused, app not in front, permission granted. Settings > Schedule (`ScheduleSettings.tsx`) asks
for notification permission only when the switch is turned on, after saying why (`planTurnOn`; a guard test fails if anything else calls
`requestPermission`). Checked every 30 s while the app is open (`checkReminder`). Click: `window.focus()` in a browser, a native
notification in the desktop app. **Not built: a reminder with the app closed** (Periodic Background Sync in an installed PWA: it needs
custom code in the generated service worker, the worker cannot read `localStorage`, Chrome decides when it fires, it is Chromium-desktop
installed-PWA only; details in `ws7a-notes.md`). Reminders need the app open in a tab or window, or the desktop app running in its tray.

### 15.6 Browsers

| | Hidden-tab rate | Mini window | Verified |
|---|---|---|---|
| Chrome 155 desktop (headless) | full, 5 a second, with or without the mini window | Document PiP | yes |
| Edge and other Chromium desktop | expected full | yes | no |
| Firefox, Safari | worker if the browser runs it at full rate, else the old once a second (alarm in about 3 s); the Watch tab says so after a slow stretch | none: no Document PiP (the Minimize button shows only where a PiP API exists) | no |
| Electron | the window is never throttled (WS7b); same pause clock and tray bridge | n/a | partly |

What the person sees where nothing better exists: the Watch tab's pause card says that some browsers slow background tabs, and after
a measured slow stretch adds one sentence with the rate that was actually reached.

### 15.7 Not verified (the owner should look)

A real hand on a real camera while hidden; a windowed Chrome (minimised, covered); Edge, Firefox, Safari; a real Document PiP window's
size and always-on-top behaviour (headless opens a larger one); the tray clicks; a worker under `file://` in the packaged app (it falls
back to timers); the OS notification itself; screen readers. Flag-off sameness was checked on the HTML of Watch, History and Settings
against a build of main: byte-identical.
