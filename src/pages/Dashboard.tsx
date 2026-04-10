import { ShieldCheck } from 'lucide-react';
import { CameraView } from '../components/detection/CameraView';
import { StreakCard } from '../components/dashboard/StreakCard';
import { StatsRow } from '../components/dashboard/StatsRow';
import { PanicButton } from '../components/dashboard/PanicButton';
import { CameraToggle } from '../components/dashboard/CameraToggle';
import { useCamera } from '../hooks/useCamera';
import { useAppStore } from '../store/useAppStore';

function FirstRunHint() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none select-none">
      <p className="text-stone-500 dark:text-stone-400 text-xs text-center px-6">
        Tap <span className="font-medium text-stone-600 dark:text-stone-300">Start AI Detection</span> above to begin
      </p>
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
        className="flex items-center gap-1.5 text-forest-600 dark:text-forest-400 text-xs py-1.5 px-4 bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800 rounded-full mb-6 w-fit animate-fade-up"
        style={{ animationDelay: '0ms' }}
      >
        <ShieldCheck size={12} />
        <span>All processing on-device — camera feed never leaves this app</span>
      </div>

      {/* AI Detection — hero, full-width, primary action */}
      <div className="mb-8 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <CameraToggle />
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
            <PanicButton />
          </div>
        </div>
      </div>
    </div>
  );
}
