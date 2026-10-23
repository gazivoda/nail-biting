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
