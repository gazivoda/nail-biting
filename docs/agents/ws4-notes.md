# WS4 (Optional sync of history, export, import) — notes

Opt-in sync of history between a person's browsers, a manual export/import that works with no account, and the
data controls (delete synced data, delete everything). Everything is behind two flags, off by default:
`event_sync` (sync, delete synced data) and `data_backup` (export, import). For the owner, for WS5/WS6/WS10 (the
contract), and for WS13 (release notes). Reference: `docs/agents/ARCHITECTURE.md`.

## How to turn it on (owner)

1. Read the drafts in `docs/agents/legal/ws4-privacy.md` and `ws4-terms.md` (**NEEDS HUMAN REVIEW**). The Privacy
   Policy currently says habit data is "stored only in your browser"; that stops being true for a person who switches
   sync on. Publish the new wording with the flag, and change the other sentences listed under "Copy that says history
   is local-only" below.
2. In Coolify set `FEATURE_FLAGS=event_sync,data_backup` (either alone works: `data_backup` is export/import, with or
   without an account; `event_sync` is sync and "Delete synced data") and restart. No rebuild, no new required env var.
   Optional: `EVENTS_QUOTA_PER_USER` (default 50000 stored entries per account).
3. Check `GET /api/features`, then Settings: "Account & Sync" and "Data" appear. Sync is **off for everyone until they
   switch it on**.
4. To go back: remove the names and restart. The server answers 404 at once; a browser that had sync on shows "Sync is
   not available right now" and tries again every 30 minutes, and stops for good when its cached flags refresh (within
   about 10 minutes of the tab being used). Stored rows stay in `habit_events` until deleted.

## What exists

| Area | Files |
|---|---|
| Server route module (registered in `server/routes/index.js`) | `server/routes/events.js` |
| Server logic | `server/events/{limits,validate,compare,store}.js` |
| Client sync engine (pure TS, ports injected) | `src/sync/engine.ts`, `types.ts`, `payload.ts`, `controller.ts` |
| Client wiring | `src/sync/{api,apiFetchRequest,ports,browser,runtime,optIn,actions,statusText,deviceName,useSyncStatus}.ts`, `SyncHost.tsx` (mounted once in `App.tsx`), `SyncRunner.tsx` (lazy) |
| Backup | `src/backup/{csv,importPlan,files}.ts` |
| UI | `src/pages/settings/SyncSettings.tsx`, `DataSettings.tsx`, the two section files (lazy-loaded) |
| Tests | `server/routes/events.test.js` (84), `events.sync.test.js` (12, two browsers over real HTTP), `server/events/*.test.js` (8), `src/sync/*.test.ts` (97), `src/backup/backup.test.ts` (20), `src/pages/settings/syncData.test.tsx` (17), `scripts/syncGuard.test.mjs` (18); helpers `test-utils/{eventsHarness.js,fakeClock.ts,syncHarness.ts}` |

### Endpoints (all: flag `event_sync` first, then sign-in; with the flag off every path is a plain 404)

| | |
|---|---|
| `POST /api/events/sync` | body `{ since, events[], deviceId, epoch? }` (exactly these keys). Returns `{ events[], cursor, hasMore, epoch }`: events other devices changed after `since` (never the rows this request wrote), plus the server's own version of any pushed event it kept instead. Pass `cursor` back as `since`; while `hasMore` is true ask again. Errors: 400 `invalid_request` (names the index and field, never a value), 401, 404 (flag off), 409 `epoch_changed`, 413 `quota_exceeded` / `payload_too_large`, 429. |
| `GET /api/events/status` | `{ epoch, count, live, deleted, quota, lastChangeAt }` (for the confirmation text) |
| `DELETE /api/events` | wipes the caller's synced events, starts a new epoch: `{ deleted, epoch }` |

Limits (`server/events/limits.js`): 500 events per batch, 1000 per response page, ids and device ids 64 chars
(`[A-Za-z0-9._:-]`), 10 triggers of at most 64 chars, `ts`/`updatedAt` within 0..year 2100, durations at most a day,
50,000 rows per account (`EVENTS_QUOTA_PER_USER`), 40 sync requests per 5 minutes and 30 status/delete requests per 15
minutes **per account** (on top of the server-wide 100 / 15 min / address). The sync route parses its own body (512 kb).

### Schema (additive migrations `ws4_001`, `ws4_002`)

`habit_events(seq INTEGER PRIMARY KEY AUTOINCREMENT, user_id, id, ts, source, behavior, hand, triggers JSON,
false_positive, confirmed, competing_response JSON, device_id, updated_at, deleted, server_updated_at,
UNIQUE(user_id, id))`; `habit_event_epochs(user_id PRIMARY KEY, epoch, created_at)`. `seq` is the since-cursor: it only
ever grows (AUTOINCREMENT survives deletes and wipes), a row that changes is rewritten and gets a fresh seq, a write that
changes nothing writes nothing. `false_positive` and `confirmed` are NULL when absent (tri-state kept exactly). A
deleted row keeps no content.

## The contract for WS5, WS6 and WS10

- **Reading a user's events on the server** (weekly email, share links):
  `import { createEventStore } from '../events/store.js'; const store = createEventStore(ctx.db);`
  `store.listUserEvents(userId, { since, until, includeDeleted, limit })` returns canonical wire events (`HabitEvent`
  plus `confirmed`), oldest first by `ts`; `since` inclusive and `until` exclusive on `ts`. Deleted events are left out
  unless asked for. `store.counts(userId)` gives totals. Do not query `habit_events` with your own SQL for anything
  that must agree with this (it hides deleted rows and decodes the JSON columns). A user who never synced has no rows:
  the weekly email must say so, not send zeros as if they were data.
- **The wire shape is `HabitEventWire`** (`src/storage/eventModel.ts`): `{ id, ts, source, behavior, updatedAt,
  hand?, triggers?, falsePositive?, competingResponse?, confirmed?, deviceId?, deleted? }`. `confirmed` matters: an
  alarm is a bite only once confirmed (`isBite`). Streaks are not synced; they are worked out from the events.
- **To add a field to the event** (WS3 or later): add it in the five places `ARCHITECTURE.md` section 3 lists, then ALSO
  in `server/events/validate.js` (`EVENT_KEYS` and a check), `server/events/store.js` (a column via an additive
  `addColumn` migration, `rowToEvent`, `toParams`), `server/events/compare.js` and `compareEventVersions` in
  `eventModel.ts` (`LIVE_ORDER`), and `src/sync/payload.ts` (`SYNC_EVENT_FIELDS`, `toSyncEvent`). The parity tests
  (`server/events/payload.parity.test.js`, `compare.test.js`) fail if the client and server lists drift.
- **A feature that logs events** (WS6 phone view, WS2 urge timer already) just uses `events.add` / `events.update` /
  `events.softDelete`: sync picks the change up by itself (its "queue" is derived from `updatedAt`, see below). Never
  write `incidents` with `setState`: it bypasses the update stamp, and the change would not sync.
- **Phone view with sync off**: events stay on the phone; say so in the UI (the WS6 plan already requires it).
- **Share links (WS10)** read `listUserEvents` for the link's owner, never anything keyed by a client-supplied id.

## How it works

- **Opt-in belongs to one account on one browser** (`sb:sync:optin = { userId, at }`). A different person signing in on
  the same browser starts with sync OFF and must switch it on; their cursor and acknowledged versions are separate. This
  stops one person's local history being uploaded into another person's account by accident.
- **`SyncHost`** (one line in `App.tsx`, inside the signed-in app) reads that one local value. If the signed-in account
  did not opt in it renders nothing: no network request, no feature-flag request, no extra chunk. Only an opted-in
  account loads `SyncRunner`, which checks `event_sync` and runs the engine; unmount (sign-out, switch off) stops it and
  removes its timers and page listeners. `controller.ts` states the rule: an engine exists only while someone is signed
  in AND `event_sync` is on AND that same person opted in.
- **The queue is derived, not kept.** The engine stores, per event id, the `updatedAt` the server last acknowledged
  (`sb:sync:versions`, at most one entry per event on the device: about 55 bytes each). An event is waiting when its
  `updatedAt` differs. It survives reloads and offline weeks by construction; a clock that jumps backwards cannot hide
  a change (nothing is compared with "now"); losing the map only costs one idempotent re-send. This replaces the
  "push everything newer than a watermark" idea, which loses edits made while the clock is behind.
- **Cycle**: push up to 500 oldest-changed events, pull what others changed after the cursor, merge through
  `events.merge`, repeat while there is more (at most 40 requests per cycle, the rest next cycle). Single flight.
  Background: on start, every ~5 min (jittered), 30 s after a local change, on focus/visibility (not more often than
  once a minute), on `online`. Offline: no request at all. Errors: exponential back-off 30 s to 30 min (the engine honours a Retry-After it is given;
  the browser's `apiFetch` does not expose response headers, so in the app a 429 uses the normal back-off); 401 stops (signed out); 404 waits 30 min; 400 and 413 stop until the next local change or "Sync now".
- **Conflicts**: last write wins by `updatedAt`; a tie is settled by `compareEventVersions` (higher `updatedAt`, then a
  deletion beats a live record, then the higher `deviceId`, then the higher canonical text): one rule, in
  `eventModel.ts` and `server/events/compare.js`, proven identical on 20,000 random pairs. A device that loses a
  conflict gets the server's version back in the same response and adopts it.
- **Deleting**: a delete is a tombstone that syncs; an edit made after a delete elsewhere brings the event back.
- **"Delete synced data"** pauses the engine, deletes the server rows, starts a new **epoch**, forgets the local sync
  state and switches sync off on that device. Any other device that still holds the old epoch gets 409 on its next sync,
  stops, keeps its own history and tells the person ("Your synced data was deleted from another device, so sync is off
  here"). So a wipe cannot be silently undone by a second device uploading its history again.
- **"Delete everything"** asks in the page (no `window.confirm`). If sync is on there is a box, ticked by default:
  "Also delete the copy synced to my account". With it, the server copy goes FIRST and nothing local is touched if that
  fails. Either way this device ends with no history, no settings and no sync state.
- **Export**: JSON (`events.exportAll()`: events, deletion markers, streak anchors; restorable) and CSV (live events,
  RFC 4180, cells that look like formulas are defused with an apostrophe). **Import**: file size checked before
  reading (10 MB), parsed, every entry validated with `parseWireEvent`, then a preview (new, replaced by a newer file
  version, kept because newer here, unchanged, invalid, duplicates, deletion records, date range, a sample) and only
  then applied. A device with no history at all is restored whole through `replaceAll` (streak start dates come back
  exactly); otherwise through `merge` (never overwrites a newer local record). Importing the same file twice changes
  nothing the second time.

## Privacy, and how it is enforced

- Only the fields in `SYNC_EVENT_FIELDS` can be sent: `toSyncEvent` copies them one by one (never a spread). A test puts
  `landmarks`, a data-URL frame, a photo reference, calibration data and a note on a stored event and checks none of it
  reaches a request body or a database column.
- The server refuses (400, nothing stored, the whole batch) any key outside the whitelist, at the top level, on an
  event and inside `competingResponse`.
- `scripts/syncGuard.test.mjs`: the events endpoints appear in `src/sync/api.ts` only; nothing in `src/sync` calls
  `fetch`/XHR/beacon/WebSocket itself; `src/sync` and `src/backup` cannot import the detector, MediaPipe, a canvas or
  the local blob store (nail photos); no `window.confirm`; the landing page's entry chunk contains no events endpoint.
- Device name (Settings) never leaves the device. The server sees a random device id only.

## Verification (what was actually run)

- `npm test`: 63 files / 1012 tests (baseline 52 / 755). `npm run build:web`: 0. `node --check` on `server.js`, the
  route module and all four `server/events` files. `npm run lint`: 23 errors / 7 warnings, same as baseline.
  `grep -l "dev-override\|readDevOverrides" dist/assets/*.js` and `grep -l "seedPreviewData\|previewKind"` print nothing.
- **Real server, real HTTP** (`server.js` on :3204, temp `DATA_DIR`, dummy env, real JWT cookies): auth required,
  a 42 kb batch accepted while another JSON route still answers 413 above 10 kb, `landmarks` and `frame` refused with
  400, a second account sees nothing of the first and cannot wipe it, stale epoch gives 409, wipe works.
- **Two real headless Chrome profiles on one account** against that server, driving the actual Settings UI: sync off
  makes zero `/api/events` requests through page load, Settings and an import; switching on sends only
  `POST /api/events/sync` with no landmark/frame/image words; browser B ends with an export identical field by field to
  A's (12 events plus the deletion record); a reload restarts sync by itself; "Delete synced data" shows the count in
  the page, and B then stops with the notice and sends nothing more; no console errors.
- The flags-off comparison saw the page's own requests, not the service worker's: the worker's precache list grows from
  29 to 35 entries (+40 KiB: the lazy sync and data chunks), downloaded in the background like the rest of the
  precache, once, when the worker updates. That is the only flags-off difference I know of.
- **Flags off, before and after** (`main`@0ab519b built in a scratch directory vs this branch, both with `FEATURE_FLAGS`
  empty): 12 GET responses (pages and a few API paths) byte-identical (asset hashes normalised), the three events paths 404 in both, the
  signed-in Settings page `innerHTML` and text identical, localStorage keys identical, the set of non-analytics network
  requests identical (30), no console errors, full-page screenshot byte-identical. Why that holds: the sync and data
  cards are lazy chunks fetched only when a flag is on; `SyncHost` reads one local value and renders nothing; the
  server module answers 404 before parsing a body.
- **Not verified**: a real Paddle/Google/Apple session (the fixture user came from a minted JWT); a second physical
  machine; the packaged Electron app (`apiFetch` sends its bearer token, the same path as every other API call, but it
  was not run); Safari and Firefox.

## Decisions and deviations from the plan

- `mergeEvents` (WS0's `src/storage/eventModel.ts`) changed: a tie on `updatedAt` used to keep the local copy; it now
  uses `compareEventVersions`. Identical versions are still a no-op; no existing test depended on the old tie rule.
  Needed because two devices that disagree about a tie never converge. Also added there: `canonicalEvent`,
  `compareEventVersions`.
- `server.js`: ONE condition. The global `express.json({ limit: '10kb' })` skips exactly `/api/events/sync`
  (`req.path === '/api/paddle/webhook' || req.path === '/api/events/sync'`), and the route parses its own 512 kb body
  after the flag and sign-in checks. A test reads `server.js` to keep it that way.
- `src/pages/settings/settings.test.tsx`: removed `event_sync` from the flags in "renders nothing even with the flags on
  while the section files are empty" (the sections have content now), as WS2 did for `hrt_coaching`.
- The plan said "background sync every N minutes": N is 5, with the rules above. "Device name" in the card is a local
  label only.
- `Settings.tsx` is untouched: the page now has two cards titled "Data" (WS0's section and the existing red "Clear all
  data" card). The existing "Clear all data" and History's clear-all are **not sync-aware** (they are local deletes that
  leave no tombstones); they cannot cause an upload of old data, and the synced copy stays. Use "Delete everything" in
  the new Data card to remove both.

## Known limitations

- **A hand-logged event with no triggers at all** (only an edited import file or another client can produce one; this
  app always sets a tag) is held on a device as `triggers: ['unknown']` (`toHabitEvent` derives it from the tag
  `unknown`), so its copy is not byte-identical to the server's. It converges, and the device sends it back once
  (`src/sync/engine.test.ts`, "is sent back at most once"), but the server may keep either form. Making
  `triggersFromTag` return nothing for `unknown` would remove it; that changes WS0's export shape, so it was left alone.

- **Custom bite reasons are not synced** (settings, not events). An entry that uses a custom reason arrives on another
  device with the reason's id and shows as a plain "Bite" there until the same reason exists.
- **Streak start dates are per device** (`firstOpenTime`, `historyStartTime`, `bestStreakFloorMs`). Events converge;
  a best streak that includes the time before a device's own start date can differ between devices. Export/import of a
  whole history restores them.
- The app keeps the newest 5,000 events locally (`MAX_INCIDENTS`) and 1,000 deletion records; the server keeps up to
  50,000 rows. A device never shows more than it keeps; older entries stay on the server.
- Two tabs of one browser each run an engine and share the same stored cursor; harmless (a re-send is a no-op) but
  wasteful. The existing app already does not share store state between tabs.
- Server rows are kept until deleted: nothing removes them when a trial or subscription ends or an account is deleted by
  hand. Owner: delete `habit_events` and `habit_event_epochs` rows for an account you delete.
- The server holds tombstones for ever (they count toward the quota); there is no compaction.

## Copy that says history is local-only (must change when `event_sync` goes live; not edited here)

`src/pages/PrivacyPage.tsx` (sections 3, 8, 9, 11; draft in `legal/ws4-privacy.md`), `src/pages/Settings.tsx:542` (the
Privacy card: "your alarm and bite log stays in this browser too"), `src/pages/Landing.tsx:411` and `:503` (and the
no-JS mirror at `server.js:1640`), plus any FAQ/blog/`llms` text saying history never leaves the browser. WS11b owns the
marketing wording. Keep the approved line "Detection runs on your device. No camera data is sent while it runs."

## Suggested updates to `ARCHITECTURE.md` (for WS13, to avoid merge conflicts in wave 2)

Section 1: "no event history is stored server-side today" becomes "only for accounts that opted in (`event_sync`)".
Section 6: the `server.js` pipeline step 3 now names the `/api/events/sync` exemption; add the events module to the
file map and `habit_events` / `habit_event_epochs` to "Database". Section 4: `events.merge` ties are settled by
`compareEventVersions`. Section 7: `account-sync` and `data` have content (lazy). Section 11: `test-utils/fakeClock.ts`,
`syncHarness.ts`, `eventsHarness.js`.

## Owner TODOs

- Review and publish `legal/ws4-privacy.md` and `ws4-terms.md` with the flag; fill the hosting provider
  (`TODO(owner)`); decide retention for lapsed accounts and whether backups are mentioned.
- Decide whether habit-log data counts as health data where you operate, and what consent wording that needs.
- Decide the quota (default 50,000 per account) and whether to state it in the Terms.
- When deleting an account by hand, delete its `habit_events` and `habit_event_epochs` rows.
- Turn the flags on in staging first and try two real browsers (and the desktop app) before production.
