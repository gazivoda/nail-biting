// The capture screen wired to the real camera, encoder and store. The camera is opened
// when the panel appears and every track is stopped when it goes (see captureController.ts).
// It uses its own getUserMedia stream; detection's stream is never touched, and the only
// thing done to watching is the explicit "Stop watching and try again" button after the
// browser said the camera was busy.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAppStore } from '../store/useAppStore';
import { createCaptureController } from './captureController';
import { CapturePanelView } from './CapturePanelView';
import { encodeVideoFrame, openDiaryCamera } from './frameEncoder';
import { photoStore } from './photoStore';
import { t } from '../i18n/scopes/photos';
import type { PhotoMeta } from './diaryMeta';

export interface SavedPhoto {
  photo: PhotoMeta;
  /** false when the bytes only live in memory for this tab */
  persisted: boolean;
}

/** Time for the Watch tab to let go of the camera after it is stopped. */
const RETRY_DELAY_MS = 900;

function createController() {
  const hasCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
  return createCaptureController<MediaStream, HTMLVideoElement>({
    openCamera: hasCamera ? () => openDiaryCamera()! : undefined,
    encode: encodeVideoFrame,
    save: frame => photoStore.add({ blob: frame.blob, width: frame.width, height: frame.height, takenAt: frame.takenAt }),
    now: () => Date.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: handle => window.clearTimeout(handle as number),
    isWatching: () => useAppStore.getState().detecting,
  });
}

export function CapturePanel({ onClose, onSaved }: { onClose: () => void; onSaved: (saved: SavedPhoto) => void }) {
  const [controller] = useState(createController);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const retryTimer = useRef<number | null>(null);

  useEffect(() => {
    void controller.start();
    return () => {
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      controller.dispose(); // stops every track
    };
  }, [controller]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) controller.release(t('capture.hiddenNotice')); };
    const onPageHide = () => controller.dispose();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [controller]);

  const save = async () => {
    await controller.save();
    const s = controller.getState();
    if (s.phase === 'saved') onSaved({ photo: s.photo, persisted: s.persisted });
  };

  const stopWatchingAndRetry = () => {
    useAppStore.getState().setCameraEnabled(false); // what the Watch tab's own Stop button does
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      void controller.retake();
    }, RETRY_DELAY_MS);
  };

  return (
    <CapturePanelView
      state={state}
      onStart={() => { void controller.start(); }}
      onTakeNow={video => { void controller.takeNow(video); }}
      onTakeInSeconds={video => controller.takeWithCountdown(video)}
      onCancelCountdown={controller.cancelCountdown}
      onRetake={() => { void controller.retake(); }}
      onSave={() => { void save(); }}
      onClose={onClose}
      onStopWatchingAndRetry={stopWatchingAndRetry}
    />
  );
}
