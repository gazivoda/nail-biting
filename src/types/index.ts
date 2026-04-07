export type TriggerTag = 'auto-detected' | 'stress' | 'focus' | 'boredom' | 'unknown';
export type Theme = 'light' | 'dark' | 'system';

export interface Incident {
  id: string;
  timestamp: number;
  tag: TriggerTag;
  autoDetected: boolean;
}

export type DetectionSensitivity = 'low' | 'medium' | 'high';
export type AlertType = 'sound' | 'flash' | 'both';
export type ReminderInterval = 5 | 10 | 15 | 30 | 60;

export interface AppState {
  incidents: Incident[];
  firstOpenTime: number;
  lastBiteTime: number | null;
  bestStreakMs: number;

  // Camera/detection
  cameraEnabled: boolean;
  showCameraFeed: boolean;
  detectionSensitivity: DetectionSensitivity;
  alertType: AlertType;

  // Fallback reminders
  remindersEnabled: boolean;
  reminderIntervalMinutes: ReminderInterval;

  // Theme preference
  theme: Theme;
}

export interface AppActions {
  logIncident: (tag: TriggerTag, autoDetected?: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  setShowCameraFeed: (show: boolean) => void;
  setSensitivity: (s: DetectionSensitivity) => void;
  setAlertType: (t: AlertType) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  setReminderInterval: (minutes: ReminderInterval) => void;
  setTheme: (theme: Theme) => void;
  clearAllData: () => void;
}
