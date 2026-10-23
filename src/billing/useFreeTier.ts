// React side of the free tier. Everything is inert unless the signed-in account is in the free tier, which
// the server decides (shared/access.js: trial over, nothing paid, free_tier flag on).

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from '../store/useAppStore';
import { kv } from '../storage/kv';
import { addSeconds, limitReached, minutesUsed, secondsLeft, usageToday, visibleHistory, type FreeUsage } from './freeTier';

const KEY = 'free-usage';
const subscribe = (fn: () => void) => kv.subscribe('billing', KEY, fn);

function readUsage(): FreeUsage {
  return usageToday(kv.get<FreeUsage | null>('billing', KEY, null), new Date());
}

// useSyncExternalStore needs a stable snapshot: cache the parsed value until the stored one changes.
let cached: { raw: string; value: FreeUsage } | null = null;
function snapshot(): FreeUsage {
  const value = readUsage();
  const raw = `${value.day}|${value.seconds}`;
  if (!cached || cached.raw !== raw) cached = { raw, value };
  return cached.value;
}

export interface FreeTierState {
  /** The account is in the free tier right now. */
  active: boolean;
  limitMinutes: number;
  usedMinutes: number;
  secondsLeft: number;
  reached: boolean;
  historyDays: number | null;
}

export function useFreeTier(): FreeTierState {
  const { user, accessStatus } = useAuth();
  const usage = useSyncExternalStore(subscribe, snapshot, snapshot);
  const limits = accessStatus === 'free_tier' ? user?.entitlement?.free_tier : undefined;
  if (!limits) return { active: false, limitMinutes: 0, usedMinutes: 0, secondsLeft: 0, reached: false, historyDays: null };
  return {
    active: true,
    limitMinutes: limits.detection_minutes_per_day,
    usedMinutes: minutesUsed(usage),
    secondsLeft: secondsLeft(limits.detection_minutes_per_day, usage),
    reached: limitReached(limits.detection_minutes_per_day, usage),
    historyDays: limits.history_days,
  };
}

/**
 * Counts the seconds detection actually runs today and stops it when the day's allowance is used. One tick
 * a second; it writes at most once a second and only while detecting. Mounted once, by BillingHost.
 */
export function useFreeTierMeter(): void {
  const { active, limitMinutes } = useFreeTier();
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const usage = readUsage();
      if (limitReached(limitMinutes, usage)) {
        // Today's time is used: keep detection off (also when the person turns it back on).
        if (useAppStore.getState().cameraEnabled) useAppStore.getState().setCameraEnabled(false);
        return;
      }
      if (!useAppStore.getState().detecting) return;
      kv.set<FreeUsage>('billing', KEY, addSeconds(usage, 1, new Date()));
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, limitMinutes]);
}

/** The history a free account may see; every other account gets its list back unchanged (same array). */
export function useHistoryWindow<T extends { timestamp: number }>(entries: T[]): { visible: T[]; hidden: number } {
  const { active, historyDays } = useFreeTier();
  return active ? visibleHistory(entries, historyDays) : { visible: entries, hidden: 0 };
}
