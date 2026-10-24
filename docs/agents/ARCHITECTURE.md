# Stop Biting — Architecture (written by WS0, verified against the code)

> **Final state (WS13), 2026-10-24, `main` at b6b16f9 (WS0 to WS11b merged).** This file now describes the whole product as built:
> sections 1 to 15 are the original reference, corrected where later workstreams made them stale; sections 16 to 22 are new and
> cover each later feature area (sign-in providers, sync and backup, billing, coaching and false-alarm controls, insights and the
> weekly email, share links, the flag map), and section 23 is WS12a's localization of the signed-in app (merged after this file was
> first finalised; **WS12b, the marketing pages in es, de and pt-BR, is not in it yet** and the WS13 agent updates this file once it lands).
> What the owner has to do before turning a flag on lives in `docs/agents/RELEASE_NOTES.md`, not here.

Every agent after WS0 reads this first, then `docs/agents/PLAN.md` (your workstream), `docs/agents/SWARM_RULES.md`
and `tasks/lessons.md`. Claims here name the file and function so you can check them. Line numbers are left out on
purpose; they rot. If something here is wrong, fix it in your PR and say so in your report.

Contents: 1 Stack and file map · 2 Detection · 3 History, streak, event schema v2 · 4 Storage module ·
5 Feature flags · 6 Server: routes, auth, Paddle, database · 7 Settings shell · 8 Marketing pages, meta, schema ·
9 PWA · 10 Electron · 11 Tests and tooling · 12 File ownership map · 13 Rules for later agents ·
14 Gotchas · 15 Background watching and Picture-in-Picture (WS7a) · 16 Sign-in providers (WS8) ·
17 Optional sync, export and import (WS4) · 18 Billing, trial length, referrals, free tier (WS9) ·
19 Coaching, urge timer, false-alarm controls (WS2, WS3) · 20 Insights, photo diary, weekly email (WS5) ·
21 Share links (WS10) · 22 Where each flag is checked · 23 Localization of the signed-in app (WS12a)

---

## 1. Stack and file map

| Layer | What |
|---|---|
| Client | Vite 5, React 19, TypeScript (strict, `erasableSyntaxOnly`), Tailwind 3, Zustand 5 (`persist` to localStorage), `recharts`, `lucide-react`, `date-fns`. No router library: `src/App.tsx` switches on `window.location.pathname`. |
| Detection | `@mediapipe/tasks-vision` (WASM) running in the page, fed by `getUserMedia`. |
| Server | One Express 5 file, `server.js`, plus `server/` (route registry, flags, DB helpers). ESM, Node 22 in Docker (Node 24 locally). |
| Data | SQLite via `better-sqlite3`, `data/users.db` (never commit). Users and subscriptions, plus 13 additive migrations' worth of tables for sync, sign-in providers, billing, share links and the weekly email (section 6). **Event history is stored server-side only for accounts that opted in (`event_sync`, section 17)**; with the flag off the tables are empty. |
| Email | `resend` through `email.js` (welcome, feedback, admin notice, generic `sendEmail`); the emailed sign-in link, gift emails and the weekly summary use `sendEmail`. |
| Auth | Google OAuth by default; with flags and keys also an emailed link, Sign in with Apple and Microsoft (section 16). All end in the same HS256 JWT in an HttpOnly cookie (`nh_session`); `Authorization: Bearer` for Electron. |
| Payments | Paddle (checkout via `@paddle/paddle-js` on the client, webhook + verify + portal on the server). Lifetime, gift, referral credit and the free plan are WS9's, behind flags (section 18). |
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
  routes/events.js        WS4: POST /api/events/sync, GET /api/events/status, DELETE /api/events (flag event_sync)
  events/                 WS4: limits.js, validate.js (the field whitelist), compare.js (tie rule), store.js (tables + createEventStore)
  routes/authProviders.js WS8: emailed link, Apple, Microsoft, GET /auth/providers, GET /signin (flags signin_*)
  auth/                   WS8: linkPolicy, accounts (identities), magicLink(+Email), apple, microsoft, jwks, oauthState, session, schema, googleLink
  routes/billing.js       WS9: lifetime, gifts, referrals, free tier (flagged); hooks for the webhook and /api/user/me
  billing/                WS9: entitlements, gift codes, referrals, purchases, webhook hook (see ws9-notes.md)
  routes/share.js         WS10: read-only share links (flag share_links): owner API + public page and JSON
  share/                  WS10: links.js (table + store), tokens.js, summary.js (THE whitelist), page.js (self-contained HTML)
  routes/weeklyEmail.js   WS5: opt-in weekly summary email (weekly_email): preferences, unsubscribe pages
  weeklyEmail/            WS5: week bounds in a time zone, the summary maths, the unsubscribe token, the template
  jobs/weeklyEmail.js     WS5: the hourly in-process job (only with weekly_email on and RESEND_API_KEY set)
  routes/phone.js         WS6: GET /manifest.webmanifest with home-screen shortcuts while phone_companion is on
  marketing/              WS11a/b: gatedPages.js (pages that exist only while a flag is on), copyFlags.js (which copy flags are on)
shared/                   WS9: plans.js (TRIAL_DAYS and the other plan numbers), access.js (the one access decision);
                          WS11b: flagCopy.js (RULES, markers; sentences that change with a flag);
                          plain JS + .d.ts, imported by src/, server/, scripts/ and vite.config.ts
email.js                  Resend: welcome, feedback, admin notice, generic sendEmail()
trialFollowup.js          hourly job: one email 24 h after a trial ends
src/
  App.tsx                 path-based routing; AuthProvider > AppRouter (Landing | Paywall | tabbed app)
  main.tsx                React root + service worker registration
  store/useAppStore.ts    THE persisted store (history, streak, settings) + migrations
  storage/                the storage module (section 4): adapter, kv, deviceId, blobs, events facade
  detection/              WS1/WS3: zones, rules, registry, engine (section 2); controls, pose, learning, handedness (section 19)
  falsePositive/          WS3: "Not a bite" seam and toast, pose store, Settings > Detection card, bridge (flag false_positive_controls)
  calibration/            WS3: the optional one-minute calibration view
  coaching/               WS2: competing-response prompt, urge timer, 4-week program (flags hrt_coaching, urge_timer; section 19)
  background/             WS7a: hidden-tab tick sources, pause machine, schedule, reminders (section 15)
  sync/                   WS4: the sync engine and its browser wiring (section 17); backup/ = export and import
  insights/               WS5: pure aggregation (aggregate.ts), milestones, share card, zone maths; ui/ = the Insights view
  photos/                 WS5: the local-only nail photo diary (flag photo_diary); never imports sync or network code
  phone/                  WS6: the phone view, its decision rule, log flow, offline access copy (flag phone_companion; section 9)
  auth/                   WS8: client side of sign-in providers (provider list cache, hooks, link handling; section 16)
  billing/                WS9: client side of billing (env, Paddle loader, localized prices, referral and gift storage, free-tier meter)
  share/                  WS10: client side of share links (API calls, copy, clipboard)
  desktop/                WS7b: the renderer half of the Electron bridge (section 10)
  features/               feature flags on the client (section 5), useFlagCopy / copyFlags (section 8)
  i18n/                   WS12a: messages, locale state, scopes (English), locales/ (es, de, pt-BR), format helpers (section 23)
  hooks/                  useDetection, biteDetector, useCamera, usePictureInPicture, useStreak, ...
  components/detection/   CameraView, DetectionSurface, AlertOverlay, PiPWindow, ...
  components/dashboard/   StreakHero, TodayStats, ReplacementPrompt, PanicButton, CameraPanel, ...
  components/billing/     WS9: PlanExtras, LifetimePlate, ReferralCard, FreeTierNotice, BillingHost
  components/site/        marketing components; Testimonials.tsx (WS11a, flag social_proof)
  pages/                  Landing, Dashboard, Log, Settings, Pricing, About, HowItWorks, Blog*, Compare*, SignIn, RedeemPage, Program, legal
  pages/settings/         Settings section registry and one file per new section (section 7)
  contexts/AuthContext    session, apiFetch, access status
  utils/                  access, trial, insights, time, track, coachingStats, ...
  data/                   blogPosts.ts, comparePages.ts (content; also read by build scripts), pageUpdates.json,
                          competitorPages.ts, featurePages.ts, featurePagePaths.ts, hrtProgram.json, testimonials.json
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

- **WS2 update (coaching, flags `hrt_coaching`, `urge_timer`).** Nothing in the detector or the loop changed: the competing-response card
  is mounted at the alarm UI's seams and hears about an alarm only after the sound is playing and the event is logged. Section 19.

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
delete. `clearHistory` and `clearAllData` reset the list, and they are local-only (not sync-aware: the synced copy stays). WS4's
"Delete everything" (Settings > Data) is the flow that removes both, server copy first (section 17).

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

### Every reader and writer of the event shape (complete as of WS0; later readers are listed after it)

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

**Readers and writers added by later workstreams** (all go through `events.*` or the shared predicates, none through `setState`):
- *The predicates.* WS3 added `isFalsePositive`, `isPendingAlarm`, `isAlarmOrBite` beside `isBite` in `eventModel.ts`, and WS2 added
  `isUrge`; the state table is at the head of them. Every counter below uses them.
- *Client:* `src/insights/predicate.ts` and `aggregate.ts` (charts, milestones), `src/phone/history.ts` and `useLogFlow.ts` (phone
  view; writes with `events.add / update / softDelete`), `src/utils/coachingStats.ts`, `src/coaching/` (writes `competingResponse`
  and urge entries), `src/falsePositive/` (writes `falsePositive`), `src/sync/` and `src/backup/` (merge, export, import),
  `Log.tsx` (behaviour filter, window for the free plan), `TodayStats.tsx`, `PaywallPage.tsx`.
- *Server copies of the same rule*, because server code cannot import from `src/`: `server/weeklyEmail/summary.js`
  (`isCountedBiteEvent`) and `server/share/summary.js`, over rows read through `createEventStore(db).listUserEvents` (section 17).
  `server/weeklyEmail/parity.test.js` and `server/share/semantics.test.js` fail if a copy drifts from `isBite`.

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
`events.merge(incoming)` (last write wins by `updatedAt`; a tie is settled by `compareEventVersions` in `eventModel.ts`: higher
`updatedAt`, then a deletion beats a live record, then the higher `deviceId`, then the higher canonical text, the same rule as
`server/events/compare.js`; `deleted: true` events remove; for sync),
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
component that calls `useFeature` triggers one `/api/features` request per page load. In the signed-in app that is the Watch tab
(WS2's coaching slot), History and Settings. Marketing pages make no flag request at all: they learn the two flags their copy
depends on from a marker in the page (section 8), and take the sign-in methods from `/auth/providers`.

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

`dependsOn` in the registry (and `FLAG_DEPENDS_ON` in `server/features.js`) is advisory: the server logs a warning at boot when
a flag is on while something it lists is off, and switches nothing off. Today it lists `experimental` -> `detection_behaviors`,
`urge_timer` -> `hrt_coaching`, `photo_diary` -> `insights`, `weekly_email` -> `event_sync` and `insights`. Two of those are
stricter than the code: `urge_timer` and `photo_diary` work on their own. `share_links` has no `dependsOn` but shows nothing
without `event_sync`. Where each flag is actually checked: section 22.

---

## 6. Server: routes, auth, Paddle, database

### Request pipeline in `server.js` (in order)

1. `http -> https` 301 (from `X-Forwarded-Proto`), then a canonicalising 301 for page URLs (lower-case, collapse `//`,
   strip trailing slash, `/index.html` -> `/`; never `/api`, `/assets` or `/share/` (WS10: share tokens are mixed case)).
2. `compression`, `Permissions-Policy`, `helmet` (CSP lists Paddle, GA, Formspree), CORS for `/api/` only
   (`ALLOWED_ORIGINS` + `APP_URL`), `cookieParser`.
3. `express.json({ limit: '10kb' })` for everything except `/api/paddle/webhook` (which needs the raw body).
   **A route that needs a bigger body cannot raise this per route**: the global parser runs first and rejects with 413. WS4's
   sync batches are the one exception made: the condition is `req.path === '/api/paddle/webhook' || req.path === '/api/events/sync'`,
   and `server/routes/events.js` parses its own 512 kb body after the flag and sign-in checks (a test reads `server.js` to keep
   the exemption). Any other path that needs a bigger body does the same in that one condition.
4. Rate limits: `/api/` 100 requests / 15 min / IP (`apiLimiter`), `/api/auth/` 10 / min. Background sync must fit.
5. SQLite init (next section), `getUser/saveUser`, `signToken`, `authMiddleware`.
6. `GET /health` (reports `SOURCE_COMMIT` or `COMMIT_SHA`), Google OAuth routes (with WS8's one-line `createGoogleLinker` seam in
   the callback), `/api/user/me` (WS9's `app.locals.decorateUser` adds the optional `entitlement` key), the three Paddle routes
   (WS9's `app.locals.billingWebhook.take` runs inside the webhook).
7. **`registerRoutes({...})`** (the registry, below).
8. `GET /downloads/:file` (302 to GitHub releases), then static + server-rendered pages (section 8), ending in the
   `/{*path}` catch-all, which returns the branded 404.
9. `startTrialFollowupJob` (web only), `app.listen`.

### The route registry (`server/routes/`)

`server.js` makes one import and one call, placed after the built-in auth/Paddle routes and **before static files and
the page catch-all** (otherwise `/api/...` would fall into the HTML 404; verified with a real request):

```js
const { flags } = registerRoutes({ app, db, authMiddleware, getUser, saveUser, signToken,
  findUserByEmail: email => stmtFindByEmail.get(email) ?? null, config: { APP_URL, ELECTRON_PROTOCOL } });
```

`server.js` keeps the returned `flags` and reads it in the page handlers (gated pages, copy rules, testimonials). `ROUTE_MODULES`
today, in order: `features`, `_example`, `authProviders` (WS8), `events` (WS4), `billing` (WS9), `share` (WS10), `weeklyEmail` (WS5),
`phone` (WS6).

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
`COPY server ./server` and `COPY shared ./shared`; the build stage also copies `shared`). A new top-level file or directory
imported by `server.js` must be added to the Dockerfile or production crashes at boot (commit 57aa6b0 was exactly this). A
test checks the `COPY server` line. Checked at WS13 (b6b16f9): every import and every file read at run time resolves inside
`server.js`, `email.js`, `trialFollowup.js`, `server/`, `shared/` and `dist/`, so nothing is missing.

### Database

`server.js`: `new Database(join(DATA_DIR, 'users.db'))` with `DATA_DIR` env (default `./data`; Docker sets
`/app/data`, mount a volume), `journal_mode = WAL`, then `CREATE TABLE IF NOT EXISTS users (...)`:
`id` (Google sub), `email`, `name`, `avatar`, `trial_end_date`, `subscription_status`
(`trial | active | paused | cancelled | expired`), `subscription_plan` (`monthly | yearly`), `subscription_end_date`,
`paddle_subscription_id`, `paddle_customer_id`, `created_at`. There is also a legacy
`ALTER TABLE users DROP COLUMN paypal_subscription_id` in a try/catch, and `trialFollowup.js` adds
`trial_followup_sent_at` (only when `RESEND_API_KEY` is set). `getUser` lazily flips an expired trial to `expired`.
Prepared statements: `stmtGet`, `stmtFindByEmail`, `stmtUpsert`.

**Tables added by later workstreams** (13 migrations, all additive, run at every boot whatever the flags, recorded in
`schema_migrations`; the `users` table is untouched by all of them; where the data is used: the section in brackets):

| Migration id | Tables | Owner |
|---|---|---|
| `ws4_001_habit_events`, `ws4_002_habit_event_epochs` | `habit_events`, `habit_event_epochs` (section 17) | WS4 |
| `ws5_001_email_preferences` | `email_preferences` (section 20) | WS5 |
| `ws8_001_auth_identities`, `ws8_002_magic_link_tokens`, `ws8_003_auth_oauth_states` | `auth_identities`, `magic_link_tokens`, `auth_oauth_states` (section 16) | WS8 |
| `ws9_001` to `ws9_006` (`paddle_events`, `billing_transactions`, `entitlements`, `gift_codes`, `referral_codes`, `referrals`) | the same six tables (section 18) | WS9 |
| `ws10_001_share_links` | `share_links` (section 21) | WS10 |

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
  follow-up job off at `server.js` startup, weekly-email job off in `server/routes/weeklyEmail.js`; WS8's providers honour it the same
  way). WS8 argued production almost certainly does not set it (the Google redirect URI would then be unregistered and web
  sign-in could not work), but nothing in the repo proves it. `COOLIFY_DEPLOY.md` still lists it (line 24) and should not.
- **More providers (WS8, flags `signin_*`):** emailed link, Apple, Microsoft, all ending in the same `nh_session` cookie via
  `server/auth/session.js`. Section 16.
- Client: `src/contexts/AuthContext.tsx`. `apiFetch(path, init)` sends `credentials: 'include'`, adds the Electron
  bearer token, throws `API error <status>` on non-2xx. On mount it calls `/api/user/me`; `sb_has_session` in
  localStorage only chooses the initial status (`loading` vs `no_auth`) so the landing page renders without waiting.
  `AccessStatus = 'loading' | 'no_auth' | 'trial_active' | 'subscribed' | 'free_tier' | 'paywall'` (`src/types/access.ts`),
  derived by `computeAccessStatus(user)` in `src/utils/access.ts`, which calls `shared/access.js` (`active`/`paused` -> subscribed;
  a running lifetime, gift or referral grant -> subscribed; unexpired non-cancelled trial -> trial_active; the free plan only if the
  account carries free-tier limits -> free_tier; else paywall; section 18). `App.tsx` `AppRouter` renders Landing, PaywallPage or the tabbed app from it.
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
- The owner's uncommitted Paddle price-id filter (`PADDLE_PRICE_IDS`, `isOurPaddleData`) is still not in `main`: it is in a stash
  (`docs/agents/RELEASE_NOTES.md`, section f, says how to restore it). WS9 edits these handlers in place, in small functions, and
  `git apply --check` of the patch passed after every merge up to WS11b. Billing, entitlements and referrals: section 18.

### Email

`email.js`: `sendWelcomeEmail`, `sendFeedbackEmail` (the trial follow-up), `sendAdminNotification`, and the generic
`sendEmail({ to, subject, html, text, headers })` added by WS0 for route modules. Sender is `EMAIL_FROM`
(falls back to a Resend sandbox address that only delivers to the account owner). `FROM` is read at import time.
**The Resend SDK returns `{ data, error }` and does not throw on an API error**, so `await sendEmail(...)` can "succeed"
with `error` set (the older emails ignore this). WS5's job treats `result.error` (or no `data`) as a failure
(`isSendSuccess` in `server/jobs/weeklyEmail.js`); do the same in anything new. WS8's magic-link route and WS9's gift email
check it too; the welcome, admin and trial follow-up emails still do not, so `trialFollowup.js` can mark someone mailed when
nothing was sent.

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
| `account-sync` | Account & Sync | WS4 (+WS8, WS5, WS9, WS12a) | `event_sync`, `signin_*`, `weekly_email`, `referrals`, `locale_*` (the Language card) | `sections/AccountSyncSection.tsx` |
| `data` | Data | WS4 (+WS5) | `data_backup`, `event_sync`, `photo_diary` | `sections/DataSection.tsx` |
| `sharing` | Sharing | WS10 | `share_links` | `sections/SharingSection.tsx` |

`meta.ts` (ids, titles, owners, flags, `visibleSections(flags)`), `sectionComponents.ts` (id -> component),
`SettingsSlots.tsx` (the flag-aware renderer, a fragment of grid children rendered once in `Settings.tsx` after Bite
reasons). WS0 shipped every section file as an empty component returning `null`; **all seven have content now**:
`DetectionSection` renders `falsePositive/DetectionSettings`, `AlertsSection` `CoachingSettings`, `BehaviorsSection` its own list,
`ScheduleSection` `background/ScheduleSettings`, `AccountSyncSection` the sync card plus `WeeklyEmailSettings` and `ReferralCard`
(the choice of sign-in method is on `/signin`, not here), `DataSection` `DataSettings` plus `PhotoDiarySettings`, `SharingSection`
`SharingSettings`. The section files are static imports; the heavier cards inside them (sync, data, sharing, weekly email) are lazy
chunks fetched only when a flag is on, so with all flags off nothing is added and nothing extra is downloaded. **Each workstream
edits only its own section file.** Cards should be `fullWidth` unless they pair, follow DESIGN.md (pills, hairlines, no shadows), and gate single
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
`/compare/*` and `/solutions/*` pages, plus WS11a's two gated competitor pages and WS11b's five `/features/*` pages and
`/solutions/cuticle-biting`, which answer the branded 404 while their flag is off). Route modules own `/signin` (WS8), `/redeem`
(WS9) and `/share/...` (WS10), each the app shell or its own document, each the normal 404 while its flag is off. Static serving order: `/assets`, `/fonts`, `/og` (1 year, immutable), `/posts`
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

**Pages behind flags (WS11a, the first of them).** `/compare/hands-off` and `/compare/habitaware-keen` (flag `compare_competitors`):
copy in `src/data/competitorPages.ts` (`GATED_PAGE_MAP`; two entries carry `needsVerification: true`, a human must confirm every
sourced fact), paths in `src/data/gatedComparePaths.ts`, meta in `COMPARE_META` in `server.js` with `flag: GATED_FLAG`. Closed:
the branded 404 (noindex, no canonical), absent from the sitemap, `llms*.txt` and the noscript nav; the copy is a lazy JS chunk
excluded from the service-worker precache (`globIgnores` in `vite.config.ts`). Open: 200, self-canonical, in the sitemap with a
ledger date. `social_proof` is the other WS11a flag: `src/components/site/Testimonials.tsx` (validator
`testimonialsModel.ts`, loader `testimonialsData.ts`, data `src/data/testimonials.json` which is `[]`, rules in
`src/data/README-testimonials.md`); an empty file returns before the flag hook is even mounted (no heading, no request); the
crawler copy in `server.js` is built from `seo-content.json` by the same validator; no Review or AggregateRating markup.
`generate-seo-content.mjs` also writes `dist/seo-gated.json` (the unpublished copy, never served) and the testimonials into
`seo-content.json`. `server.js` keeps `const { flags } = registerRoutes(...)` and reads it in these handlers.

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
(21 entries when WS11a measured it, 60 when WS11b did, because the lazy chunks of the flagged features are precached so they work
offline; `desktopHost-*.js` and the competitor-page chunk are excluded by `globIgnores`, and WS6 removed the manifest from it),
`navigateFallback: '/index.html'` with a denylist for `/api/`, `/downloads/`, `/posts/`, `/signin` (WS8), `/redeem` (WS9) and `/share/` (WS10); runtime caches:
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
- Before WS7b the builder config had `extraResources: data -> data`, which copies `data/users.db` into any installer built on the
  owner's machine; it is now the two tray icons only. `server.js` still redirects `/downloads/Stop-Biting-1.1.0*.dmg` and the 1.0.0
  files to GitHub releases (`DOWNLOAD_MAP`), so those older assets should be checked (`RELEASE_NOTES.md`, section f).
- The desktop app is **not marketed** on the site (removed on purpose); marketing is WS11b's `/features/desktop-app` behind
  `desktop_app`, which must stay off until desktop sign-in works, the Mac build is signed and the installer is linked.

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
  ephemeral port; use global `fetch`; no supertest), and one harness per server feature: `eventsHarness.js` and
  `syncHarness.ts` / `fakeClock.ts` (WS4: two browsers over real HTTP), `authHarness.js` (WS8), `billingHarness.js` (WS9),
  `shareHarness.js` (WS10), `weeklyEmailHarness.js` (WS5).
- Fixtures of the v1 persisted state: `src/storage/fixtures/v1State.ts`.
- Guard tests read source and fail on a forbidden pattern; they are the enforcement of several privacy rules: `storageGuard`
  (no direct browser storage), `coachingGuards`, `falsePositiveGuards`, `syncGuard`, `photoGuard`, `phoneGuards`, `shareGuard`,
  `backgroundGuards`, `trialLength`, `flagCopySources` (all `scripts/*.test.mjs`). `marketingSite`, `featurePages` and
  `billingWebhook` boot the real `server.js` and need `dist/` (they skip without it, so run `npm run build:web` first).
- Baseline before WS0: 18 files / 119 tests. Last gate recorded on `main` at 24cae22 (`tasks/todo.md`): 151 files / 2842 tests,
  `npm run lint` 23 errors / 4 warnings (the pre-existing ones, same files and rules; 23 errors / 7 warnings at the start of WS0),
  `seo:check` and `og:check` in sync. Do not add new lint errors: compare by file and rule. Plain `npm run lint` also scans
  `.claude/worktrees/*`, so lint `src server scripts electron shared` instead. WS13's own run is in
  `docs/agents/RELEASE_NOTES.md` ("QA results").
- QA tooling (WS13), all Node ESM with no dependencies, driving Chrome over CDP:
  `npm run privacy:audit` (`scripts/privacy-audit/`: the real server and a fake camera, every request recorded with its body,
  fails on image data, landmarks, video, the photo diary, an unknown host or an `/api/events` call while sync is off;
  `check.mjs` is the judge, `check.test.mjs` proves it can fail and runs in every `npm test`; `smoke.test.mjs` runs a 45 s
  real-browser smoke only with `PRIVACY_AUDIT=1`; `probe-root.sh` builds the WS7a probe copy so real alarms with landmark data
  can be audited; report in `docs/agents/privacy-audit-report.md`), `scripts/qa/gates.sh` (every release gate in one command)
  and `scripts/qa/docker-repro.sh` (the Dockerfile reproduced by hand), `scripts/lighthouse/run.mjs` (Lighthouse and
  installability against a local server; `docs/agents/lighthouse-report.md`) and `scripts/flags-off-diff/` (sameness against
  another commit with all flags off; `docs/agents/flags-off-diff-report.md`). Accessibility: `docs/agents/accessibility-report.md`.
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
| `Settings.tsx` | frozen; nobody edits it. Two edits were made: WS9 in `PlanSection` (plans), WS11b in one sentence of the Privacy card (now through `useFlagCopy`, on the orchestrator's instruction) | `<SettingsSlots />` |
| `src/pages/settings/sections/*.tsx` | one workstream per file (table in section 7) | |
| `src/pages/settings/meta.ts`, `sectionComponents.ts` | WS0; add a section = a line in each | |
| Marketing copy: `Landing.tsx`, FAQ data, meta/schema strings, `comparePages.ts` | WS11a wording; WS9 mechanical trial-length constant swap; WS11b, WS12 last | |
| Feature pages, flag-aware copy: `src/data/featurePages.ts`, `featurePagePaths.ts`, `shared/flagCopy.js`, `server/marketing/**`, `src/features/useFlagCopy.ts` | WS11b | add a page = copy + map entry + path/flag + `COMPARE_META` entry (`gated: true`); change a sentence on an existing page = a rule in `RULES` and a line in `scripts/flagCopySources.test.mjs`; never edit the source sentence |
| `App.tsx` routes | one added line per route | |
| Phone view: `src/phone/**`, `server/routes/phone.js`, `scripts/generate-phone-icons.py` | WS6 | `Dashboard.tsx` renders `<PhoneView>` when `usePhoneView()` is true (lazy); `App.tsx` passes `onNavigate`; `TabBar` and `PWAGuideModal` read `usePhoneViewActive()`; `AuthContext` calls `resolveFailedSession` / `clearGrant`; `index.html` PWA head tags |
| Sync and backup: `src/sync/**`, `src/backup/**`, `server/routes/events.js`, `server/events/**`, `SyncSettings.tsx`, `DataSettings.tsx` | WS4 | `SYNC_EVENT_FIELDS` (client, `src/sync/payload.ts`) and `EVENT_KEYS` (server, `server/events/validate.js`) are the two whitelists; `payload.parity.test.js` fails if they drift. A new event field touches both plus the places in section 3 |
| Sign-in providers: `server/routes/authProviders.js`, `server/auth/**`, `src/auth/**`, `SignIn.tsx`, `ProviderButtons.tsx` | WS8 | the 3-line Google seam in `server.js` (`createGoogleLinker`); `GET /auth/providers` is the truth for "is this method on"; `/signin` is in the service worker denylist |
| Billing: `server/billing/**`, `server/routes/billing.js`, `src/billing/**`, `src/components/billing/**`, `RedeemPage.tsx` | WS9 | `app.locals.billingWebhook` and `app.locals.decorateUser` are the only hooks into `server.js`; plan numbers only in `shared/plans.js` |
| Coaching: `src/coaching/**`, `src/data/hrtProgram.json`, `src/pages/Program.tsx`, `CoachingSettings.tsx` | WS2 | `<CoachingSeam />` in `AlertOverlay.tsx` and `PiPWindow.tsx`, `<CoachingDashboardSlot />` in `Dashboard.tsx`, `<ProgramHost />` in `App.tsx`; guard: `scripts/coachingGuards.test.mjs` |
| False-alarm controls: `src/falsePositive/**`, `src/calibration/**`, `src/detection/{controls,controlsRegistry,pose,learning,handedness}.ts` | WS3 | `<NotABiteSeam />` beside the coaching seam; `detectHandsWithSides` is the one changed line in `useDetection.ts`; guard: `scripts/falsePositiveGuards.test.mjs` |
| Weekly email: `server/routes/weeklyEmail.js`, `server/weeklyEmail/**`, `server/jobs/weeklyEmail.js`, `WeeklyEmailSettings.tsx` | WS5 | `server/weeklyEmail/summary.js` is the server copy of the bite rule (`parity.test.js`); the unsubscribe routes are never flag-gated |
| Gated pages and testimonials: `src/data/competitorPages.ts`, `gatedComparePaths.ts`, `src/components/site/Testimonials*` | WS11a | see the WS11a paragraph in section 8 |
| `useAppStore.ts` | do not reshape persisted state; new persisted data goes through `kv` or `events` | |
| `src/index.css`, `tailwind.config.js` | do not change tokens (a change reaches every surface; see lessons) | |
| `src/i18n/**`, `scripts/i18n/**` | WS12a (WS12b adds marketing scopes and routes on top) | `createScope`, `t`/`useT`, `format.ts`; `scope.mjs` is the one list of what is exempt from the no-English rule |
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
- **`ELECTRON_PROTOCOL` is global.** If production sets it (`COOLIFY_DEPLOY.md` line 24 says to), the web OAuth callback would
  redirect to `stopbiting://` instead of setting the cookie, and the trial follow-up and weekly-email jobs would not start. WS8
  checked: production almost certainly does not set it, but the repo cannot prove it, so the owner should look and delete the
  line from the file.
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
- **(WS8, WS10) The service worker answers any GET navigation outside its denylist with the cached app shell**, which loads Google
  Analytics. So a page that must not be the shell (`/signin`, `/redeem`, `/share/<token>`) needs a `navigateFallbackDenylist`
  entry in `vite.config.ts`, and a server route that Apple or a mail client reaches by a plain GET lives under `/api/` for the same
  reason. A browser still running the previous worker serves the shell for the new path until it updates (why `share_links`
  should go on a day or two after the deploy).
- **(WS8) Apple posts back from `appleid.apple.com`, so the request carries a foreign `Origin`**, which the `/api/` CORS check
  turns into a 500. Its callback is `POST /auth/apple/callback`, outside `/api/`, then a 303 to `GET /api/auth/apple/finish`.
- **(WS8, WS10) `server.js` sets no `trust proxy`.** Behind Coolify's proxy the global limits (`/api/` 100 per 15 minutes) may be
  one bucket for every visitor. New public routes either sit outside `/api/` with their own limiter (`/auth/providers`,
  `/share/...`) or read the proxy's `X-Forwarded-For` entry only from a private-network peer (`server/auth/session.js`).
- **(WS7a) The page's CSP is `worker-src 'self'`**: a blob worker works under Vite's dev server and is refused in production.
  Workers must be same-origin files (`new Worker(new URL('./x.ts', import.meta.url), { type: 'module' })`), and anything about
  workers, service workers or caching must be measured through the real `server.js`, not the dev server.
- **(WS6) On plain `http://localhost` the service worker never installs** (the app sends `upgrade-insecure-requests`, so the
  redirect of `/index.html` is upgraded to https and the precache fetch fails). To test the worker or offline use, put a throwaway
  https proxy that sends `x-forwarded-proto: https` in front of the server.
- **(WS6) Two files in one folder that differ only by case** (`phoneView.ts`, `PhoneView.tsx`) break `tsc -b` on a case-insensitive
  filesystem. Exporting a non-component from a component file trips `react-refresh/only-export-components`.
- **(WS7a) The React compiler lint rules (`react-hooks/purity`) reject `Date.now()` in render**, and a lint error that disappears can
  mean the compiler skipped the function (an `if (flag) steps++` on a captured `let` did that to `useDetection`). Keep counters in
  an object and the clock in the store.
- **(WS9, WS11a) `scripts/sync-seo.mjs` contains a literal NUL byte** (`parts.join('\x00')`): edit it with a bytes-safe script and
  search it with `grep -a`. Also, writing `export const NAME =` or `export function NAME(` at the start of a line in
  `comparePages.ts` stops `sync-seo.mjs` from following shared sections and moves every page's freshness date; the helpers are
  exported with a trailing `export { ... }` list instead.

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

---

## 16. Sign-in providers (WS8, flags `signin_magic_link`, `signin_apple`, `signin_microsoft`)

Details, the setup steps for Apple and Microsoft and the security table: `docs/agents/ws8-notes.md`. Code: `server/routes/authProviders.js`
(registered in `ROUTE_MODULES`) and `server/auth/`; client `src/pages/SignIn.tsx`, `src/components/auth/ProviderButtons.tsx`, `src/auth/`.

**A method is offered only when its flag is on AND its keys are configured.** `GET /auth/providers` returns
`{ magic_link, apple, microsoft }` and is the one source of truth; it answers 404 while all three flags are off and sits outside
`/api/` on purpose (marketing traffic must not spend the shared `/api/` limit). The client caches the answer for 10 minutes
(`sb:auth:providers`, `src/auth/providers.ts`).

| Route | Purpose |
|---|---|
| `POST /api/auth/magic-link/request` `{email}` | always `{ok:true}` for a valid address (no account enumeration); sends the link |
| `POST /api/auth/magic-link/verify` `{token}` | JSON only, foreign `Origin` refused; sets the session and returns `{ok, redirect}` |
| `GET /api/auth/apple`, `POST /auth/apple/callback`, `GET /api/auth/apple/finish` | Apple: start, Apple's `form_post` return (outside `/api/`: Apple's `Origin` would be refused), second hop that checks the cookie and exchanges the code |
| `GET /api/auth/microsoft`, `GET /api/auth/microsoft/callback` | authorization code + PKCE (S256, verifier kept in the database) |
| `GET /.well-known/apple-developer-domain-association.txt` | served from `APPLE_DOMAIN_VERIFICATION` while it is set, flag or not (`express.static` ignores dot directories) |
| `GET /signin` | the app shell, `noindex`, `no-store`, with a script first in `<head>` that moves the token out of the address bar; the branded 404 while all flags are off |

**One person, one account** (`server/auth/linkPolicy.js`, `accounts.js`). Every sign-in is an identity (`google:<sub>`,
`email:<address>`, `apple:<sub>`, `microsoft:<tid>:<oid>`) in `auth_identities`. A known identity signs in to its account. A new identity
joins an existing account only if the provider vouches for the address AND the existing account's address is itself vouched for (a
legacy Google user, or an identity row with `email_verified = 1`); several candidates: a paying one, then the oldest. An unverified
address is never stored on `users.email`; if an account already has it the sign-in is refused (`email_unverified`) and the person is
told to use the emailed link. Apple vouches for any returned address (relay addresses included); Microsoft only for the personal-account
tenant `9188040d-6c67-4c5b-b112-36a304b66dad` or when the optional claim `xms_edov` is true, never from `email` alone. The ID tokens are
verified against the provider's JWKS (RS256 pinned, `aud`, `iss` per tenant, `exp`, `nonce`).

**The Google seam** is the only edit to existing sign-in code: `server.js` creates `createGoogleLinker({ db, getUser })` and the Google
callback does `if (!user) user = linkGoogleSignIn(googlePayload)`, which runs only when no user has that Google subject, so an existing
Google user never reaches it. It returns an account made by another method with the same verified address, else `null`, and any
error returns `null`.

**Emailed link.** 32 random bytes, only the SHA-256 stored, single use (one conditional `UPDATE ... WHERE used_at IS NULL AND
expires_at > now`), 15 minutes. The token travels in the URL fragment (`#t=...`), never sent to a server, and signing in needs a press of
"Sign in to Stop Biting" (a POST), because mail scanners open GET links. Limits: 5 per address per hour and 30 s apart (counted in the
database), 20 per caller per hour. Resend click tracking must be off for the sending domain or the fragment is lost. Retention:
`magic_link_tokens` rows are deleted 24 hours after they expire, `auth_oauth_states` after use or 10 minutes.

**Client.** `useSignInHref()` (used by `SiteHeader.tsx` and `TrialButton.tsx`) is `/api/auth/google` while no extra method is on, else
`/signin`; `PricingSection` and `HeroDemo` still link straight to Google. New accounts get the trial from `TRIAL_MS`
(`shared/plans.js`). `/signin` is in the service worker's `navigateFallbackDenylist`. `UserProfile.email` can be `NULL` for an account
made by an unverified Microsoft sign-in; the client only reads it as `user?.email ?? ...`.

Not built: showing the linked methods in Settings, deleting identities with an account. Not verified: any real Apple, Microsoft or Resend call.

---

## 17. Optional sync, export and import (WS4, flags `event_sync`, `data_backup`)

Details, the contract for other features and the verification: `docs/agents/ws4-notes.md`. Privacy rule: **only the whitelisted
`HabitEvent` fields can leave the device**; never video, frames, landmarks, photos, calibration or learned poses.

**Server** (`server/routes/events.js`, `server/events/`). Flag `event_sync` first, then sign-in; with the flag off every path is a plain 404.

| Route | |
|---|---|
| `POST /api/events/sync` `{ since, events[], deviceId, epoch? }` | the body is parsed by the route (512 kb; exempted from the global 10 kb parser). Returns `{ events[], cursor, hasMore, epoch }`: what other devices changed after `since`, plus the server's own version of any pushed event it kept instead |
| `GET /api/events/status` | `{ epoch, count, live, deleted, quota, lastChangeAt }` |
| `DELETE /api/events` | wipes the caller's synced events and starts a new **epoch** |

Limits (`server/events/limits.js`): 500 events per batch, 1000 per page, 50,000 rows per account (`EVENTS_QUOTA_PER_USER`), 40 sync
requests per 5 minutes and 30 status or delete requests per 15 minutes per account, on top of the global limit. Any key outside the
whitelist (top level, event, `competingResponse`) refuses the whole batch with a 400 that names the field, never the value. Tables:
`habit_events` (`seq` AUTOINCREMENT is the since-cursor; `UNIQUE(user_id, id)`; `false_positive` and `confirmed` are NULL when absent)
and `habit_event_epochs`. **Other server features read a user's events only through
`createEventStore(db).listUserEvents(userId, { since, until, includeDeleted, limit })`** (weekly email, share links); it hides deleted rows
and decodes the JSON columns. A user who never synced has no rows, and a consumer must say so rather than show zeros.

**Client** (`src/sync/`, pure TypeScript with injected ports: `engine.ts`, `payload.ts`, `controller.ts`; browser wiring in `api.ts`,
`ports.ts`, `runtime.ts`, `optIn.ts`; `SyncHost.tsx` is mounted once in `App.tsx`). Opt-in belongs to **one account on one browser**
(`sb:sync:optin = { userId, at }`); a different person signing in on the same browser starts with sync off. `SyncHost` renders nothing
for an account that did not opt in (no request, no flag request, no chunk); only an opted-in account loads the lazy `SyncRunner`, and an
engine exists only while someone is signed in AND `event_sync` is on AND that person opted in. The queue is **derived**, not kept: the
engine remembers the `updatedAt` the server last acknowledged per event id (`sb:sync:versions`) and an event is waiting when its
`updatedAt` differs, so it survives reloads, offline weeks and a clock that jumps backwards. A cycle pushes up to 500, pulls, merges
through `events.merge`, and repeats while `hasMore` (at most 40 requests); it runs on start, about every 5 minutes (jittered), 30 s after a
local change, on focus (at most once a minute) and on `online`; errors back off from 30 s to 30 min; a 401 stops, a 404 waits 30 minutes, a
409 `epoch_changed` stops this device and tells the person. Conflicts: last write wins by `updatedAt`, ties by `compareEventVersions`
(identical on client and server, proven on 20,000 random pairs). A delete is a tombstone that syncs; an edit made after a delete elsewhere
brings the event back.

**Data controls** (Settings > Data, `src/pages/settings/DataSettings.tsx`, `src/backup/`). "Delete synced data" pauses the engine, deletes the
server rows, starts a new epoch and switches sync off on that device, so a second device cannot silently re-upload. "Delete everything"
removes the server copy first (a box, ticked by default, when sync is on), then local history, settings and sync state; it does **not** touch
nail photos. Export is JSON (`events.exportAll()`, restorable, with the streak anchors) or CSV (formula-looking cells defused); import checks
size (10 MB), validates every entry with `parseWireEvent`, shows a preview and then applies it: a device with no history is restored whole
through `replaceAll`, otherwise through `merge`. Both work with no account and no network.

Limits worth knowing: custom bite reasons are not synced; streak start dates are per device; the app keeps the newest 5,000 events
locally while the server keeps up to 50,000; server rows are kept until deleted, including for lapsed accounts and tombstones; deleting
an account by hand must also delete its `habit_events` and `habit_event_epochs` rows. Guards: `scripts/syncGuard.test.mjs`,
`server/events/payload.parity.test.js`.

---

## 18. Billing, trial length, referrals, free plan (WS9, flags `free_tier`, `lifetime_plan`, `gift_plan`, `referrals`, `regional_pricing`)

Details, the owner's Paddle steps and the verification: `docs/agents/ws9-notes.md`. Legal drafts: `docs/agents/legal/ws9-*.md`.

**One place for the numbers.** `shared/plans.js` (with `plans.d.ts`): `TRIAL_DAYS` (default 3, whole number 1 to 90 from the environment,
read at import time, so it is a build argument AND a runtime variable; `vite.config.ts` copies it into the bundle with `define`),
`TRIAL_MS`, the `${TRIAL_*}` copy tokens (`{{TRIAL_*}}` in `index.html`), free-tier limits, referral and gift numbers.
`scripts/trialLength.test.mjs` fails when a literal trial length appears outside its `ALLOWED` list, which is also the list of the sentences
a human must edit if the length changes. **One access decision:** `shared/access.js` (`evaluateAccess`), called by
`src/utils/access.ts` and by the server. Order: active or paused Paddle subscription, then a running grant (lifetime, gift, referral
credit), then trial, then the free plan (only if the account carries the limits, i.e. `free_tier` is on), else paywall. **Flags decide who
is sold something and what the server reports, never whether something already paid for is honoured.**

**Server** (`server/routes/billing.js`, `server/billing/`). Tables `paddle_events`, `billing_transactions`, `entitlements`, `gift_codes`,
`referral_codes`, `referrals`; grants live in `entitlements`, so a cancelled subscription cannot overwrite a lifetime buyer.

| Route | Flag | |
|---|---|---|
| `GET /api/referrals/me`, `POST /api/referrals/attach` | `referrals` | my code and counts; tie a NEW account (under 7 days old, nothing paid) to a link |
| `GET /api/billing/gift-info`, `POST /api/billing/gift/redeem` | `gift_plan` | single use; 10 tries per 15 minutes per address |
| `POST /api/billing/verify-transaction` | `lifetime_plan` | fallback after checkout; only for the caller's own payment |
| `GET /redeem` | `gift_plan` | the app shell, `noindex`, with the gift code moved out of the address bar; the normal 404 while off; in the service worker denylist |

**The webhook** keeps its raw-body parser and signature check. After the JSON parse, `app.locals.billingWebhook.take(event, res)`
ignores an event id already in `paddle_events`, handles `transaction.completed` (lifetime grant, gift code and email, first payment for the
referral program) and `adjustment.*` (refund, chargeback: revoke grant, gift, the referral credits that payment earned) itself, and records
the other events once the existing `subscription.*` handlers have answered 2xx. Two layers of idempotence: the event id, and a unique key
on every effect (`txn:<id>`). Out-of-order `subscription.*` delivery is still not guarded. The destination in Paddle must also send
`transaction.completed`, `adjustment.created` and `adjustment.updated`. `GET /api/user/me` gets an optional `entitlement` key
(`grants`, `banked_days`, `free_tier`) from `app.locals.decorateUser`; with every flag off and no grants it is exactly the users row.

**Referrals.** Link `<site>/?ref=CODE` (kept 30 days in the browser, only when the flag is on). Reward when the referred user's FIRST
payment completes: both get `REFERRAL_CREDIT_DAYS` (default 30). Checks: not the same user, same normalised email, same Paddle customer,
or the same card; one reward per referred user; a refund or chargeback takes both credits back. A payment is rewarded only if its price id
is positively one of ours (`PADDLE_PRICE_IDS`, or `PADDLE_PRICE_ID_MONTHLY` and `_YEARLY`, in the runtime environment). Gift and referral days
are banked and start when the account has no other access.

**Free plan.** Detection minutes are counted in the browser per local day (`src/billing/useFreeTier.ts`, `sb:billing:free-usage`; paused
time never counts, WS7a) and the camera is switched off at the limit; History lists the last N days while statistics and streaks use
everything. It replaces the paywall for accounts whose trial ended or lapsed. **Client:** `src/billing/` (env, Paddle loader,
localized prices through `Paddle.PricePreview`, referral and gift-code storage), `src/components/billing/` (`PlanExtras`, `LifetimePlate`,
`ReferralCard`, `FreeTierNotice`, `BillingHost`), `src/pages/RedeemPage.tsx`; any failure of localized prices keeps $2.99 and $29.

---

## 19. Coaching, urge timer and the false-alarm controls (WS2 and WS3, flags `hrt_coaching`, `urge_timer`, `false_positive_controls`)

Detection-side detail of WS3 is in section 2; the full notes are `docs/agents/ws2-notes.md` and `ws3-notes.md`.

**WS2 (`src/coaching/`).** After an alarm an optional card offers the person's competing response (15 to 60 s; Done, Skip, Escape; the prompt
policy is off, hourly or every alarm, and defaults to **off per person** even with the flag on). It can never block, delay or silence the
alarm: `useDetection.startBiting` starts the sound first and `logIncident` only then notifies; coaching hears about an alarm from a store
listener (`watcher.ts`) that does one pure check, defers the rest with `queueMicrotask` and is wrapped in try/catch;
`scripts/coachingGuards.test.mjs` fails if any coaching file imports the detector, camera, alarm sound or PiP code, or if the seam imports the
store. Seams: `<CoachingSeam surface="main" />` in `AlertOverlay.tsx`, `surface="pip"` in `PiPWindow.tsx`, `<CoachingDashboardSlot />` in
`Dashboard.tsx` (bridge, urge timer, program link), `<ProgramHost />` in `App.tsx`. The "I feel an urge" timer (`UrgeTimer.tsx`, 60 or 90 s,
`urge_timer` alone is enough) logs a **manual event with trigger `urge`, which is not a bite** (`isUrge`, used by `isBite`, History, Today and
the charts). The 4-week program (`src/data/hrtProgram.json`, 28 lessons, `reviewed: false`, NEEDS HUMAN REVIEW) is an in-app full-screen view
(`Program.tsx`, `ProgramView.tsx`), not a URL; one new lesson a day, no backlog or streak. Data: `competingResponse` on the event; kv
namespace `hrt` (`settings`, `last-prompt-at`, `program`); `src/utils/coachingStats.ts` gives the share of alarms followed by a finished response.

**WS3 (`src/falsePositive/`, `src/calibration/`, `src/detection/controls.ts` and friends).** The controls can only remove or delay an alarm:
chin-rest rule, learned poses (six numbers per "Not a bite" tap), hand filter, silence. `falsePositive: true` outranks `confirmed`
(state table in `eventModel.ts`). The learned data and the calibration are kv namespace `falsePositive`: never an event field, never in
the export, never synced (`localOnly.test.ts`, `falsePositiveGuards.test.mjs`). "Clear all data" does not touch `kv`; Settings > Detection
has "Forget what it learned" and "Delete calibration". The MediaPipe handedness mapping assumes a mirrored picture and is one constant,
`HANDEDNESS_INPUT_IS_MIRRORED` (`handedness.ts`), unverified on a real device.

---

## 20. Insights, photo diary and the weekly email (WS5, flags `insights`, `photo_diary`, `weekly_email`)

Details: `docs/agents/ws5-notes.md`; legal drafts `legal/ws5-*.md`.

**Insights is a view inside History, not a URL** (a new top-level path needs `server.js` `KNOWN_ROUTES` and the service worker's navigation
fallback). `Log.tsx` has a History / Insights switch (`useInsightsAvailability()`, a lazy `InsightsView` in `src/insights/ui/`); with
both flags off the switch renders nothing and `Log` renders what it did. The charts are plain HTML and CSS (recharts renders an empty box
without a DOM, which would have left the 0 / 1 / 10,000-event tests with nothing to assert, and a scaled SVG shrinks its text on a phone).
`src/insights/aggregate.ts` is one pass over the history (`computeInsights`; 10,000 events in about 2 ms in the browser's zone, 22 ms with a named zone), `zone.ts` does calendar maths in
the browser's time zone (or a named IANA zone in tests), weeks start on Monday, and `predicate.ts` is the one place the charts decide what a
bite is, built on WS3's predicates. Milestones (`milestones.ts`, clock injected): first hour without a bite, first day, 7 days, 30 days, and
the 100th alarm that still stands; each celebrated once ever (`sb:insights:milestones`), with a baseline on first run so a new user is not
greeted with old ones. The share card (`shareCard.ts`) is a 1080 x 1080 PNG drawn on a canvas: the figure, one sentence, the date, the app's
name; no photo, name, email or other number, and it leaves the device only if the person sends it.

**Photo diary (`src/photos/`).** Hands-only guided capture with a separate `getUserMedia` (all tracks stopped on save, discard, cancel,
error, unmount and when the page is hidden), weekly in-app reminder strip (7 days, "Not now" snoozes a day, no Notification API),
before/after slider. Bytes in IndexedDB through `localBlobs` (collection `photo-diary`), metadata in `sb:insights:photo-diary`, one JPEG per
photo, at most 1,280 px and 104 photos. Photos are drawn on canvases via `createImageBitmap`, never `<img src="blob:...">`, because the CSP has no
`blob:` image source. **Local only, by construction:** `scripts/photoGuard.test.mjs` (no network or sync imports, no photo-like key in either
whitelist, the service worker caches no photo) and `src/photos/photoNetwork.test.tsx` (throwing spies on every network API through the
lifecycle). The diary has no export; "Delete everything" does not delete it.

**Weekly summary email.** Routes `GET` and `PUT /api/email/weekly` (flag `weekly_email`, then sign-in; the browser never sends an address)
and `GET` and `POST /api/email/unsubscribe/:token` (**never flag-gated, no sign-in**: a dead unsubscribe link is a compliance problem; GET shows
a confirmation and changes nothing, POST unsubscribes, including RFC 8058 one-click). The token is `base64url(userId).base64url(HMAC-SHA256(
per-account secret, "weekly-summary-unsubscribe:v1:" + userId))`. Table `email_preferences`. The job (`server/jobs/weeklyEmail.js`) starts in
`register()` only when `weekly_email` is on, `RESEND_API_KEY` is set and `ELECTRON_PROTOCOL` is not; it runs hourly, `.unref()`'d, and for each
opted-in account with synced events works out the last completed ISO week in the person's own time zone and sends between 8 and 72 hours
after it ended, only if the week ended after they opted in and either week had a bite. **Claim, then send:** `UPDATE ... SET last_sent_week = week
WHERE ... last_sent_week < week` must change one row before anything is sent; if the send throws or returns `{ error }` the claim is put back.
At most 200 sends per tick. The body is plain and branded, with no image or name, and says "A log is a way to notice a habit, not a treatment."

---

## 21. Share links (WS10, flag `share_links`)

Details, the scope table and the verification: `docs/agents/ws10-notes.md`; legal draft `legal/ws10-*.md`.

Owner routes (flag, then sign-in; 60 requests per 15 minutes per account): `POST /api/share/links` (body exactly `label?`, `expiresInDays?` of 7, 30,
90 or null, `detailed?`, `timezone?`; returns the token ONCE; at most 5 active links), `GET /api/share/links` (no token, no hash),
`DELETE /api/share/links/:id` (no entitlement needed, so an expired account can always revoke). Public routes (no sign-in, no cookie; the address
is the credential): `GET /share/:token` (the page) and `GET /share/:token/data.json`. A revoked, expired, unknown or malformed token gets one
answer: the same 404, body and headers (one query that already excludes revoked and expired rows). Table `share_links`: only the SHA-256 of the
32-byte token is stored; revoked or expired rows are deleted 30 days later, whenever anyone next makes a link.

**What a link reveals is whatever `buildShareView` returns** (`server/share/summary.js`; `toPublicView` names every key literally, no spread),
pinned by exact-key-set tests for both modes: streak in whole days, bites in the last 7 days / the 7 before / the last 12 weeks, 28 daily and 12
weekly counts as positions with no dates, reasons in the fixed groups `stress, focus, boredom, unknown, other`, the competing-response rate,
and, only when the owner ticked "detailed", day-level dates and an hour-of-day histogram. Never: ids, device ids, hands, behaviours, free text,
custom reason names, per-event timestamps, name, email, account id, time zone, photos, the private label. Definitions are the server's copy of
the app's WS3 predicates (`server/share/semantics.test.js`). Events come from `createEventStore(db).listUserEvents`.

**The page is not the app shell** (the shell loads Google Analytics and the address holds the token): `server/share/page.js` renders one
self-contained document with an inline stylesheet and one inline script allowed by SHA-256 in its own CSP (`default-src 'none'`), no third
party, no cookie, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, a print stylesheet for one A4
page. Two shared-file edits make it work: `server.js` exempts `/share/` from the canonicalising lower-case redirect (tokens are mixed case) and
`vite.config.ts` has `/^\/share\//` in `navigateFallbackDenylist`. Known: the address is a bearer secret and may appear in host logs; a chat
app that previews the link counts as a view.

---

## 22. Where each flag is checked

All 27 flags are in `src/features/registry.ts` and `server/features.js`. This is where each one is actually read, to answer "what does
turning it on touch". "Page" = a gated marketing page (`src/data/featurePagePaths.ts`).

| Flag | Server | Client |
|---|---|---|
| `detection_behaviors`, `experimental` | none (the worked-example route uses `experimental`); page `/solutions/cuticle-biting` for the first | `src/detection/useBehaviors.ts` (reads both), `registry.ts` `effectiveBehaviors()`, `BehaviorsSection` |
| `hrt_coaching` | page `/features/habit-reversal-coaching` | `CoachingDashboardSlot.tsx`, `ProgramView.tsx`, Settings > Alerts, `InsightsView.tsx` |
| `urge_timer` | | `CoachingDashboardSlot.tsx`, `src/phone/PhoneView.tsx` |
| `false_positive_controls` | | `FalsePositiveSlot.tsx`, `useEnabled.ts`, `InsightsView.tsx`, Settings > Detection |
| `event_sync` | `server/routes/events.js`; copy rules in `shared/flagCopy.js` | `SyncRunner.tsx`, `src/sync/ports.ts`, `SyncNoteView.tsx`, `DataSettings.tsx`, `SharingSettings.tsx` |
| `data_backup` | none (export and import are client-only) | `DataSection.tsx`, `DataSettings.tsx` |
| `insights`, `photo_diary` | none | `useInsightsAvailability.ts`, `MilestoneHost.tsx`, `PhotoReminder.tsx`, `PhotoDiarySettings.tsx` |
| `weekly_email` | `server/routes/weeklyEmail.js` (routes and job start; unsubscribe is ungated) | `WeeklyEmailSettings.tsx` |
| `phone_companion` | `server/routes/phone.js` (manifest shortcuts); copy rules; page `/features/phone-companion` | `src/phone/usePhoneView.ts`, `offlineGrant.ts` |
| `background_watching` | none | `src/background/gate.ts`, `BackgroundHost.tsx`, `useDetection.ts`, `usePictureInPicture.ts`, `useNotifications.ts` |
| `desktop_app` | page `/features/desktop-app` only | none |
| `signin_magic_link`, `signin_apple`, `signin_microsoft` | `server/routes/authProviders.js`; copy rules (only when keys are configured, `server/marketing/copyFlags.js`) | `src/auth/`, `SignIn.tsx` |
| `free_tier` | `server/billing/userDecorator.js` | `src/billing/useFreeTier.ts` (reads `entitlement.free_tier`) |
| `lifetime_plan`, `gift_plan` | `server/routes/billing.js` | `PaywallPage.tsx`, `PlanExtras.tsx`, `useGiftInfo.ts` |
| `referrals` | `server/routes/billing.js`, `server/billing/referrals.js`; page `/features/referral-program` | `ReferralCard.tsx`, `referralCapture.ts` |
| `regional_pricing` | none | `src/billing/prices.ts` |
| `share_links` | `server/routes/share.js`; page `/features/share-with-therapist` | `SharingSection.tsx`, `SharingSettings.tsx` |
| `compare_competitors` | `server.js` (`GATED_FLAG`), `server/marketing/gatedPages.js` | `ComparePage.tsx` |
| `social_proof` | `server.js` (testimonials article) | `src/components/site/Testimonials.tsx` |
| `locale_es`, `locale_de`, `locale_pt_br` | none yet (WS12b will add the marketing pages) | `src/i18n/LocaleHost.tsx` (the only link between a language and the flags), `LanguageSettings.tsx` (the card appears while one is on), `meta.ts` |

---

## 23. Localization of the signed-in app (WS12a, flags `locale_es`, `locale_de`, `locale_pt_br`)

Full notes: `docs/agents/ws12a-notes.md`. The short version:

- **Where the text lives.** `src/i18n/scopes/<area>.ts` holds the English messages of one area and exports its `t` / `useT`; the translations are
  `src/i18n/locales/{es,de,pt-BR}/<area>.ts`, typed `Record<keyof English, string>`. English is the source of truth. A scope is imported by the
  code of its area, so the English text stays in that area's lazy chunk; keep the scopes imported by the main bundle (`common`, `shell`, `alarm`,
  `trial`, `plans`, the i18n core) small. The `labels` scope (tag and behavior names) is read through getters in `triggerTags.ts` / `detection/registry.ts`.
- **Messages.** ICU-like subset in `message.ts`: `{name}`, `{n, number}`, `{n, plural, =0 {..} one {# ..} other {# ..}}`, `{x, select, ..}`, rich `<tag>..</tag>`
  through `t.rich`. Stored ids (tags, behaviors, settings values) are never translated; only what is displayed, through a lookup.
- **Which language.** Only what the person picked (Settings > Account & Sync > Language, kept in `kv('i18n', 'locale')` via `src/i18n/persist.ts`) and only
  when that locale's flag is on: `<LocaleHost />` (mounted by `App.tsx`, `SignIn.tsx`, `RedeemPage.tsx`) is the only link between the language and the
  flags. The browser language is never read. The catalog of the language is fetched by dynamic import (`assets/locale-*.js`, kept out of the service
  worker precache); until it arrives, and for any missing key, English shows. `<html lang>` follows (written only after a language was applied).
- **`src/i18n/core.ts` imports no storage, flags or store.** The alarm overlay, `useDetection` and the not-a-bite seam are also loaded by the marketing demo,
  and `scripts/coachingGuards`, `falsePositiveGuards`, `backgroundGuards` keep storage and the flag client out of that part of the bundle. `format.ts` imports
  date-fns, so those modules must not import it (`backgroundGuards` pins `useDetection`'s packages).
- **Formatting.** `src/i18n/format.ts`: numbers, money, dates, times, relative time, lists. While English shows they behave exactly like the code they replaced
  (browser formats, date-fns patterns), so English output is unchanged.
- **Enforcement.** Two ESLint rules (`local-i18n/no-hardcoded-text`, `local-i18n/no-english-literals`; `scripts/i18n/`) fail on English in any file under `src/`
  that `scripts/i18n/scope.mjs` does not exempt (each exemption has a reason). `scripts/i18n/guard.test.mjs` runs them inside `npm test`. Every area has a
  pseudo-locale coverage test (`src/i18n/coverage/*.coverage.test.tsx`: German catalog, every `t()` result wrapped in `⟦ ⟧`, fail on any word outside the marks);
  `scripts/i18n/inventory.test.mjs` requires every file that uses `t()` to be rendered by one or carry a `NOT-RENDERED` reason; `src/i18n/catalogs.test.ts`
  checks keys, placeholders, plural forms and the `NEEDS NATIVE REVIEW` header of every locale.
- **Not translated:** marketing pages, blog, compare pages, calculators, legal text, the 28 coaching lessons, every server-rendered page and email, the Electron tray menu.

