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
function computeBestStreak(incidents: Incident[], firstOpenTime: number): number {
  const biteTimes = incidents.filter(isBite).map(i => i.timestamp).sort((a, b) => a - b);
  let best = 0;
  let prev = firstOpenTime;
  for (const t of biteTimes) {
    best = Math.max(best, t - prev);
    prev = t;
  }
  return best;
}

const initialState: AppState = {
  incidents: [],
  firstOpenTime: Date.now(),
  lastBiteTime: null,
  bestStreakMs: 0,
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

      logIncident: (tag: TriggerTag, autoDetected = false) => {
        const { firstOpenTime, incidents } = get();
        const now = Date.now();

        const incident: Incident = {
          id: crypto.randomUUID(),
          timestamp: now,
          tag,
          autoDetected,
        };

        const next = [incident, ...incidents];

        // Only confirmed bites (manual or confirmed auto-detected) break the streak
        if (!autoDetected) {
          set({
            incidents: next,
            lastBiteTime: now,
            bestStreakMs: computeBestStreak(next, firstOpenTime),
          });
        } else {
          set({ incidents: next });
        }
      },

      confirmIncident: (id: string) => {
        const { incidents, firstOpenTime } = get();
        if (!incidents.some(i => i.id === id)) return;

        const next = incidents.map(i => i.id === id ? { ...i, confirmed: true } : i);
        set({
          incidents: next,
          lastBiteTime: latestBiteTime(next),
          bestStreakMs: computeBestStreak(next, firstOpenTime),
        });
      },

      deleteIncident: (id: string) => {
        const { incidents, firstOpenTime } = get();
        const next = incidents.filter(i => i.id !== id);
        set({
          incidents: next,
          lastBiteTime: latestBiteTime(next),
          bestStreakMs: computeBestStreak(next, firstOpenTime),
        });
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
      }),
    }),
    {
      name: 'stop-biting-state',
      // cameraEnabled + showCameraFeed excluded — always start with detection on, feed hidden
      partialize: (state) => {
        const { cameraEnabled: _a, showCameraFeed: _b, ...rest } = state as AppState & AppActions;
        return rest as AppState & AppActions;
      },
    }
  )
);
