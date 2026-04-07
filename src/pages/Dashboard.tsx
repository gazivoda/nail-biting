import { ShieldCheck, Camera } from 'lucide-react';
import { CameraView } from '../components/detection/CameraView';
import { StreakCard } from '../components/dashboard/StreakCard';
import { StatsRow } from '../components/dashboard/StatsRow';
import { PanicButton } from '../components/dashboard/PanicButton';
import { CameraToggle } from '../components/dashboard/CameraToggle';
import { useCamera } from '../hooks/useCamera';
import { useAppStore } from '../store/useAppStore';

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

  const isFirstRun = !cameraEnabled && incidents.length === 0;

  return (
    <div className="p-8">

      {/* Privacy badge */}
      <div
        className="flex items-center gap-1.5 text-forest-600 dark:text-forest-400 text-xs py-1.5 px-4 bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800 rounded-full mb-8 w-fit animate-fade-up"
        style={{ animationDelay: '0ms' }}
      >
        <ShieldCheck size={12} />
        <span>All processing on-device — camera feed never leaves this app</span>
      </div>

      {/* Two-column: camera left, controls right */}
      <div className="grid grid-cols-5 gap-8 items-start">
        {/* Camera — takes 3/5 */}
        <div
          className="col-span-3 relative animate-fade-up"
          style={{ animationDelay: '60ms' }}
        >
          <CameraView videoRef={videoRef} />
          {isFirstRun && <FirstRunHint />}
        </div>

        {/* Stats + controls — takes 2/5, staggered children */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
            <StreakCard />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '160ms' }}>
            <StatsRow />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
            <CameraToggle />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '240ms' }}>
            <PanicButton />
          </div>
        </div>
      </div>
    </div>
  );
}
