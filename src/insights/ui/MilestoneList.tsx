// The five milestones: reached ones with their date and a way to open the card again, the rest with how far
// along they are. Always shown, even with an empty history, so a first visit has something real on it.

import { Check } from 'lucide-react';
import type { MilestoneStatus } from '../milestones';
import { formatDuration } from '../../utils/time';
import { formatCardDate } from '../shareCard';
import { useT } from '../../i18n/scopes/insights';
import { InsightCard } from './InsightCard';

export function MilestoneList({ statuses, onOpen }: { statuses: readonly MilestoneStatus[]; onOpen: (s: MilestoneStatus) => void }) {
  const t = useT();
  const progressText = (s: MilestoneStatus): string => {
    if (s.def.kind === 'count') return t('milestones.progressAlarms', { best: s.best, target: s.target });
    return s.best < 60_000
      ? t('milestones.progressUnderMinute', { target: formatDuration(s.target) })
      : t('milestones.progress', { best: formatDuration(s.best), target: formatDuration(s.target) });
  };
  return (
    <InsightCard title={t('milestones.title')} subtitle={t('milestones.subtitle')}>
      <ul className="m-0 list-none divide-y divide-stone-200 p-0 dark:divide-ink-400">
        {statuses.map(s => {
          const reached = s.reachedAt !== null;
          const fraction = Math.min(1, s.target > 0 ? s.best / s.target : 0);
          return (
            <li key={s.def.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
              <span
                aria-hidden="true"
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${reached ? 'bg-deep text-lime-300 dark:bg-lime-300 dark:text-deep' : 'border border-stone-300 text-transparent dark:border-ink-400'}`}
              >
                <Check size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{s.def.title}</p>
                {reached ? (
                  <p className="text-sm text-stone-600 dark:text-stone-300">{t('milestone.reached', { date: formatCardDate(s.reachedAt!) })}</p>
                ) : (
                  <>
                    <p className="text-sm text-stone-600 dark:text-stone-300">{progressText(s)}</p>
                    <div className="mt-1.5 h-1.5 max-w-xs rounded-full bg-stone-100 dark:bg-ink-fill" aria-hidden="true">
                      <div className="h-full rounded-full bg-forest-500 dark:bg-lime-300" style={{ width: `${Math.round(fraction * 100)}%` }} />
                    </div>
                  </>
                )}
              </div>
              {reached && (
                <button
                  type="button"
                  onClick={() => onOpen(s)}
                  className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
                >
                  {t('milestones.viewCard')}
                  <span className="sr-only">{t('milestones.viewCardFor', { title: s.def.title })}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </InsightCard>
  );
}
