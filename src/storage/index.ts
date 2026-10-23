// The storage module: the ONE way the app reads and writes persistent data.
//
//   import { events, settings, kv, localBlobs, getDeviceId } from '../storage';
//
// No other file may call localStorage, sessionStorage or indexedDB directly
// (enforced by eslint.config.js and src/storage/noDirectStorage.test.ts; a short
// allowlist covers files that predate this module).
//
//  events      history: add, update, soft-delete (tombstone), list/query,
//              export-all, replace-all (import), merge (sync)
//  settings    the core settings the app store already owns
//  kv          small namespaced key-value area for everything else
//  localBlobs  IndexedDB blobs that never leave the device (nail photos)
//  getDeviceId stable random id of this browser profile
//
// This is a facade over the existing zustand store ('stop-biting-state'), not a
// second source of truth: events live in `useAppStore().incidents`, so every
// screen that already renders history keeps working. See eventModel.ts for the
// record shapes and docs/agents/ARCHITECTURE.md for the rules.
//
// Import weight: this entry pulls in the app store. Code that only needs a light
// dependency (a marketing page reading a flag) should import './kv' directly.

import { useAppStore } from '../store/useAppStore';
import type { AppState, Incident } from '../types';
import {
  BEHAVIORS,
  DEFAULT_BEHAVIOR,
  fromHabitEvent,
  mergeEvents,
  queryEvents,
  toHabitEvent,
  type Behavior,
  type EventQuery,
  type HabitEvent,
  type HabitEventWire,
  type Tombstone,
} from './eventModel';
import { getDeviceId } from './deviceId';

export { kv, kvKey, KV_NAMESPACES, type KvNamespace } from './kv';
export { localBlobs, blobStorageStatus, type BlobStore } from './blobs';
export { getDeviceId } from './deviceId';
export { storageStatus } from './adapter';
export { lastBackupResult, lastStateWriteFailed } from './persistStorage';
export {
  BEHAVIORS,
  DEFAULT_BEHAVIOR,
  MAX_TOMBSTONES,
  type Behavior,
  type EventQuery,
  type EventSource,
  type Hand,
  type HabitEvent,
  type HabitEventWire,
  type StoredEvent,
  type Tombstone,
} from './eventModel';

// ── Events ───────────────────────────────────────────────────────────────────

/** What a caller supplies to record an event. Everything else is derived. */
export interface NewEventInput {
  source: HabitEvent['source'];
  behavior?: Behavior;
  /** Defaults to now. */
  ts?: number;
  /** Supply to import a known event; otherwise a uuid is generated. */
  id?: string;
  triggers?: string[];
  hand?: HabitEvent['hand'];
  falsePositive?: boolean;
  competingResponse?: HabitEvent['competingResponse'];
  /** Alarm review state; see HabitEventWire. Alarms start unconfirmed. */
  confirmed?: boolean;
  /** Defaults to this device's id. */
  deviceId?: string;
}

/** The fields that may change after an event exists. `id`, `ts` and `source` never do. */
export type EventUpdate = Partial<Pick<HabitEvent, 'behavior' | 'hand' | 'triggers' | 'falsePositive' | 'competingResponse'>>
  & { confirmed?: boolean };

/** The file format of `exportAll()` / `replaceAll()`. */
export interface HabitExport {
  format: 'stop-biting-events';
  version: 2;
  exportedAt: number;
  deviceId: string;
  /** Streak anchors, so an import restores streaks exactly, not just the events. */
  anchors: { firstOpenTime: number; historyStartTime: number; bestStreakFloorMs: number };
  events: HabitEventWire[];
  tombstones: Tombstone[];
}

const store = () => useAppStore.getState();

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Strict check of an event arriving from outside (a file, the network). Returns
 * a clean `HabitEventWire` or null. Unknown fields are dropped; missing optional
 * ones are defaulted (`behavior`, `updatedAt`).
 */
export function parseWireEvent(x: unknown): HabitEventWire | null {
  if (!isObject(x)) return null;
  if (typeof x.id !== 'string' || x.id === '') return null;
  if (typeof x.ts !== 'number' || !Number.isFinite(x.ts)) return null;
  if (x.source !== 'alarm' && x.source !== 'manual') return null;
  const behavior = x.behavior === undefined ? DEFAULT_BEHAVIOR : x.behavior;
  if (!(BEHAVIORS as readonly unknown[]).includes(behavior)) return null;

  const e: HabitEventWire = {
    id: x.id,
    ts: x.ts,
    source: x.source,
    behavior: behavior as Behavior,
    updatedAt: typeof x.updatedAt === 'number' && Number.isFinite(x.updatedAt) ? x.updatedAt : x.ts,
  };
  if (Array.isArray(x.triggers) && x.triggers.every(t => typeof t === 'string')) e.triggers = [...x.triggers] as string[];
  if (x.hand === 'left' || x.hand === 'right' || x.hand === 'unknown') e.hand = x.hand;
  if (typeof x.falsePositive === 'boolean') e.falsePositive = x.falsePositive;
  if (isObject(x.competingResponse) && typeof x.competingResponse.done === 'boolean') {
    e.competingResponse = { done: x.competingResponse.done };
    if (typeof x.competingResponse.durationSec === 'number') e.competingResponse.durationSec = x.competingResponse.durationSec;
  }
  if (typeof x.deviceId === 'string') e.deviceId = x.deviceId;
  if (x.deleted === true) e.deleted = true;
  if (typeof x.confirmed === 'boolean') e.confirmed = x.confirmed;
  return e;
}

export const events = {
  /** Records an event and returns it. Goes through the store, so streaks update. */
  add(input: NewEventInput): HabitEventWire {
    const now = Date.now();
    const ts = input.ts ?? now;
    const e: HabitEventWire = {
      id: input.id ?? newId(),
      ts,
      source: input.source,
      behavior: input.behavior ?? DEFAULT_BEHAVIOR,
      updatedAt: now,
      deviceId: input.deviceId ?? getDeviceId(),
    };
    if (input.triggers !== undefined) e.triggers = [...input.triggers];
    if (input.hand !== undefined) e.hand = input.hand;
    if (input.falsePositive !== undefined) e.falsePositive = input.falsePositive;
    if (input.competingResponse !== undefined) e.competingResponse = { ...input.competingResponse };
    if (input.confirmed !== undefined) e.confirmed = input.confirmed;
    store().insertEvent(fromHabitEvent(e));
    return toHabitEvent(store().incidents.find(i => i.id === e.id) ?? fromHabitEvent(e));
  },

  get(id: string): HabitEventWire | undefined {
    const rec = store().incidents.find(i => i.id === id);
    return rec ? toHabitEvent(rec) : undefined;
  },

  /** Changes mutable fields and stamps `updatedAt`. Undefined if no live event has this id. */
  update(id: string, patch: EventUpdate): HabitEventWire | undefined {
    if (!store().patchEvent(id, patch)) return undefined;
    return events.get(id);
  },

  /** Deletes the event from every list and statistic and leaves a tombstone. */
  softDelete(id: string): boolean {
    if (!store().incidents.some(i => i.id === id)) return false;
    store().deleteIncident(id);
    return true;
  },

  /** Live events matching `query`, newest first. Pass `includeDeleted` to see tombstones too. */
  list(query: EventQuery = {}): HabitEventWire[] {
    const { incidents, tombstones } = store();
    const all = incidents.map(toHabitEvent);
    if (query.includeDeleted) all.push(...tombstones.map(t => ({ ...t })));
    return queryEvents(all, query);
  },

  count(query: EventQuery = {}): number {
    return events.list({ ...query, limit: undefined }).length;
  },

  /** Everything needed to rebuild this history elsewhere, exactly. */
  exportAll(): HabitExport {
    const s = store();
    return {
      format: 'stop-biting-events',
      version: 2,
      exportedAt: Date.now(),
      deviceId: getDeviceId(),
      anchors: {
        firstOpenTime: s.firstOpenTime,
        historyStartTime: s.historyStartTime,
        bestStreakFloorMs: s.bestStreakFloorMs,
      },
      events: s.incidents.map(toHabitEvent),
      tombstones: s.tombstones.map(t => ({ ...t })),
    };
  },

  /**
   * Replaces the whole history with `data` (an export, or a bare list of
   * events). Malformed entries are skipped and counted, never half-applied.
   * Streak fields are re-derived from the result.
   */
  replaceAll(data: HabitExport | unknown[]): { imported: number; skipped: number } {
    const rawEvents = Array.isArray(data) ? data : data.events;
    const rawTombs = Array.isArray(data) ? [] : data.tombstones;
    const parsed = [
      ...(Array.isArray(rawEvents) ? rawEvents : []),
      ...(Array.isArray(rawTombs) ? rawTombs : []),
    ].map(parseWireEvent);
    const good = parsed.filter((e): e is HabitEventWire => e !== null);
    // Duplicate ids (an event listed twice, or live and deleted) resolve last-write-wins.
    const { incidents, tombstones } = mergeEvents({ incidents: [], tombstones: [] }, good);
    const anchors = Array.isArray(data) ? undefined : data.anchors;
    store().replaceEvents({
      incidents,
      tombstones,
      firstOpenTime: typeof anchors?.firstOpenTime === 'number' ? anchors.firstOpenTime : undefined,
      historyStartTime: typeof anchors?.historyStartTime === 'number' ? anchors.historyStartTime : undefined,
      bestStreakFloorMs: typeof anchors?.bestStreakFloorMs === 'number' ? anchors.bestStreakFloorMs : undefined,
    });
    return { imported: incidents.length, skipped: parsed.length - good.length };
  },

  /**
   * Folds events from another source (sync) into local history, last write wins
   * by `updatedAt`; deletes arrive as `deleted: true`. Unlike `replaceAll`,
   * nothing local is lost to an event that is older than its local copy.
   */
  merge(incoming: unknown[]): { applied: number; skipped: number } {
    const parsed = incoming.map(parseWireEvent);
    const good = parsed.filter((e): e is HabitEventWire => e !== null);
    const s = store();
    const result = mergeEvents({ incidents: s.incidents, tombstones: s.tombstones }, good);
    s.replaceEvents({
      incidents: result.incidents,
      tombstones: result.tombstones,
      firstOpenTime: s.firstOpenTime,
      historyStartTime: s.historyStartTime,
      bestStreakFloorMs: s.bestStreakFloorMs,
    });
    return { applied: result.applied, skipped: incoming.length - good.length };
  },

  /** Calls `fn` whenever history changes. Returns an unsubscribe. */
  subscribe(fn: () => void): () => void {
    let last: Incident[] = store().incidents;
    let lastTombs: Tombstone[] = store().tombstones;
    return useAppStore.subscribe(state => {
      if (state.incidents !== last || state.tombstones !== lastTombs) {
        last = state.incidents;
        lastTombs = state.tombstones;
        fn();
      }
    });
  },
};

// ── Settings ─────────────────────────────────────────────────────────────────

/** The settings the app store already owns, readable and writable in one place. */
export type AppSettings = Pick<AppState,
  'detectionSensitivity' | 'alertType' | 'alertSound' | 'alertVolume' | 'remindersEnabled'
  | 'reminderIntervalMinutes' | 'theme' | 'weekChartMetric'>;

export const settings = {
  get(): AppSettings {
    const s = store();
    return {
      detectionSensitivity: s.detectionSensitivity,
      alertType: s.alertType,
      alertSound: s.alertSound,
      alertVolume: s.alertVolume,
      remindersEnabled: s.remindersEnabled,
      reminderIntervalMinutes: s.reminderIntervalMinutes,
      theme: s.theme,
      weekChartMetric: s.weekChartMetric,
    };
  },

  update(patch: Partial<AppSettings>): void {
    const s = store();
    if (patch.detectionSensitivity !== undefined) s.setSensitivity(patch.detectionSensitivity);
    if (patch.alertType !== undefined) s.setAlertType(patch.alertType);
    if (patch.alertSound !== undefined) s.setAlertSound(patch.alertSound);
    if (patch.alertVolume !== undefined) s.setAlertVolume(patch.alertVolume);
    if (patch.remindersEnabled !== undefined) s.setRemindersEnabled(patch.remindersEnabled);
    if (patch.reminderIntervalMinutes !== undefined) s.setReminderInterval(patch.reminderIntervalMinutes);
    if (patch.theme !== undefined) s.setTheme(patch.theme);
    if (patch.weekChartMetric !== undefined) s.setWeekChartMetric(patch.weekChartMetric);
  },
};
