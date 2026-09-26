import { PageHeader } from '../components/layout/PageHeader';
import { StreakHero } from '../components/dashboard/StreakHero';
import { CameraPanel } from '../components/dashboard/CameraPanel';
import { TodayStats } from '../components/dashboard/TodayStats';
import { SessionGoal } from '../components/dashboard/SessionGoal';
import { ReplacementPrompt } from '../components/dashboard/ReplacementPrompt';
import { PanicButton } from '../components/dashboard/PanicButton';
import { useAuth } from '../contexts/AuthContext';
import { trialLeft } from '../utils/trial';

export function Dashboard({ onUpgrade }: { onUpgrade?: () => void }) {
  const { user, accessStatus } = useAuth();
  const trialLeftText = accessStatus === 'trial_active' ? trialLeft(user?.trial_end_date) : null;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-5 sm:p-8 pb-10">
      {/* No "On-device" pill: the detection card says "Runs on this device"
          and the sidebar footer says it again; a third time was noise. */}
      <PageHeader title={`${greeting}, ${firstName}.`} />

      {/* The sidebar's trial card only exists from lg up; below that (a
          half-width window beside your work, a tablet) this is the only place
          the countdown and the way to a plan are visible. */}
      {trialLeftText && (
        <p className="lg:hidden -mt-4 mb-6 flex flex-wrap items-center gap-x-3 text-sm text-stone-600 dark:text-stone-300">
          <span>Free trial: {trialLeftText}.</span>
          {onUpgrade && (
            <button
              type="button"
              onClick={onUpgrade}
              className="inline-flex min-h-11 items-center font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-400 dark:hover:text-forest-300"
            >
              Choose a plan
            </button>
          )}
        </p>
      )}

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
