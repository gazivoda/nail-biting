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

import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store/useAppStore';
import { writeCalibration } from '../falsePositive/poseStore';
import { CALIBRATION } from '../detection/calibration';
import { openCamera, startFrames } from './runner';
import { addFrame, begin, failureMessage, framesSoFar, profileToSave, secondsLeft, START, stepAnnouncement, tick, type CalibrationState } from './steps';
import { closeCalibration } from './state';
import { t as tNow, useT } from '../i18n/scopes/calibration';
import { useT as useCommonT } from '../i18n/scopes/common';

export type Link = 'starting' | 'ready' | 'error';

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
    // Something else (the 4-week program view) may already have made the page inert: leave it as we found it.
    const wasInert = root?.hasAttribute('inert') ?? false;
    root?.setAttribute('inert', '');
    dialogRef.current?.focus({ preventScroll: true });
    // Capture phase and marked as handled: this view is on top, so Escape closes only it, not a view underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      closeCalibration();
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => {
      document.removeEventListener('keydown', onKey, { capture: true });
      if (!wasInert) root?.removeAttribute('inert');
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
        if (!cancelled) { setProblem(tNow('link.models')); setLink('error'); }
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

  // Start, and Try again: begin step 1 from now.
  const restart = useCallback(() => update(begin(stateRef.current, Date.now())), [update]);

  return <CalibrationPanel state={state} now={now} link={link} problem={problem} seen={seen} onBegin={restart} dialogRef={dialogRef} videoRef={videoRef} />;
}

export interface CalibrationPanelProps {
  state: CalibrationState;
  now: number;
  link: Link;
  /** What went wrong with the camera or the models, when `link` is 'error'. */
  problem: string | null;
  seen: { hand: boolean; face: boolean };
  /** Start (from the intro) and Try again (from the result): begin step 1. */
  onBegin: () => void;
  dialogRef?: Ref<HTMLDivElement>;
  videoRef?: Ref<HTMLVideoElement>;
}

/** Everything the person reads and presses. The view above owns the camera, the clock and the state; this only draws them. */
export function CalibrationPanel({ state, now, link, problem, seen, onBegin, dialogRef, videoRef }: CalibrationPanelProps) {
  const t = useT();
  const tc = useCommonT();
  const left = secondsLeft(state, now);
  const profile = profileToSave(state);
  const stepTitle = state.phase === 'rest' ? t('title.rest') : state.phase === 'real' ? t('title.real') : state.phase === 'between' ? t('title.between') : t('title.default');
  // One short line per step, read out once when the step starts. It lives in a region that is always in the page, and the
  // ticking "seconds left" and frame count are NOT inside any live region: they used to be, and a screen reader read out
  // a new number every second for the whole step.
  const announcement = stepAnnouncement(state);

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
            {state.phase === 'result' ? tc('close') : tc('cancel')}
          </button>
        </div>

        {/* The person's own live picture, mirrored like the preview in the app. */}
        <div>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 dark:border-ink-400 dark:bg-ink-50">
            <video ref={videoRef} autoPlay playsInline muted aria-label={t('camera.aria')} className="aspect-video w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          </div>
          <p role="status" className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            {link === 'starting' && t('link.starting')}
            {link === 'error' && (problem ?? t('link.failed'))}
            {link === 'ready' && (state.phase === 'rest' || state.phase === 'real'
              ? (seen.face ? (seen.hand ? t('seen.both') : t('seen.faceOnly')) : t('seen.none'))
              : t('link.paused'))}
          </p>
        </div>

        <div className="space-y-5">
          <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
          {state.phase === 'intro' && (
            <>
              <p className="text-base leading-relaxed">
                {t('intro.lead')}
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-base">
                <li>{t('instruction.rest')}</li>
                <li>{t('instruction.real')}</li>
              </ol>
              <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                {t('intro.privacy')}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={link !== 'ready'}
                  onClick={onBegin}
                  className="min-h-11 rounded-full bg-deep px-6 text-sm font-semibold text-white transition-colors enabled:hover:bg-deep-2 disabled:opacity-50 dark:bg-lime-300 dark:text-deep"
                >
                  {t('start')}
                </button>
                <button type="button" onClick={() => closeCalibration()} className="min-h-11 rounded-full px-5 text-sm font-semibold text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100">
                  {t('notNow')}
                </button>
              </div>
            </>
          )}

          {state.phase === 'rest' && (
            <div>
              <p className="text-xl font-semibold">{t('instruction.rest')}</p>
              <p className="mt-3 text-base">{t('hold', { left: left ?? 0 })}</p>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{t('progress', { count: framesSoFar(state), needed: CALIBRATION.minFrames })}</p>
            </div>
          )}

          {state.phase === 'between' && (
            <div>
              <p className="text-xl font-semibold">{t('between.lead')}</p>
              <p className="mt-3 text-base">{t('between.next', { left: left ?? 0 })}</p>
            </div>
          )}

          {state.phase === 'real' && (
            <div>
              <p className="text-xl font-semibold">{t('instruction.real')}</p>
              <p className="mt-3 text-base">{t('hold', { left: left ?? 0 })}</p>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{t('progress', { count: framesSoFar(state), needed: CALIBRATION.minFrames })}</p>
            </div>
          )}

          {state.phase === 'result' && (
            <div className="space-y-4">
              {profile ? (
                <>
                  <p className="text-xl font-semibold">{t('result.done')}</p>
                  <p className="text-base leading-relaxed">
                    {t('result.summary', { rest: state.restFrames, real: state.realFrames })}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => { writeCalibration(profile); closeCalibration(); }}
                      className="min-h-11 rounded-full bg-deep px-6 text-sm font-semibold text-white transition-colors hover:bg-deep-2 dark:bg-lime-300 dark:text-deep"
                    >
                      {tc('save')}
                    </button>
                    <button type="button" onClick={onBegin} className="min-h-11 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill">
                      {tc('tryAgain')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xl font-semibold">{t('result.failed')}</p>
                  <p className="text-base leading-relaxed">{state.outcome.ok ? '' : failureMessage(state.outcome.reason)}</p>
                  <button type="button" onClick={onBegin} className="min-h-11 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill">
                    {tc('tryAgain')}
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
