// The optional one-minute calibration (WS3): a full-screen view with the person's own live camera picture
// and plain-text instructions. Loaded lazily by CalibrationHost, only while the flag is on.
//
//   Step 1  "Rest your chin on your hand as you normally would."  (poses that are NOT a bite)
//   Step 2  "Bring a fingertip near your lips."                   (poses that ARE one)
//
// TEXT AND THE PERSON'S OWN PICTURE ONLY. No drawing of a hand, a mouth, a figure or an animation of one
// (DESIGN.md, tasks/lessons.md): the picture on the screen is their camera, nothing else.
//
// While it is open the app's own detection is paused (so an alarm does not sound halfway through step 2)
// and put back exactly as it was when the view closes. Nothing is saved until "Save" is pressed.
//
// Keyboard: the dialog takes focus when it opens, Escape closes it (cancelling), and the page behind is
// inert. Every phase has a Cancel/Close.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store/useAppStore';
import { writeCalibration } from '../falsePositive/poseStore';
import { CALIBRATION } from '../detection/calibration';
import { openCamera, startFrames } from './runner';
import { addFrame, begin, failureMessage, framesSoFar, profileToSave, secondsLeft, START, tick, type CalibrationState } from './steps';
import { closeCalibration } from './state';

type Link = 'starting' | 'ready' | 'error';

export function CalibrationView() {
  if (typeof document === 'undefined') return null;
  return createPortal(<Overlay />, document.body);
}

function Overlay() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stateRef = useRef<CalibrationState>(START);
  const [state, setState] = useState<CalibrationState>(START);
  const [now, setNow] = useState(() => Date.now());
  const [link, setLink] = useState<Link>('starting');
  const [problem, setProblem] = useState<string | null>(null);
  const [seen, setSeen] = useState({ hand: false, face: false });

  const update = useCallback((next: CalibrationState) => { stateRef.current = next; setState(next); }, []);

  // The page behind is inert, the dialog takes focus, Escape closes it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) closeCalibration(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      root?.removeAttribute('inert');
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  // Pause the app's own detection while this is open, and put it back exactly as it was.
  useEffect(() => {
    const store = useAppStore.getState();
    const wasOn = store.cameraEnabled;
    if (wasOn) store.setCameraEnabled(false);
    return () => { if (wasOn) useAppStore.getState().setCameraEnabled(true); };
  }, []);

  // The camera and the models.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let stopCamera: (() => void) | null = null;
    let stopFrames: (() => void) | null = null;
    (async () => {
      const opened = await openCamera(video);
      if (cancelled) { if (opened.ok) opened.camera.stop(); return; }
      if (!opened.ok) { setProblem(opened.message); setLink('error'); return; }
      stopCamera = opened.camera.stop;
      try {
        const frames = await startFrames(video, report => {
          setSeen(prev => (prev.hand === report.handSeen && prev.face === report.faceSeen ? prev : { hand: report.handSeen, face: report.faceSeen }));
          update(addFrame(stateRef.current, report.pose));
        });
        if (cancelled) { frames.stop(); return; }
        stopFrames = frames.stop;
        setLink('ready');
      } catch {
        if (!cancelled) { setProblem("Detection couldn't load. Check your connection and try again."); setLink('error'); }
      }
    })();
    return () => {
      cancelled = true;
      stopFrames?.();
      stopCamera?.();
    };
  }, [update]);

  // The clock.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const next = tick(stateRef.current, t);
      if (next !== stateRef.current) update(next);
    }, 250);
    return () => clearInterval(id);
  }, [update]);

  const left = secondsLeft(state, now);
  const profile = profileToSave(state);
  const stepTitle = state.phase === 'rest' ? 'Step 1 of 2' : state.phase === 'real' ? 'Step 2 of 2' : state.phase === 'between' ? 'Step 2 of 2 next' : 'Calibrate';

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibration-title"
      tabIndex={-1}
      className="app-type fixed inset-0 z-[65] overflow-y-auto bg-cream-200 text-stone-800 outline-none dark:bg-ink-100 dark:text-stone-200"
    >
      <div className="mx-auto grid max-w-4xl gap-6 p-5 sm:p-8 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center justify-between gap-3">
          <h1 id="calibration-title" className="font-display text-3xl font-extrabold tracking-[-0.04em] text-stone-900 dark:text-stone-100">
            {stepTitle}
          </h1>
          <button
            type="button"
            onClick={() => closeCalibration()}
            className="min-h-11 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
          >
            {state.phase === 'result' ? 'Close' : 'Cancel'}
          </button>
        </div>

        {/* The person's own live picture, mirrored like the preview in the app. */}
        <div>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 dark:border-ink-400 dark:bg-ink-50">
            <video ref={videoRef} autoPlay playsInline muted aria-label="Your camera" className="aspect-video w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          </div>
          <p role="status" className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            {link === 'starting' && 'Starting the camera…'}
            {link === 'error' && (problem ?? 'The camera could not start.')}
            {link === 'ready' && (state.phase === 'rest' || state.phase === 'real'
              ? (seen.face ? (seen.hand ? 'The camera sees your face and your hand.' : 'The camera sees your face. It does not see your hand yet.') : 'The camera does not see your face. Sit so your face is in the picture.')
              : 'The camera is on. Detection is paused while you calibrate.')}
          </p>
        </div>

        <div className="space-y-5">
          {state.phase === 'intro' && (
            <>
              <p className="text-base leading-relaxed">
                This is optional and takes about a minute. It helps the app tell resting your chin from the real thing. You will do two short things while the camera looks at you.
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-base">
                <li>Rest your chin on your hand as you normally would.</li>
                <li>Bring a fingertip near your lips.</li>
              </ol>
              <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                Nothing is recorded. Only a few numbers about where your hand was are kept, on this device: no picture. They are not part of your history, are not synced and are not uploaded. You can delete them in Settings, under Detection. Watching is paused while you do this.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={link !== 'ready'}
                  onClick={() => update(begin(stateRef.current, Date.now()))}
                  className="min-h-11 rounded-full bg-deep px-6 text-sm font-semibold text-white transition-colors enabled:hover:bg-deep-2 disabled:opacity-50 dark:bg-lime-300 dark:text-deep"
                >
                  Start
                </button>
                <button type="button" onClick={() => closeCalibration()} className="min-h-11 rounded-full px-5 text-sm font-semibold text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100">
                  Not now
                </button>
              </div>
            </>
          )}

          {state.phase === 'rest' && (
            <div aria-live="polite">
              <p className="text-xl font-semibold">Rest your chin on your hand as you normally would.</p>
              <p className="mt-3 text-base">Hold it there. {left} seconds left.</p>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{framesSoFar(state)} of {CALIBRATION.minFrames} needed.</p>
            </div>
          )}

          {state.phase === 'between' && (
            <div aria-live="polite">
              <p className="text-xl font-semibold">Take your hand away.</p>
              <p className="mt-3 text-base">Step 2 starts in {left} seconds: you will bring a fingertip near your lips.</p>
            </div>
          )}

          {state.phase === 'real' && (
            <div aria-live="polite">
              <p className="text-xl font-semibold">Bring a fingertip near your lips.</p>
              <p className="mt-3 text-base">Hold it there. {left} seconds left.</p>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{framesSoFar(state)} of {CALIBRATION.minFrames} needed.</p>
            </div>
          )}

          {state.phase === 'result' && (
            <div aria-live="polite" className="space-y-4">
              {profile ? (
                <>
                  <p className="text-xl font-semibold">Done.</p>
                  <p className="text-base leading-relaxed">
                    The app saw {state.restFrames} frames of you resting your chin and {state.realFrames} with a fingertip near your lips. Saving keeps a few numbers from them, on this device, and the chin-rest rule will use them.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => { writeCalibration(profile); closeCalibration(); }}
                      className="min-h-11 rounded-full bg-deep px-6 text-sm font-semibold text-white transition-colors hover:bg-deep-2 dark:bg-lime-300 dark:text-deep"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => update(begin(stateRef.current, Date.now()))} className="min-h-11 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill">
                      Try again
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xl font-semibold">That did not work.</p>
                  <p className="text-base leading-relaxed">{state.outcome.ok ? '' : failureMessage(state.outcome.reason)}</p>
                  <button type="button" onClick={() => update(begin(stateRef.current, Date.now()))} className="min-h-11 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill">
                    Try again
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
