import { useAppStore } from '../../store/useAppStore';

export function StatsRow() {
  const { incidents } = useAppStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = incidents.filter(i => i.timestamp >= today.getTime()).length;
  const totalCount = incidents.length;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white border border-stone-200 rounded-xl p-4 text-center shadow-sm">
        <p className="text-3xl font-bold text-alert-600">{todayCount}</p>
        <p className="text-stone-400 text-xs mt-1">bites today</p>
      </div>
      <div className="bg-white border border-stone-200 rounded-xl p-4 text-center shadow-sm">
        <p className="text-3xl font-bold text-stone-600">{totalCount}</p>
        <p className="text-stone-400 text-xs mt-1">total logged</p>
      </div>
    </div>
  );
}
