// "How often did an alarm get a finished competing response?" (WS2). Shown only
// where the hrt_coaching flag is on (the Program page and the coaching settings
// card both sit behind it). Says nothing until there is something to say.

import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { toHabitEvent } from '../storage/eventModel';
import { coachingStats, formatRate } from '../utils/coachingStats';
import { useT } from '../i18n/scopes/coaching';

export function CoachingStatsLine({ className = '' }: { className?: string }) {
  const t = useT();
  const incidents = useAppStore(s => s.incidents);
  const stats = useMemo(() => coachingStats(incidents.map(toHabitEvent)), [incidents]);
  const rate = formatRate(stats.rate);
  if (rate === null) return null;
  return (
    <p className={className}>
      {t.rich(
        'stats.line',
        { completed: stats.completed, alarms: stats.alarms, rate },
        { b: chunks => <span className="font-semibold tabular-nums">{chunks}</span> },
      )}{' '}
      <span className="text-stone-500 dark:text-stone-400">{t('stats.note')}</span>
    </p>
  );
}
