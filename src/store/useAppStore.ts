import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, AppActions, TriggerTag, DetectionSensitivity, AlertType, AlertSound, ReminderInterval, Incident, Theme, StatsMetric } from '../types';

function isBite(inc: Incident): boolean {
  return !inc.autoDetected || inc.confirmed === true;
}

function latestBiteTime(incidents: Incident[]): number | null {
  const bites = incidents.filter(isBite);
  return bites.length > 0 ? bites[0].timestamp : null;
}

// Longest completed gap between the start of tracking and each successive bite.
// An in-progress streak is deliberately excluded — it only counts once a bite
// ends it, which is what the ticker on the dashboard shows separately.
//
// Derived from the incident list rather than tracked incrementally so that
// editing history (deleting a mislogged bite, confirming an old incident)
// produces a best streak that actually matches the visible log.
export function computeBestStreak(incidents: Incident[], historyStartTime: number): number {
  const biteTimes = incidents.filter(isBite).map(i => i.timestamp).sort((a, b) => a - b);
  let best = 0;
  let prev = historyStartTime;
  for (const t of biteTimes) {
    best = Math.max(best, t - prev);
    prev = t;
  }
  return best;
}

// zustand serialises the entire store into one localStorage entry. Auto-detection
// appends an incident per episode, so an unbounded list eventually blows the
// ~5MB quota — at which point the write fails and the app silently stops saving
// anything at all. Measured: 5000 incidents serialise to ~0.63MB, while a year
// of heavy auto-detection (50/day) would reach ~2.3MB, which is close enough to
// the limit to matter on browsers that count the quota in UTF-16 code units.
export const MAX_INCIDENTS = 5000;

/** The three fields pruning has to keep consistent with each other. */
export interface RetentionState {
  incidents: Incident[];
  historyStartTime: number;
  bestStreakFloorMs: number;
}

// Drops the oldest incidents beyond MAX_INCIDENTS. Naively slicing the array
// would corrupt the streak maths in two separate ways, so both are handled here:
//
//  1. A record streak that happened entirely inside the dropped range would
//     vanish. bestStreakFloorMs preserves it as a high-water mark.
//  2. The oldest *retained* bite ended a streak that began at the newest
//     *dropped* bite — not at firstOpenTime. Leaving the anchor where it was
//     would measure that streak from too far back and invent a new record.
//
// Incidents are stored newest-first.
export function pruneIncidents(state: RetentionState): RetentionState {
  const { incidents, historyStartTime, bestStreakFloorMs } = state;
  if (incidents.length <= MAX_INCIDENTS) return state;

  const dropped = incidents.slice(MAX_INCIDENTS);
  const droppedBites = dropped.filter(isBite);

  return {
    incidents: incidents.slice(0, MAX_INCIDENTS),
    // Re-anchor to the newest dropped bite so the oldest retained streak is
    // measured from where it actually started.
    historyStartTime: droppedBites.length > 0 ? droppedBites[0].timestamp : historyStartTime,
    // Bank everything the full list could prove before it is forgotten.
    bestStreakFloorMs: Math.max(
      bestStreakFloorMs,
      computeBestStreak(incidents, historyStartTime),
    ),
  };
}

/** Streak fields are always derived, never accumulated — see computeBestStreak. */
function deriveStreakState(state: RetentionState) {
  return {
    lastBiteTime: latestBiteTime(state.incidents),
    bestStreakMs: Math.max(
      state.bestStreakFloorMs,
      computeBestStreak(state.incidents, state.historyStartTime),
    ),
  };
}

export const STATE_VERSION = 1;

// v0 had no retention fields. Anyone upgrading has a complete, unpruned history,
// so their anchor is firstOpenTime and there is nothing banked behind it. A floor
// of 0 keeps bestStreakMs purely derived, which is what lets a wrong value get
// corrected for users who have deleted an incident. bestStreakMs itself is left
// alone here; the next history action re-derives it.
export function migrateState(persisted: unknown, version: number): Partial<AppState> {
  const state = (persisted ?? {}) as Partial<AppState>;
  if (version < 1) {
    return {
      ...state,
      historyStartTime: state.firstOpenTime ?? Date.now(),
      bestStreakFloorMs: 0,
    };
  }
  return state;
}

const initialState: AppState = {
  incidents: [],
  firstOpenTime: Date.now(),
  historyStartTime: Date.now(),
  lastBiteTime: null,
  bestStreakMs: 0,
  bestStreakFloorMs: 0,
  cameraEnabled: true,
  showCameraFeed: false,
  detectionSensitivity: 'medium',
  alertType: 'both',
  alertSound: 'alarm',
  alertVolume: 0.8,
  remindersEnabled: false,
  reminderIntervalMinutes: 15,
  theme: 'system',
  customTags: [],
  weekChartMetric: 'incidents',
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // All three history actions follow the same shape: build the next incident
      // list, then re-derive the streak fields from it. Nothing is accumulated,
      // so the numbers always agree with what the log actually shows.
      logIncident: (tag: TriggerTag, autoDetected = false) => {
        const { incidents, historyStartTime, bestStreakFloorMs } = get();

        const incident: Incident = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          tag,
          autoDetected,
        };

        // Only the log path can grow the list, so it is the only one that prunes.
        const next = pruneIncidents({
          incidents: [incident, ...incidents],
          historyStartTime,
          bestStreakFloorMs,
        });

        set({ ...next, ...deriveStreakState(next) });
      },

      confirmIncident: (id: string) => {
        const { incidents, historyStartTime, bestStreakFloorMs } = get();
        if (!incidents.some(i => i.id === id)) return;

        const next = {
          incidents: incidents.map(i => i.id === id ? { ...i, confirmed: true } : i),
          historyStartTime,
          bestStreakFloorMs,
        };
        set({ ...next, ...deriveStreakState(next) });
      },

      deleteIncident: (id: string) => {
        const { incidents, historyStartTime, bestStreakFloorMs } = get();

        const next = {
          incidents: incidents.filter(i => i.id !== id),
          historyStartTime,
          bestStreakFloorMs,
        };
        set({ ...next, ...deriveStreakState(next) });
      },

      setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),
      setShowCameraFeed: (show) => set({ showCameraFeed: show }),
      setSensitivity: (s: DetectionSensitivity) => set({ detectionSensitivity: s }),
      setAlertType: (t: AlertType) => set({ alertType: t }),
      setAlertSound: (s: AlertSound) => set({ alertSound: s }),
      setAlertVolume: (v: number) => set({ alertVolume: Math.min(1, Math.max(0, v)) }),
      setRemindersEnabled: (enabled) => set({ remindersEnabled: enabled }),
      setReminderInterval: (minutes: ReminderInterval) => set({ reminderIntervalMinutes: minutes }),
      setTheme: (theme: Theme) => set({ theme }),

      addCustomTag: (label: string, emoji: string) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        const { customTags } = get();
        const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
        set({ customTags: [...customTags, { id, label: trimmed, emoji: emoji.trim() || '🏷️' }] });
      },

      removeCustomTag: (id: string) => {
        const { customTags } = get();
        set({ customTags: customTags.filter(t => t.id !== id) });
      },

      setWeekChartMetric: (m: StatsMetric) => set({ weekChartMetric: m }),

      clearAllData: () => set({
        ...initialState,
        firstOpenTime: Date.now(),
        historyStartTime: Date.now(),
      }),
    }),
    {
      name: 'stop-biting-state',
      version: STATE_VERSION,
      migrate: migrateState,
      // cameraEnabled + showCameraFeed excluded — always start with detection on, feed hidden
      partialize: (state) => {
        const { cameraEnabled: _a, showCameraFeed: _b, ...rest } = state as AppState & AppActions;
        return rest as AppState & AppActions;
      },
    }
  )
);
