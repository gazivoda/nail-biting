// Names and short phrases for the Insights charts. Pure, so they are tested without React.
// Every function reads the language when it is called (nothing here is computed at module level).

import type { CustomTag } from '../types';
import { t as tc } from '../i18n/scopes/common';
import { t } from '../i18n/scopes/insights';
import { formatDatePattern } from '../i18n/format';
import { hourLabel, hourRange } from '../utils/insights';

/** What the charts count: confirmed and logged bites, or every alarm and bite. */
export type Series = 'bites' | 'entries';

/** The label for a stored trigger tag, in the words the tag picker uses. */
export function triggerLabel(tag: string, customTags: readonly CustomTag[] = []): string {
  switch (tag) {
    case 'stress': return tc('tag.stress');
    case 'focus': return tc('tag.focus');
    case 'boredom': return tc('tag.boredom');
    case 'unknown': return tc('tag.unknown');
    case 'auto-detected': return t('label.noReason');
    default: {
      const custom = customTags.find(c => c.id === tag);
      // A custom reason made on another device arrives with its id only.
      return custom ? [custom.emoji, custom.label].filter(Boolean).join(' ') : t('label.otherReason');
    }
  }
}

/** Heatmap rows are 0..6, Monday first. */
export const WEEKDAY_ROWS = [0, 1, 2, 3, 4, 5, 6] as const;
const monday = (row: number) => new Date(2024, 0, 1 + row); // 1 January 2024 is a Monday
/** "Mon" (English), "lun" (es), "Mo." (de). */
export const weekdayShort = (row: number): string => formatDatePattern(monday(row), 'EEE', { weekday: 'short' });
/** "Monday" (English), "lunes" (es), "Montag" (de). */
export const weekdayLong = (row: number): string => formatDatePattern(monday(row), 'EEEE', { weekday: 'long' });

/** 0 -> "12 am", 9 -> "9 am", 13 -> "1 pm" (English); "09:00" in the other languages. */
export { hourLabel };

/** 9 -> "9 to 10 am", 11 -> "11 am to 12 pm". The same words History uses for "Most bites". */
export const hourSpan = hourRange;

/** "1 bite", "3 bites" / "1 entry", "3 entries". */
export function countPhrase(series: Series, count: number): string {
  return t(series === 'bites' ? 'count.bites' : 'count.entries', { count });
}
