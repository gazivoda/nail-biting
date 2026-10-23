import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import type { AppState, AppActions, TriggerTag, DetectionSensitivity, AlertType, AlertSound, ReminderInterval, Incident, Theme, StatsMetric, CustomTag, ReplaceEventsInput } from '../types';
import {
  DEFAULT_BEHAVIOR,
  MAX_TOMBSTONES,
  addTombstone,
  createStoredEvent,
  isFalsePositive,
  isUrge,
  makeTombstone,
  patchStoredEvent,
  upgradeIncident,
  upgradeStateEvents,
  type EventExtras,
  type EventPatch,
  type StoredEvent,
} from '../storage/eventModel';
import { getDeviceId } from '../storage/deviceId';
import { detectLocalStorage } from '../storage/adapter';
import { createStatePersistStorage } from '../storage/persistStorage';

/**
 * A real bite: logged by hand, or an alarm the user confirmed. Alarms start
 * unconfirmed. An urge-timer entry (WS2) is logged by hand too, but it is an
 * urge that was felt, not a bite, so it never breaks a streak. An alarm marked
 * "Not a bite" (WS3) is never a bite, even if it was confirmed before; see the
 * state table in src/storage/eventModel.ts. This is the ONE definition: the
 * streak, Today, History and the insights all go through it.
 */
export function isBite(inc: Incident): boolean {
  return (!inc.autoDetected || inc.confirmed === true) && !isUrge(inc) && !isFalsePositive(inc);
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
export function deriveStreakState(state: RetentionState) {
  return {
    lastBiteTime: latestBiteTime(state.incidents),
    bestStreakMs: Math.max(
      state.bestStreakFloorMs,
      computeBestStreak(state.incidents, state.historyStartTime),
    ),
  };
}

/** Auto-detections this close to the previous one are the same episode. */
export const AUTO_EPISODE_MS = 30_000;

export const STATE_VERSION = 2;

// Persisted-state migrations, run by zustand's persist middleware whenever the
// stored version differs from STATE_VERSION. Steps chain, so a v0 user goes
// v0 -> v1 -> v2 in one call. Every step is non-destructive and idempotent: it
// adds or fills fields and never removes or rewrites existing ones, so running
// it again on its own output (for instance after a rollback to an older bundle,
// which rewrites the stored version number) changes nothing.
//
//   v0 -> v1  retention fields. v0 had none. Anyone upgrading has a complete,
//             unpruned history, so their anchor is firstOpenTime and there is
//             nothing banked behind it. A floor of 0 keeps bestStreakMs purely
//             derived, which is what lets a wrong value get corrected for users
//             who have deleted an incident. bestStreakMs itself is left alone
//             here; the next history action re-derives it.
//   v1 -> v2  event schema v2: every incident gains ts, source, behavior and
//             updatedAt (src/storage/eventModel.ts, upgradeIncident). Existing
//             fields, ids, timestamps and tags are untouched, so streaks and
//             statistics are identical before and after. Before the first write
//             of upgraded state, src/storage/persistStorage.ts has already
//             copied the raw old JSON to 'stop-biting-state-v1-backup'.
export function migrateState(persisted: unknown, version: number): Partial<AppState> {
  let state = (persisted ?? {}) as Partial<AppState>;
  if (version < 1) {
    state = {
      ...state,
      historyStartTime: state.firstOpenTime ?? Date.now(),
      bestStreakFloorMs: 0,
    };
  }
  if (version < 2) {
    state = upgradeStateEvents(state);
  }
  return state;
}

const initialState: AppState = {
  incidents: [],
  tombstones: [],
  firstOpenTime: Date.now(),
  historyStartTime: Date.now(),
  lastBiteTime: null,
  bestStreakMs: 0,
  bestStreakFloorMs: 0,
  cameraEnabled: true,
  detecting: false,
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

type Store = AppState & AppActions;
/** What reaches disk (and what `migrate` returns): state without the actions. */
type Persisted = Partial<AppState>;

// The persist middleware is only wired up where there is a real Web Storage to
// back it (a browser). Where there is none (node tests, storage blocked by
// policy) the store is memory-only, exactly as before this module existed.
function defaultStorage(): PersistStorage<Persisted> | undefined {
  return detectLocalStorage() ? createStatePersistStorage<Persisted>(STATE_VERSION) : undefined;
}

/**
 * Builds the app store. `useAppStore` below is the one instance the app uses;
 * tests build their own with an injected `storage` (see
 * src/storage/persistence.test.ts) to exercise hydration and migration.
 * Passing `undefined` yields a memory-only store.
 */
export function createAppStore(storage?: PersistStorage<Persisted>) {
  return create<Store>()(
  persist<Store, [], [], Persisted>(
    (set, get) => ({
      ...initialState,

      // The history actions all follow the same shape: build the next incident
      // list, then re-derive the streak fields from it. Nothing is accumulated,
      // so the numbers always agree with what the log actually shows.
      logIncident: (tag: TriggerTag, autoDetected = false, extras?: EventExtras) => {
        const { incidents, historyStartTime, bestStreakFloorMs, tombstones } = get();
        const behavior = extras?.behavior ?? DEFAULT_BEHAVIOR;

        // A hand resting at the chin re-triggers the detector every second or
        // two. The alarm still sounds each time, but it is one episode: a new
        // entry within AUTO_EPISODE_MS of the last auto one would inflate the
        // counts and bring the "try this instead" card back again and again.
        // Episodes are per behavior, so a nose-pick right after a bite is not
        // swallowed by the bite's episode (identical for nail biting alone).
        if (autoDetected) {
          const lastAuto = incidents.find(i => i.autoDetected && (i.behavior ?? DEFAULT_BEHAVIOR) === behavior);
          if (lastAuto && Date.now() - lastAuto.timestamp < AUTO_EPISODE_MS) return;
        }

        const incident = createStoredEvent({
          tag,
          autoDetected,
          now: Date.now(),
          deviceId: getDeviceId(),
          extras,
        });

        // Only the log path can grow the list, so it is the only one that prunes.
        const next = pruneIncidents({
          incidents: [incident, ...incidents],
          historyStartTime,
          bestStreakFloorMs,
        });

        set({ ...next, tombstones, ...deriveStreakState(next) });
      },

      confirmIncident: (id: string, tag?: TriggerTag) => {
        const { incidents, historyStartTime, bestStreakFloorMs } = get();
        if (!incidents.some(i => i.id === id)) return;

        const now = Date.now();
        const next = {
          incidents: incidents.map(i =>
            // Saying "this was a bite" about an alarm that was marked "Not a bite" takes the mark off.
            i.id === id ? patchStoredEvent(i, { confirmed: true, ...(i.falsePositive ? { falsePositive: false } : {}), ...(tag ? { tag } : {}) }, now) : i),
          historyStartTime,
          bestStreakFloorMs,
        };
        set({ ...next, ...deriveStreakState(next) });
      },

      deleteIncident: (id: string) => {
        const { incidents, tombstones, historyStartTime, bestStreakFloorMs } = get();
        const victim = incidents.find(i => i.id === id);

        const next = {
          incidents: incidents.filter(i => i.id !== id),
          historyStartTime,
          bestStreakFloorMs,
        };
        set({
          ...next,
          // Sync needs to hear about the delete; no screen ever reads this list.
          tombstones: victim ? addTombstone(tombstones, makeTombstone(victim, Date.now())) : tombstones,
          ...deriveStreakState(next),
        });
      },

      restoreIncident: (incident: Incident) => {
        const { incidents, tombstones, historyStartTime, bestStreakFloorMs } = get();
        if (incidents.some(i => i.id === incident.id)) return;
        // Back into its place in time (newest first), then re-derive the
        // streak so undoing a deleted bite puts the streak back exactly.
        // updatedAt moves forward so the restore outranks the tombstone in sync.
        const restored = patchStoredEvent(incident, {}, Date.now());
        const next = {
          incidents: [...incidents, restored].sort((a, b) => b.timestamp - a.timestamp),
          historyStartTime,
          bestStreakFloorMs,
        };
        set({ ...next, tombstones: tombstones.filter(t => t.id !== incident.id), ...deriveStreakState(next) });
      },

      insertEvent: (event: StoredEvent) => {
        const { incidents, tombstones, historyStartTime, bestStreakFloorMs } = get();
        if (incidents.some(i => i.id === event.id)) return;
        const next = pruneIncidents({
          incidents: [...incidents, upgradeIncident(event)].sort((a, b) => b.timestamp - a.timestamp),
          historyStartTime,
          bestStreakFloorMs,
        });
        set({ ...next, tombstones: tombstones.filter(t => t.id !== event.id), ...deriveStreakState(next) });
      },

      patchEvent: (id: string, patch: EventPatch) => {
        const { incidents, historyStartTime, bestStreakFloorMs } = get();
        if (!incidents.some(i => i.id === id)) return false;
        const now = Date.now();
        const next = {
          incidents: incidents.map(i => (i.id === id ? patchStoredEvent(i, patch, now) : i)),
          historyStartTime,
          bestStreakFloorMs,
        };
        set({ ...next, ...deriveStreakState(next) });
        return true;
      },

      replaceEvents: (input: ReplaceEventsInput) => {
        const state = get();
        const sorted = input.incidents.map(i => upgradeIncident(i)).sort((a, b) => b.timestamp - a.timestamp);
        const earliest = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : undefined;
        const firstOpenTime = input.firstOpenTime
          ?? (earliest !== undefined ? Math.min(state.firstOpenTime, earliest) : state.firstOpenTime);
        const next = pruneIncidents({
          incidents: sorted,
          historyStartTime: input.historyStartTime ?? firstOpenTime,
          bestStreakFloorMs: input.bestStreakFloorMs ?? 0,
        });
        set({
          ...next,
          firstOpenTime,
          tombstones: (input.tombstones ?? []).slice(0, MAX_TOMBSTONES),
          ...deriveStreakState(next),
        });
      },

      setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),
      setDetecting: (detecting) => set({ detecting }),
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

      // Same id, so bites already tagged with it keep their label.
      restoreCustomTag: (tag: CustomTag, index: number) => {
        const { customTags } = get();
        if (customTags.some(t => t.id === tag.id)) return;
        const next = [...customTags];
        next.splice(Math.max(0, Math.min(index, next.length)), 0, tag);
        set({ customTags: next });
      },

      setWeekChartMetric: (m: StatsMetric) => set({ weekChartMetric: m }),

      // History's "Clear all" used to call clearAllData, which also reset
      // sensitivity, sound, volume, theme, reminders and custom bite reasons.
      // The current streak runs from lastBiteTime ?? firstOpenTime, so both
      // restart here or the streak would keep counting from install day.
      clearHistory: () => {
        const now = Date.now();
        set({
          incidents: [],
          tombstones: [],
          lastBiteTime: null,
          bestStreakMs: 0,
          bestStreakFloorMs: 0,
          historyStartTime: now,
          firstOpenTime: now,
        });
      },

      clearAllData: () => set({
        ...initialState,
        firstOpenTime: Date.now(),
        historyStartTime: Date.now(),
      }),
    }),
    {
      name: 'stop-biting-state', // never change: a new name orphans every user's saved history
      version: STATE_VERSION,
      migrate: migrateState,
      storage,
      // cameraEnabled + showCameraFeed excluded — always start with detection on, feed hidden
      partialize: (state) => {
        const { cameraEnabled: _a, showCameraFeed: _b, detecting: _c, ...rest } = state as AppState & AppActions;
        return rest as AppState & AppActions;
      },
    }
  )
  );
}

export const useAppStore = createAppStore(defaultStorage());
