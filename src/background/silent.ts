// "Is meeting mode on right now?" for code that is not a React component (the alarm in useDetection.ts).
// False whenever the `background_watching` flag is off, and then nothing else here is even read, so the flag-off
// app takes exactly the path it always took. Light on purpose: flags + the watch store, no React, no app store,
// because the landing-page demo shares useDetection.

import { isFeatureOn } from '../features/flags';
import { getWatchState } from './watchStore';
import { isSilent } from './pauseMachine';

export function silentNow(): boolean {
  return isFeatureOn('background_watching') && isSilent(getWatchState());
}

/**
 * True while the person has paused or is in a meeting: the periodic "Hands check" nudges (useNotifications.ts) stay
 * quiet too, because a pause that still buzzes is not a pause. False whenever the flag is off.
 */
export function quietNow(): boolean {
  if (!isFeatureOn('background_watching')) return false;
  const kind = getWatchState().kind;
  return kind === 'paused' || kind === 'meeting';
}
