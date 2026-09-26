import { useAppStore } from '../../store/useAppStore';

export function TodayStats() {
  const { incidents } = useAppStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIncidents = incidents.filter(i => i.timestamp >= today.getTime());
  const incidentCount = todayIncidents.filter(i => i.autoDetected && !i.confirmed).length;
  const biteCount = todayIncidents.filter(i => !i.autoDetected || i.confirmed).length;

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] p-7 shadow-card dark:shadow-card-dark">
      <p className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-5">Today</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[28px] font-semibold tabular-nums tracking-tight text-amber-700 dark:text-amber-400 leading-none">
            {incidentCount}
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">
            alarms to review
          </p>
        </div>
        <div>
          <p className="text-[28px] font-semibold tabular-nums tracking-tight text-alert-600 dark:text-alert-400 leading-none">
            {biteCount}
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">
            bites
          </p>
        </div>
      </div>
    </div>
  );
}
