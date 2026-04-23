import { Trophy } from 'lucide-react';
import { useStreak } from '../../hooks/useStreak';

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[64px]">
      <span className="font-mono text-[56px] font-medium leading-none tracking-[-2px] tabular-nums text-forest-700 dark:text-forest-300">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10.5px] font-medium tracking-[1.5px] uppercase text-stone-400 dark:text-stone-500 mt-1.5">
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <span className="font-mono text-[40px] font-light text-stone-300 dark:text-stone-600 leading-none self-start mt-1 select-none">
      :
    </span>
  );
}

export function StreakHero() {
  const { streakDays, streakHours, streakMinutes, formattedBest, isGreat } = useStreak();

  const ringClass = isGreat
    ? 'ring-2 ring-forest-400/40 dark:ring-forest-500/30 shadow-[0_0_24px_oklch(58%_0.130_148/0.15)]'
    : '';

  return (
    <div
      className={`bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] p-9 shadow-card dark:shadow-card-dark transition-shadow duration-700 ${ringClass}`}
      data-tour="streak-card"
    >
      {/* Overline */}
      <div className="flex items-center gap-2 mb-6">
        <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
        <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-stone-400 dark:text-stone-500">
          Current streak
        </p>
      </div>

      {/* Mono ticker */}
      <div className="flex items-start gap-4">
        {streakDays > 0 && (
          <>
            <Segment value={streakDays} label="days" />
            <Colon />
          </>
        )}
        <Segment value={streakHours} label="hrs" />
        <Colon />
        <Segment value={streakMinutes} label="min" />
      </div>

      {/* Best streak */}
      <div className="mt-6 pt-5 border-t border-stone-100 dark:border-ink-400 flex items-center gap-2 text-stone-500 dark:text-stone-400 text-sm">
        <Trophy size={14} className="text-amber-400" />
        <span>Best: <span className="text-amber-500 font-semibold">{formattedBest || '—'}</span></span>
      </div>
    </div>
  );
}
