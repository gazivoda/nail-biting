import { Camera, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export function CameraToggle() {
  const { cameraEnabled, showCameraFeed, setCameraEnabled, setShowCameraFeed } = useAppStore();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera size={18} className={cameraEnabled ? 'text-emerald-400' : 'text-slate-500'} />
          <div>
            <p className="text-sm font-medium text-slate-200">AI Detection</p>
            <p className="text-xs text-slate-500">100% on-device — no data sent</p>
          </div>
        </div>
        <button
          onClick={() => setCameraEnabled(!cameraEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            cameraEnabled ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
              cameraEnabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {cameraEnabled && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            {showCameraFeed ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Show camera feed</span>
          </div>
          <button
            onClick={() => setShowCameraFeed(!showCameraFeed)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              showCameraFeed ? 'bg-slate-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                showCameraFeed ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
}
