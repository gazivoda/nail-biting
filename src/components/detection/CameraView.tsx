import { useCallback, useRef } from 'react';
import { PictureInPicture2 } from 'lucide-react';
import { DetectionWave } from '../DetectionWave';
import { useDetection } from '../../hooks/useDetection';
import { usePictureInPicture } from '../../hooks/usePictureInPicture';
import { DetectionStatus } from './DetectionStatus';
import { AlertOverlay } from './AlertOverlay';
import { useAppStore } from '../../store/useAppStore';
import type { DetectionSensitivity } from '../../types';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function CameraView({ videoRef }: Props) {
  const {
    cameraEnabled,
    showCameraFeed,
    detectionSensitivity,
    alertType,
    alertSound,
    logIncident,
    setCameraEnabled,
  } = useAppStore();

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pipActive, pipSupported, togglePiP } = usePictureInPicture(videoRef);

  const handleAlert = () => logIncident('auto-detected', true);

  const handleRetry = useCallback(() => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    setCameraEnabled(false);
    retryTimeoutRef.current = setTimeout(() => setCameraEnabled(true), 300);
  }, [setCameraEnabled]);

  const { status } = useDetection(
    videoRef,
    cameraEnabled,
    detectionSensitivity as DetectionSensitivity,
    alertType,
    alertSound,
    handleAlert,
  );

  const showFlash = status === 'alert' && (alertType === 'flash' || alertType === 'both');
  const isAlerting = status === 'alert';
  // When PiP is active the floating window already shows the feed — hide it in the main view
  const effectiveShowFeed = showCameraFeed && !pipActive;

  return (
    <>
      <AlertOverlay visible={showFlash} />

      <div
        className={`relative bg-stone-900 dark:bg-ink-50 rounded-2xl overflow-hidden border transition-all duration-300 ${
          isAlerting
            ? 'border-alert-400 shadow-[0_0_0_3px_oklch(55%_0.22_25/0.35)] animate-[alert-ring_1s_ease-in-out_infinite]'
            : 'border-stone-800 dark:border-ink-400'
        }`}
      >
        {/* Video element always present for MediaPipe, visibility toggled */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full aspect-video object-cover ${
            !cameraEnabled ? 'hidden' : effectiveShowFeed ? 'block' : 'invisible absolute inset-0'
          }`}
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Hidden feed placeholder — detection is active, wave shows real events */}
        {cameraEnabled && !effectiveShowFeed && (
          <div className="w-full aspect-video flex flex-col items-center justify-center bg-stone-900 dark:bg-ink-50 px-6">
            <DetectionWave detectionStatus={status} />
          </div>
        )}

        {/* Offline / idle state — wave runs in demo mode */}
        {!cameraEnabled && (
          <div className="w-full aspect-video flex flex-col items-center justify-center bg-stone-950 dark:bg-ink-300 px-6">
            <DetectionWave />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute bottom-3 left-3">
          <DetectionStatus status={status} cameraEnabled={cameraEnabled} onRetry={handleRetry} />
        </div>

        {/* PiP button — keeps detection alive when tab is minimized */}
        {cameraEnabled && pipSupported && (
          <button
            onClick={togglePiP}
            title={pipActive ? 'Exit Picture-in-Picture' : 'Float to a mini window — detection keeps running when you switch apps'}
            className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              pipActive
                ? 'bg-forest-600 text-cream-100 shadow-md ring-1 ring-forest-400/40'
                : 'bg-stone-900/75 text-stone-200 hover:bg-stone-800 hover:text-white border border-white/10'
            }`}
          >
            <PictureInPicture2 size={13} />
            {pipActive ? 'Exit PiP' : 'Minimize'}
          </button>
        )}
      </div>
    </>
  );
}
