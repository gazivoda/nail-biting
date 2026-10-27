// In-app milestones for the funnel, sent through the same `track()` as the
// marketing events: aggregate counts to the Google Analytics that index.html
// already loads, with NO parameters at all. Not a count, a time, a duration or a
// label, and nothing derived from the habit log. Each call says only "this
// happened", so it cannot identify a person or describe what the camera saw.
//
//   signin_complete   a person has just signed in on this device. No flag: it is
//                     about the account, not the camera, and the Privacy Policy
//                     already covers Google Analytics counting visits.
//   detection_start   (flag app_analytics) detection really started with the camera on.
//   first_alarm       (flag app_analytics) the habit detector fired for the first time on this device.
//
// The last two are signals from the camera and the habit detector, even without
// parameters, and the Privacy Policy says Google Analytics "never receives
// anything from your camera or your habit log". So they ship OFF behind the
// `app_analytics` flag until the owner has approved and published the new wording
// (docs/agents/legal/in-app-analytics-privacy.md). With the flag off `trackApp`
// sends nothing and touches no storage.

import { track } from './track';
import { isFeatureOn } from '../features/flags';
import { kv } from '../storage/kv';

/**
 * Whether this applyUser call is a sign-in that has just finished on this device:
 * the server confirmed the session AND this browser had no session marker yet.
 * Records the marker either way (what AuthProvider always did), so the second
 * call for the same browser (StrictMode's double effect, `refreshProfile`, the
 * next page load) answers false. Sign-out clears the marker, so signing in again
 * counts again, which is correct.
 *
 * `serverConfirmed` is false for the offline grant and the dev preview: neither
 * is a sign-in.
 */
export function claimFreshSignIn(
  store: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  serverConfirmed: boolean,
): boolean {
  const hadSession = !!store.getItem(key);
  store.setItem(key, '1');
  return serverConfirmed && !hadSession;
}

/**
 * Sends `signin_complete`. Safe at any time: index.html queues `gtag` calls from the first line of the head (before
 * the gtag.js download), so the session lookup finishing before the window's load event loses nothing.
 */
export function trackSignInComplete(): void {
  try {
    track('signin_complete');
  } catch {
    // Analytics must never break sign-in.
  }
}

/** The two milestones that come from the camera and the detector. Both are behind the `app_analytics` flag. */
export type AppEvent = 'detection_start' | 'first_alarm';

// Names already sent in this page load. `detection_start` is once per page session; it also stops
// StrictMode's double effect and a pause/resume from sending twice.
const sentThisPage = new Set<AppEvent>();

// Marks that this device has sent `first_alarm`. A flag, never a count or a time. `kv` never throws and, when
// storage is blocked, keeps the value in memory for the page, so a blocked store means once per page load.
const FIRST_ALARM_SENT = 'first-alarm-sent';

/**
 * Sends `detection_start` or `first_alarm` to Google Analytics, and only while the `app_analytics` flag is on.
 *
 * - Flag off (or not known yet, which reads as off): returns before touching anything. Nothing is sent, nothing is
 *   written, so a device that used the app flag-off still sends its first alarm after the owner turns the flag on.
 * - `detection_start`: at most once per page load.
 * - `first_alarm`: at most once per device, and the marker is written only after it was sent.
 * - No parameters, ever: `track(name)` is called with the name alone. Nothing about the log, the time, how long
 *   detection ran or what the camera saw is an argument here, so none can be sent.
 *
 * The flag is read from the cached `/api/features` answer (`isFeatureOn`), not a hook, because the callers are an
 * effect and the detector's alert callback. It does not ask the server: the Watch tab's own flag reads do that,
 * seconds before the models have loaded. If that answer has not arrived yet the event is dropped, an undercount.
 */
export function trackApp(name: AppEvent): void {
  try {
    if (!isFeatureOn('app_analytics')) return;
    if (sentThisPage.has(name)) return;
    if (name === 'first_alarm' && kv.get<boolean>('app', FIRST_ALARM_SENT, false) === true) {
      sentThisPage.add(name);
      return;
    }
    track(name);
    sentThisPage.add(name);
    if (name === 'first_alarm') kv.set('app', FIRST_ALARM_SENT, true);
  } catch {
    // Analytics must never break detection or the alarm.
  }
}

/** Tests only: forget what this page load has already sent. */
export function resetAppAnalyticsForTests(): void {
  sentThisPage.clear();
}
