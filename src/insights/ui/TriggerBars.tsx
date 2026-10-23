// What sets it off: one horizontal bar per trigger, longest first.

import type { TriggerBreakdown } from '../aggregate';
import { triggerLabel } from '../labels';
import type { CustomTag } from '../../types';

const MAX_ROWS = 8;

export function TriggerBars({ breakdown, customTags }: { breakdown: TriggerBreakdown; customTags: readonly CustomTag[] }) {
  const shown = breakdown.items.slice(0, MAX_ROWS);
  const rest = breakdown.items.slice(MAX_ROWS);
  const max = shown.reduce((m, i) => (i.count > m ? i.count : m), 0);
  return (
    <div>
      <ul className="m-0 list-none space-y-3 p-0">
        {shown.map(item => (
          <li key={item.tag}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-stone-800 dark:text-stone-100">{triggerLabel(item.tag, customTags)}</span>
              <span className="shrink-0 tabular-nums text-stone-600 dark:text-stone-300">
                {item.count} <span aria-hidden="true">({Math.round(item.share * 100)}%)</span>
                <span className="sr-only">, {Math.round(item.share * 100)} percent</span>
              </span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-stone-100 dark:bg-ink-fill" aria-hidden="true">
              <div className="h-full rounded-full bg-forest-500 dark:bg-lime-300" style={{ width: `${Math.max(3, (item.count / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
          and {rest.length} more, {rest.reduce((n, i) => n + i.count, 0)} bites in all.
        </p>
      )}
    </div>
  );
}
