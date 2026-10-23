// Names and short phrases for the Insights charts. Pure, so they are tested without React.

import type { CustomTag } from '../types';

/** The label for a stored trigger tag, in the words the tag picker uses. */
export function triggerLabel(tag: string, customTags: readonly CustomTag[] = []): string {
  switch (tag) {
    case 'stress': return 'Stress';
    case 'focus': return 'Deep focus';
    case 'boredom': return 'Boredom';
    case 'unknown': return 'Not sure';
    case 'auto-detected': return 'No reason picked';
    default: {
      const custom = customTags.find(t => t.id === tag);
      // A custom reason made on another device arrives with its id only.
      return custom ? [custom.emoji, custom.label].filter(Boolean).join(' ') : 'Another reason';
    }
  }
}

/** Heatmap rows, Monday first. */
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** 0 -> "12 am", 9 -> "9 am", 13 -> "1 pm". */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`;
}

/** 9 -> "9 to 10 am", 11 -> "11 am to 12 pm". */
export function hourSpan(hour: number): string {
  const start = hourLabel(hour);
  const end = hourLabel(hour + 1);
  const [sn, sp] = start.split(' ');
  const [en, ep] = end.split(' ');
  return sp === ep ? `${sn} to ${en} ${ep}` : `${sn} ${sp} to ${en} ${ep}`;
}

export function plural(n: number, one: string, many: string = `${one}s`): string {
  return n === 1 ? one : many;
}
