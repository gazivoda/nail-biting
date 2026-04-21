import { useStreak } from '../../hooks/useStreak';
import { Trophy } from 'lucide-react';

export function StreakCard() {
  const { formattedCurrent, formattedBest, isGood, isGreat } = useStreak();

  const streakColor = isGreat
    ? 'text-forest-600 dark:text-forest-400'
    : isGood
    ? 'text-forest-500 dark:text-forest-400'
    : 'text-stone-500 dark:text-stone-400';

  const dotColor = isGreat ? 'bg-forest-500' : isGood ? 'bg-forest-400' : 'bg-stone-400';

  // Ring glow around the card when streak is notable
  const ringClass = isGreat
    ? 'ring-2 ring-forest-400/50 dark:ring-forest-500/40 shadow-[0_0_24px_oklch(58%_0.130_148/0.20)]'
    : isGood
    ? 'ring-1 ring-forest-300/60 dark:ring-forest-600/40'
    : '';

  return (
    <div data-tour="streak-card" className={`bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-6 text-center shadow-card dark:shadow-card-dark transition-shadow duration-700 ${ringClass}`}>
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
        <p className="text-stone-400 dark:text-stone-500 text-xs uppercase tracking-[0.15em] font-medium">Current streak</p>
      </div>

      <p className={`text-5xl font-bold tabular-nums ${streakColor} mt-1 tracking-tight`}>
        {formattedCurrent}
      </p>
      <p className="text-stone-400 dark:text-stone-500 text-xs mt-1">nail-bite free</p>

      <div className="mt-4 pt-4 border-t border-stone-100 dark:border-ink-400 flex items-center justify-center gap-2 text-stone-500 dark:text-stone-400 text-sm">
        <Trophy size={14} className="text-amber-400" />
        <span>Best: <span className="text-amber-500 font-semibold">{formattedBest || '—'}</span></span>
      </div>
    </div>
  );
}
