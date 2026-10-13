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
    return `${days} day${days !== 1 ? 's' : ''} left`;
  }
  if (ms >= hour) {
    const hours = Math.floor(ms / hour);
    return `${hours} hour${hours !== 1 ? 's' : ''} left`;
  }
  return 'Less than an hour left';
}

// The line on the paywall after a trial ends. It reports only what the device
// logged: every incident in the history is an alert the alarm raised or one the
// user logged by hand, so the count is called alerts, never "bites", which
// would claim they were all real. With nothing logged there is nothing to say,
// and no number is invented.
export function trialEndedMessage(alertCount: number): string {
  const base = 'Your free trial has ended.';
  if (!Number.isFinite(alertCount) || alertCount < 1) {
    return `${base} Your history is still saved on this device.`;
  }
  const n = Math.floor(alertCount);
  return `${base} It logged ${n} alert${n === 1 ? '' : 's'}, and your history is still saved on this device.`;
}
