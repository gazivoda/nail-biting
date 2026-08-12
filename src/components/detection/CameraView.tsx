import { useCallback, useRef } from 'react';
import { PictureInPicture2 } from 'lucide-react';
import { useDetection } from '../../hooks/useDetection';
import { usePictureInPicture } from '../../hooks/usePictureInPicture';
import { DetectionSurface } from './DetectionSurface';
import { PiPWindow } from './PiPWindow';
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
    alertVolume,
    logIncident,
    setCameraEnabled,
  } = useAppStore();

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pipActive, pipWindow, pipSupported, togglePiP } = usePictureInPicture(videoRef);

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
    alertVolume,
    handleAlert,
  );

  const showFlash = status === 'alert' && (alertType === 'flash' || alertType === 'both');
  // When PiP is active the floating window already shows the feed — hide it in the main view
  const effectiveShowFeed = showCameraFeed && !pipActive;

  return (
    <>
      <DetectionSurface
        videoRef={videoRef}
        status={status}
        cameraEnabled={cameraEnabled}
        showFeed={effectiveShowFeed}
        showFlash={showFlash}
        onRetry={handleRetry}
      >
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
      </DetectionSurface>

      {/* Document PiP content — custom UI rendered into the floating window */}
      {pipActive && pipWindow && (
        <PiPWindow pipWindow={pipWindow} status={status} />
      )}
    </>
  );
}
