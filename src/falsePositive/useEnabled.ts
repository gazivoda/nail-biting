// Whether the false-alarm controls are on, for screens that only need to know (History). Reads the cached
// flag and makes no request: the Dashboard's slot, which is always mounted for a signed-in person, has
// already asked (same pattern as useBehaviorFilterEnabled).

import { useSyncExternalStore } from 'react';
import { getFlags, subscribeFlags } from '../features/flags';

const snapshot = () => getFlags().false_positive_controls;

export function useFalsePositiveEnabled(): boolean {
  return useSyncExternalStore(subscribeFlags, snapshot, snapshot);
}
