// The capture flow of the photo diary as a small state machine. No DOM, no React:
// the camera, the encoder, the timer and the store are injected, so node tests
// can drive every path with fakes.
//
//   idle -> starting -> live -> (counting) -> review -> saving -> saved
//                  \-> error (permission, no camera, busy, insecure page, ...)
//
// The camera rule: the diary opens its OWN stream, only while this screen is in use,
// and stops EVERY track on every way out: a photo taken, Retake, Discard, an error,
// the page being hidden, and unmount (dispose). A stream that arrives after the
// person already left is stopped the moment it arrives. The detection stream is
// never read, shared or touched here.

import type { AddResult } from './photoStore';
import type { PhotoMeta } from './diaryMeta';
import { problemFromError, describeCameraProblem, type CameraProblem } from './cameraProblem';
import { messages, t } from '../i18n/scopes/photos';

export interface CaptureTrackLike {
  stop(): void;
}
export interface CaptureStreamLike {
  getTracks(): CaptureTrackLike[];
}

/** A frame turned into a saved-format JPEG, not stored yet. */
export interface EncodedFrame {
  blob: Blob;
  width: number;
  height: number;
  takenAt: number;
}

export interface CapturePorts<S extends CaptureStreamLike, V> {
  /** Opens a camera stream; undefined when the page has no camera API (an insecure page). */
  openCamera: (() => Promise<S>) | undefined;
  /** Draws the current video frame and encodes it. Rejects if there is no frame yet. */
  encode(video: V): Promise<{ blob: Blob; width: number; height: number }>;
  save(frame: EncodedFrame): Promise<AddResult>;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** Whether Stop Biting's own watching is running right now (it changes the "busy" wording). */
  isWatching(): boolean;
}

export type CaptureState<S extends CaptureStreamLike> =
  | { phase: 'idle'; notice?: string }
  | { phase: 'starting' }
  | { phase: 'live'; stream: S; /** shown when a press found no picture yet */ hint?: string }
  | { phase: 'counting'; stream: S; secondsLeft: number }
  | { phase: 'review'; frame: EncodedFrame; saveError?: string }
  | { phase: 'saving'; frame: EncodedFrame }
  | { phase: 'saved'; photo: PhotoMeta; persisted: boolean }
  | { phase: 'error'; problem: CameraProblem };

export const COUNTDOWN_SECONDS = 3;

/** The English wording of the "no picture yet" hint (what the tests compare with); the controller says it with t() when it happens. */
export const NOT_READY_HINT = messages['capture.notReady'];

/** Made when it is needed, so the words are in the language showing then. */
const frameProblem = (): CameraProblem => ({
  kind: 'unknown',
  title: t('problem.frame.title'),
  detail: t('capture.notReady'),
  watchingIsUsingIt: false,
});

export function createCaptureController<S extends CaptureStreamLike, V>(ports: CapturePorts<S, V>) {
  let state: CaptureState<S> = { phase: 'idle' };
  let stream: S | null = null;
  let timer: unknown = null;
  /** Bumped whenever the person leaves, so a slow camera or encoder cannot act afterwards. */
  let generation = 0;
  let encoding = false;
  const listeners = new Set<() => void>();

  const set = (next: CaptureState<S>) => {
    state = next;
    listeners.forEach(fn => fn());
  };

  const stopTimer = () => {
    if (timer !== null) {
      ports.clearTimer(timer);
      timer = null;
    }
  };

  const stopStream = () => {
    const s = stream;
    stream = null;
    if (!s) return;
    for (const track of s.getTracks()) {
      try { track.stop(); } catch { /* a track that will not stop must not block the others */ }
    }
  };

  const leave = () => {
    generation++;
    stopTimer();
    stopStream();
    encoding = false;
  };

  async function start(): Promise<void> {
    if (state.phase === 'starting' || state.phase === 'live' || state.phase === 'counting' || state.phase === 'saving') return;
    leave();
    const mine = generation;
    if (!ports.openCamera) {
      set({ phase: 'error', problem: describeCameraProblem('insecure-context', ports.isWatching()) });
      return;
    }
    set({ phase: 'starting' });
    try {
      const opened = await ports.openCamera();
      if (mine !== generation) {
        // The person left while the browser was still asking: do not leave the camera on.
        for (const track of opened.getTracks()) { try { track.stop(); } catch { /* ignore */ } }
        return;
      }
      stream = opened;
      set({ phase: 'live', stream: opened });
    } catch (err) {
      if (mine !== generation) return;
      set({ phase: 'error', problem: problemFromError(err, ports.isWatching()) });
    }
  }

  async function takeNow(video: V): Promise<void> {
    if ((state.phase !== 'live' && state.phase !== 'counting') || encoding) return;
    stopTimer();
    encoding = true;
    const mine = generation;
    try {
      const out = await ports.encode(video);
      if (mine !== generation) return;
      encoding = false;
      stopStream(); // the light goes off the moment the picture exists
      set({ phase: 'review', frame: { blob: out.blob, width: out.width, height: out.height, takenAt: ports.now() } });
    } catch {
      if (mine !== generation) return;
      encoding = false;
      // Keep the preview: the person can press the button again once the picture is there.
      if (stream) set({ phase: 'live', stream, hint: t('capture.notReady') });
      else set({ phase: 'error', problem: frameProblem() });
    }
  }

  function takeWithCountdown(video: V, seconds: number = COUNTDOWN_SECONDS): void {
    if (state.phase !== 'live' || !stream) return;
    const mine = generation;
    const s = stream;
    let left = Math.max(1, Math.floor(seconds));
    set({ phase: 'counting', stream: s, secondsLeft: left });
    const tick = () => {
      timer = null;
      if (mine !== generation) return;
      left -= 1;
      if (left <= 0) {
        void takeNow(video);
        return;
      }
      set({ phase: 'counting', stream: s, secondsLeft: left });
      timer = ports.setTimer(tick, 1000);
    };
    timer = ports.setTimer(tick, 1000);
  }

  function cancelCountdown(): void {
    if (state.phase !== 'counting') return;
    stopTimer();
    set({ phase: 'live', stream: state.stream });
  }

  /** Turn the camera off without a photo (page hidden, tab left). A photo in review is kept. */
  function release(notice?: string): void {
    if (state.phase !== 'live' && state.phase !== 'counting' && state.phase !== 'starting') return;
    leave();
    set({ phase: 'idle', notice });
  }

  function retake(): Promise<void> {
    if (state.phase !== 'review' && state.phase !== 'error' && state.phase !== 'idle') return Promise.resolve();
    set({ phase: 'idle' });
    return start();
  }

  function discard(): void {
    leave();
    set({ phase: 'idle' });
  }

  async function save(): Promise<void> {
    if (state.phase !== 'review') return;
    const frame = state.frame;
    set({ phase: 'saving', frame });
    const mine = generation;
    let result: AddResult;
    try {
      result = await ports.save(frame);
    } catch {
      result = { ok: false, reason: 'write-failed', message: t('capture.saveFailed') };
    }
    if (mine !== generation) return;
    if (result.ok) set({ phase: 'saved', photo: result.photo, persisted: result.persisted });
    else set({ phase: 'review', frame, saveError: result.message });
  }

  function dispose(): void {
    leave();
    state = { phase: 'idle' };
    listeners.forEach(fn => fn());
  }

  return {
    getState: () => state,
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    start,
    takeNow,
    takeWithCountdown,
    cancelCountdown,
    release,
    retake,
    discard,
    save,
    dispose,
  };
}

export type CaptureController<S extends CaptureStreamLike, V> = ReturnType<typeof createCaptureController<S, V>>;
