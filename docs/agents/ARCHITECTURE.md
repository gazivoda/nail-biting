# Stop Biting — Architecture (written by WS0, verified against the code)

Every agent after WS0 reads this first, then `docs/agents/PLAN.md` (your workstream), `docs/agents/SWARM_RULES.md`
and `tasks/lessons.md`. Claims here name the file and function so you can check them. Line numbers are left out on
purpose; they rot. If something here is wrong, fix it in your PR and say so in your report.

Contents: 1 Stack and file map · 2 Detection · 3 History, streak, event schema v2 · 4 Storage module ·
5 Feature flags · 6 Server: routes, auth, Paddle, database · 7 Settings shell · 8 Marketing pages, meta, schema ·
9 PWA · 10 Electron · 11 Tests and tooling · 12 File ownership map · 13 Rules for later agents ·
14 Gotchas · 15 Background watching and Picture-in-Picture (reserved for WS7a)

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
email.js                  Resend: welcome, feedback, admin notice, generic sendEmail()
trialFollowup.js          hourly job: one email 24 h after a trial ends
src/
  App.tsx                 path-based routing; AuthProvider > AppRouter (Landing | Paywall | tabbed app)
  main.tsx                React root + service worker registration
  store/useAppStore.ts    THE persisted store (history, streak, settings) + migrations
  storage/                the storage module (section 4): adapter, kv, deviceId, blobs, events facade
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
WS10) must carry it unchanged. WS3: "Not a bite" sets `falsePositive: true`; make `isBite` return false for it in
that one function and every screen follows.

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
   strip trailing slash, `/index.html` -> `/`; never `/api` or `/assets`).
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

**New tables and columns** go through `server/db/migrate.js`, additive only: `createTable` (must be
`CREATE TABLE IF NOT EXISTS`), `createIndex` (`CREATE [UNIQUE] INDEX IF NOT EXISTS`), `addColumn(table, column,
definition)` (checks `PRAGMA table_info` first; rejects `PRIMARY KEY`/`UNIQUE` and `NOT NULL` without `DEFAULT`),
`runMigrations(db, steps)` (each step in a transaction, recorded once in `schema_migrations`). There is no helper to
drop, rename or rewrite, on purpose. Tests use an in-memory database (`test-utils/memorySqlite.js`).

### Auth

- `GET /api/auth/google`: sets a 5-minute `oauth_state` cookie, redirects to Google (`profile`, `email`).
- `GET /api/auth/callback`: checks `state` against the cookie (skipped when `ELECTRON_PROTOCOL` is set), exchanges the
  code, verifies the id token, **creates the user on first sign-in with a trial of 3 days (hard-coded inline)**,
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
  found by `custom_data.userId`, else by customer email. It is **not idempotent today** (WS9 must make it so).
- `POST /api/paddle/verify-subscription` (auth): looks the transaction up via the Paddle API, then the subscription;
  accepts `active`/`trialing`; writes the same fields. `GET /api/paddle/portal-session` (auth): returns the Paddle
  customer-portal URL.
- The owner's uncommitted Paddle price-id filter (`PADDLE_PRICE_IDS`, `isOurPaddleData`) is not in this base; see
  SWARM_RULES.md. WS9 edits these handlers in place, in small functions.

### Email

`email.js`: `sendWelcomeEmail`, `sendFeedbackEmail` (the trial follow-up), `sendAdminNotification`, and the generic
`sendEmail({ to, subject, html, text, headers })` added by WS0 for route modules. Sender is `EMAIL_FROM`
(falls back to a Resend sandbox address that only delivers to the account owner). `FROM` is read at import time.

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

**Adding a marketing page** (WS6 phone view, WS10 share page, WS11): client branch in `src/App.tsx`; a server handler
(or at least a `KNOWN_ROUTES` entry, otherwise a direct hit 404s); for indexable pages `CORE_PAGES` and
`PAGE_SOURCES` in `sync-seo.mjs` (the file contains binary bytes: use `grep -a` and edit in bytes) and the llms.txt
key-page list. Pages that must stay private use `noindex` and are kept out of the sitemap. A page that exists only
while a flag is on must 404 on the server while it is off (`flags.isOn`) so it cannot be indexed.

---

## 9. PWA

`vite.config.ts` includes `VitePWA` only when `VITE_BUILD_TARGET=web` (what `build:web`, the Dockerfile and nixpacks use).
`registerType: 'autoUpdate'`, `injectRegister: null`; `src/main.tsx` registers `/sw.js` on window load with errors
swallowed. The generated worker has `skipWaiting` + `clientsClaim`, so a new deploy takes over on the next navigation
(the open page is not reloaded; there is no update prompt). Manifest (generated, `dist/manifest.webmanifest`): name
"Stop Biting: AI Nail Habit Tracker", `display: standalone`, `orientation: portrait-primary`, theme/background
`#F7F7F1`, icons 192, 512 and a maskable 512 in `public/icons/`, `screenshots: []`. Workbox: precache of the app shell
(21 entries), `navigateFallback: '/index.html'` with a denylist for `/api/`, `/downloads/`, `/posts/`; runtime caches:
`/assets/*.js|css` StaleWhileRevalidate, `/posts/<slug>.json` NetworkFirst (3 s), `/icons/*.png` CacheFirst.
MediaPipe wasm and models are excluded from precache and not runtime-cached (browser HTTP cache only), so detection
needs a network on the very first run of a profile. `/api/*` is never cached by the worker.
Install UI: `usePWAInstall` (captures `beforeinstallprompt`, key `pwa_install_dismissed`), `PWAInstallPrompt`
(banner), `usePWAGuide` + `PWAGuideModal` (iOS/Chromium instructions, key `pwa_guide_snoozed_until`).
**A browser that has visited keeps the old bundle until the worker updates** (lessons.md): unregister the worker or use
a fresh headless Chrome profile before judging a UI change. WS6: the manifest has no `shortcuts` or phone-specific
config; `start_url` is `/`.

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
| `Dockerfile` | WS0 added `COPY server ./server` | any new top-level server path must be copied |
| Detection rule: `biteDetector.ts`, `src/detection/**` (zones, rules, registry, engine), `scripts/eval-detection/**` | WS1 then WS3 | extras on `logIncident` carry `behavior`/`hand`; `getBehaviors` on `createBiteDetector` |
| Detection loop / PiP: `useDetection.ts` loop, `usePictureInPicture.ts`, `PiPWindow.tsx` | WS7a (wave 3) | before then, one-line seams only |
| Desktop shell: `electron/**`, `src/desktop/**`, `vite.electron*.config.ts`, `build/`, `.github/workflows/desktop.yml` | WS7b | `src/desktop/ipc.ts` is the contract with the Electron side; WS7a consumes `stopbiting:desktop-command` and reports with `stopbiting:desktop-state` (docs/agents/ws7b-notes.md) |
| Alarm UI: `AlertOverlay.tsx`, `CameraView.tsx` `handleAlert` | WS2 mounts coaching overlay; WS3 adds "Not a bite" at the same seam | `handleAlert` is the one-line seam for `{ behavior, hand }` |
| `Settings.tsx` | frozen; nobody edits it (WS9 may touch `PlanSection` for plans) | `<SettingsSlots />` |
| `src/pages/settings/sections/*.tsx` | one workstream per file (table in section 7) | |
| `src/pages/settings/meta.ts`, `sectionComponents.ts` | WS0; add a section = a line in each | |
| Marketing copy: `Landing.tsx`, FAQ data, meta/schema strings, `comparePages.ts` | WS11a wording; WS9 mechanical trial-length constant swap; WS11b, WS12 last | |
| `App.tsx` routes | one added line per route | |
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
- **Trial length is hard-coded** (`3 * 24 * 60 * 60 * 1000` in the Google callback) and in copy; WS9 centralises it.
- **`PWAGuideModal` says "Works offline: detection runs fully on-device, no internet needed"**, but the worker does not
  cache the models. WS11a/WS6: do not repeat that claim.
- The persisted payload grew by about 60 percent with v2 (see section 3). `MAX_INCIDENTS` is still 5000.
- `src/storage/index.ts` imports the store, which hydrates from localStorage at import. Importing it from a marketing
  page would break the "demo never touches the store" guarantee. Use `src/storage/kv` there.

---

## 15. Background watching and Picture-in-Picture (WS7a to complete)

_Reserved for WS7a. Document here, with measurements: what the browser does to the detection loop when the tab is
hidden (rAF paused, timer throttling, the 500 ms `setInterval` fallback in `useDetection`), what Document
Picture-in-Picture changes, what happens on browsers without it, notification and schedule behaviour, and how pause /
meeting mode interact with `logIncident` (the alarm must still be loggable). Starting points that exist today:
`usePictureInPicture.ts` (opens a Document PiP window of 240x64 with copied styles, falls back to PiP of the raw video
element), `PiPWindow.tsx` (a status strip with Start/Stop, rendered from `CameraView`), `useNotifications.ts`
(periodic "hands check" reminders, skipped while detection runs), and `useDetection.startBiting` (app badge and
`Notification` when `document.hidden`)._
