import { useAppStore, isBite } from '../../store/useAppStore';
import { isPendingAlarm } from '../../storage/eventModel';
import { useT } from '../../i18n/scopes/watch';

export function TodayStats() {
  const t = useT();
  const { incidents } = useAppStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIncidents = incidents.filter(i => i.timestamp >= today.getTime());
  const incidentCount = todayIncidents.filter(isPendingAlarm).length; // a "Not a bite" alarm is reviewed, not pending
  const biteCount = todayIncidents.filter(isBite).length; // an urge-timer entry is not a bite

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-6 sm:p-7">
      <p className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-5">{t('today.title')}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-display text-[56px] font-extrabold tabular-nums tracking-[-0.04em] text-amber-700 dark:text-amber-400 leading-none">
            {incidentCount}
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">
            {t('today.alarms')}
          </p>
        </div>
        <div>
          <p className="font-display text-[56px] font-extrabold tabular-nums tracking-[-0.04em] text-alert-600 dark:text-alert-400 leading-none">
            {biteCount}
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">
            {t('today.bites')}
          </p>
        </div>
      </div>
    </div>
  );
}
