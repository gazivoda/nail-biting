import type { KeyboardEvent } from 'react';

/**
 * Arrow-key behaviour for a role="radiogroup": one Tab stop (the checked
 * radio, via `radioTabIndex`), and the arrows move to and pick the next or
 * previous option, wrapping at the ends. What screen reader users expect
 * once they hear "radio group".
 */
export function radioGroupKeyDown<T>(
  e: KeyboardEvent<HTMLElement>,
  values: readonly T[],
  current: T,
  onChange: (v: T) => void,
) {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
    : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
    : 0;
  if (!step) return;
  e.preventDefault();
  const i = Math.max(0, values.indexOf(current));
  const next = (i + step + values.length) % values.length;
  onChange(values[next]);
  e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
}

export const radioTabIndex = (checked: boolean) => (checked ? 0 : -1);
