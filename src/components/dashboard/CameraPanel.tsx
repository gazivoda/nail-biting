import { useAppStore } from '../../store/useAppStore';
import { CameraToggle } from './CameraToggle';
import { CameraView } from '../detection/CameraView';
import { useCamera } from '../../hooks/useCamera';

export function CameraPanel() {
  const { cameraEnabled } = useAppStore();
  const { videoRef } = useCamera(cameraEnabled);

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] overflow-hidden shadow-card dark:shadow-card-dark">
      {/* Toggle header */}
      <div className="p-4 border-b border-stone-100 dark:border-ink-400">
        <CameraToggle />
      </div>

      {/* Camera feed — only visible when enabled */}
      {cameraEnabled && (
        <div>
          <CameraView videoRef={videoRef} />
        </div>
      )}

      {/* Idle placeholder */}
      {!cameraEnabled && (
        <div className="flex items-center justify-center h-24 bg-stone-50 dark:bg-ink-300">
          <p className="text-xs text-stone-400 dark:text-stone-500">Camera off — start detection above</p>
        </div>
      )}
    </div>
  );
}
