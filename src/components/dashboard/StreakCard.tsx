import { useStreak } from '../../hooks/useStreak';
import { Trophy } from 'lucide-react';

export function StreakCard() {
  const { formattedCurrent, formattedBest, isGood, isGreat } = useStreak();

  const streakColor = isGreat
    ? 'text-emerald-300'
    : isGood
    ? 'text-emerald-400'
    : 'text-slate-300';

  const dotColor = isGreat ? 'bg-emerald-300' : isGood ? 'bg-emerald-400' : 'bg-slate-400';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
        <p className="text-slate-400 text-sm uppercase tracking-widest">Current streak</p>
      </div>

      <p className={`text-5xl font-bold tabular-nums ${streakColor} mt-1`}>
        {formattedCurrent}
      </p>
      <p className="text-slate-500 text-xs mt-1">nail-bite free</p>

      <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-center gap-2 text-slate-500 text-sm">
        <Trophy size={14} className="text-amber-400" />
        <span>Best: <span className="text-amber-400 font-medium">{formattedBest || '—'}</span></span>
      </div>
    </div>
  );
}
