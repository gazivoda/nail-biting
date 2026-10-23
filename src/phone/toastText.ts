// The words of the confirmation after a log. Pure, so every state has a test.

import type { TagOption } from '../components/dashboard/triggerTags';
import type { LogToast } from './logFlow';

function triggerLabel(trigger: string, options: ReadonlyArray<TagOption>): string {
  return options.find(o => o.id === trigger)?.label ?? 'Not sure';
}

export function toastMessage(toast: LogToast | null, options: ReadonlyArray<TagOption>): string {
  if (!toast) return '';
  if (toast.kind === 'urge') return 'Urge logged. Your streak is not affected.';
  return toast.trigger === 'unknown'
    ? 'Bite logged. Your streak starts again from now.'
    : `Bite logged: ${triggerLabel(toast.trigger, options)}. Your streak starts again from now.`;
}
