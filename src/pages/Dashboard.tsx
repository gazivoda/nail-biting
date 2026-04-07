import { useState } from 'react';
import { ShieldCheck, Download, X } from 'lucide-react';
import { CameraView } from '../components/detection/CameraView';
import { StreakCard } from '../components/dashboard/StreakCard';
import { StatsRow } from '../components/dashboard/StatsRow';
import { PanicButton } from '../components/dashboard/PanicButton';
import { CameraToggle } from '../components/dashboard/CameraToggle';
import { useCamera } from '../hooks/useCamera';
import { useAppStore } from '../store/useAppStore';

const DOWNLOAD_MAC_ARM = '/downloads/Nail-Habit-Tracker-1.0.0-arm64.dmg';
const isElectron = navigator.userAgent.includes('Electron');

export function Dashboard() {
  const { cameraEnabled } = useAppStore();
  const { videoRef } = useCamera(cameraEnabled);
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem('desktop_banner_dismissed') === '1'
  );

  function dismissBanner() {
    localStorage.setItem('desktop_banner_dismissed', '1');
    setBannerDismissed(true);
  }

  return (
    <div className="p-8">
      {/* Desktop app promo — only shown in browser, dismissible */}
      {!isElectron && !bannerDismissed && (
        <div className="flex items-center justify-between gap-4 mb-6 px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm shadow-sm">
          <span className="text-stone-500">
            For the best experience, try the{' '}
            <strong className="text-stone-700">native desktop app</strong> — runs fully offline, no browser needed.
          </span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href={DOWNLOAD_MAC_ARM}
              className="inline-flex items-center gap-1.5 text-forest-600 hover:text-forest-500 font-medium text-xs transition-colors"
            >
              <Download size={12} aria-hidden="true" />
              Download for Mac
            </a>
            <button
              onClick={dismissBanner}
              aria-label="Dismiss"
              className="text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Privacy badge */}
      <div className="flex items-center gap-1.5 text-forest-600 text-xs py-1.5 px-4 bg-forest-50 border border-forest-200 rounded-full mb-8 w-fit">
        <ShieldCheck size={12} />
        <span>All processing on-device — camera feed never leaves this app</span>
      </div>

      {/* Two-column: camera left, controls right */}
      <div className="grid grid-cols-5 gap-8 items-start">
        {/* Camera — takes 3/5 */}
        <div className="col-span-3">
          <CameraView videoRef={videoRef} />
        </div>

        {/* Stats + controls — takes 2/5 */}
        <div className="col-span-2 flex flex-col gap-4">
          <StreakCard />
          <StatsRow />
          <CameraToggle />
          <PanicButton />
        </div>
      </div>
    </div>
  );
}
