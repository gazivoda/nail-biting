import { Camera, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export function CameraToggle() {
  const { cameraEnabled, showCameraFeed, setCameraEnabled, setShowCameraFeed } = useAppStore();

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-4 space-y-3 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera size={18} className={cameraEnabled ? 'text-forest-500 dark:text-forest-400' : 'text-stone-400 dark:text-stone-500'} />
          <div>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-200">AI Detection</p>
            <p className="text-xs text-stone-400 dark:text-stone-500">100% on-device — no data sent</p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={cameraEnabled}
          aria-label="Toggle AI detection"
          onClick={() => setCameraEnabled(!cameraEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
            cameraEnabled ? 'bg-forest-500' : 'bg-stone-300 dark:bg-ink-400'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${
              cameraEnabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {cameraEnabled && (
        <div className="flex items-center justify-between pt-2.5 border-t border-stone-100 dark:border-ink-400">
          <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-sm">
            {showCameraFeed ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Show camera feed</span>
          </div>
          <button
            role="switch"
            aria-checked={showCameraFeed}
            aria-label="Show camera feed"
            onClick={() => setShowCameraFeed(!showCameraFeed)}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
              showCameraFeed ? 'bg-stone-400 dark:bg-stone-500' : 'bg-stone-300 dark:bg-ink-400'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                showCameraFeed ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
}
