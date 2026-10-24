import { Trophy } from 'lucide-react';
import { useStreak } from '../../hooks/useStreak';
import { useAppStore } from '../../store/useAppStore';
import { Rings } from '../site/Rings';
import { formatDate, formatTime } from '../../i18n/format';
import { useT } from '../../i18n/scopes/watch';

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

// Inside the sentence "today" and "yesterday" are words of the message (each language writes them
// its own way, in lowercase); any other day is a short date ("Fri, Sep 25").
function dayOf(timestamp: number): 'today' | 'yesterday' | 'date' {
  const day = new Date(timestamp).toDateString();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === now.toDateString()) return 'today';
  if (day === yesterday.toDateString()) return 'yesterday';
  return 'date';
}

export function StreakHero() {
  const t = useT();
  const { streakDays, streakHours, streakMinutes, formattedBest, isGreat } = useStreak();
  const lastBiteTime = useAppStore(s => s.lastBiteTime);
  // "00 : 00" alone did not say what it counts from; on a new account it
  // looked broken. Name the start, and what resets it.
  let since = t('streak.since.start');
  if (lastBiteTime) {
    const time = formatTime(lastBiteTime, { hour: '2-digit', minute: '2-digit' });
    const day = dayOf(lastBiteTime);
    since = day === 'today' ? t('streak.since.today', { time })
      : day === 'yesterday' ? t('streak.since.yesterday', { time })
      : t('streak.since.date', { date: formatDate(lastBiteTime, { weekday: 'short', month: 'short', day: 'numeric' }), time });
  }

  return (
    <div
      className="bite relative overflow-hidden bg-deep text-white rounded-[3rem] p-6 sm:p-8"
      data-tour="streak-card"
    >
      <Rings className="-bottom-52 -right-40 h-[28rem] w-[28rem]" />
      {/* Overline */}
      <div className="flex items-center gap-2 mb-6">
        <span className="w-2 h-2 rounded-full bg-lime-300 animate-pulse" />
        <p className="text-sm font-semibold text-white/90">
          {t('streak.title')}
        </p>
        {isGreat && (
          <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-bold text-deep">{t('streak.onARoll')}</span>
        )}
      </div>

      {/* Ticker */}
      <div className="relative flex items-start gap-3 sm:gap-5">
        {streakDays > 0 && (
          <>
            <Segment value={streakDays} label={t('streak.unit.days')} />
            <Colon />
          </>
        )}
        <Segment value={streakHours} label={t('streak.unit.hours')} />
        <Colon />
        <Segment value={streakMinutes} label={t('streak.unit.minutes')} />
      </div>
      <p className="relative mt-6 text-sm text-white/70">{since}</p>

      {/* Best streak */}
      <div className="mt-6 pt-5 border-t border-white/15 flex items-center gap-2 text-white/70 text-sm">
        <Trophy size={14} className="text-lime-300" />
        <span>
          {t.rich('streak.best', { value: formattedBest || t('streak.bestNone') }, {
            b: chunks => <span className="font-semibold text-white">{chunks}</span>,
          })}
        </span>
      </div>
    </div>
  );
}
