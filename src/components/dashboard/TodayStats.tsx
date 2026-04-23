import { useAppStore } from '../../store/useAppStore';

export function TodayStats() {
  const { incidents } = useAppStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIncidents = incidents.filter(i => i.timestamp >= today.getTime());
  const todayCount = todayIncidents.length;
  const autoCount = todayIncidents.filter(i => i.tag === 'auto-detected').length;

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] p-7 shadow-card dark:shadow-card-dark">
      <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-stone-400 dark:text-stone-500 mb-5">Today</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[28px] font-semibold tabular-nums tracking-tight text-alert-600 dark:text-alert-400 leading-none">
            {todayCount}
          </p>
          <p className="text-[10px] uppercase tracking-[1px] text-stone-400 dark:text-stone-500 mt-2 font-medium">
            bites logged
          </p>
        </div>
        <div>
          <p className="text-[28px] font-semibold tabular-nums tracking-tight text-stone-600 dark:text-stone-300 leading-none">
            {autoCount}
          </p>
          <p className="text-[10px] uppercase tracking-[1px] text-stone-400 dark:text-stone-500 mt-2 font-medium">
            auto-detected
          </p>
        </div>
      </div>
    </div>
  );
}
