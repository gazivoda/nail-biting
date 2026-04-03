import { ShieldCheck } from 'lucide-react';
import { CameraView } from '../components/detection/CameraView';
import { StreakCard } from '../components/dashboard/StreakCard';
import { StatsRow } from '../components/dashboard/StatsRow';
import { PanicButton } from '../components/dashboard/PanicButton';
import { CameraToggle } from '../components/dashboard/CameraToggle';
import { useCamera } from '../hooks/useCamera';
import { useAppStore } from '../store/useAppStore';

export function Dashboard() {
  const { cameraEnabled } = useAppStore();
  const { videoRef } = useCamera(cameraEnabled);

  return (
    <div className="p-8">
      {/* Privacy badge */}
      <div className="flex items-center gap-1.5 text-emerald-600 text-xs py-1.5 px-4 bg-emerald-950/40 border border-emerald-900/40 rounded-full mb-8 w-fit">
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
