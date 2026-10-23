import type { EventExtras, EventPatch, HabitEvent, StoredEvent, Tombstone } from '../storage/eventModel';

// Preset ids are suggested for autocomplete, but custom tag ids (arbitrary strings) are also valid.
export type TriggerTag = 'auto-detected' | 'stress' | 'focus' | 'boredom' | 'unknown' | (string & {});
export type Theme = 'light' | 'dark' | 'system';
export type AlertSound = 'alarm' | 'chime' | 'buzz' | 'chirp' | 'whistle';

/**
 * One entry in the history, as the screens read it. These five fields are the
 * v1 shape and are the only ones the existing screens use. Everything inherited
 * from `HabitEvent` is the v2 addition (src/storage/eventModel.ts): optional
 * here so v1-shaped literals still type-check, always present on a record
 * written by v2 code. `timestamp === ts` and `autoDetected === (source ===
 * 'alarm')` always hold; new code should go through src/storage, not read these
 * directly.
 */
export interface Incident extends Partial<Omit<HabitEvent, 'id'>> {
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
  /** Live history, newest first. Deleted entries are NOT here (see `tombstones`). */
  incidents: Incident[];
  /**
   * Entries the user deleted, kept minimally so sync can tell another device.
   * Never read by a screen or a statistic. Bounded by MAX_TOMBSTONES.
   */
  tombstones: Tombstone[];
  firstOpenTime: number;
  /**
   * Point from which `incidents` is a complete record. Equals firstOpenTime
   * until retention pruning drops the oldest entries, then advances to the
   * newest dropped bite so streak maths stays anchored correctly.
   */
  historyStartTime: number;
  lastBiteTime: number | null;
  bestStreakMs: number;
  /**
   * High-water mark for streaks that happened inside the pruned-away range and
   * can no longer be recomputed from `incidents`.
   */
  bestStreakFloorMs: number;

  // Camera/detection
  cameraEnabled: boolean;
  /** Detection is actually running: camera on, no camera or model error, models loaded. Not persisted. */
  detecting: boolean;
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
  /**
   * `extras` is the seam for later workstreams (behavior, hand, ...): it is
   * stored on the new record and does not affect streak maths.
   */
  logIncident: (tag: TriggerTag, autoDetected?: boolean, extras?: EventExtras) => void;
  /** Marks an auto-detection as a real bite, optionally with the trigger the user picked. */
  confirmIncident: (id: string, tag?: TriggerTag) => void;
  /** Removes the entry from every list and statistic and leaves a tombstone. */
  deleteIncident: (id: string) => void;
  /** Puts a just-deleted entry back (History's Undo). */
  restoreIncident: (incident: Incident) => void;
  /**
   * Generic writers for src/storage (the one module other code should use).
   * All of them re-derive the streak fields from the resulting history.
   */
  insertEvent: (event: StoredEvent) => void;
  patchEvent: (id: string, patch: EventPatch) => boolean;
  /** Replaces the whole history (import / sync bootstrap). Anchors default to the earliest event. */
  replaceEvents: (next: ReplaceEventsInput) => void;
  setCameraEnabled: (enabled: boolean) => void;
  setDetecting: (detecting: boolean) => void;
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
  /** Puts a just-removed bite reason back with the same id, at the same place. */
  restoreCustomTag: (tag: CustomTag, index: number) => void;
  setWeekChartMetric: (m: StatsMetric) => void;
  /** Empties History and resets the streak; settings and bite reasons stay. */
  clearHistory: () => void;
  clearAllData: () => void;
}

/** Input of `replaceEvents`. Anchors are optional; omitted ones are derived. */
export interface ReplaceEventsInput {
  incidents: StoredEvent[];
  tombstones?: Tombstone[];
  firstOpenTime?: number;
  historyStartTime?: number;
  bestStreakFloorMs?: number;
}
