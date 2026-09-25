import { AlertTriangle, RotateCcw } from 'lucide-react';
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
   * Why the camera didn't start, already in words for the user. While set, the
   * frame shows it with a retry instead of the video or the "Watching…" wave:
   * saying it is watching over a camera that never started is the one status
   * a detection app must not get wrong.
   */
  cameraError?: string | null;
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
  cameraError = null,
  children,
}: DetectionSurfaceProps) {
  const isAlerting = status === 'alert' && !cameraError;
  const cameraFailed = cameraEnabled && cameraError !== null;

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
            !cameraEnabled || cameraFailed ? 'hidden' : showFeed ? 'block' : 'invisible absolute inset-0'
          }`}
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Hidden feed placeholder — detection is active, wave shows real events */}
        {cameraFailed && (
          <div role="alert" className="w-full aspect-video flex flex-col items-center justify-center gap-4 bg-stone-900 dark:bg-ink-50 px-6 text-center">
            <p className="flex max-w-sm items-start gap-2 text-sm leading-relaxed text-stone-100">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-alert-400" aria-hidden="true" />
              <span>{cameraError}</span>
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-600 px-5 py-2.5 text-sm font-semibold text-stone-100 transition-colors hover:border-stone-300"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Try again
              </button>
            )}
          </div>
        )}

        {cameraEnabled && !cameraFailed && !showFeed && (
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

        {/* Status badge. Nothing to report while the camera has failed: the
            card above already says what is wrong. */}
        {!cameraFailed && (
          <div className="absolute bottom-3 left-3">
            <DetectionStatusBadge status={status} cameraEnabled={cameraEnabled} onRetry={onRetry} />
          </div>
        )}

        {children}
      </div>
    </>
  );
}
