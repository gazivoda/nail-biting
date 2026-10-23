# WS6 (Phone companion) — notes

For the owner, for WS7a / WS11b (the seams and the wording) and for WS13 (release notes). Reference material is in
`docs/agents/ARCHITECTURE.md` (section 9 and the ownership table have a WS6 update). Everything here is behind one flag,
`phone_companion`, **off by default**. Nothing was run on a real phone: see "NOT verified".

## What exists

A phone view of the signed-in app: no camera, no detection, nothing to download for detection. Two big buttons, the
current streak, today's count, the recent entries, the WS2 breathing timer, one plain sentence about where the entries
live, "Send the link to my computer" as a secondary action, and a way into the full app.

| Piece | Where |
|---|---|
| The screen | `src/phone/PhoneView.tsx` (a lazy chunk, about 13 kB), `LogToast.tsx`, `RecentList.tsx`, `SyncNoteView.tsx` |
| When it shows | `phoneDecision.ts` (pure), `usePhoneView.ts`, `activeStore.ts` |
| What a tap does | `logFlow.ts` (pure, no imports), `useLogFlow.ts` (binds it to `events.*` and WS2's `urgeLog`) |
| Words and numbers | `history.ts` (today's counts, recent rows), `syncNote.ts`, `toastText.ts` |
| Offline start | `offlineGrant.ts` |
| Home-screen shortcuts | `quickAction.ts` (`/?action=bite`, `/?action=urge`), `server/routes/phone.js` (the manifest with shortcuts) |
| Status bar colour | `themeColor.ts` |
| Icons | `public/icons/apple-touch-icon-152x152.png`, `-167x167.png`, `shortcut-bite-96x96.png`, `shortcut-urge-96x96.png`; `scripts/generate-phone-icons.py` (Pillow; the PNGs are committed, nothing runs it at build time) |
| Tests | `src/phone/*.test.ts` (8 files, 80 tests), `server/routes/phone.test.js` (13), `server/routes/phone.sync.test.js` (7, two browsers over real HTTP), `scripts/phoneGuards.test.mjs` (17) |

**Turn on (owner):** in Coolify set `FEATURE_FLAGS=phone_companion` (add `event_sync` and `urge_timer` for the full
experience; each also works alone) and restart. No rebuild, no env var, no `.env.example` change, no new dependency, no
`server.js` edit, no legal draft (no new data path: the phone's entries are ordinary events that WS4 already covers).
Back: remove the name and restart; clients drop to the camera dashboard within about 10 minutes (or on reload).

## When a device gets the phone view

`decidePhoneView({ flagOn, phoneLike, noWebcam, fullApp })`, in this order: flag off gives no; "Open the full app" (this page
load) gives no; a **phone** gives yes; a computer whose browser lists devices but **no `videoinput`** gives yes.

- **Phone** = `(pointer: coarse) and (max-width: 767px)` or `(pointer: coarse) and (max-height: 500px)` (the second clause keeps
  a phone on its side). Evaluated once per page load, so turning the phone does not swap the whole screen. A tablet, or a
  laptop window resized small (it has a mouse), keeps the full app. `useIsPhone` (marketing) is untouched.
- **No webcam** = `navigator.mediaDevices.enumerateDevices()` returned a **non-empty** list with no camera. It never asks for
  permission and never opens a camera, and it is called only when the flag is on. An empty list means "unknown" and keeps the
  full app, because Safari answers with nothing until capture permission was granted: a Mac with a camera must not land on the
  phone view. A Safari computer with no camera is therefore not detected and keeps the full app (its camera panel explains
  that no camera was found, as today). (Tested with a list that has no camera, and with the real list of headless Chrome,
  which always lists a virtual camera.)
- The way out ("Open the full app on this device") lasts until the page is reloaded; nothing is stored.
- Access is unchanged: the phone view is rendered **inside** the app router's signed-in branch (`Dashboard`), so no_auth
  still gets the landing page and `paywall` still gets the paywall. Trial, subscribed (including WS9's lifetime, gift and
  referral grants) and free tier get the app, and so the phone view.

## What the screen does, and the tap budget (measured in headless Chrome with real touch input)

| Flow | Taps |
|---|---|
| "I bit": logs at once (`events.add`, manual, tag "Not sure") | **1** |
| ... and say what set it off (optional, edits the same entry: `events.update`) | **2** |
| Undo (`events.softDelete`, leaves a tombstone for sync) | 1, from the confirmation |
| "I feel an urge", `urge_timer` ON: button, then Start (WS2's `UrgeTimer`, logs on Start) | **2** |
| "I feel an urge", `urge_timer` OFF: logs at once (`logUrge`), Undo offered | **1** |
| A home-screen shortcut: "I bit" logs at once | 0 in the app (the shortcut is the tap) |

`MAX_TAPS_TO_LOG = 2` and the table are in `logFlow.ts`; `logFlow.test.ts` holds the flows to it, and the taps above were also
counted on the live page in real Chrome, with real touch input (see "Verified"). The confirmation stays 8 s (5 s after a tag tap), is
a polite live region, and a second "I bit" within 800 ms is ignored (an accidental double tap), but not after an Undo.

- **Streak, today, recent use the shared predicates**: `isBite` (store), `isUrge`, `isFalsePositive`, `isPendingAlarm`
  (`src/storage/eventModel.ts`, WS3's state table). Streak maths is the app's own `useStreak` through `StreakHero`, untouched. An urge
  and an alarm marked "Not a bite" never count as bites; a marked alarm is not "waiting for review"; it shows in Recent as a
  quiet "Not a bite" label, as in History. `history.test.ts` checks every number against the predicates over the whole table.
- **Words** are History's: "Bite, Stress", "Urge, timer finished", "Alarm", "Not a bite".
- **Free plan** (WS9, flag `free_tier`): the view opens, says "Free plan: History shows your last N days." with a way to choose a
  plan, and Recent follows the same history window as History (`useHistoryWindow`). Counts and the streak use everything.
- **Expired** account: the paywall, as on the computer. The phone view is not shown and nothing is kept for offline.
- No icon, image, SVG or drawing in the view (guard test); buttons are text on neutral shapes; every control is at least 44 px
  (the two big buttons 64 px); light and dark by the existing tokens; safe-area insets on all sides; hover colours only where a hover
  exists (a tapped button must not stay in its hover colour).
- Wording deviation: the second button reads **"I feel an urge"** (WS2's label, so the button and its timer say one thing), not
  "I felt an urge".

## Data and sync

All writes go through the storage module (`events.add / update / softDelete`, and WS2's `logUrge / undoUrge`), never
`setState` (a guard test forbids it). Entries are ordinary `HabitEvent`s: `source: 'manual'`, `deviceId`, `updatedAt` stamped.

- **Sync on** (`event_sync`, and this account switched it on in Settings): the app's own `SyncHost` runs the WS4 engine on the phone
  view (it is mounted in `App.tsx`, outside `Dashboard`). `phone.sync.test.js` runs two engines against the real routes:
  a bite with a tag, an urge, a later tag change, an Undo and an offline period all arrive, the computer counts the bite and not the urge, and only
  `SYNC_EVENT_FIELDS` leave the phone. In two real Chrome profiles on one account the computer received the phone's entries by sync. **Latency is
  WS4's**: 30 s after a change and at least 60 s after the engine's last attempt (measured 53 s), and the computer pulls on its own cycle (about 5 min,
  or on focus, or "Sync now").
- **Sync off** says so in one plain sentence, in three honest versions (`syncNote.ts`):
  flag off: "Stored on this phone only."; flag on, not switched on: "Stored on this phone only. Turn on sync in Settings to see it on your computer."
  with an "Open Settings" button (the app's own Settings tab, which has the switch); switched on: "Sync is on, so your computer sees these
  entries." plus the engine's status line. (The plan's sentence is only true when Settings has a sync card, hence the flag-off version.)
- Nothing the phone view keeps for itself (the offline copy, shortcuts) is in any sync request (tested).

## Offline

- The service worker is WS0's, with two additions: a CacheFirst `brand-static` cache for `/fonts/*.woff2` and `/logo*.svg` (before this the fonts
  relied on the HTTP cache alone, so offline type fell back to system fonts), and the manifest is no longer precached (below). The new
  `PhoneView` chunk is precached (38 precache entries become 40: three added, the manifest removed; +20 KiB; the three are the chunk and the two sync pieces it splits out).
- **The big finding:** offline, a signed-in person got the landing page, because `AuthContext` treats "could not reach the server" as "signed out".
  So while the flag is on the app keeps a small copy of the access facts it last saw (`offlineGrant.ts`: user id, first name, trial end, status, plan, end
  date, and WS9's grants and free-tier limits; no email, avatar, payment ids or banked days) and uses it **only** when asking the server failed for any
  reason except a 401 or 403 (no network, a 5xx, a 429, a captive portal). It re-runs WS9's `computeAccessStatus` on those facts at the current time (so a trial
  that ended while offline is a paywall, i.e. no phone view), never outlives the 14-day session it was copied from, is deleted by sign-out and by a 401/403, and is
  written and used only while `phone_companion` is on. `AuthContext.tsx` has three added lines for it.
- Verified in real Chrome with a real service worker over https: cold reload offline opens the phone view with the saved first name; one tap logs;
  the tag tap works; Settings opens; the sync note is honest ("You are offline"); back online the offline log reaches the server; with the session removed
  (a 401) the copy is deleted and the landing page shows, and stays so offline.

## PWA: how installing works

- **Android (Chrome, Edge, Samsung Internet):** the existing `beforeinstallprompt` banner / "Install app" and WS0's guide. Chrome's own installability check
  (`Page.getInstallabilityErrors`) reports **no errors**, flag on and flag off. Long-pressing the installed icon shows two shortcuts, "I bit" (`/?action=bite`) and
  "I feel an urge" (`/?action=urge`), only while the flag is on (the manifest is answered by `server/routes/phone.js`; with the flag off it is the built file,
  byte for byte, checked). A shortcut acts once and removes `?action=` from the address (a reload or relaunch never logs twice). With the timer on, the urge
  shortcut opens the timer's choice (you press Start); with it off it logs.
- **iOS (Safari only):** Share, Add to Home Screen. The page now carries `apple-mobile-web-app-capable`, `mobile-web-app-capable`,
  `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style=default`, and three full-bleed touch icons (152, 167, 180; no transparent corners, checked). iOS
  **ignores manifest shortcuts**; for a one-tap log from the home screen on iOS, a person can make their own Shortcuts-app action that opens
  `https://stopbiting.today/?action=bite`.
- Manifest: `display: standalone`, `start_url` and `scope` `/` (on a phone, `/` **is** the phone view, so the installed icon opens it), theme and background
  `#F7F7F1` as before, 192 and 512 icons and a separate maskable 512. The phone view moves `<meta name="theme-color">` to the app's dark ground (`#040e09`)
  in dark mode and puts it back.
- `PWAGuideModal`'s three benefits are reworded while the phone view is up (they said "Background detection"). `TabBar`'s first tab says "Today" instead of "Watch" there.
- Not changed, on purpose: `screenshots: []` (no real capture exists; the schema comment in index.html says why), `orientation: portrait-primary`, `start_url`.

## Verified, and how

Run from this worktree on the final build (`npm run build:web`): `npm test` 106 files / 1856 tests (main was 95 / 1739); lint 23 errors / 4 warnings
(`eslint src server scripts electron shared`), compared to main **by file and rule: no new problem**; `node --check server.js`, `server/routes/phone.js`, `server/routes/index.js`;
`npm run seo:check` in sync; the two dev-leak greps print nothing; `Dockerfile` needs no change (no new top-level server path).

**Flags off, before and after** (main@014a549 built in a scratch directory vs this branch, same server settings, real headless Chrome, signed-in app at 390 px with touch and at 1280 px):
the app's DOM, the screenshot, the set of non-analytics network requests (26) and the localStorage keys are **identical**, and so is the landing page except for its head. The differences with every flag off,
all of them: (1) `index.html` gained the four iOS/Android meta tags and two more touch-icon links (only read when someone adds the app to a home screen); (2) the manifest is no longer in the service worker's
precache (the browser fetches it from the network instead: 38 precache entries become 40, with the PhoneView chunk and two sync pieces added); (3) a new `brand-static` runtime cache for fonts and the logo; (4) the main bundle grew by about 2.5 kB raw
and `Dashboard` by about 1.6 kB (the phone view itself is a separate chunk that a flag-off visitor never downloads); (5) one more line in the server's boot log.

**Real Chrome, real server, scripts kept in the session scratchpad** (about 100 checks): the two buttons, 64 px; tap counts above; sync end to end between two browser profiles; every text piece meets WCAG AA at 360, 390 and 430 px in light and dark (lowest 4.64);
no horizontal scroll; a phone on its side keeps the view; a tablet keeps the full app; a computer with a camera keeps the full app; a computer with no camera listed gets the phone view and the way out; expired trial gets the paywall; free tier gets the view with its window; flag off gets today's dashboard; quick actions;
offline as above; installability, manifest, icons (8, all PNG, square, the declared sizes).

**Lighthouse 13.5.0**, mobile (412x823, 1.75x), against this server with the flag on, signed in: **returning visitor** (flags cached): performance **100**, accessibility **100**, best practices **100**, SEO **100**; FCP 0.6 s, LCP 1.6 s, TBT 20 ms, CLS 0.
**First visit** (nothing cached; the camera dashboard shows until `/api/features` answers): performance **75**, the other three 100; LCP 6.0 s. For comparison, the same signed-in phone visit on main (flag off): performance **65**, LCP 66 s, 13 MB transferred
(detection models and wasm; the phone view requests none of them), TBT 210 ms, CLS 0.098. **Lighthouse 12 removed the PWA category**, so installability was checked directly (above). Local runs, simulated throttling: the shape matters, not the digits.

## NOT verified

- A real iPhone or Android phone, the real "Add to Home Screen" / install flow, a real home-screen icon or shortcut menu, Safari, Firefox, Samsung Internet. The iOS tags are standard; their effect was not seen.
- The status bar colour on a real device (the meta tag was verified to change; what the OS paints was not seen).
- A real camera-less computer (the list was simulated with a script that runs before the page; the real answer of Safari, Firefox and Edge was not checked).
- The phone-with-sync flow against production data, a second physical device, Paddle (the paywall and free tier were reached with minted sessions and the real access code).
- Assistive technology: announcements were checked in the DOM only.

## Owner TODOs

- Turn the flag on in staging first; open the site on a real phone, sign in, add it to the home screen, log with the airplane mode on, then off.
- Decide whether `TrialButton`'s phone copy ("The app needs a computer webcam ... Email me the link") should change once the phone view exists: a phone sign-up no longer wastes the trial. That is WS11b's wording; WS6 did not touch it.
- `docs/agents/legal`: nothing new from WS6. The Privacy page's "stored only in your browser" sentence is WS4's item.
- Optional: real app screenshots for the manifest's `screenshots` (Chrome's richer install sheet), once real captures exist.

## Deviations and lessons

- **No `/phone` URL.** A page needs a `KNOWN_ROUTES` entry in `server.js` (a hot zone) and must 404 while the flag is off; the phone view is `/` chosen by the device instead.
- **The manifest is served by a route module, not edited.** Manifest `shortcuts` are visible to anyone with the app installed, so with the flag off they must not exist; the static file is therefore unchanged.
- **workbox's `manifestTransforms` does not see the manifest entry** that vite-plugin-pwa adds (verified: it stayed in the precache). The entry is removed through the plugin's own API (`manifestOutOfPrecache()` in `vite.config.ts`, using `api.extendManifestEntries` in `buildStart`).
- **Local testing pitfall (for lessons.md):** over plain `http://localhost` the service worker **never installs**: the app sends `upgrade-insecure-requests`, so Chrome upgrades the redirect target of `/index.html` to `/` (the audit's canonical 301) to https, and workbox's precache fetch of `index.html` fails (`ERR_SSL_PROTOCOL_ERROR`). Production is https, so it does not happen there. To test the worker or offline use, put a throwaway https proxy that sends `x-forwarded-proto: https` in front of the server and start Chrome with `--ignore-certificate-errors`.
- Two test-writing pitfalls hit: a file named `phoneView.ts` next to `PhoneView.tsx` breaks `tsc -b` on a case-insensitive filesystem (renamed `phoneDecision.ts`); exporting a helper from a component file trips `react-refresh/only-export-components` (moved to `toastText.ts`).
- The `mediapipe` JS chunk (125 kB) is still downloaded on a phone-view page load because `Dashboard` statically imports the camera panel; the detection model and wasm are not. Splitting that is possible later (a follow-up, not WS6).
- `Dashboard` stays mounted while another tab is open, so a running breathing timer keeps running on the History or Settings tab, as on the computer.
- On the very first visit after the flag is turned on for a device (the flags are not yet cached) the camera dashboard shows for a moment before the phone view replaces it; later visits use the cached flag.
