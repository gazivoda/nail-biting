import { Trophy } from 'lucide-react';
import { useStreak } from '../../hooks/useStreak';
import { useAppStore } from '../../store/useAppStore';
import { formatDate, formatTime } from '../../utils/time';

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[52px] sm:min-w-[64px]">
      <span className="font-mono text-[44px] sm:text-[56px] font-medium leading-none tracking-[-2px] tabular-nums text-forest-700 dark:text-forest-300">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-xs font-medium text-stone-500 dark:text-stone-400 mt-1.5">
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <span className="font-mono text-[32px] sm:text-[40px] font-light text-stone-300 dark:text-stone-600 leading-none self-start mt-1 select-none">
      :
    </span>
  );
}

export function StreakHero() {
  const { streakDays, streakHours, streakMinutes, formattedBest, isGreat } = useStreak();
  const lastBiteTime = useAppStore(s => s.lastBiteTime);
  // "00 : 00" alone did not say what it counts from; on a new account it
  // looked broken. Name the start, and what resets it.
  const since = lastBiteTime
    ? `Since your last bite, ${formatDate(lastBiteTime)} at ${formatTime(lastBiteTime)}.`
    : "Since you started. A bite resets it; an alarm doesn't.";

  const ringClass = isGreat
    ? 'ring-2 ring-forest-400/40 dark:ring-forest-500/30 shadow-[0_0_24px_oklch(58%_0.130_148/0.15)]'
    : '';

  return (
    <div
      className={`bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] p-6 sm:p-7 shadow-card dark:shadow-card-dark transition-shadow duration-700 ${ringClass}`}
      data-tour="streak-card"
    >
      {/* Overline */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
        <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">
          Current streak
        </p>
      </div>

      {/* Mono ticker */}
      <div className="flex items-start gap-3 sm:gap-4">
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
      <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">{since}</p>

      {/* Best streak */}
      <div className="mt-6 pt-5 border-t border-stone-100 dark:border-ink-400 flex items-center gap-2 text-stone-500 dark:text-stone-400 text-sm">
        <Trophy size={14} className="text-amber-400" />
        <span>Best: <span className="font-semibold text-stone-800 dark:text-stone-100">{formattedBest || 'none yet'}</span></span>
      </div>
    </div>
  );
}
