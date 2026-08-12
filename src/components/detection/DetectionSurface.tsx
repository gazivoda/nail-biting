import { DetectionWave } from '../DetectionWave';
// The badge component and the status union share a name; alias the component so
// the prop type below can keep the name the rest of the codebase uses.
import { DetectionStatus as DetectionStatusBadge } from './DetectionStatus';
import { AlertOverlay } from './AlertOverlay';
import type { DetectionStatus } from '../../hooks/useDetection';

interface DetectionSurfaceProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: DetectionStatus;
  cameraEnabled: boolean;
  showFeed: boolean;
  showFlash: boolean;
  onRetry?: () => void;
  /**
   * Overlay slot, rendered top-right inside the frame. The frame is `relative`
   * and the slot is not wrapped, so the child places itself — see the PiP
   * button in `CameraView`, which uses `absolute top-3 right-3`.
   */
  children?: React.ReactNode;
}

/**
 * Presentational shell for a detection session: the alert flash, the bordered
 * (and, while alerting, ringed) frame, the video element, the idle/hidden wave
 * fallbacks and the status badge. No store access — every container feeds it
 * props, so `CameraView` and the landing demo render the identical surface.
 */
export function DetectionSurface({
  videoRef,
  status,
  cameraEnabled,
  showFeed,
  showFlash,
  onRetry,
  children,
}: DetectionSurfaceProps) {
  const isAlerting = status === 'alert';

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
            !cameraEnabled ? 'hidden' : showFeed ? 'block' : 'invisible absolute inset-0'
          }`}
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Hidden feed placeholder — detection is active, wave shows real events */}
        {cameraEnabled && !showFeed && (
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
          <DetectionStatusBadge status={status} cameraEnabled={cameraEnabled} onRetry={onRetry} />
        </div>

        {children}
      </div>
    </>
  );
}
