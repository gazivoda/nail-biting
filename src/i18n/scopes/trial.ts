// Scope "trial": how much of the free trial is left, in the words every screen uses (src/utils/trial.ts). Its own tiny scope because the tab bar (main bundle) imports it; the big billing scope stays in the paywall chunk.
import { createScope } from '../scope.ts';

export const messages = {
  'trial.left.days': '{count, plural, one {{count} day left} other {{count} days left}}',
  'trial.left.hours': '{count, plural, one {{count} hour left} other {{count} hours left}}',
  'trial.left.underHour': 'Less than an hour left',
  'trial.ended.none': 'Your free trial has ended. Your history is still saved on this device.',
  'trial.ended.logged': 'Your free trial has ended. It logged {count, plural, one {{count} alert} other {{count} alerts}}, and your history is still saved on this device.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('trial', messages);
