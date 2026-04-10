import { Camera, Eye, EyeOff, ShieldCheck, Square } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export function CameraToggle() {
  const { cameraEnabled, showCameraFeed, setCameraEnabled, setShowCameraFeed } = useAppStore();

  if (!cameraEnabled) {
    return (
      <button
        onClick={() => setCameraEnabled(true)}
        className="btn-shimmer group w-full rounded-2xl p-6 flex items-center gap-5 transition-all duration-200 active:scale-[0.99] text-left"
        style={{
          background: 'oklch(46% 0.130 148)',
          boxShadow: '0 8px 32px oklch(46% 0.130 148 / 0.28), 0 2px 8px oklch(46% 0.130 148 / 0.15), inset 0 1px 0 oklch(100% 0 0 / 0.12)',
        }}
      >
        {/* Icon with breathing glow */}
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 rounded-full animate-pulse-slow"
            style={{ background: 'oklch(100% 0 0 / 0.12)', transform: 'scale(1.6)' }}
          />
          <div
            className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'oklch(100% 0 0 / 0.15)', border: '1px solid oklch(100% 0 0 / 0.20)' }}
          >
            <Camera size={26} className="text-white" />
          </div>
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-semibold tracking-tight text-white leading-tight">
            Start AI Detection
          </p>
          <div className="flex items-center gap-1.5 mt-1.5" style={{ color: 'oklch(100% 0 0 / 0.65)' }}>
            <ShieldCheck size={12} />
            <span className="text-[12px]">100% on-device — no data sent</span>
          </div>
        </div>

        {/* Arrow */}
        <div
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5"
          style={{ background: 'oklch(100% 0 0 / 0.15)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-white">
            <path d="M2.5 7h9M7.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
    );
  }

  // Active / ON state
  return (
    <div className="w-full rounded-2xl overflow-hidden bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800">
      {/* Status row */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3.5">
          {/* Animated live dot */}
          <div className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest-500 opacity-70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-forest-500" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-forest-700 dark:text-forest-300">
              Detection Active
            </p>
            <p className="text-[11px] mt-0.5 text-forest-500 dark:text-forest-400">
              AI running on-device
            </p>
          </div>
        </div>

        <button
          onClick={() => setCameraEnabled(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-stone-500 dark:text-stone-400 bg-stone-200/50 dark:bg-ink-400/50 hover:bg-stone-200 dark:hover:bg-ink-400 transition-colors duration-150"
        >
          <Square size={10} fill="currentColor" />
          Stop
        </button>
      </div>

      {/* Show feed sub-toggle */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-forest-200/60 dark:border-forest-800/60">
        <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
          {showCameraFeed ? <Eye size={13} /> : <EyeOff size={13} />}
          <span className="text-[12px]">Show camera feed</span>
        </div>
        <button
          role="switch"
          aria-checked={showCameraFeed}
          aria-label="Show camera feed"
          onClick={() => setShowCameraFeed(!showCameraFeed)}
          className={`relative w-9 h-[18px] rounded-full transition-colors duration-200 ${
            showCameraFeed ? 'bg-forest-500' : 'bg-stone-300 dark:bg-ink-400'
          }`}
        >
          <span
            className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform duration-200"
            style={{ transform: showCameraFeed ? 'translateX(18px)' : 'translateX(0)' }}
          />
        </button>
      </div>
    </div>
  );
}
