import { useEffect, useSyncExternalStore } from 'react';
import { ensureFlags, getFlags, subscribeFlags, type FeatureName, type FlagMap } from './flags';

/**
 * Whether a feature is switched on. False while unknown (first visit, offline
 * with nothing cached), then the server's answer. Re-renders when it changes.
 *
 *   const sync = useFeature('event_sync');
 *   if (!sync) return null;
 *
 * Mounting any component that uses this triggers one /api/features request per
 * page load (plus a re-check every few minutes). Pages that never read a flag
 * never make the request.
 */
export function useFeature(name: FeatureName): boolean {
  useEffect(() => { ensureFlags(); }, []);
  return useSyncExternalStore(subscribeFlags, () => getFlags()[name], () => false);
}

/** The whole map, for components that read several flags (the Settings renderer). */
export function useFeatures(): FlagMap {
  useEffect(() => { ensureFlags(); }, []);
  return useSyncExternalStore(subscribeFlags, getFlags, getFlags);
}
