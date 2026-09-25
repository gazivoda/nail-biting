import { useAppStore } from '../../store/useAppStore';
import { CameraToggle } from './CameraToggle';
import { CameraView } from '../detection/CameraView';
import { useCamera } from '../../hooks/useCamera';
import { CAMERA_ERROR_MESSAGE } from '../detection/cameraErrorCopy';

export function CameraPanel() {
  const { cameraEnabled } = useAppStore();
  const { videoRef, error } = useCamera(cameraEnabled);
  const cameraError = error ? CAMERA_ERROR_MESSAGE[error.kind] : null;

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] overflow-hidden shadow-card dark:shadow-card-dark">
      {/* Toggle header */}
      <div className="p-4 border-b border-stone-100 dark:border-ink-400">
        <CameraToggle cameraProblem={cameraError !== null} />
      </div>

      {/* Camera feed — only visible when enabled */}
      {cameraEnabled && (
        <div>
          <CameraView videoRef={videoRef} cameraError={cameraError} />
        </div>
      )}

      {/* Idle placeholder */}
      {!cameraEnabled && (
        <div className="flex items-center justify-center h-24 bg-stone-50 dark:bg-ink-300">
          <p className="text-xs text-stone-500 dark:text-stone-400">Camera off — start detection above</p>
        </div>
      )}
    </div>
  );
}
