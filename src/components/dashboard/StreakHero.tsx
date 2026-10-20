import { Trophy } from 'lucide-react';
import { useStreak } from '../../hooks/useStreak';
import { useAppStore } from '../../store/useAppStore';
import { Rings } from '../site/Rings';
import { formatDate, formatTime } from '../../utils/time';

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-start min-w-[64px] sm:min-w-[96px]">
      <span className="font-display text-[64px] sm:text-[92px] font-extrabold leading-[0.85] tracking-[-0.05em] tabular-nums text-white">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-lime-300 mt-3">
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <span className="font-display text-[48px] sm:text-[68px] font-bold text-white/25 leading-[0.85] select-none">
      :
    </span>
  );
}

// formatDate says "Today"/"Yesterday" for headings; inside a sentence they
// are lowercase. Dates ("Fri, Sep 25") stay as they are.
const midSentence = (day: string) => (/^(Today|Yesterday)$/.test(day) ? day.toLowerCase() : day);

export function StreakHero() {
  const { streakDays, streakHours, streakMinutes, formattedBest, isGreat } = useStreak();
  const lastBiteTime = useAppStore(s => s.lastBiteTime);
  // "00 : 00" alone did not say what it counts from; on a new account it
  // looked broken. Name the start, and what resets it.
  const since = lastBiteTime
    ? `Since your last bite, ${midSentence(formatDate(lastBiteTime))} at ${formatTime(lastBiteTime)}.`
    : "Since you started. A bite resets it; an alarm doesn't.";

  return (
    <div
      className="bite relative overflow-hidden bg-deep text-white rounded-3xl p-6 sm:p-8 [--bite:44px]"
      data-tour="streak-card"
    >
      <Rings className="-bottom-52 -right-40 h-[28rem] w-[28rem]" />
      {/* Overline */}
      <div className="flex items-center gap-2 mb-6">
        <span className="w-2 h-2 rounded-full bg-lime-300 animate-pulse" />
        <p className="text-sm font-semibold text-white/90">
          Current streak
        </p>
        {isGreat && (
          <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-bold text-deep">On a roll</span>
        )}
      </div>

      {/* Ticker */}
      <div className="relative flex items-start gap-3 sm:gap-5">
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
      <p className="relative mt-6 text-sm text-white/70">{since}</p>

      {/* Best streak */}
      <div className="mt-6 pt-5 border-t border-white/15 flex items-center gap-2 text-white/70 text-sm">
        <Trophy size={14} className="text-lime-300" />
        <span>Best: <span className="font-semibold text-white">{formattedBest || 'none yet'}</span></span>
      </div>
    </div>
  );
}
