import { ShieldCheck } from 'lucide-react';
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
    <div className="p-8 pb-10">
      <PageHeader
        eyebrow="Today"
        title={`${greeting}, ${firstName}.`}
        right={
          <div className="flex items-center gap-1.5 text-forest-600 dark:text-forest-400 text-[11.5px] py-1.5 px-3 bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800 rounded-full">
            <ShieldCheck size={12} />
            <span>On-device</span>
          </div>
        }
      />

      {/* Split grid: left 1.35fr, right 1fr */}
      <div className="grid gap-5 items-start" style={{ gridTemplateColumns: '1.35fr 1fr' }}>
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
