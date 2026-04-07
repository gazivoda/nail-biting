import { useStreak } from '../../hooks/useStreak';
import { Trophy } from 'lucide-react';

export function StreakCard() {
  const { formattedCurrent, formattedBest, isGood, isGreat } = useStreak();

  const streakColor = isGreat
    ? 'text-forest-600'
    : isGood
    ? 'text-forest-500'
    : 'text-stone-500';

  const dotColor = isGreat ? 'bg-forest-500' : isGood ? 'bg-forest-400' : 'bg-stone-400';

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center shadow-sm">
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
        <p className="text-stone-400 text-sm uppercase tracking-widest">Current streak</p>
      </div>

      <p className={`text-5xl font-bold tabular-nums ${streakColor} mt-1`}>
        {formattedCurrent}
      </p>
      <p className="text-stone-400 text-xs mt-1">nail-bite free</p>

      <div className="mt-4 pt-4 border-t border-stone-200 flex items-center justify-center gap-2 text-stone-500 text-sm">
        <Trophy size={14} className="text-amber-400" />
        <span>Best: <span className="text-amber-500 font-medium">{formattedBest || '—'}</span></span>
      </div>
    </div>
  );
}
