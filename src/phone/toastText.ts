// The words of the confirmation after a log. Pure, so every state has a test.

import type { TagOption } from '../components/dashboard/triggerTags';
import type { LogToast } from './logFlow';
import { t } from '../i18n/scopes/phone';
import { t as tc } from '../i18n/scopes/labels';

function triggerLabel(trigger: string, options: ReadonlyArray<TagOption>): string {
  return options.find(o => o.id === trigger)?.label ?? tc('tag.unknown');
}

export function toastMessage(toast: LogToast | null, options: ReadonlyArray<TagOption>): string {
  if (!toast) return '';
  if (toast.kind === 'urge') return t('toast.urge');
  return toast.trigger === 'unknown'
    ? t('toast.bite')
    : t('toast.biteWith', { reason: triggerLabel(toast.trigger, options) });
}
