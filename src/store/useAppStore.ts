import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, AppActions, TriggerTag, DetectionSensitivity, AlertType, ReminderInterval, Incident, Theme } from '../types';

const initialState: AppState = {
  incidents: [],
  firstOpenTime: Date.now(),
  lastBiteTime: null,
  bestStreakMs: 0,
  cameraEnabled: false,
  showCameraFeed: true,
  detectionSensitivity: 'medium',
  alertType: 'both',
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

      setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),
      setShowCameraFeed: (show) => set({ showCameraFeed: show }),
      setSensitivity: (s: DetectionSensitivity) => set({ detectionSensitivity: s }),
      setAlertType: (t: AlertType) => set({ alertType: t }),
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
