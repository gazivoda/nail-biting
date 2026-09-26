import { PageHeader } from '../components/layout/PageHeader';
import { StreakHero } from '../components/dashboard/StreakHero';
import { CameraPanel } from '../components/dashboard/CameraPanel';
import { TodayStats } from '../components/dashboard/TodayStats';
import { SessionGoal } from '../components/dashboard/SessionGoal';
import { ReplacementPrompt } from '../components/dashboard/ReplacementPrompt';
import { PanicButton } from '../components/dashboard/PanicButton';
import { useAuth } from '../contexts/AuthContext';

export function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-5 sm:p-8 pb-10">
      {/* No "On-device" pill: the detection card says "Runs on this device"
          and the sidebar footer says it again; a third time was noise. */}
      <PageHeader title={`${greeting}, ${firstName}.`} />

      {/* Single column on phones/tablets; split 1.35fr / 1fr from md up */}
      <div className="grid gap-5 items-start grid-cols-1 md:grid-cols-[1.35fr_1fr]">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          <StreakHero />
          <CameraPanel />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <SessionGoal />
          <TodayStats />
          <ReplacementPrompt />
          <PanicButton />
        </div>
      </div>
    </div>
  );
}
