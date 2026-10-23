// React hooks over the behaviour selection.
//
//   useActiveBehaviors()     what the detector should run right now (CameraView)
//   useBehaviorSettings()    the Settings > Behaviors list
//
// Flags are read WITHOUT triggering a fetch (getFlags / subscribeFlags, not
// useFeature), so the Watch tab makes no new request when every flag is off. A
// non-default selection can only exist because the user opened Settings while
// `detection_behaviors` was on, which fetched the flags and cached them. For
// those users, and only those, the Watch tab asks for fresh flags (at most every
// ten minutes, via ensureFlags), so switching a flag off on the server reaches
// a device that is already detecting.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ensureFlags, getFlags, subscribeFlags } from '../features/flags';
import { useFeatures } from '../features/useFeature';
import type { Behavior } from '../storage/eventModel';
import {
  effectiveBehaviors,
  isNonDefaultSelection,
  normalizeSelection,
  toggleBehavior,
  visibleBehaviors,
  DEFAULT_BEHAVIORS,
  type BehaviorInfo,
} from './registry.ts';
import { readStoredBehaviors, subscribeStoredBehaviors, writeStoredBehaviors } from './selection';

// useSyncExternalStore compares snapshots with Object.is, so the snapshots are strings,
// never fresh arrays (a fresh array each call would re-render forever).
const storedSnapshot = () => JSON.stringify(readStoredBehaviors() ?? null);
const flagsSnapshot = () => {
  const f = getFlags();
  return `${f.detection_behaviors ? 1 : 0}${f.experimental ? 1 : 0}`;
};

function useStoredJson(): string {
  return useSyncExternalStore(subscribeStoredBehaviors, storedSnapshot, storedSnapshot);
}

/** The behaviours the detector should watch for now: stable between renders unless they change. */
export function useActiveBehaviors(): readonly Behavior[] {
  const storedJson = useStoredJson();
  const flagKey = useSyncExternalStore(subscribeFlags, flagsSnapshot, flagsSnapshot);

  useEffect(() => {
    if (isNonDefaultSelection(JSON.parse(storedJson))) ensureFlags();
  }, [storedJson]);

  return useMemo(
    () => effectiveBehaviors(
      { detectionBehaviors: flagKey[0] === '1', experimental: flagKey[1] === '1' },
      JSON.parse(storedJson),
    ),
    [storedJson, flagKey],
  );
}

const filterFlagSnapshot = () => getFlags().detection_behaviors;

/**
 * Whether History may offer the per-behaviour filter (the `detection_behaviors` flag). Reads the
 * cached flag and makes no request: more than one behaviour can only be in a history if the
 * user chose it in Settings, which fetched the flags.
 */
export function useBehaviorFilterEnabled(): boolean {
  return useSyncExternalStore(subscribeFlags, filterFlagSnapshot, filterFlagSnapshot);
}

export interface BehaviorSettings {
  /** What the list may show, in order. */
  visible: BehaviorInfo[];
  /** Which of those are on. */
  selected: Behavior[];
  /** Turn one on or off. The last one cannot be turned off. */
  setBehavior: (id: Behavior, on: boolean) => void;
}

export function useBehaviorSettings(): BehaviorSettings {
  const storedJson = useStoredJson();
  const experimental = useFeatures().experimental;

  return useMemo(() => {
    const options = { experimental };
    const stored = JSON.parse(storedJson);
    const normalized = normalizeSelection(stored, options);
    const selected = normalized.length > 0 ? normalized : [...DEFAULT_BEHAVIORS];
    return {
      visible: visibleBehaviors(options),
      selected,
      setBehavior: (id: Behavior, on: boolean) => {
        writeStoredBehaviors(toggleBehavior(selected, id, on, options));
      },
    };
  }, [storedJson, experimental]);
}
