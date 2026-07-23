// Preset ids are suggested for autocomplete, but custom tag ids (arbitrary strings) are also valid.
export type TriggerTag = 'auto-detected' | 'stress' | 'focus' | 'boredom' | 'unknown' | (string & {});
export type Theme = 'light' | 'dark' | 'system';
export type AlertSound = 'alarm' | 'chime' | 'buzz' | 'chirp' | 'whistle';

export interface Incident {
  id: string;
  timestamp: number;
  tag: TriggerTag;
  autoDetected: boolean;
  confirmed?: boolean; // auto-detected incident confirmed as an actual bite
}

export interface CustomTag {
  id: string;
  label: string;
  emoji: string;
}

export type StatsMetric = 'incidents' | 'confirmed';

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

  // Alert sound
  alertSound: AlertSound;
  alertVolume: number; // 0–1

  // User-defined bite reasons, in addition to the built-in presets
  customTags: CustomTag[];

  // Which metric the Log page's week chart displays
  weekChartMetric: StatsMetric;
}

export interface AppActions {
  logIncident: (tag: TriggerTag, autoDetected?: boolean) => void;
  confirmIncident: (id: string) => void;
  deleteIncident: (id: string) => void;
  setCameraEnabled: (enabled: boolean) => void;
  setShowCameraFeed: (show: boolean) => void;
  setSensitivity: (s: DetectionSensitivity) => void;
  setAlertType: (t: AlertType) => void;
  setAlertSound: (s: AlertSound) => void;
  setAlertVolume: (v: number) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  setReminderInterval: (minutes: ReminderInterval) => void;
  setTheme: (theme: Theme) => void;
  addCustomTag: (label: string, emoji: string) => void;
  removeCustomTag: (id: string) => void;
  setWeekChartMetric: (m: StatsMetric) => void;
  clearAllData: () => void;
}
