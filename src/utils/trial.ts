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
