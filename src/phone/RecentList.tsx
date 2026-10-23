// "Today" and the last few entries. The pill colours are the ones History uses
// (src/pages/Log.tsx): red for a bite, calm green for an urge, amber for an
// alarm nobody has reviewed. Counts and labels come from ./history.ts.

import { useAppStore } from '../store/useAppStore';
import { useHistoryWindow } from '../billing/useFreeTier';
import { recentRows, todayCounts, todaySentence, whenLabel, type EntryKind } from './history';

const PILL: Record<EntryKind, string> = {
  bite: 'text-alert-600 dark:text-alert-400 bg-alert-100 dark:bg-alert-900/30 border-alert-400 dark:border-alert-800',
  urge: 'text-forest-700 dark:text-forest-300 bg-forest-50 dark:bg-forest-800/50 border-forest-300 dark:border-forest-700',
  alarm: 'text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700',
  // An alarm marked "Not a bite" (WS3): reviewed and not counted, so quiet, like History's muted label.
  dismissed: 'text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-ink-fill border-stone-200 dark:border-ink-400',
};

export function TodayLine() {
  const incidents = useAppStore(s => s.incidents);
  return <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">{todaySentence(todayCounts(incidents))}</p>;
}

export function RecentList({ onSeeAll }: { onSeeAll?: () => void }) {
  const incidents = useAppStore(s => s.incidents);
  const customTags = useAppStore(s => s.customTags);
  // A free account sees the last N days (WS9), here as in History; counts and the streak use everything.
  const { visible } = useHistoryWindow(incidents);
  const rows = recentRows(visible, customTags, 6);

  return (
    <section aria-labelledby="phone-recent">
      <div className="flex items-center justify-between gap-3">
        <h2 id="phone-recent" className="font-display text-lg font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">Recent</h2>
        {onSeeAll && rows.length > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="-mr-3 inline-flex min-h-11 items-center px-3 text-sm font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-400 dark:hover:text-forest-300"
          >
            All history
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-relaxed text-stone-600 dark:border-ink-400 dark:bg-ink-50 dark:text-stone-300">
          Nothing logged yet. Tap a button above when it happens.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white dark:divide-ink-400 dark:border-ink-400 dark:bg-ink-50">
          {rows.map(row => (
            <li key={row.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-semibold ${PILL[row.kind]}`}>{row.label}</span>
              <span className="ml-auto whitespace-nowrap text-right font-mono text-[13px] font-semibold tabular-nums text-stone-600 dark:text-stone-300">{whenLabel(row.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
