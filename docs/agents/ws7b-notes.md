# WS7b (Desktop app wrapper) — notes

The desktop app is the Electron wrapper that already existed (`electron/`). WS7b added the tray, launch at login,
native notifications, the pause bridge contract for WS7a, the camera explanation, a universal macOS build, a CI
workflow and the signing guide. Nothing was added to any marketing page, and nothing changes in a browser.

**For the owner:** signing and notarization are yours to do: `docs/DESKTOP_SIGNING.md` (marked OWNER TODO).
**For WS7a (wave 3):** the section "Contract for WS7a" below is the whole interface.

## What exists

| Feature | Where | Notes |
|---|---|---|
| Tray icon and menu | `electron/tray.ts`, menu content in `src/desktop/trayModel.ts` | macOS: black-and-alpha template image (`electron/assets/trayTemplate*.png`, drawn by `scripts/generate-tray-icons.mjs` from the logo's lens: a ring with one dot). Windows/Linux: `icon-32x32.png`. |
| Menu items | `trayModel.ts` | Open Stop Biting · status line (Watching / Not watching / Paused until 3:45 PM) · Start or Stop watching · Pause for 15 minutes / 1 hour / until tomorrow, or Resume while paused · Launch at login (checkbox) · Quit Stop Biting |
| Close hides to the tray | `electron/main.ts` | The app keeps running. Windows shows a balloon the first time. Quit (tray, Cmd+Q) really quits. |
| Runs with the window hidden | `main.ts` | `backgroundThrottling: false`, three Chromium switches (below), and a power-save blocker (`prevent-app-suspension`) while detection runs and is not paused. |
| Launch at login | `main.ts`, `src/desktop/prefs.ts`, `electron/prefsFile.ts` | macOS and Windows, **off by default**, in the tray menu. See "Launch at login". |
| Native notifications | `main.ts`, `preload.ts` | `window.desktop.notify(...)`, validated in main. The old `window.electronAPI.notify(title, body)` goes through the same checks. |
| Camera permission | `main.ts`, `src/desktop/cameraGate.ts`, `DesktopCameraNotice.tsx` | See "Camera permission". |
| Pause bridge contract | `src/desktop/{ipc,events,bridge}.ts` | See "Contract for WS7a". |
| Universal macOS build | `package.json` `build.mac` | One `.dmg` and one `.zip` containing x64 and arm64. Windows targets unchanged (`nsis` and `portable`, x64). |
| CI | `.github/workflows/desktop.yml` | Tag `desktop-v*` or manual run. Never run by the agent. |

How to run it yourself:

```bash
npm run electron:dev          # builds main + preload first (dist-electron/ is untracked), then Vite + server + Electron on ports 5173/3000 (the tray works, the login item is disabled)
npm run electron:typecheck    # tsc -p tsconfig.electron.json (tsc -b does not check electron/)
npm run electron:pack         # renderer + main + preload, then electron-builder --dir (unpacked, current OS)
npm run electron:dist:mac     # real installers in release/ (unsigned unless you have signing set up)
```

Installers and unpacked apps land in `release/` (git-ignored; it used to land in `dist/`, next to the renderer).
`dist-electron/` is git-ignored too, and **was untracked in this branch** (commit `47af7c4`): it held a stale build
from before commit 2b633d6 (it still spawned a local server and looked for `Resources/.env`).

## Contract for WS7a

Everything crossing the boundary is defined in `src/desktop/ipc.ts` and parsed on the receiving side; a payload that
does not parse is dropped silently.

### Tray command -> web app

The tray (or a notification click) asks the web app to do something. The renderer-side bridge
(`src/desktop/bridge.ts`, started by `src/desktop/desktopHost.tsx`) receives it and dispatches a DOM event on
`window`:

```ts
// event name: 'stopbiting:desktop-command'   (constant DESKTOP_COMMAND_EVENT in src/desktop/events.ts)
// event.detail is one of:
type DesktopCommand =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'pause'; minutes: number }   // integer, 1..1620 (27 h)
  | { type: 'resume' };
```

The event is **cancelable**. After dispatching it the bridge runs a default action **only if no listener called
`preventDefault()`**:

| type | default action | WS7a |
|---|---|---|
| `start` | `setCameraEnabled(true)` (if the camera is already on but detection is not running, off then on after 300 ms, like the Retry button) | may take over with `preventDefault()` |
| `stop` | `setCameraEnabled(false)` | may take over with `preventDefault()` |
| `pause` | none | **yours**: start the pause for `minutes`, then report it (below) |
| `resume` | none | **yours** |

Example for the pause feature:

```ts
window.addEventListener('stopbiting:desktop-command', (e) => {
  const command = (e as CustomEvent<{ type: string; minutes?: number }>).detail;
  if (command.type === 'pause' && command.minutes) { pauseFor(command.minutes); e.preventDefault(); }
  if (command.type === 'resume') { resume(); e.preventDefault(); }
});
```

In a browser nothing ever dispatches this event, so the listener is harmless there. "Until tomorrow" is computed by the
tray in local time as the next 08:00 that is at least two hours away (`nextMorning`, `TOMORROW_RESUME_HOUR` in
`trayModel.ts`; change the hour there), so WS7a only ever sees minutes.

### Web app -> tray: state

The bridge reports `DesktopState` to the tray on every change and once at start:

```ts
type DesktopState = {
  watching: boolean;       // the detection loop is running: the store's `detecting`
  paused: boolean;
  pausedUntil: number | null;   // epoch ms; null when not paused or no end time
  pauseSupported: boolean;      // false until the pause feature has reported once
};
```

`watching` comes from the app store. `paused`, `pausedUntil` and `pauseSupported` come from WS7a through a second
DOM event, so `useDetection.ts`, `usePictureInPicture.ts` and `PiPWindow.tsx` need no import from `src/desktop`:

```ts
// event name: 'stopbiting:desktop-state'   (DESKTOP_STATE_EVENT)
// event.detail: { paused: boolean; pausedUntil?: number | null }
import { reportPauseState } from '../desktop/events';   // optional helper; dispatching the event by hand is the same thing

reportPauseState({ paused: false });                                        // once at start: enables the tray's pause items
reportPauseState({ paused: true, pausedUntil: Date.now() + minutes * 60_000 });
reportPauseState({ paused: false });                                        // when the pause ends, however it ends
```

- **The first report switches the tray's pause items on** (`pauseSupported: true`). Until then the three pause items
  are shown disabled, so the tray never offers a control that does nothing. If the feature is behind the
  `background_watching` flag and the flag is off, do not call it: the items stay disabled.
- While `paused` the menu shows "Paused until 3:45 PM" (or "tomorrow 8:00 AM") and Resume replaces the three pause
  items. If detection stops during a pause, `watching` becomes false and `paused` stays true: the tray reads that as
  paused.
- Pausing is offered only while `watching && !paused`.
- Detection and `logIncident` are WS7a's: the bridge does not touch them.

### Preload API (`window.desktop`, typed in `src/types/electron.d.ts` via `DesktopAPI`)

| Member | |
|---|---|
| `platform` | `'darwin' \| 'win32' \| 'linux'` |
| `onCommand(cb)` | `cb(command)` for each valid command; returns the unsubscribe function. The bridge is the only caller today. |
| `sendState(state)` | validated in preload and again in main |
| `notify({ title, body, clickAction? })` | `title` ≤ 80 and `body` ≤ 240 characters, control characters removed, `clickAction` `'open'` (default) or `'start'` (a click also sends the `start` command). The same text twice within 1.5 s is shown once. |
| `camera.status()` / `.request()` / `.decline()` / `.openSettings()` / `.onPrompt(cb)` | used by `DesktopCameraNotice` |

`window.electronAPI` (the original API: `notify`, `onBiteDetected`, `openExternal`, `openGoogleAuth`, `isElectron`)
is unchanged for callers (`AuthContext`, `useDetection`, `useNotifications`); main now validates what it sends
(`openExternal` accepts http and https only).

IPC channel names are in `DESKTOP_CHANNEL` (all `desktop:*`). main accepts a message only from its own window and only
when the sender's page is `file://` (packaged) or the dev server.

### Measured: a hidden window keeps running

Measured on this Mac with the unpacked arm64 build, driving the app through the DevTools protocol (the page ran a
100 ms `setInterval` and a `requestAnimationFrame` counter):

| | timers (100 ms), 3 s | animation frames, 3 s | `document.hidden` |
|---|---|---|---|
| window visible | 30 | 360 | false |
| after `BrowserWindow.hide()` | 30 | 360 | **false** (`visibilityState` stays `visible`) |
| hidden, 10 s | 100 | 1201 | false |

So with `backgroundThrottling: false` and the switches in `main.ts` (`disable-renderer-backgrounding`,
`disable-background-timer-throttling`, `disable-backgrounding-occluded-windows`, and on Windows
`CalculateNativeWinOcclusion` disabled) the page is not throttled when its window is hidden, and **the page never
learns that it is hidden**. Consequences for WS7a:

- In the desktop app `useDetection`'s `visibilitychange` branch (the 500 ms `setInterval` fallback) does not engage;
  the normal `requestAnimationFrame` loop keeps running at the display's rate (120 Hz here) while the window is hidden.
  Inference stays at 5 per second, but the loop itself wakes 60 to 120 times a second for nothing; if CPU use while
  hidden matters, that is where to look.
- Do not use `document.hidden` to decide "the window is in the tray" on desktop. Use the tray state or add a small
  main -> renderer "window visibility" message (not built; nothing needed it).

**Not measured:** whether a camera frame actually reaches MediaPipe while the window is hidden, what happens past the
5-minute mark that Chrome uses for "intensive" throttling, screen lock and sleep, macOS App Nap on a real camera
session (only that the power-save blocker starts and stops with the state was observed), and everything on Windows.
This needs a person with a camera and a stopwatch.

## Camera permission

- `NSCameraUsageDescription` is set in `package.json` `build.mac.extendInfo` to the approved sentence ("Stop Biting
  uses your camera to notice when your hand reaches your face. Detection runs on your device. No camera data is sent
  while it runs."). Verified in the built `Info.plist`.
- `build/entitlements.mac.plist` has `device.camera`, and the two memory exceptions V8 needs for JavaScript and the
  WebAssembly the MediaPipe models run as (`allow-jit`, `allow-unsigned-executable-memory`). Verified embedded in the
  (ad-hoc signed, hardened-runtime) universal build with `codesign -d --entitlements`. `network.server` was removed
  (nothing listens since 2b633d6); comments in the file were corrected.
- The old code asked macOS for the camera in `createWindow`, before any window or explanation. That is gone.
  Now the page's own `getUserMedia` request reaches main's permission handler; on macOS, if the status is
  `not-determined`, main **holds the request** and sends the card to the window (showing the window if it is hidden).
  **Continue** calls `systemPreferences.askForMediaAccess('camera')` (the OS prompt), then answers the held request.
  **Not now** or Escape answers it with a refusal (`getUserMedia` rejects with `NotAllowedError`, which the app
  already shows as a camera error). If macOS reports `denied` or `restricted`, the card says where to turn the camera
  on and has an Open settings button (`x-apple.systempreferences:...Privacy_Camera`, `ms-settings:privacy-webcam`).
  It covers the landing demo too, because the card has its own React root, mounted by `src/main.tsx` only when
  `window.desktop` exists.
- Verified for real (unpacked app started through LaunchServices so macOS attributed the camera to the app itself):
  status `not-determined`, `getUserMedia` stayed pending, the card showed the approved text with Continue focused,
  `pending` was true, Not now and Escape both rejected the request with `NotAllowedError`, no OS prompt appeared.
  **Not verified:** pressing Continue and the macOS prompt itself (it needs a click by a person), granting, and the
  denied/restricted card on a real denial.
- Copy in `src/desktop/DesktopCameraNotice.tsx` follows the approved privacy wording. `cameraErrorCopy.ts` (shared
  with the website, not touched) still says "from the camera icon in your browser's address bar" for a refused
  camera: wrong inside the desktop app. WS7a or WS12 can pick it up.

## Launch at login

- Off by default; nothing is written to disk until the user toggles it. The choice is `launchAtLogin` in
  `desktop-prefs.json` in the app's user-data folder (plain JSON, written through a temp file and a rename).
- Applied with `app.setLoginItemSettings({ openAtLogin })`; on Windows with `args: ['--hidden']`. On the next login the
  app starts in the tray without showing the window (`--hidden` on Windows; macOS 13+ reports `wasOpenedAtLogin`).
- At every start the OS wins when it can answer (`reconcileLoginPref`): if the user removed the login item in System
  Settings or Task Manager, the app does not put it back.
- The menu item is disabled in an unpackaged build and in the Windows portable build, and absent on Linux
  (`loginItemSupport`).
- **Not verified:** an actual login. macOS may refuse or ignore the login item for an unsigned app.

## Build and packaging facts

- `npm run electron:build-main` is now two builds: `vite.electron.config.ts` (main, ES module, `main.js`) and
  `vite.electron.preload.config.ts` (preload, **CommonJS, `preload.cjs`**, self-contained). The preload is CommonJS
  because it must be one file with no `import`s, and because both main and preload share `src/desktop/ipc.ts`
  (built together they would share a chunk).
- `server.js` is no longer bundled into `dist-electron/` (it was dead weight since 2b633d6: the comment in `main.ts`
  said no server ships, the config still built one).
- `extraResources` used to be `data -> data`. In a build made from the owner's checkout that copies
  `data/users.db`, the real user database, into the installer. It is now `electron/assets -> tray` (the two
  `*Template*.png`). Removed `!dist/mac/**`-style excludes (the installers no longer land in `dist/`) and added
  `!node_modules/**/*` and `npmRebuild: false`: the main and preload are fully bundled, and without that
  electron-builder also packs the production `node_modules` (including `better-sqlite3`, whose native binary differs
  per architecture and would break the universal merge). Checked in the built `app.asar`: no `node_modules`, no
  `server.js`, no `data/`.
- Verified here: `npm run electron:build` (exit 0); `npx electron-builder --dir --arm64 --mac` (unpacked app, 322 MB);
  `npx electron-builder --mac --universal` (unsigned): `release/Stop Biting-1.0.0-universal.dmg` (240 MB) and
  `...-universal-mac.zip` (233 MB), binary `lipo -archs` = `x86_64 arm64`, ad-hoc signed with hardened runtime and the
  entitlements. `CSC_IDENTITY_AUTO_DISCOVERY=false` was set so a Developer ID in this Mac's keychain was not used.
- The installers are big because `dist/` is the whole website bundle (`og/` 214 files, `posts/` 189, fonts, video,
  MediaPipe models). Trimming `build.files` is a possible follow-up; not done, to avoid dropping something the app
  loads.

## Tests

`npm test`: 80 new tests in `src/desktop/*.test.ts` (IPC validators and limits, tray menu for every state, "until
tomorrow" across a day, month and year, formatting, prefs and login-item decisions, camera gate, the bridge with
fakes: every command becomes the DOM event, cancel skips the default action, state de-duplication, pause reports,
dispose). They also pass with `TZ=America/New_York` and `TZ=Asia/Kolkata`.
`npm run electron:typecheck` passes. `src/main.tsx` is the only existing source file that gained code.

The web build: `build:web` output compared with a build of the base commit (hashes normalised): every file identical
except the entry chunk `assets/index-*.js` (+132 characters: the `if (window.desktop)` guard and the dynamic import),
one new chunk `assets/desktopHost-*.js` (the bridge, the card and its icon; **excluded from the service worker's
precache** with a `globIgnores` line in `vite.config.ts`, so visitors never download it), and the files that always
differ (`sw.js` revisions, the two `generatedAt` timestamps). The CSS is byte-identical: the card reuses classes that
already exist (`sm:right-2`, not `sm:right-4`).

## Known gaps before a public release

1. **Signing in from the desktop app does not work against the hosted API.** `ELECTRON_PROTOCOL` is a switch for the
   whole server (see ARCHITECTURE section 6), so the hosted server cannot answer a desktop sign-in with the
   `stopbiting://auth` deep link without breaking web sign-in. And `signInWithGoogle` is not called from any component
   in the packaged app (the sign-in buttons are links). The fix is a per-request desktop mode on the sign-in start
   routes (for example `?client=desktop`, remembered in the `state` record, so the callback redirects to the deep link
   for that request only), plus a sign-in button in the packaged app that calls `window.electronAPI.openGoogleAuth`
   (and the equivalent for the WS8 providers). That is server work, so it was not done here. Not verified: cookies and
   CORS for the packaged page's API calls (they are redirected from `file://` to the hosted API by `main.ts`).
2. Windows was not built or run. `electron-builder --win` needs Windows (or Wine); the CI job is the first real test.
3. No auto-update. A signed build and a release channel come first.
4. A command sent to a page that has not mounted the bridge yet is lost (for example a notification click that
   cold-starts the app with `clickAction: 'start'`). Nothing sends one today.
5. macOS prints `representedObject is not a WeakPtrToElectronMenuModelAsNSObject` to the console when the tray menu is
   replaced. It is AppKit noise, not an error; the menu is rebuilt only when the state actually changes.
6. `COOLIFY_DEPLOY.md` line 24 tells the owner to set `ELECTRON_PROTOCOL=stopbiting` on the web server. Wrong for the
   website (see 1). Not edited here (it has uncommitted owner edits); the owner should delete that line.

## Flags and claims

- No new flag. The desktop features exist only inside the Electron build, which is not offered anywhere. The
  registered `desktop_app` flag ("download links, tray features") stays off and is for WS11b's marketing page and
  download links; nothing in the website reads it yet. Whether the tray features should also be gated by it is the
  orchestrator's call: it would mean main asking the server for `/api/features`.
- No marketing page, FAQ, schema or `llms` text mentions the desktop app, and none was added.
- No new npm dependency.
- Icons: the tray template and the existing brand icons only (a ring and a dot); nothing depicts the habit.

## Not verified (honest list)

- Signed installers on either OS, notarization, Gatekeeper and SmartScreen behavior: needs your certificates.
- Anything on Windows: build, tray, balloon, login item, camera privacy switch.
- The tray icon's appearance and the menu's clicks (only built and constructed; the menu model is unit-tested and the
  IPC chain behind each item was exercised through the DevTools protocol, not by clicking).
- Native notifications actually appearing (macOS needs a signed app and the user's permission).
- Detection running with the window hidden on a real camera (timers and frames were measured; frames from a camera were
  not).
- Pressing Continue on the camera card and the OS prompt; the denied card.
- Launch at login across a real logout/login.
- The GitHub workflow (never run; YAML parses, and the unsigned mac command is the one used locally).

## Side effects of the checks on the machine that ran them

Starting an unpacked build calls `app.setAsDefaultProtocolClient('stopbiting')` (existing behavior), so macOS
LaunchServices on this Mac now lists a throwaway test bundle (`today.stopbiting.e2etest`, deleted) as the handler for
`stopbiting://` links. Installing and opening the real app registers it again; nothing else depends on it.
