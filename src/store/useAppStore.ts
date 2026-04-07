import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, AppActions, TriggerTag, DetectionSensitivity, AlertType, AlertSound, ReminderInterval, Incident, Theme } from '../types';

const initialState: AppState = {
  incidents: [],
  firstOpenTime: Date.now(),
  lastBiteTime: null,
  bestStreakMs: 0,
  cameraEnabled: false,
  showCameraFeed: true,
  detectionSensitivity: 'medium',
  alertType: 'both',
  alertSound: 'alarm',
  remindersEnabled: false,
  reminderIntervalMinutes: 15,
  theme: 'system',
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      logIncident: (tag: TriggerTag, autoDetected = false) => {
        const { lastBiteTime, firstOpenTime, bestStreakMs, incidents } = get();
        const now = Date.now();
        const streakStart = lastBiteTime ?? firstOpenTime;
        const currentStreakMs = now - streakStart;
        const newBest = Math.max(bestStreakMs, currentStreakMs);

        const incident: Incident = {
          id: crypto.randomUUID(),
          timestamp: now,
          tag,
          autoDetected,
        };

        set({
          incidents: [incident, ...incidents],
          lastBiteTime: now,
          bestStreakMs: newBest,
        });
      },

      deleteIncident: (id: string) => {
        const { incidents, lastBiteTime } = get();
        const next = incidents.filter(i => i.id !== id);
        // If we deleted the most recent incident, roll lastBiteTime back to the new most recent
        const mostRecent = next[0]?.timestamp ?? null;
        const newLastBite = lastBiteTime === incidents.find(i => i.id === id)?.timestamp
          ? mostRecent
          : lastBiteTime;
        set({ incidents: next, lastBiteTime: newLastBite });
      },

      setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),
      setShowCameraFeed: (show) => set({ showCameraFeed: show }),
      setSensitivity: (s: DetectionSensitivity) => set({ detectionSensitivity: s }),
      setAlertType: (t: AlertType) => set({ alertType: t }),
      setAlertSound: (s: AlertSound) => set({ alertSound: s }),
      setRemindersEnabled: (enabled) => set({ remindersEnabled: enabled }),
      setReminderInterval: (minutes: ReminderInterval) => set({ reminderIntervalMinutes: minutes }),
      setTheme: (theme: Theme) => set({ theme }),

      clearAllData: () => set({
        ...initialState,
        firstOpenTime: Date.now(),
      }),
    }),
    {
      name: 'stop-biting-state',
      // cameraEnabled intentionally excluded — should always start as false on page load
      partialize: (state) => {
        const { cameraEnabled: _skip, ...rest } = state as AppState & AppActions;
        return rest as AppState & AppActions;
      },
    }
  )
);
