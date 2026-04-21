import { createPortal } from 'react-dom';
import { Power } from 'lucide-react';
import { DetectionWave } from '../DetectionWave';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  pipWindow: Window;
  status: 'idle' | 'loading' | 'watching' | 'alert' | 'error';
}

export function PiPWindow({ pipWindow, status }: Props) {
  const { cameraEnabled, setCameraEnabled } = useAppStore();
  const isAlerting = status === 'alert';

  const body = pipWindow.document.body;
  if (!body) return null;

  return createPortal(
    <div
      className={`relative flex flex-col items-center justify-center gap-3 transition-colors duration-300 overflow-hidden`}
      style={{
        width: '100vw',
        height: '100vh',
        background: isAlerting
          ? 'oklch(13% 0.04 25)'
          : 'oklch(11% 0.005 150)',
      }}
    >
      {/* Alert border ring */}
      {isAlerting && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            border: '3px solid oklch(62% 0.18 25)',
            animation: 'alert-ring 1s ease-in-out infinite',
          }}
        />
      )}

      {/* Detection wave */}
      <div className="w-full px-3">
        <DetectionWave detectionStatus={status} />
      </div>

      {/* Stop / Start button */}
      <button
        onClick={() => setCameraEnabled(!cameraEnabled)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
          cameraEnabled
            ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            : 'bg-forest-600 text-cream-100 hover:bg-forest-500'
        }`}
      >
        <Power size={12} />
        {cameraEnabled ? 'Stop detection' : 'Start detection'}
      </button>
    </div>,
    body
  );
}
