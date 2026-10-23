// Spots a NEW alarm in the history (WS2). Pure.
//
// The coaching prompt is keyed on "an alarm event just appeared", not on the
// detector's status. That is deliberate:
//  - the alarm itself is sounded by useDetection.startBiting before it calls
//    onAlert -> logIncident, so by the time the history changes the sound is
//    already playing and nothing here can delay or silence it;
//  - the detector's `alert` status (and the flash overlay) end ~300 ms after
//    the hand leaves the mouth, but a 15-60 s countdown must outlive that;
//  - sound-only users never see the flash, but they have the same history.

/** An alarm older than this is history, not "just now" (a restored or synced event). */
export const FRESH_ALARM_MS = 5000;

export interface WatchedEvent {
  id: string;
  timestamp: number;
  autoDetected: boolean;
}

/**
 * The newest alarm in `incidents` (newest first, as the store keeps them), if it
 * is one we have not offered coaching for (`seenId`) and was logged just now.
 */
export function newestFreshAlarm(
  incidents: readonly WatchedEvent[],
  seenId: string | null,
  now: number,
): WatchedEvent | null {
  const alarm = incidents.find(i => i.autoDetected);
  if (!alarm || alarm.id === seenId) return null;
  const age = now - alarm.timestamp;
  return age >= -FRESH_ALARM_MS && age <= FRESH_ALARM_MS ? alarm : null;
}

/** The id to treat as already seen when the watcher starts, so old alarms never prompt. */
export function newestAlarmId(incidents: readonly WatchedEvent[]): string | null {
  return incidents.find(i => i.autoDetected)?.id ?? null;
}
