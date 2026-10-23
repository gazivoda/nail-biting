import { useCallback, useEffect, useRef } from 'react';
import { PictureInPicture2 } from 'lucide-react';
import { useDetection } from '../../hooks/useDetection';
import { usePictureInPicture } from '../../hooks/usePictureInPicture';
import { DetectionSurface } from './DetectionSurface';
import { PiPWindow } from './PiPWindow';
import { useAppStore } from '../../store/useAppStore';
import type { DetectionSensitivity } from '../../types';
import type { Behavior } from '../../storage/eventModel';
import { useActiveBehaviors } from '../../detection/useBehaviors';
import { alarmHandExtras } from '../../detection/controlsRegistry';
import { useWatchGate } from '../../background/gate';
import { PausedOverlay } from '../../background/PausedOverlay';
import { effectiveAlertType, inferenceEnabled, isDetecting } from '../../background/pauseMachine';
import { useT } from '../../i18n/scopes/watch';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Why the camera didn't start, in words for the user; null while it runs. */
  cameraError?: string | null;
  /** Told whether the detection models failed, so the card above can say so. */
  onModelError?: (failed: boolean) => void;
}

export function CameraView({ videoRef, cameraError = null, onModelError }: Props) {
  const {
    cameraEnabled,
    showCameraFeed,
    detectionSensitivity,
    alertType,
    alertSound,
    alertVolume,
    logIncident,
    setCameraEnabled,
    setDetecting,
  } = useAppStore();

  const t = useT();
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pipActive, pipWindow, pipSupported, togglePiP } = usePictureInPicture(videoRef);

  const behaviors = useActiveBehaviors();
  // WS7a: with the background_watching flag off the gate is a constant "running, not silent", and everything below
  // reduces to what it was. Paused: nothing runs (no inference, `detecting` false for the tray and WS9's meter).
  // Meeting mode: watching goes on, the alarm is a flash only.
  const gate = useWatchGate();
  const inferenceOn = inferenceEnabled(cameraEnabled, gate.state);
  // SEAM (WS3): alarmHandExtras() is {} unless the false-alarm controls are on, then { hand } (left or right as the person sees it).
  const handleAlert = (behavior: Behavior) => logIncident('auto-detected', true, { behavior, ...alarmHandExtras() });

  const handleRetry = useCallback(() => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    setCameraEnabled(false);
    retryTimeoutRef.current = setTimeout(() => setCameraEnabled(true), 300);
  }, [setCameraEnabled]);

  const { status } = useDetection(
    videoRef,
    inferenceOn,
    detectionSensitivity as DetectionSensitivity,
    alertType,
    alertSound,
    alertVolume,
    handleAlert,
    behaviors,
  );

  const modelFailed = status === 'error';

  // "Switched on" is not "watching": cameraEnabled starts true on every load
  // and stays true when the camera is refused or the models fail. Anything
  // that should only happen while detection really runs (the check-in
  // reminders) reads this instead.
  const running = isDetecting({ cameraEnabled, cameraError, status, watch: gate.state });
  useEffect(() => { setDetecting(running); }, [running, setDetecting]);
  useEffect(() => () => setDetecting(false), [setDetecting]);
  useEffect(() => { onModelError?.(modelFailed); }, [modelFailed, onModelError]);

  const shownAlertType = effectiveAlertType(alertType, gate.state);
  const showFlash = status === 'alert' && (shownAlertType === 'flash' || shownAlertType === 'both');
  // When PiP is active the floating window already shows the feed — hide it in the main view
  const effectiveShowFeed = showCameraFeed && !pipActive;

  return (
    <>
      <DetectionSurface
        videoRef={videoRef}
        status={status}
        cameraEnabled={inferenceOn}
        showFeed={effectiveShowFeed}
        showFlash={showFlash}
        onRetry={handleRetry}
        cameraError={cameraError}
        flush
      >
        <PausedOverlay />{/* WS7a: the pause panel over the frame; nothing unless watching is paused. Before the PiP button so that button stays on top. */}
        {/* PiP button — keeps detection alive when tab is minimized */}
        {cameraEnabled && pipSupported && !cameraError && !modelFailed && (
          <button
            onClick={togglePiP}
            title={pipActive ? t('view.pip.exitTitle') : t('view.pip.floatTitle')}
            className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
              pipActive
                ? 'bg-forest-600 text-cream-100 ring-1 ring-forest-400/40'
                : 'bg-white/90 text-stone-700 hover:bg-white border border-stone-200 dark:bg-ink-100/90 dark:text-stone-200 dark:hover:bg-ink-100 dark:border-ink-400'
            }`}
          >
            <PictureInPicture2 size={13} />
            {pipActive ? t('view.pip.exit') : t('view.pip.minimize')}
          </button>
        )}
      </DetectionSurface>

      {/* Document PiP content — custom UI rendered into the floating window */}
      {pipActive && pipWindow && (
        <PiPWindow pipWindow={pipWindow} status={status} />
      )}
    </>
  );
}
