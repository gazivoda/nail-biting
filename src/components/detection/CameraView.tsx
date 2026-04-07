import { useCallback, useRef } from 'react';
import { VideoOff } from 'lucide-react';
import { useDetection } from '../../hooks/useDetection';
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

  return (
    <>
      <AlertOverlay visible={showFlash} />

      <div
        className={`relative bg-stone-900 dark:bg-ink-50 rounded-2xl overflow-hidden border transition-all duration-300 ${
          isAlerting
            ? 'border-alert-500 shadow-[0_0_0_3px_oklch(55%_0.22_25/0.35)] animate-[alert-ring_1s_ease-in-out_infinite]'
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
            !cameraEnabled ? 'hidden' : showCameraFeed ? 'block' : 'invisible absolute inset-0'
          }`}
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Hidden feed placeholder */}
        {cameraEnabled && !showCameraFeed && (
          <div className="w-full aspect-video flex flex-col items-center justify-center bg-stone-900 dark:bg-ink-50 gap-3">
            <VideoOff className="text-stone-600 dark:text-stone-500" size={40} />
            <p className="text-stone-500 dark:text-stone-400 text-sm">Camera hidden — detection active</p>
          </div>
        )}

        {/* Offline / idle state */}
        {!cameraEnabled && (
          <div className="w-full aspect-video flex flex-col items-center justify-center bg-stone-950 dark:bg-ink-300 gap-3">
            <VideoOff className="text-stone-700 dark:text-stone-600" size={40} />
            <p className="text-stone-600 dark:text-stone-500 text-sm">Camera off</p>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute bottom-3 left-3">
          <DetectionStatus status={status} cameraEnabled={cameraEnabled} onRetry={handleRetry} />
        </div>
      </div>
    </>
  );
}
