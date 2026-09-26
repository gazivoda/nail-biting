import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { AlertTriangle, Camera, Loader2, RotateCcw, Zap } from 'lucide-react';
import { DetectionSurface } from '../detection/DetectionSurface';
import { useCamera } from '../../hooks/useCamera';
import { CAMERA_ERROR_MESSAGE, MODEL_ERROR_MESSAGE } from '../detection/cameraErrorCopy';
import { useDetection } from '../../hooks/useDetection';
import { initialSession, remainingMs, sessionReducer } from './demoSession';

// --------------------------------------------------------------------------
// Copy
//
// None of these strings are in server.js's crawler block: only the demo's
// heading and paragraph in Landing.tsx are mirrored there, and they render
// outside this component. Plain language, no dashes (the homepage has none).
// --------------------------------------------------------------------------

const START_LABEL = 'Try the live demo';
const RETRY_LABEL = 'Try again';

/**
 * Also used as the `Suspense` fallback in `Landing.tsx` — the lazy chunk fetch
 * and the model download are one continuous wait to the visitor, so they read
 * one continuous message. Keep the two copies identical.
 */
const LOADING_LABEL = 'Downloading AI models (~20 MB, one time)…';

/** Shown on the plate while it watches, until the first catch. */
const HINT_LABEL = 'Bring a fingertip to your lips to hear the alarm';

/** The offer, next to every trial link this component renders. */
const OFFER_LABEL = '3 days free, no card';



function resultLine(catches: number): string {
  // A zero is the most likely result of a minute of sitting still, and "Nice"
  // read as "nothing happened". Tell the visitor how to see it work instead.
  if (catches === 0) return 'Nothing caught in 60 seconds. Run it again and touch your lips to hear the alarm.';
  if (catches === 1) return 'Caught you once in 60 seconds. The app does this all day, while you work.';
  return `Caught you ${catches} times in 60 seconds. The app does this all day, while you work.`;
}

// --------------------------------------------------------------------------
// Buttons, in the homepage's sign set (`.sg-btn` in index.css): the primary
// is the blue "mandatory" plate. The page is light only, so there are no dark
// variants. The secondary sits on the dark plate, so it is drawn light-on-dark.
// --------------------------------------------------------------------------

const PRIMARY_BTN = 'sg-btn';

const SECONDARY_BTN =
  'sg-btn bg-transparent text-white shadow-[inset_0_0_0_2px_oklch(100%_0_0/0.55)] hover:bg-white/10';

// --------------------------------------------------------------------------

/** The trial link. A new tab on purpose (see 92360d2): the demo tab keeps running. */
function TrialLink() {
  return (
    <a href="/api/auth/google" target="_blank" rel="noopener noreferrer" className={PRIMARY_BTN}>
      <Zap size={15} aria-hidden="true" />
      Start free trial
    </a>
  );
}

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
      {isRunning ? (
        <DetectionSurface
          videoRef={videoRef}
          status={status}
          cameraEnabled={cameraOn}
          showFeed
          showFlash={status === 'alert'}
          onRetry={start}
        >
          {/* The slot is rendered bare inside the frame's `relative` box, so the
              overlays carry their own placement. */}
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
          {/* Without this, the payoff depends on the visitor happening to bite
              in the next minute. Gone after the first catch: it has done its job. */}
          {isDetecting && state.catches === 0 && (
            <p className="absolute top-3 left-3 right-24 rounded-lg bg-stone-900/75 px-2.5 py-1.5 text-xs font-medium text-stone-100">
              {HINT_LABEL}
            </p>
          )}
        </DetectionSurface>
      ) : (
        // Finished or failed. The live surface is not rendered here: with the
        // camera off it falls back to its animated "Watching…" wave, which is
        // untrue after a denial and undercuts the privacy claim beside it. The
        // plate keeps the same box, so nothing moves.
        <div
          className="animate-fade-in flex aspect-video w-full flex-col items-center justify-center gap-5 rounded-2xl bg-[color:var(--sg-ink)] px-6 text-center"
          role={failure ? 'alert' : undefined}
          aria-live={failure ? undefined : 'polite'}
        >
          {failure ? (
            <p className="flex max-w-md items-start gap-2 text-[0.9375rem] text-white">
              <AlertTriangle size={15} className="mt-1 flex-shrink-0 text-alert-400" aria-hidden="true" />
              <span>{failure}</span>
            </p>
          ) : isFinished ? (
            <p className="max-w-md text-[1.0625rem] font-bold text-white">{resultLine(state.catches)}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {isFinished && <TrialLink />}
            <button
              type="button"
              onClick={start}
              className={isFinished || failure ? SECONDARY_BTN : PRIMARY_BTN}
            >
              {isIdle && !failure ? (
                <Camera size={15} aria-hidden="true" />
              ) : (
                <RotateCcw size={14} aria-hidden="true" />
              )}
              {failure ? RETRY_LABEL : isFinished ? 'Run it again' : START_LABEL}
            </button>
          </div>
          {isFinished && <p className="sg-note text-white/80">{OFFER_LABEL}</p>}
        </div>
      )}

      {isLoading && (
        <p className="sg-small flex items-center justify-center gap-2">
          <Loader2
            size={14}
            className="animate-spin flex-shrink-0"
            aria-hidden="true"
          />
          {LOADING_LABEL}
        </p>
      )}

      {/* The peak moment: the alarm just fired on the visitor's own face. The
          trial is offered here, while the camera is still live, rather than
          after the minute runs out. */}
      {isRunning && state.catches > 0 && (
        <div className="animate-fade-in flex flex-wrap items-center justify-center gap-x-5 gap-y-3" aria-live="polite">
          <p className="text-[1.0625rem] font-bold">
            That&apos;s the alarm. Caught {state.catches === 1 ? 'once' : `${state.catches} times`} so far.
          </p>
          <TrialLink />
        </div>
      )}

      {/* A failed camera is a dead end for the demo, not for the visitor. */}
      {failure && (
        <p className="sg-small text-center">
          You can still{' '}
          <a
            href="/api/auth/google"
            target="_blank"
            rel="noopener noreferrer"
            className="sg-link"
          >
            start the free trial
          </a>{' '}
          ({OFFER_LABEL}) or read{' '}
          <a href="/how-it-works" className="sg-link">
            how detection works
          </a>
          .
        </p>
      )}
    </div>
  );
}
