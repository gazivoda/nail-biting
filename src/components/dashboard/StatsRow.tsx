import { useAppStore } from '../../store/useAppStore';

export function StatsRow() {
  const { incidents } = useAppStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = incidents.filter(i => i.timestamp >= today.getTime()).length;
  const totalCount = incidents.length;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
        <p className="text-3xl font-bold text-red-400">{todayCount}</p>
        <p className="text-slate-500 text-xs mt-1">bites today</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
        <p className="text-3xl font-bold text-slate-300">{totalCount}</p>
        <p className="text-slate-500 text-xs mt-1">total logged</p>
      </div>
    </div>
  );
}
