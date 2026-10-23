import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CameraToggle } from './CameraToggle';
import { CameraView } from '../detection/CameraView';
import { useCamera } from '../../hooks/useCamera';
import { CAMERA_ERROR_MESSAGE } from '../detection/cameraErrorCopy';
import { useWatchGate } from '../../background/gate';
import { cameraStreamEnabled } from '../../background/pauseMachine';

export function CameraPanel() {
  const { cameraEnabled } = useAppStore();
  // WS7a: while watching is paused the camera is let go of (indicator off) where the browser remembers consent.
  // Flag off: the gate is a constant "running" and this is useCamera(cameraEnabled), as before.
  const gate = useWatchGate();
  const { videoRef, error } = useCamera(cameraStreamEnabled(cameraEnabled, gate.state));
  const cameraError = error ? CAMERA_ERROR_MESSAGE[error.kind] : null;
  const [modelFailed, setModelFailed] = useState(false);
  const problem = !cameraEnabled ? null
    : cameraError ? 'Camera not running'
    : modelFailed ? 'Detection not running'
    : null;

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl overflow-hidden">
      {/* While detection is on, the status is the card's own deep top band
          (edge to edge) above the feed. Off, the card says what starting does. */}
      <CameraToggle problem={problem} note={gate.note} />

      {/* Camera feed: only visible when enabled */}
      {cameraEnabled && (
        <div>
          <CameraView videoRef={videoRef} cameraError={cameraError} onModelError={setModelFailed} />
        </div>
      )}
    </div>
  );
}
