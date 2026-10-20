// Local design preview. Only ever loaded by a dynamic import behind
// `import.meta.env.DEV` in AuthContext, so none of this reaches a production
// build. Open the app with ?preview=trial, ?preview=subscribed or
// ?preview=paywall on the Vite dev server to see the signed-in screens with
// fixture data, without a Google session.
import { useAppStore, computeBestStreak } from '../store/useAppStore';
import type { UserProfile } from '../types/access';
import type { Incident } from '../types';

export type PreviewKind = 'trial' | 'subscribed' | 'paywall';

const DAY = 24 * 60 * 60 * 1000;

export function previewKind(search: string): PreviewKind | null {
  const k = new URLSearchParams(search).get('preview');
  return k === 'trial' || k === 'subscribed' || k === 'paywall' ? k : null;
}

export function previewUser(kind: PreviewKind): UserProfile {
  const base = { id: 'preview', email: 'alex@example.com', name: 'Alex Preview', avatar: null, paddle_subscription_id: null, paddle_customer_id: null };
  if (kind === 'subscribed') {
    return { ...base, trial_end_date: null, subscription_status: 'active', subscription_plan: 'yearly', subscription_end_date: new Date(Date.now() + 200 * DAY).toISOString() };
  }
  if (kind === 'paywall') {
    return { ...base, trial_end_date: new Date(Date.now() - 2 * DAY).toISOString(), subscription_status: 'expired', subscription_plan: null, subscription_end_date: null };
  }
  return { ...base, trial_end_date: new Date(Date.now() + 2 * DAY).toISOString(), subscription_status: 'trial', subscription_plan: null, subscription_end_date: null };
}

/** A believable fortnight of history, once, if the store is empty. */
export function seedPreviewData(): void {
  if (useAppStore.getState().incidents.length > 0) return;
  const now = Date.now();
  const tags = ['auto-detected', 'stress', 'focus', 'boredom', 'unknown'];
  const incidents: Incident[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let d = 12; d >= 0; d--) {
    const n = d < 2 ? 1 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const ts = now - d * DAY - Math.floor(rnd() * 11 * 60 * 60 * 1000) - 40 * 60 * 1000;
      if (ts > now - 3 * 60 * 60 * 1000) continue;
      const auto = rnd() > 0.35;
      incidents.push({
        id: `p${d}-${k}`,
        timestamp: ts,
        tag: auto ? 'auto-detected' : tags[1 + Math.floor(rnd() * 4)],
        autoDetected: auto,
        confirmed: auto ? rnd() > 0.4 : undefined,
      });
    }
  }
  incidents.sort((a, b) => b.timestamp - a.timestamp);
  const historyStartTime = now - 13 * DAY;
  const bites = incidents.filter(i => !i.autoDetected || i.confirmed);
  useAppStore.setState({
    incidents,
    historyStartTime,
    firstOpenTime: historyStartTime,
    lastBiteTime: bites.length ? bites[0].timestamp : null,
    bestStreakMs: computeBestStreak(incidents, historyStartTime),
  });
}
