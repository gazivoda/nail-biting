// The history record and everything that can be said about it without a DOM,
// React or a store: types, the v1 -> v2 upgrade, and the conversions between the
// persisted record and the canonical `HabitEvent`. Pure functions only, so the
// migration is unit-tested in node on fixtures of real persisted JSON.
//
// Vocabulary
//  - `HabitEvent`   canonical type (docs/agents/PLAN.md, WS0). What sync, export,
//                   import and every new workstream talk about.
//  - `Incident`     what v1 persisted and what the existing screens still read
//                   (src/types/index.ts): `timestamp`, `tag`, `autoDetected`,
//                   `confirmed`. v2 fields are optional on it so v1-shaped
//                   literals keep type-checking.
//  - `StoredEvent`  what a v2 record on disk looks like: an `Incident` that also
//                   carries `ts`, `source`, `behavior` and `updatedAt`.
//                   It is a SUPERSET of both shapes on purpose. Every v1 field is
//                   left exactly as it was (so streak and stats code produce
//                   identical numbers, and an older bundle that reads v2 data
//                   still works); the v2 fields are added beside it.
//  - `Tombstone`    a deleted event kept (minimally) so sync can propagate the
//                   delete. Lives in `state.tombstones`, never in `state.incidents`,
//                   so no existing screen or statistic can see it.
//
// Invariants kept by every writer in this file:
//    ts === timestamp          source === (autoDetected ? 'alarm' : 'manual')
// `timestamp` and `autoDetected` never change after an event is created, so the
// mirrors cannot drift. `tag` is the single stored source for the primary
// trigger; `triggers` is only stored when an explicit list was provided.

import type { Incident, TriggerTag } from '../types';

export const BEHAVIORS = [
  'nail_biting',
  'cuticle_skin_biting',
  'nose_picking',
  'eye_area_pulling',
  'face_skin_picking',
  'hair_pulling',
] as const;
export type Behavior = (typeof BEHAVIORS)[number];
export const DEFAULT_BEHAVIOR: Behavior = 'nail_biting';

export type EventSource = 'alarm' | 'manual';
export type Hand = 'left' | 'right' | 'unknown';

/** Canonical event record. Field-for-field the type in docs/agents/PLAN.md, WS0. */
export type HabitEvent = {
  id: string;              // uuid
  ts: number;              // epoch ms
  source: 'alarm' | 'manual';
  behavior: 'nail_biting' | 'cuticle_skin_biting' | 'nose_picking'
          | 'eye_area_pulling' | 'face_skin_picking' | 'hair_pulling'; // default 'nail_biting'
  hand?: 'left' | 'right' | 'unknown';
  triggers?: string[];     // existing tags
  falsePositive?: boolean; // set by WS3
  competingResponse?: { done: boolean; durationSec?: number }; // set by WS2
  deviceId?: string;       // for WS4 sync
  updatedAt: number;
  deleted?: boolean;       // tombstone for sync
};

/**
 * A HabitEvent as it travels (export, import, sync). The plan's type has no slot
 * for v1's review state, but every streak and count depends on it: an alarm only
 * counts as a bite once `confirmed` is true. It rides along as an extra field.
 * Whoever merges or syncs events MUST carry it unchanged.
 */
export type HabitEventWire = HabitEvent & { confirmed?: boolean };

/** A persisted v2 record. See the header for why it keeps the v1 fields. */
export type StoredEvent = Incident & Pick<HabitEvent, 'ts' | 'source' | 'behavior' | 'updatedAt'>;

/** A deleted event: just enough to tell another device it is gone. */
export type Tombstone = Pick<HabitEvent, 'id' | 'ts' | 'source' | 'behavior' | 'updatedAt' | 'deviceId'> & {
  deleted: true;
};

/** Tombstones are only useful until sync has delivered them; keep the list bounded. */
export const MAX_TOMBSTONES = 1000;

// ── v1 -> v2 ─────────────────────────────────────────────────────────────────

type Loose = Record<string, unknown>;

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `legacy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Upgrades one persisted record to the v2 shape. Pure, non-destructive and
 * idempotent: every existing field is kept byte for byte (including fields this
 * code has never heard of), and a v2 field is only filled when it is absent.
 *
 *   ts         <- timestamp
 *   source     <- autoDetected ? 'alarm' : 'manual'
 *   behavior   <- 'nail_biting'
 *   updatedAt  <- ts
 *
 * The id is kept. It is replaced only if it cannot be used as a string at all
 * (missing, empty, or some other type), which no version of the app has written.
 * `makeId` is injectable so tests can pin it.
 */
export function upgradeIncident(raw: Incident, makeId: () => string = newId): StoredEvent {
  const rec = raw as unknown as Loose;
  const timestamp = Number(rec.timestamp);
  const ts = typeof rec.ts === 'number' ? rec.ts : Number.isFinite(timestamp) ? timestamp : 0;
  const id =
    typeof rec.id === 'string' && rec.id !== ''
      ? rec.id
      : typeof rec.id === 'number' && Number.isFinite(rec.id)
        ? String(rec.id)
        : makeId();
  return {
    ...(rec as object),
    id,
    ts,
    source: (rec.source as EventSource | undefined) ?? (rec.autoDetected ? 'alarm' : 'manual'),
    behavior: (rec.behavior as Behavior | undefined) ?? DEFAULT_BEHAVIOR,
    updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : ts,
  } as StoredEvent;
}

/** Applies `upgradeIncident` to a whole persisted state. Everything else passes through untouched. */
export function upgradeStateEvents<T extends { incidents?: unknown }>(state: T, makeId?: () => string): T {
  if (!Array.isArray(state.incidents)) return state;
  return {
    ...state,
    incidents: (state.incidents as Incident[]).map(i =>
      i !== null && typeof i === 'object' ? upgradeIncident(i, makeId) : i,
    ),
  };
}

// ── Canonical <-> persisted ──────────────────────────────────────────────────

/** The trigger an urge-timer entry carries (WS2). It is not a bite and never touches the streak. */
export const URGE_TAG_ID = 'urge';

/**
 * An entry the urge timer logged: a manual event whose primary trigger is
 * `urge`. It records an urge that was felt, not a bite, so `isBite` (the
 * store), History and Today all leave it out of bite counts and streaks.
 * Requires `!autoDetected`: an alarm somebody confirms with some other tag
 * can never be mistaken for one.
 */
export function isUrge(inc: Pick<Incident, 'tag' | 'autoDetected'>): boolean {
  return !inc.autoDetected && inc.tag === URGE_TAG_ID;
}

// ── What an entry is: the review states (WS3). ONE set of predicates, used by every counter ─────────────
//
//   state                autoDetected  confirmed  falsePositive   isBite  pending  alarmOrBite
//   unreviewed alarm     true          no         no              no      YES      yes
//   confirmed bite       true          yes        no              YES     no       yes
//   false positive       true          (any)      yes             no      no       no
//   manual log ("I bit") false         n/a        no              YES     no       yes
//   urge (urge timer)    false, tag    n/a        no              no      no       no
//
// "False positive" is the person saying "Not a bite" about an alarm. It outranks `confirmed`, which is
// left as it was so that undoing the false positive puts the entry back exactly where it was. A false
// positive is never a bite, never "an alarm to review", and not part of any count, chart, insight or
// streak. `isBite` lives in the store file (it needs the streak maths) and applies the same rule.

/** The person said "Not a bite" about this alarm. Outranks `confirmed`. */
export function isFalsePositive(inc: Pick<Incident, 'falsePositive'>): boolean {
  return inc.falsePositive === true;
}

/** An alarm nobody has reviewed yet: the amber "Alarm" in History and "alarms to review" on Today. */
export function isPendingAlarm(inc: Pick<Incident, 'autoDetected' | 'confirmed' | 'falsePositive'>): boolean {
  return inc.autoDetected && !inc.confirmed && inc.falsePositive !== true;
}

/**
 * "Alarms and bites": the History chart's All view and the Paywall's "alerts logged". An urge is neither
 * and a false positive is not an alarm anyone should count.
 */
export function isAlarmOrBite(inc: Pick<Incident, 'tag' | 'autoDetected' | 'falsePositive'>): boolean {
  return !isUrge(inc) && !isFalsePositive(inc);
}

/** The synthetic tag an alarm carries until the user says what set it off. */
const NO_TAG_ALARM = 'auto-detected';
const NO_TAG_MANUAL = 'unknown';

function triggersFromTag(tag: TriggerTag | undefined): string[] | undefined {
  return tag === undefined || tag === NO_TAG_ALARM ? undefined : [tag];
}

function tagFromTriggers(triggers: string[] | undefined, source: EventSource): TriggerTag {
  return triggers?.[0] ?? (source === 'alarm' ? NO_TAG_ALARM : NO_TAG_MANUAL);
}

/** Persisted record -> canonical event. Missing v2 fields get their defaults. Never mutates. */
export function toHabitEvent(rec: Incident): HabitEventWire {
  const up = upgradeIncident(rec);
  const out: HabitEventWire = {
    id: up.id,
    ts: up.ts,
    source: up.source,
    behavior: up.behavior,
    updatedAt: up.updatedAt,
  };
  const triggers = up.triggers ?? triggersFromTag(up.tag);
  if (triggers) out.triggers = [...triggers];
  if (up.hand !== undefined) out.hand = up.hand;
  if (up.falsePositive !== undefined) out.falsePositive = up.falsePositive;
  if (up.competingResponse !== undefined) out.competingResponse = { ...up.competingResponse };
  if (up.deviceId !== undefined) out.deviceId = up.deviceId;
  if (up.deleted !== undefined) out.deleted = up.deleted;
  if (up.confirmed !== undefined) out.confirmed = up.confirmed;
  return out;
}

/** Canonical event -> persisted record (v1 mirror fields included). */
export function fromHabitEvent(e: HabitEventWire): StoredEvent {
  const rec: StoredEvent = {
    id: e.id,
    timestamp: e.ts,
    tag: tagFromTriggers(e.triggers, e.source),
    autoDetected: e.source === 'alarm',
    ts: e.ts,
    source: e.source,
    behavior: e.behavior ?? DEFAULT_BEHAVIOR,
    updatedAt: e.updatedAt ?? e.ts,
  };
  if (e.confirmed !== undefined) rec.confirmed = e.confirmed;
  if (e.triggers !== undefined) rec.triggers = [...e.triggers];
  if (e.hand !== undefined) rec.hand = e.hand;
  if (e.falsePositive !== undefined) rec.falsePositive = e.falsePositive;
  if (e.competingResponse !== undefined) rec.competingResponse = { ...e.competingResponse };
  if (e.deviceId !== undefined) rec.deviceId = e.deviceId;
  return rec;
}

// ── Writers (used by the store actions and the storage facade) ──────────────

/** Fields a caller may set when recording an event; the rest is derived. */
export type EventExtras = Partial<Pick<HabitEvent, 'behavior' | 'hand' | 'triggers' | 'falsePositive' | 'competingResponse'>>;

export interface NewEventInput {
  tag: TriggerTag;
  autoDetected: boolean;
  now: number;
  id?: string;
  deviceId?: string;
  extras?: EventExtras;
}

/** A brand-new record, v1 and v2 fields together. */
export function createStoredEvent(input: NewEventInput): StoredEvent {
  const { tag, autoDetected, now, id, deviceId, extras } = input;
  const rec: StoredEvent = {
    id: id ?? newId(),
    timestamp: now,
    tag,
    autoDetected,
    ts: now,
    source: autoDetected ? 'alarm' : 'manual',
    behavior: extras?.behavior ?? DEFAULT_BEHAVIOR,
    updatedAt: now,
  };
  if (deviceId !== undefined) rec.deviceId = deviceId;
  if (extras?.hand !== undefined) rec.hand = extras.hand;
  if (extras?.triggers !== undefined) rec.triggers = [...extras.triggers];
  if (extras?.falsePositive !== undefined) rec.falsePositive = extras.falsePositive;
  if (extras?.competingResponse !== undefined) rec.competingResponse = { ...extras.competingResponse };
  return rec;
}

/** The fields of a record that a caller may change after the fact. */
export type EventPatch = Partial<Pick<HabitEvent,
  'behavior' | 'hand' | 'triggers' | 'falsePositive' | 'competingResponse'>> & {
  confirmed?: boolean;
  tag?: TriggerTag;
};

/** Applies a patch and stamps `updatedAt`. Keeps `tag` and `triggers` consistent. */
export function patchStoredEvent(rec: Incident, patch: EventPatch, now: number): StoredEvent {
  const base = upgradeIncident(rec);
  const next: StoredEvent = { ...base, updatedAt: Math.max(now, base.updatedAt) };
  if (patch.behavior !== undefined) next.behavior = patch.behavior;
  if (patch.hand !== undefined) next.hand = patch.hand;
  if (patch.falsePositive !== undefined) next.falsePositive = patch.falsePositive;
  if (patch.competingResponse !== undefined) next.competingResponse = { ...patch.competingResponse };
  if (patch.confirmed !== undefined) next.confirmed = patch.confirmed;
  if (patch.triggers !== undefined) {
    next.triggers = [...patch.triggers];
    next.tag = tagFromTriggers(patch.triggers, next.source);
  }
  if (patch.tag !== undefined) {
    next.tag = patch.tag;
    // `tag` wins over a stale explicit list.
    if (patch.triggers === undefined && next.triggers) next.triggers = triggersFromTag(patch.tag) ?? [];
    if (next.triggers && next.triggers.length === 0) delete next.triggers;
  }
  return next;
}

export function makeTombstone(rec: Incident, now: number): Tombstone {
  const up = upgradeIncident(rec);
  const t: Tombstone = {
    id: up.id,
    ts: up.ts,
    source: up.source,
    behavior: up.behavior,
    updatedAt: Math.max(now, up.updatedAt),
    deleted: true,
  };
  if (up.deviceId !== undefined) t.deviceId = up.deviceId;
  return t;
}

/** Newest first, bounded. Tombstones with the same id collapse to the latest. */
export function addTombstone(list: Tombstone[], t: Tombstone, max = MAX_TOMBSTONES): Tombstone[] {
  const merged = [t, ...list.filter(x => x.id !== t.id)];
  merged.sort((a, b) => b.updatedAt - a.updatedAt);
  return merged.length > max ? merged.slice(0, max) : merged;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export interface EventQuery {
  behavior?: Behavior | Behavior[];
  source?: EventSource;
  /** Inclusive lower bound on `ts`. */
  since?: number;
  /** Exclusive upper bound on `ts`. */
  until?: number;
  /** Keep only events carrying this trigger. */
  trigger?: string;
  /** true: only false positives; false: hide them. Omit for both. */
  falsePositive?: boolean;
  /** Include tombstones (deleted events). Default false. */
  includeDeleted?: boolean;
  /** Newest first by default. */
  order?: 'newest' | 'oldest';
  limit?: number;
}

export function matchesQuery(e: HabitEventWire, q: EventQuery): boolean {
  if (!q.includeDeleted && e.deleted) return false;
  if (q.behavior !== undefined) {
    const wanted = Array.isArray(q.behavior) ? q.behavior : [q.behavior];
    if (!wanted.includes(e.behavior)) return false;
  }
  if (q.source !== undefined && e.source !== q.source) return false;
  if (q.since !== undefined && e.ts < q.since) return false;
  if (q.until !== undefined && e.ts >= q.until) return false;
  if (q.trigger !== undefined && !(e.triggers ?? []).includes(q.trigger)) return false;
  if (q.falsePositive !== undefined && (e.falsePositive === true) !== q.falsePositive) return false;
  return true;
}

export function queryEvents(events: HabitEventWire[], q: EventQuery = {}): HabitEventWire[] {
  const out = events.filter(e => matchesQuery(e, q));
  out.sort((a, b) => (q.order === 'oldest' ? a.ts - b.ts : b.ts - a.ts));
  return q.limit !== undefined ? out.slice(0, Math.max(0, q.limit)) : out;
}

// ── Which version wins (last write wins, deterministic ties) ────────────────

const LIVE_ORDER = [
  'id', 'ts', 'source', 'behavior', 'hand', 'triggers', 'falsePositive',
  'competingResponse', 'confirmed', 'deviceId', 'updatedAt',
] as const;
const DELETED_ORDER = ['id', 'ts', 'source', 'behavior', 'deviceId', 'updatedAt'] as const;

/** A fixed-key-order JSON text of an event. A deleted record keeps only what a tombstone keeps. */
export function canonicalEvent(e: HabitEventWire): string {
  const rec = e as unknown as Record<string, unknown>;
  const deleted = e.deleted === true;
  const out: Record<string, unknown> = {};
  for (const key of deleted ? DELETED_ORDER : LIVE_ORDER) {
    const v = rec[key];
    if (v === undefined) continue;
    if (key === 'competingResponse') {
      const cr = v as NonNullable<HabitEvent['competingResponse']>;
      out[key] = cr.durationSec === undefined ? { done: cr.done } : { done: cr.done, durationSec: cr.durationSec };
    } else {
      out[key] = v;
    }
  }
  if (deleted) out.deleted = true;
  return JSON.stringify(out);
}

/**
 * Which of two versions of the SAME event wins: > 0 when `a` should replace
 * `b`, < 0 when `b` stays, 0 when they are the same version. The first
 * difference decides: higher `updatedAt`; then a deletion beats a live record;
 * then the higher `deviceId`; then the higher canonical text. It is a total
 * order on content, so every replica that sees the same set of versions ends
 * on the same one, whatever order they arrive in.
 *
 * The server uses the same rule (server/events/compare.js, kept identical by
 * server/events/compare.test.js). It has to: two devices that disagreed about a
 * tie would never converge.
 */
export function compareEventVersions(a: HabitEventWire, b: HabitEventWire): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? 1 : -1;
  const da = a.deleted === true;
  const db = b.deleted === true;
  if (da !== db) return da ? 1 : -1;
  const deva = a.deviceId ?? '';
  const devb = b.deviceId ?? '';
  if (deva !== devb) return deva > devb ? 1 : -1;
  const ca = canonicalEvent(a);
  const cb = canonicalEvent(b);
  if (ca === cb) return 0;
  return ca > cb ? 1 : -1;
}

// ── Merging (last write wins), for import and sync ──────────────────────────

export interface MergeResult {
  incidents: StoredEvent[];
  tombstones: Tombstone[];
  /** How many incoming events changed local state. */
  applied: number;
}

/**
 * Folds incoming events into local state, last-write-wins by `updatedAt`.
 * A tie on `updatedAt` is settled by `compareEventVersions`, the same rule the
 * server uses, so devices that exchange the same versions converge (before WS4
 * a tie kept the local copy, which can leave two devices with different copies
 * for ever; identical versions are still a no-op). A deleted incoming event
 * removes the live record and leaves a tombstone; a newer live event beats an
 * older tombstone. Output is newest-first, like the store keeps it.
 */
export function mergeEvents(
  local: { incidents: Incident[]; tombstones: Tombstone[] },
  incoming: HabitEventWire[],
  max = MAX_TOMBSTONES,
): MergeResult {
  const live = new Map<string, StoredEvent>();
  for (const i of local.incidents) {
    const up = upgradeIncident(i);
    live.set(up.id, up);
  }
  const dead = new Map<string, Tombstone>();
  for (const t of local.tombstones) dead.set(t.id, t);

  let applied = 0;
  for (const e of incoming) {
    const mine = live.get(e.id);
    const theirTomb = dead.get(e.id);
    const localVersion: HabitEventWire | undefined = mine ? toHabitEvent(mine) : theirTomb;
    if (localVersion && compareEventVersions(e, localVersion) <= 0) continue; // local wins or is identical
    applied++;
    if (e.deleted) {
      live.delete(e.id);
      dead.set(e.id, {
        id: e.id, ts: e.ts, source: e.source, behavior: e.behavior,
        updatedAt: e.updatedAt, deleted: true,
        ...(e.deviceId !== undefined ? { deviceId: e.deviceId } : {}),
      });
    } else {
      dead.delete(e.id);
      live.set(e.id, fromHabitEvent(e));
    }
  }

  const incidents = [...live.values()].sort((a, b) => b.ts - a.ts);
  let tombstones = [...dead.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  if (tombstones.length > max) tombstones = tombstones.slice(0, max);
  return { incidents, tombstones, applied };
}
