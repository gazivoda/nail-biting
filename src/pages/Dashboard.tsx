import { useState } from 'react';
import { ShieldCheck, Download, X, Camera } from 'lucide-react';
import { CameraView } from '../components/detection/CameraView';
import { StreakCard } from '../components/dashboard/StreakCard';
import { StatsRow } from '../components/dashboard/StatsRow';
import { PanicButton } from '../components/dashboard/PanicButton';
import { CameraToggle } from '../components/dashboard/CameraToggle';
import { useCamera } from '../hooks/useCamera';
import { useAppStore } from '../store/useAppStore';

const DOWNLOAD_MAC_ARM = '/downloads/Nail-Habit-Tracker-1.0.0-arm64.dmg';
const isElectron = navigator.userAgent.includes('Electron');

function FirstRunHint() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none select-none">
      <div className="w-12 h-12 rounded-2xl bg-forest-100 dark:bg-forest-900/40 border border-forest-200 dark:border-forest-800 flex items-center justify-center">
        <Camera size={22} className="text-forest-600 dark:text-forest-400" />
      </div>
      <div className="text-center px-6">
        <p className="text-stone-600 dark:text-stone-300 font-medium text-sm">Enable AI detection to start</p>
        <p className="text-stone-400 dark:text-stone-500 text-xs mt-1">Toggle "AI Detection" on the right →</p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { cameraEnabled, incidents } = useAppStore();
  const { videoRef } = useCamera(cameraEnabled);
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem('desktop_banner_dismissed') === '1'
  );

  const isFirstRun = !cameraEnabled && incidents.length === 0;

  function dismissBanner() {
    localStorage.setItem('desktop_banner_dismissed', '1');
    setBannerDismissed(true);
  }

  return (
    <div className="p-8">
      {/* Desktop app promo — only shown in browser, dismissible */}
      {!isElectron && !bannerDismissed && (
        <div className="flex items-center justify-between gap-4 mb-6 px-4 py-3 bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-xl text-sm shadow-card dark:shadow-card-dark animate-fade-up" style={{ animationDelay: '0ms' }}>
          <span className="text-stone-500 dark:text-stone-400">
            For the best experience, try the{' '}
            <strong className="text-stone-700 dark:text-stone-200">native desktop app</strong> — runs fully offline, no browser needed.
          </span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href={DOWNLOAD_MAC_ARM}
              className="inline-flex items-center gap-1.5 text-forest-600 dark:text-forest-400 hover:text-forest-500 font-medium text-xs transition-colors"
            >
              <Download size={12} aria-hidden="true" />
              Download for Mac
            </a>
            <button
              onClick={dismissBanner}
              aria-label="Dismiss"
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Privacy badge */}
      <div
        className="flex items-center gap-1.5 text-forest-600 dark:text-forest-400 text-xs py-1.5 px-4 bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800 rounded-full mb-8 w-fit animate-fade-up"
        style={{ animationDelay: '60ms' }}
      >
        <ShieldCheck size={12} />
        <span>All processing on-device — camera feed never leaves this app</span>
      </div>

      {/* Two-column: camera left, controls right */}
      <div className="grid grid-cols-5 gap-8 items-start">
        {/* Camera — takes 3/5 */}
        <div
          className="col-span-3 relative animate-fade-up"
          style={{ animationDelay: '120ms' }}
        >
          <CameraView videoRef={videoRef} />
          {isFirstRun && <FirstRunHint />}
        </div>

        {/* Stats + controls — takes 2/5, staggered children */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="animate-fade-up" style={{ animationDelay: '160ms' }}>
            <StreakCard />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
            <StatsRow />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '240ms' }}>
            <CameraToggle />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '280ms' }}>
            <PanicButton />
          </div>
        </div>
      </div>
    </div>
  );
}
