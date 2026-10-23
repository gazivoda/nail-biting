// The capture screen of the photo diary, as a props-only view (the camera logic is in
// captureController.ts; CapturePanel.tsx wires the two). Rendered in node by the tests.
//
// The framing guide is a neutral rounded rectangle with corner marks and one plain
// sentence. It draws nothing else: no hand, no face, no mouth, no figure.

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, RotateCcw, X } from 'lucide-react';
import type { CaptureState } from './captureController';
import { COUNTDOWN_SECONDS } from './captureController';
import { PhotoCanvas } from './PhotoCanvas';
import { GUIDE_TEXT } from './copy';

export interface CapturePanelViewProps {
  state: CaptureState<MediaStream>;
  onStart: () => void;
  onTakeNow: (video: HTMLVideoElement) => void;
  onTakeInSeconds: (video: HTMLVideoElement) => void;
  onCancelCountdown: () => void;
  onRetake: () => void;
  onSave: () => void;
  /** Close the panel: discards an unsaved photo and turns the camera off. */
  onClose: () => void;
  onStopWatchingAndRetry: () => void;
}

const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-deep px-6 font-display text-sm font-bold text-white transition-colors hover:bg-deep-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200';
const pill = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill';

export function CapturePanelView(p: CapturePanelViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const { state } = p;

  return (
    <section
      aria-labelledby="photo-capture-title"
      className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-ink-400 dark:bg-ink-50 sm:p-6"
    >
      <h3
        id="photo-capture-title"
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-xl font-bold tracking-[-0.02em] text-stone-900 outline-none dark:text-stone-100"
      >
        Take a photo of your hands
      </h3>

      <div className="mt-4 space-y-4">
        {state.phase === 'idle' && (
          <>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              {state.notice ?? 'The camera opens only while this screen is open, and turns off as soon as the photo is taken.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={p.onStart} className={primary}><Camera size={16} aria-hidden="true" />Start the camera</button>
              <button type="button" onClick={p.onClose} className={pill}>Close</button>
            </div>
          </>
        )}

        {state.phase === 'starting' && (
          <>
            <p role="status" className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              Opening the camera. Your browser may ask you to allow it.
            </p>
            <button type="button" onClick={p.onClose} className={pill}>Cancel</button>
          </>
        )}

        {(state.phase === 'live' || state.phase === 'counting') && (
          <LiveStage
            stream={state.stream}
            secondsLeft={state.phase === 'counting' ? state.secondsLeft : null}
            hint={state.phase === 'live' ? state.hint : undefined}
            onTakeNow={p.onTakeNow}
            onTakeInSeconds={p.onTakeInSeconds}
            onCancelCountdown={p.onCancelCountdown}
            onClose={p.onClose}
          />
        )}

        {(state.phase === 'review' || state.phase === 'saving') && (
          <>
            <div
              className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 dark:border-ink-400 dark:bg-ink-fill"
              style={{ aspectRatio: `${state.frame.width} / ${state.frame.height}` }}
            >
              <PhotoCanvas
                sourceKey={`review-${state.frame.takenAt}`}
                load={() => Promise.resolve(state.frame.blob)}
                maxWidth={960}
                label="The photo you just took"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              The camera is off. Save this photo to your diary on this device, or take it again.
            </p>
            {state.phase === 'review' && state.saveError && (
              <p role="alert" className="text-sm font-semibold text-alert-600 dark:text-alert-400">{state.saveError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={p.onSave} disabled={state.phase === 'saving'} className={primary}>
                <Check size={16} aria-hidden="true" />{state.phase === 'saving' ? 'Saving' : 'Save photo'}
              </button>
              <button type="button" onClick={p.onRetake} disabled={state.phase === 'saving'} className={pill}>
                <RotateCcw size={14} aria-hidden="true" />Retake
              </button>
              <button type="button" onClick={p.onClose} disabled={state.phase === 'saving'} className={pill}>
                <X size={14} aria-hidden="true" />Discard
              </button>
            </div>
          </>
        )}

        {state.phase === 'saved' && (
          <p role="status" className="text-sm font-semibold text-stone-800 dark:text-stone-100">Saved to your diary.</p>
        )}

        {state.phase === 'error' && (
          <div role="alert" className="space-y-3">
            <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{state.problem.title}</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{state.problem.detail}</p>
            <div className="flex flex-wrap gap-2">
              {state.problem.watchingIsUsingIt && (
                <button type="button" onClick={p.onStopWatchingAndRetry} className={primary}>Stop watching and try again</button>
              )}
              <button type="button" onClick={p.onRetake} className={state.problem.watchingIsUsingIt ? pill : primary}>Try again</button>
              <button type="button" onClick={p.onClose} className={pill}>Close</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface LiveStageProps {
  stream: MediaStream;
  secondsLeft: number | null;
  hint?: string;
  onTakeNow: (video: HTMLVideoElement) => void;
  onTakeInSeconds: (video: HTMLVideoElement) => void;
  onCancelCountdown: () => void;
  onClose: () => void;
}

function LiveStage({ stream, secondsLeft, hint, onTakeNow, onTakeInSeconds, onCancelCountdown, onClose }: LiveStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState(4 / 3);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null; // let go of the stream; the controller stops the tracks
    };
  }, [stream]);

  const counting = secondsLeft !== null;
  const withVideo = (fn: (video: HTMLVideoElement) => void) => () => {
    if (videoRef.current) fn(videoRef.current);
  };

  return (
    <>
      <div
        className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-deep"
        style={{ aspectRatio: String(ratio) }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-label="Live camera preview"
          onLoadedMetadata={e => {
            const v = e.currentTarget;
            if (v.videoWidth > 0 && v.videoHeight > 0) setRatio(v.videoWidth / v.videoHeight);
          }}
          onLoadedData={() => setReady(true)}
          className="absolute inset-0 h-full w-full -scale-x-100 object-contain"
        />
        {/* The framing guide: a rounded rectangle with four corner marks. Nothing else. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-[7%] rounded-3xl border-2 border-white/60">
          <span className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-3xl border-l-4 border-t-4 border-lime-300" />
          <span className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-3xl border-r-4 border-t-4 border-lime-300" />
          <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-3xl border-b-4 border-l-4 border-lime-300" />
          <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-3xl border-b-4 border-r-4 border-lime-300" />
        </div>
        {counting && (
          <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
            <span className="grid h-24 w-24 place-items-center rounded-full bg-black/55 font-display text-6xl font-extrabold tabular-nums text-white">
              {secondsLeft}
            </span>
          </div>
        )}
      </div>

      <p id="photo-guide-text" className="text-center text-sm font-medium text-stone-800 dark:text-stone-100">{GUIDE_TEXT}</p>
      <p className="-mt-2 text-center text-xs text-stone-600 dark:text-stone-300">Keep your face out of the picture. The preview is a mirror, and the photo is saved the way you see it.</p>

      <div role="status" aria-live="polite" className="min-h-5 text-center text-sm text-stone-700 dark:text-stone-200">
        {counting ? `Taking the photo in ${secondsLeft}` : hint ?? (ready ? '' : 'Waiting for the camera picture')}
      </div>

      <div className="flex flex-wrap justify-center gap-2" aria-describedby="photo-guide-text">
        {counting ? (
          <button type="button" onClick={onCancelCountdown} className={pill}>Cancel the timer</button>
        ) : (
          <>
            <button type="button" disabled={!ready} onClick={withVideo(onTakeInSeconds)} className={primary}>
              <Camera size={16} aria-hidden="true" />Take photo in {COUNTDOWN_SECONDS} seconds
            </button>
            <button type="button" disabled={!ready} onClick={withVideo(onTakeNow)} className={pill}>Take it now</button>
            <button type="button" onClick={onClose} className={pill}>Cancel</button>
          </>
        )}
      </div>
    </>
  );
}
