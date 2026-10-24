// How long a plan or gift lasts, in words: "one year", "3 months", "45 days" (shared/plans.js describeDays() in the
// active language). Its own file, with the tiny `plans` scope, because PlanExtras (also on the marketing pricing page,
// in the main bundle) needs it and must not drag the whole billing scope along.
import { t } from '../i18n/scopes/plans';

export function describeLength(days: number): string {
  if (days % 365 === 0) return t('length.years', { count: days / 365 });
  if (days % 30 === 0) return t('length.months', { count: days / 30 });
  return t('length.days', { count: days });
}
