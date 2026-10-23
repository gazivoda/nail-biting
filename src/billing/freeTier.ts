// The free tier's two limits, as plain functions (flag free_tier; the numbers are the owner's, set on the
// server with FREE_TIER_DETECTION_MINUTES and FREE_TIER_HISTORY_DAYS and delivered in
// user.entitlement.free_tier, see shared/plans.js). OWNER DECISION PENDING: the defaults are placeholders.
//
//   * Detection time per day: counted on this device (detection runs here, so the server cannot count it).
//     A person who clears their browser data or uses another browser gets a fresh allowance; that is a
//     known limit of enforcing it locally, and acceptable for a free tier.
//   * History: the History screen lists the last `historyDays` days. Older entries stay on the device,
//     untouched, and come back into view with a plan. Streaks and statistics always use everything.
//
// Nothing here touches the store or storage; the hooks that do are in useFreeTier.ts.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FreeUsage {
  /** The local calendar day the seconds were counted on, "2026-10-23". */
  day: string;
  seconds: number;
}

export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The usage for today: yesterday's count does not carry over. */
export function usageToday(stored: FreeUsage | null | undefined, now: Date): FreeUsage {
  const day = dayKey(now);
  if (!stored || stored.day !== day || !Number.isFinite(stored.seconds) || stored.seconds < 0) return { day, seconds: 0 };
  return stored;
}

export function addSeconds(stored: FreeUsage | null | undefined, seconds: number, now: Date): FreeUsage {
  const today = usageToday(stored, now);
  return { day: today.day, seconds: today.seconds + seconds };
}

export function minutesUsed(usage: FreeUsage): number {
  return Math.floor(usage.seconds / 60);
}

export function secondsLeft(limitMinutes: number, usage: FreeUsage): number {
  return Math.max(0, limitMinutes * 60 - usage.seconds);
}

export function limitReached(limitMinutes: number, usage: FreeUsage): boolean {
  return secondsLeft(limitMinutes, usage) <= 0;
}

/**
 * The part of the history a free account sees. Entries older than `historyDays` are counted, not shown.
 * `entries` is returned as the same array when nothing is hidden.
 */
export function visibleHistory<T extends { timestamp: number }>(
  entries: T[], historyDays: number | null | undefined, now = Date.now(),
): { visible: T[]; hidden: number } {
  if (!historyDays || historyDays < 1) return { visible: entries, hidden: 0 };
  const cutoff = now - historyDays * DAY_MS;
  const visible = entries.filter(e => e.timestamp >= cutoff);
  return visible.length === entries.length ? { visible: entries, hidden: 0 } : { visible, hidden: entries.length - visible.length };
}
