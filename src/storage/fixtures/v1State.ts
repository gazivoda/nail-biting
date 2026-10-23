// Fixtures: what the app wrote to localStorage['stop-biting-state'] BEFORE event
// schema v2 (STATE_VERSION 1), captured field for field from the v1 store. Used
// only by tests. Do not "modernise" these: their whole value is that they are
// the old shape.
//
// The persisted payload is { state, version }. `state` is the store minus the
// three keys `partialize` drops (cameraEnabled, showCameraFeed, detecting) and
// minus the action functions. Incidents are stored newest first.

import { computeBestStreak, isBite } from '../../store/useAppStore';

export const DAY = 24 * 60 * 60 * 1000;
export const T0 = 1_760_000_000_000; // an arbitrary fixed "install day"

type V1Incident = { id: string; timestamp: number; tag: string; autoDetected: boolean; confirmed?: boolean };

/** Everything v1 persisted, with defaults matching a fresh install. */
export function v1State(over: Record<string, unknown> = {}): Record<string, unknown> {
  const incidents = (over.incidents ?? []) as V1Incident[];
  const firstOpenTime = (over.firstOpenTime as number | undefined) ?? T0;
  const historyStartTime = (over.historyStartTime as number | undefined) ?? firstOpenTime;
  const bites = incidents.filter(isBite as (i: V1Incident) => boolean);
  return {
    incidents,
    firstOpenTime,
    historyStartTime,
    lastBiteTime: bites.length > 0 ? bites[0].timestamp : null,
    bestStreakMs: computeBestStreak(incidents, historyStartTime),
    bestStreakFloorMs: 0,
    detectionSensitivity: 'medium',
    alertType: 'both',
    alertSound: 'alarm',
    alertVolume: 0.8,
    remindersEnabled: false,
    reminderIntervalMinutes: 15,
    theme: 'system',
    customTags: [],
    weekChartMetric: 'incidents',
    ...over,
  };
}

/** The exact string zustand's persist middleware would have stored. */
export function persistedJson(state: Record<string, unknown>, version = 1): string {
  return JSON.stringify({ state, version });
}

// ── A realistic history: manual logs, tags, custom tags, alarms in every review
// state, and a streak with gaps (a quiet fortnight in the middle). ────────────

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function basicIncidents(): V1Incident[] {
  const list: V1Incident[] = [
    // Newest first, as stored.
    { id: id(11), timestamp: T0 + 40 * DAY + 3_600_000, tag: 'stress', autoDetected: false },
    { id: id(10), timestamp: T0 + 40 * DAY, tag: 'auto-detected', autoDetected: true },                    // pending alarm
    { id: id(9),  timestamp: T0 + 39 * DAY, tag: 'custom-ab12cd34', autoDetected: false },                 // custom reason
    { id: id(8),  timestamp: T0 + 38 * DAY + 7_200_000, tag: 'boredom', autoDetected: true, confirmed: true }, // confirmed alarm with a trigger
    { id: id(7),  timestamp: T0 + 38 * DAY, tag: 'auto-detected', autoDetected: true, confirmed: true },   // confirmed, no trigger
    { id: id(6),  timestamp: T0 + 20 * DAY, tag: 'focus', autoDetected: false },                           // end of the quiet fortnight
    { id: id(5),  timestamp: T0 + 6 * DAY, tag: 'unknown', autoDetected: false },
    { id: id(4),  timestamp: T0 + 5 * DAY + 60_000, tag: 'stress', autoDetected: false },
    { id: id(3),  timestamp: T0 + 5 * DAY, tag: 'auto-detected', autoDetected: true },                     // pending alarm
    { id: id(2),  timestamp: T0 + 2 * DAY, tag: 'stress', autoDetected: false },
    { id: id(1),  timestamp: T0 + DAY, tag: 'focus', autoDetected: false },
  ];
  return list;
}

export function basicState(): Record<string, unknown> {
  return v1State({
    incidents: basicIncidents(),
    customTags: [{ id: 'custom-ab12cd34', label: 'Zoom calls', emoji: '📞' }],
    detectionSensitivity: 'high',
    alertType: 'flash',
    alertSound: 'chime',
    alertVolume: 0.5,
    remindersEnabled: true,
    reminderIntervalMinutes: 30,
    theme: 'dark',
    weekChartMetric: 'confirmed',
  });
}

export function emptyState(): Record<string, unknown> {
  return v1State({ incidents: [] });
}

/** What retention pruning leaves behind: advanced anchor and a banked record streak. */
export function prunedState(): Record<string, unknown> {
  const incidents = basicIncidents().slice(0, 6);
  return v1State({
    incidents,
    historyStartTime: T0 + 6 * DAY,
    bestStreakFloorMs: 12 * DAY,
  });
}

/** A seeded pseudo-random history of `n` events, 40% alarms (half confirmed), tags mixed. */
export function largeIncidents(n: number): V1Incident[] {
  const tags = ['stress', 'focus', 'boredom', 'unknown', 'custom-ab12cd34'];
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out: V1Incident[] = [];
  let t = T0;
  for (let k = 0; k < n; k++) {
    t += 60_000 + Math.floor(rnd() * 4 * 3_600_000); // 1 min to 4 h apart
    const auto = rnd() < 0.4;
    const rec: V1Incident = {
      id: `l${k}-${Math.floor(rnd() * 1e9).toString(36)}`,
      timestamp: t,
      tag: auto ? 'auto-detected' : tags[Math.floor(rnd() * tags.length)],
      autoDetected: auto,
    };
    if (auto && rnd() < 0.5) {
      rec.confirmed = true;
      if (rnd() < 0.5) rec.tag = tags[Math.floor(rnd() * tags.length)];
    }
    out.push(rec);
  }
  return out.reverse(); // newest first
}

export function largeState(n = 10_000): Record<string, unknown> {
  return v1State({ incidents: largeIncidents(n), customTags: [{ id: 'custom-ab12cd34', label: 'Zoom calls', emoji: '📞' }] });
}

/** Pre-retention (v0) payload: no historyStartTime / bestStreakFloorMs. */
export function v0State(): Record<string, unknown> {
  const s = basicState();
  delete s.historyStartTime;
  delete s.bestStreakFloorMs;
  return s;
}
