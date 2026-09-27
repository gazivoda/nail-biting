import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CameraToggle } from './CameraToggle';
import { CameraView } from '../detection/CameraView';
import { useCamera } from '../../hooks/useCamera';
import { CAMERA_ERROR_MESSAGE } from '../detection/cameraErrorCopy';

export function CameraPanel() {
  const { cameraEnabled } = useAppStore();
  const { videoRef, error } = useCamera(cameraEnabled);
  const cameraError = error ? CAMERA_ERROR_MESSAGE[error.kind] : null;
  const [modelFailed, setModelFailed] = useState(false);
  const problem = !cameraEnabled ? null
    : cameraError ? 'Camera not running'
    : modelFailed ? 'Detection not running'
    : null;

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] overflow-hidden shadow-card dark:shadow-card-dark">
      {/* Toggle header. While detection is on, the status is the card's own
          top band (edge to edge); a bordered green card inside the white card
          was a card in a card. Off, the start button keeps its padding. */}
      <div className={`border-b border-stone-100 dark:border-ink-400 ${cameraEnabled ? '' : 'p-4'}`}>
        <CameraToggle problem={problem} />
      </div>

      {/* Camera feed — only visible when enabled */}
      {cameraEnabled && (
        <div>
          <CameraView videoRef={videoRef} cameraError={cameraError} onModelError={setModelFailed} />
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
