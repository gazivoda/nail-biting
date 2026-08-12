import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { AlertTriangle, Camera, Loader2, RotateCcw, Zap } from 'lucide-react';
import { DetectionSurface } from '../detection/DetectionSurface';
import { useCamera, type CameraError } from '../../hooks/useCamera';
import { useDetection } from '../../hooks/useDetection';
import { initialSession, remainingMs, sessionReducer } from './demoSession';

// --------------------------------------------------------------------------
// Copy
//
// Every string below is reproduced verbatim in the crawler-visible SSR block in
// server.js. Edit them here and there in the same commit, or the two renders
// drift and the parity discipline the GEO work established is lost.
// --------------------------------------------------------------------------

const START_LABEL = 'Try the live demo';

/**
 * Also used as the `Suspense` fallback in `Landing.tsx` — the lazy chunk fetch
 * and the model download are one continuous wait to the visitor, so they read
 * one continuous message. Keep the two copies identical.
 */
const LOADING_LABEL = 'Downloading AI models (~20 MB, one time)…';

const MODEL_ERROR_MESSAGE = "The AI models couldn't load. Check your connection and try again.";

const CAMERA_ERROR_MESSAGE: Record<CameraError['kind'], string> = {
  'permission-denied':
    "Camera access was blocked. Allow camera access in your browser's address bar, then try again.",
  'no-camera': 'No camera found. The demo needs a webcam — the app itself works the same way.',
  'insecure-context': 'The demo needs a secure (HTTPS) connection to use your camera.',
  'unavailable':
    "Your camera couldn't start — it may be in use by another app. Close anything else using it and try again.",
};

function resultLine(catches: number): string {
  if (catches === 0) return "We didn't catch you once. Nice.";
  if (catches === 1) return 'We caught you once in 60 seconds.';
  return `We caught you ${catches} times in 60 seconds.`;
}

// --------------------------------------------------------------------------
// Shared class strings — lifted from the hero CTAs so the demo reads as part of
// the same page rather than a bolted-on widget.
// --------------------------------------------------------------------------

const PRIMARY_BTN =
  'btn-shimmer inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-2xl px-6 py-3 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_oklch(38%_0.12_148/0.35)] active:scale-95';

const SECONDARY_BTN =
  'inline-flex items-center gap-2 rounded-2xl border border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-50 px-5 py-3 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:border-forest-300 dark:hover:border-forest-700 hover:text-forest-600 dark:hover:text-forest-400 transition-all duration-200 hover:-translate-y-0.5 active:scale-95';

// --------------------------------------------------------------------------

/** How often the clock is sampled. Fine enough that a whole second is never skipped. */
const TICK_MS = 250;

/** `m:ss`, floored — 60000ms is `1:00`, 59_400ms is `0:59`. */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface Props {
  /**
   * Begin the session on the very first render. `Landing.tsx` only mounts this
   * component from the visitor's click, so the click should not have to be
   * repeated — and starting in the reducer's initial state rather than in an
   * effect avoids painting one frame of the idle card first.
   */
  autoStart?: boolean;
}

/**
 * The landing page's 60-second live demo. Runs the same `useCamera`,
 * `useDetection` and detector the paid app runs — the only differences are that
 * the configuration is fixed and that a catch increments a local counter.
 *
 * It never touches `useAppStore` and never calls `logIncident`: a visitor who
 * tries the demo and then signs up must start with an empty history, so nothing
 * here may reach the `stop-biting-state` localStorage key.
 */
export function HeroDemo({ autoStart = false }: Props) {
  const [state, dispatch] = useReducer(sessionReducer, initialSession, init =>
    autoStart ? sessionReducer(init, { type: 'start', now: Date.now() }) : init,
  );

  // The reducer deliberately returns the *same* state object for a no-op tick,
  // so React bails out and the countdown would never repaint. This is what
  // actually drives the digits; the tick drives expiry.
  const [now, setNow] = useState(Date.now);

  // Held separately from the session because `useCamera` clears its own `error`
  // the moment `enabled` goes false — and leaving the running phase is exactly
  // how we react to one. Without this copy the message would erase itself.
  const [failure, setFailure] = useState<string | null>(null);

  const cameraOn = state.phase === 'running';
  const { videoRef, error } = useCamera(cameraOn);
  const { status } = useDetection(
    videoRef,
    cameraOn,
    'medium',
    'both',
    'alarm',
    0.5,
    () => dispatch({ type: 'catch' }), // local counter ONLY — never logIncident
  );

  // Whether the clock has been re-anchored to the moment detection actually
  // began. See the effect below.
  const anchoredRef = useRef(false);

  const start = useCallback(() => {
    const t = Date.now();
    anchoredRef.current = false;
    setFailure(null);
    setNow(t);
    dispatch({ type: 'start', now: t });
  }, []);

  // Expiry + countdown clock. Cleared when the phase leaves `running` and on
  // unmount, which is also what stops the camera: `cameraOn` is derived from the
  // phase, so `finished` flips `useCamera`'s `enabled` to false and its cleanup
  // stops every track.
  useEffect(() => {
    if (state.phase !== 'running') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state.phase]);

  // MediaPipe's first load is ~20 MB and can take several seconds on a cold
  // cache — all of it inside the running phase, because detection cannot start
  // before the camera does. Re-anchor the session once, when detection actually
  // starts watching, so the visitor gets a full minute of detection instead of a
  // minute that mostly went on the download.
  //
  // Layout effect, not a plain one: the countdown appears in the same commit
  // that flips the status to `watching`, so re-anchoring after paint would show
  // one frame of the download-eroded time before correcting itself. `now` is
  // deliberately not touched — it is behind `startedAt` for at most one tick,
  // and `remainingMs` clamps that to a full 1:00.
  useLayoutEffect(() => {
    if (state.phase !== 'running' || anchoredRef.current || status !== 'watching') return;
    anchoredRef.current = true;
    dispatch({ type: 'start', now: Date.now() });
  }, [state.phase, status]);

  // Why the session could not run. Derived rather than stored, so the effect
  // below fires once per distinct failure.
  const failureNow = error
    ? CAMERA_ERROR_MESSAGE[error.kind]
    : status === 'error'
      ? MODEL_ERROR_MESSAGE
      : null;

  // A camera that never started is not a session: leave the running phase, which
  // also releases the camera and stops the model download.
  //
  // The message has to be copied into state rather than rendered from
  // `failureNow` directly — leaving the running phase is precisely what makes
  // `useCamera` clear its own `error`, so a derived message would erase itself
  // in the very next render. This is the "copy from an external system that is
  // about to forget" case; the cascade is one render, on a failure path.
  useEffect(() => {
    if (!failureNow) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setFailure(failureNow);
    dispatch({ type: 'reset' });
  }, [failureNow]);

  const isRunning = state.phase === 'running';
  const isFinished = state.phase === 'finished';
  const isIdle = state.phase === 'idle';
  const isLoading = isRunning && status === 'loading';
  // The countdown tracks detection, not the phase: `status` is still `idle` for
  // the first frame of a session and `loading` for the whole model download, and
  // showing a clock through either would be counting time nothing is watching.
  const isDetecting = isRunning && (status === 'watching' || status === 'alert');

  return (
    <div className="flex flex-col gap-5">
      <DetectionSurface
        videoRef={videoRef}
        status={status}
        cameraEnabled={cameraOn}
        showFeed
        showFlash={status === 'alert'}
        onRetry={start}
      >
        {/* The slot is rendered bare inside the frame's `relative` box, so the
            overlay carries its own placement. */}
        {isDetecting && (
          <div
            role="timer"
            className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-stone-900/75 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-stone-100"
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-alert-400 animate-pulse"
              aria-hidden="true"
            />
            {formatCountdown(remainingMs(state, now))}
          </div>
        )}
      </DetectionSurface>

      {isLoading && (
        <p className="flex items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
          <Loader2
            size={14}
            className="animate-spin text-forest-500 dark:text-forest-400 flex-shrink-0"
            aria-hidden="true"
          />
          {LOADING_LABEL}
        </p>
      )}

      {failure && (
        <div className="animate-fade-in flex flex-col items-center gap-4 text-center" role="alert">
          <p className="flex items-start gap-2 text-sm leading-relaxed text-alert-600 dark:text-alert-400">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{failure}</span>
          </p>
          <button type="button" onClick={start} className={SECONDARY_BTN}>
            <RotateCcw size={14} aria-hidden="true" />
            {START_LABEL}
          </button>
        </div>
      )}

      {isFinished && (
        <div
          className="animate-fade-in flex flex-col items-center gap-4 text-center"
          aria-live="polite"
        >
          <p className="text-base font-semibold text-stone-800 dark:text-stone-100">
            {resultLine(state.catches)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="/api/auth/google"
              target="_blank"
              rel="noopener noreferrer"
              className={PRIMARY_BTN}
            >
              <Zap size={15} aria-hidden="true" />
              Start free trial
            </a>
            <button type="button" onClick={start} className={SECONDARY_BTN}>
              <RotateCcw size={14} aria-hidden="true" />
              Run it again
            </button>
          </div>
        </div>
      )}

      {isIdle && !failure && (
        <div className="flex justify-center">
          <button type="button" onClick={start} className={PRIMARY_BTN}>
            <Camera size={15} aria-hidden="true" />
            {START_LABEL}
          </button>
        </div>
      )}
    </div>
  );
}
