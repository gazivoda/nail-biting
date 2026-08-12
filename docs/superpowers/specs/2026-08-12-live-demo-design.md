# Live demo in the landing hero — design

**Date:** 2026-08-12
**Branch:** `live-demo` (cut from `origin/main` @ f84ce38)

## Goal

Let a visitor experience real nail-biting detection on the landing page without
signing up. Today the only CTA is `/api/auth/google` — nobody can see the product
work before handing over a Google account.

## Principles

1. **Reuse the existing detection system.** The demo runs the same `useCamera`,
   the same `useDetection`, and the same `createBiteDetector` the paid app runs.
   No second detector, no simulation, no fake data.
2. **Touch no persisted state.** The demo must never write to `useAppStore` or to
   the `stop-biting-state` localStorage key.
3. **Crawler/user parity.** Any new visible text ships in *both* the `server.js`
   SSR block and the React render, verbatim. This is the exact discipline the
   preceding GEO work established; do not regress it.
4. **Be honest about cost.** Tell the visitor about the ~20 MB model download
   *before* it starts.

## User flow

```
idle card  →  click "Try the live demo"
           →  "Downloading AI models (~20 MB, one time)…"
           →  browser camera permission prompt
           →  60s live session, countdown + real alerts
           →  camera stops automatically at 0:00
           →  result card: catch count + "Start free trial" / "Run it again"
```

## Architecture

`CameraView` currently reads eight values from `useAppStore` and calls
`logIncident`, so it cannot be reused as-is. Extract the presentational part:

```
DetectionSurface (props only, no store)   ← video + alert ring + status badge + wave
  ├── CameraView = store config      + usePictureInPicture + PiP button in slot
  └── HeroDemo   = local demo config + countdown           + countdown in slot
```

Both containers call the same `useCamera` and `useDetection`. Only the source of
config and the destination of alerts differ.

### `src/components/detection/DetectionSurface.tsx` (new)

```ts
interface DetectionSurfaceProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: DetectionStatus;
  cameraEnabled: boolean;
  showFeed: boolean;
  showFlash: boolean;
  onRetry?: () => void;
  /** Overlay slot, rendered top-right inside the frame. */
  children?: React.ReactNode;
}
```

Contains everything currently inside `CameraView`'s returned markup **except**
the PiP button and `PiPWindow`: the `AlertOverlay`, the bordered/alert-ringed
container, the `<video>`, the two `DetectionWave` fallbacks, and the
`DetectionStatus` badge. This is a pure extraction — no behaviour change.

`CameraView` keeps: store reads, `useDetection`, `usePictureInPicture`,
`handleAlert`/`handleRetry`, `PiPWindow`, and passes the PiP button as
`children`.

### `src/hooks/useCamera.ts` (extend, backwards compatible)

Currently every failure is swallowed into `console.error`, so denied permission,
missing hardware and insecure context all render as a silently dead box.

```ts
export type CameraError =
  | { kind: 'insecure-context' }
  | { kind: 'permission-denied' }
  | { kind: 'no-camera' }
  | { kind: 'unavailable' };

export function useCamera(enabled: boolean): {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  error: CameraError | null;
}
```

Mapping (by `DOMException.name`):

| Condition                             | `kind`             |
|---------------------------------------|--------------------|
| `navigator.mediaDevices` missing      | `insecure-context` |
| `NotAllowedError`, `SecurityError`    | `permission-denied`|
| `NotFoundError`, `OverconstrainedError` | `no-camera`      |
| anything else (e.g. `NotReadableError`) | `unavailable`    |

`error` resets to `null` on a successful start and when `enabled` goes false.
Existing callers destructure only `{ videoRef }` and are unaffected.

### `src/components/demo/demoSession.ts` (new, pure)

No React, no DOM, no timers — a reducer, so it is testable without a camera.
Same pattern as `biteDetector.ts`.

```ts
export const DEMO_DURATION_MS = 60_000;

export type DemoPhase = 'idle' | 'running' | 'finished';

export interface SessionState {
  phase: DemoPhase;
  startedAt: number | null;
  catches: number;
}

export type SessionEvent =
  | { type: 'start'; now: number }
  | { type: 'catch' }
  | { type: 'tick'; now: number }
  | { type: 'reset' };

export const initialSession: SessionState;
export function sessionReducer(s: SessionState, e: SessionEvent): SessionState;
export function remainingMs(s: SessionState, now: number): number;
```

Rules:
- `start` from any phase → `{ phase:'running', startedAt: now, catches: 0 }`.
- `catch` increments **only** while `running` (a late alert after expiry must not count).
- `tick` → `finished` once `now - startedAt >= DEMO_DURATION_MS`; no-op otherwise.
- `reset` → `initialSession`.
- `remainingMs` clamps to `[0, DEMO_DURATION_MS]`.

### `src/components/demo/HeroDemo.tsx` (new)

Owns `useReducer(sessionReducer)`, a 250 ms tick interval while running, and:

```ts
const cameraOn = state.phase === 'running';
const { videoRef, error } = useCamera(cameraOn);
const { status } = useDetection(
  videoRef, cameraOn, 'medium', 'both', 'alarm', 0.5,
  () => dispatch({ type: 'catch' }),   // local counter only — never logIncident
);
```

Renders `<DetectionSurface>` with the countdown in the `children` slot.
`AudioContext` is allowed because the session always begins from a click.

**Must be lazy-loaded** from `Landing.tsx` via `React.lazy` so the 125 KB
`mediapipe` chunk stays off the landing critical path. Verify after building
that the landing entry chunk still has zero MediaPipe references.

### `src/pages/Landing.tsx`

Replace the hero's decorative `<DetectionWave />` (line ~212) with the demo
section. `DetectionWave` remains in use by `CameraView` and `PiPWindow` — do not
delete it.

## Copy (verbatim — SSR and React must match exactly)

Heading (`h2`):
> Try the detector right now

Body paragraph:
> Run the real nail biting detector on your own camera for 60 seconds — no
> account, no signup. The AI models download once (about 20 MB) and then
> everything runs on your device: open your browser's network panel and you'll
> see zero requests while it is watching. Nothing is uploaded and nothing is
> saved.

| Element            | Text |
|--------------------|------|
| Start button       | `Try the live demo` |
| Loading status     | `Downloading AI models (~20 MB, one time)…` |
| Countdown format   | `0:37` (m:ss, floor of remaining) |
| Result — 0 catches | `We didn't catch you once. Nice.` |
| Result — 1 catch   | `We caught you once in 60 seconds.` |
| Result — n catches | `We caught you {n} times in 60 seconds.` |
| Primary CTA        | `Start free trial` → `/api/auth/google` |
| Secondary CTA      | `Run it again` |

Error messages:

| `kind`             | Message |
|--------------------|---------|
| `permission-denied`| `Camera access was blocked. Allow camera access in your browser's address bar, then try again.` |
| `no-camera`        | `No camera found. The demo needs a webcam — the app itself works the same way.` |
| `insecure-context` | `The demo needs a secure (HTTPS) connection to use your camera.` |
| `unavailable`      | `Your camera couldn't start — it may be in use by another app. Close anything else using it and try again.` |
| detection `error`  | `The AI models couldn't load. Check your connection and try again.` |

## SSR parity (`server.js`)

The homepage handler (`app.get('/')`, ~line 1110) injects crawler-visible prose.
Add the heading and body paragraph above to that block, verbatim. Non-JS
crawlers get the description; they cannot run the demo, which is expected and
honest — the text describes the feature, it does not claim the crawler can use it.

Also add to the `SoftwareApplication` `featureList` in `index.html`:
> `Free 60-second live demo — try detection in the browser, no signup`

## Deliberately not in the demo

PiP, streaks, incident log, trigger tagging, the 7-day chart, reminders,
sensitivity/alert settings, and persistence. The demo proves detection works; it
does not substitute for the product.

## Testing

- New unit tests for `sessionReducer` / `remainingMs` covering: catches ignored
  outside `running`, expiry at exactly `DEMO_DURATION_MS`, `remainingMs` clamping,
  and `reset`.
- All 53 existing tests stay green.
- `npm run build:web` exits 0.
- Landing entry chunk contains zero MediaPipe references after the change.
- Homepage SSR output contains the new heading and paragraph.
