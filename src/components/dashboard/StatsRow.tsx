import { useAppStore } from '../../store/useAppStore';

export function StatsRow() {
  const { incidents } = useAppStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = incidents.filter(i => i.timestamp >= today.getTime()).length;
  const totalCount = incidents.length;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-xl p-4 text-center shadow-card">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-alert-600">{todayCount}</p>
        <p className="text-stone-400 dark:text-stone-500 text-xs mt-1">bites today</p>
      </div>
      <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-xl p-4 text-center shadow-card">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-stone-600 dark:text-stone-300">{totalCount}</p>
        <p className="text-stone-400 dark:text-stone-500 text-xs mt-1">total logged</p>
      </div>
    </div>
  );
}
