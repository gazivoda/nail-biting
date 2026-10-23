import { t } from '../i18n/scopes/billing';

// How much of the free trial is left, in the words every screen uses. Days
// were rounded up, so the last minutes of a trial still read "1 day
// remaining" and the paywall arrived without warning. Inside the last day
// the count switches to hours.
export function trialLeft(trialEndIso: string | null | undefined, now = Date.now()): string | null {
  if (!trialEndIso) return null;
  const ms = new Date(trialEndIso).getTime() - now;
  if (!(ms > 0)) return null;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (ms >= day) {
    const days = Math.ceil(ms / day);
    return t('trial.left.days', { count: days });
  }
  if (ms >= hour) {
    const hours = Math.floor(ms / hour);
    return t('trial.left.hours', { count: hours });
  }
  return t('trial.left.underHour');
}

// The line on the paywall after a trial ends. It reports only what the device
// logged: every incident in the history is an alert the alarm raised or one the
// user logged by hand, so the count is called alerts, never "bites", which
// would claim they were all real. With nothing logged there is nothing to say,
// and no number is invented.
export function trialEndedMessage(alertCount: number): string {
  if (!Number.isFinite(alertCount) || alertCount < 1) return t('trial.ended.none');
  return t('trial.ended.logged', { count: Math.floor(alertCount) });
}
