// Which behaviours the user chose to monitor. Stored through the storage module's
// key-value area (kv namespace "detection", key "behaviors"), a JSON list of
// behaviour names. Not in the app store: ARCHITECTURE.md section 4 says new
// settings go through `kv` and persisted state is not reshaped.
//
// Nothing stored means the default, nail biting alone. The stored list is only
// ever read through effectiveBehaviors() (registry.ts), which also checks the
// feature flags, so a stored choice cannot change what the detector does while
// `detection_behaviors` is off.

import { kv } from '../storage/kv';
import type { Behavior } from '../storage/eventModel';

const NAMESPACE = 'detection' as const;
const KEY = 'behaviors';

/** Whatever is stored, unvalidated (it may be missing, old, or edited by hand). */
export function readStoredBehaviors(): unknown {
  return kv.get<unknown>(NAMESPACE, KEY, null);
}

/** Returns false when the browser refused to store it. */
export function writeStoredBehaviors(list: readonly Behavior[]): boolean {
  return kv.set(NAMESPACE, KEY, [...list]);
}

/** Calls `fn` after every change made on this page. Returns an unsubscribe. */
export function subscribeStoredBehaviors(fn: () => void): () => void {
  return kv.subscribe(NAMESPACE, KEY, fn);
}
