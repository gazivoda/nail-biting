# WS0 (Foundation) — notes

Read `docs/agents/ARCHITECTURE.md` for the reference; this file is the short version for the owner and for WS13
(release notes).

## What exists now

- **Event schema v2.** `HabitEvent` (the plan's type, field for field) in `src/storage/eventModel.ts`. History is still
  stored in the existing `stop-biting-state` key, now `STATE_VERSION 2`. Records are a superset of the old shape
  (old fields untouched, `ts`, `source`, `behavior`, `updatedAt` added), so streaks and statistics are identical and an
  older bundle still reads the data.
- **Safe migration.** The raw old JSON is copied once to `stop-biting-state-v1-backup` before anything is rewritten.
  If you ever need to undo the upgrade for a user: put that string back under `stop-biting-state`.
- **Storage module** `src/storage/`: `events`, `settings`, `kv`, `localBlobs` (IndexedDB, local only), `getDeviceId`.
  A lint rule and a test forbid direct `localStorage`/`sessionStorage`/`indexedDB` use outside it (four old files are
  allowlisted).
- **Feature flags**, 27 of them, all off. Server `FEATURE_FLAGS` env -> `GET /api/features` -> client `useFeature()`.
- **Server route registry** `server/routes/`: one call in `server.js`, one file per workstream, additive DB migration
  helpers `server/db/migrate.js`, generic `sendEmail` in `email.js`.
- **Settings shell**: seven empty, flag-gated sections under `src/pages/settings/sections/`. Existing cards untouched.
- **Tests**: vitest now also runs `server/**` and `scripts/**` tests; shared helpers in `test-utils/`.

## Nothing changes for users until flags are turned on

With `FEATURE_FLAGS` unset: `/api/features` returns every flag `false`; Settings renders byte-identical to before;
the only new network request is one `GET /api/features` when a signed-in user opens Settings; the server answers every
existing route with byte-identical bodies.

## Turning a flag on (owner)

1. In Coolify, app environment variables: `FEATURE_FLAGS=event_sync,data_backup` (names in `.env.example` and
   `src/features/registry.ts`; the `before` field of each says what must be done first).
2. Restart the app (no rebuild).
3. Check `https://stopbiting.today/api/features`.
To go back: remove the name and restart. Clients pick the change up within about 10 minutes (or on reload).
Server logs at boot: `[routes] ... flags on: ...` and warnings for unknown names or missing prerequisites.

## Owner / human TODO before the next workstreams ship

- Confirm production does **not** set `ELECTRON_PROTOCOL` on the web server (`COOLIFY_DEPLOY.md` says to set it; if it
  is set, the Google callback redirects to `stopbiting://` instead of setting the cookie). Unverified from the repo.
- No new environment variable is required for WS0 itself. `FEATURE_FLAGS` is optional (empty = all off).
- Deploy note: the Dockerfile now copies `server/`. A build that is not the Dockerfile (nixpacks) copies the whole repo
  and needs no change.

## Decisions and deviations (see ARCHITECTURE.md for the reasons)

- `confirmed` (v1 review state) is not in the plan's `HabitEvent`; it is carried as an extra field
  (`HabitEventWire`). WS3/WS4/WS10 must keep it.
- `deleteIncident` now also records a minimal tombstone (needed for sync later). `clearHistory`/`clearAllData` reset
  the tombstone list.
- `logIncident` gained an optional third argument `extras` (behavior, hand, ...). Its 30 s alarm-episode merge is now
  per behavior (identical while only nail biting exists).
- One existing test changed: `useAppStore.test.ts` "no-op for state already at the current version" used version 1 as
  "current"; it now uses `STATE_VERSION`.
- Settings: existing cards stay in `Settings.tsx` (lower risk); new sections are added after "Bite reasons".
- `tests include` widened as asked; `test-utils/` lives at the repo root.
- No new dependencies.

## Not verified

- Anything needing a real camera, a real Paddle account or a real email provider.
- The packaged Electron app and `npm run build` (renderer) were not run. The main/server bundle was built into a
  scratch directory (`vite build --config vite.electron.config.ts --outDir <scratch>`) and succeeds; `server.js` is
  still one of its entries, so it bundles `server/**` (plain relative ESM imports).
