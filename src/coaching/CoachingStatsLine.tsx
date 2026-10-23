// "How often did an alarm get a finished competing response?" (WS2). Shown only
// where the hrt_coaching flag is on (the Program page and the coaching settings
// card both sit behind it). Says nothing until there is something to say.

import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { toHabitEvent } from '../storage/eventModel';
import { coachingStats, formatRate } from '../utils/coachingStats';

export function CoachingStatsLine({ className = '' }: { className?: string }) {
  const incidents = useAppStore(s => s.incidents);
  const stats = useMemo(() => coachingStats(incidents.map(toHabitEvent)), [incidents]);
  const rate = formatRate(stats.rate);
  if (rate === null) return null;
  return (
    <p className={className}>
      <span className="font-semibold tabular-nums">{stats.completed} of {stats.alarms}</span>{' '}
      {stats.alarms === 1 ? 'alarm was' : 'alarms were'} followed by a finished competing response ({rate}).{' '}
      <span className="text-stone-500 dark:text-stone-400">
        Counted from your first prompt. Alarms that did not get a prompt count as not followed.
      </span>
    </p>
  );
}
