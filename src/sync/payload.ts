// What may leave the device when history syncs, and the only way to build it.
//
// This is the client half of the privacy rule (docs/agents/PLAN.md, section 0,
// rule 1): only small event records may sync, and only after the user opts in.
// `toSyncEvent` COPIES a fixed list of fields out of an event, one by one. It
// never spreads or clones the input, so a field somebody adds to a local event
// later (a landmark list, a frame, a photo reference, a calibration sample)
// cannot ride along by accident. The server refuses unknown fields as well
// (server/events/validate.js); a test keeps this file and that one in step.
//
// No DOM, no React, no store: plain TypeScript, tested in node.

import { BEHAVIORS, type HabitEventWire } from '../storage/eventModel';

/** Mirrors server/events/limits.js. src/sync/payload.test.ts compares the two. */
export const SYNC_LIMITS = {
  maxBatch: 500,
  maxIdLength: 64,
  maxTriggers: 10,
  maxTriggerLength: 64,
  maxTime: 4102444800000,
  maxDurationSec: 86400,
} as const;

/** Every field an event may carry over the network, and nothing else. */
export const SYNC_EVENT_FIELDS = [
  'id', 'ts', 'source', 'behavior', 'hand', 'triggers', 'falsePositive',
  'competingResponse', 'confirmed', 'deviceId', 'updatedAt', 'deleted',
] as const;

export type SyncEvent = HabitEventWire;

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

const isId = (x: unknown): x is string =>
  typeof x === 'string' && x.length >= 1 && x.length <= SYNC_LIMITS.maxIdLength && ID_RE.test(x);
const isTime = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= SYNC_LIMITS.maxTime;

/**
 * The wire form of one local event, or null if the event cannot be sent as it
 * is (a malformed id, a timestamp out of range, a trigger that is not a short
 * text). Null is a skip, never a repair: the record stays on the device and is
 * counted, so one odd record cannot hold up the rest.
 *
 * The result has the same shape the server returns, which is also what
 * `compareEventVersions` compares, so a pushed event and its echo are equal.
 */
export function toSyncEvent(e: HabitEventWire): SyncEvent | null {
  if (!isId(e.id) || !isTime(e.ts) || !isTime(e.updatedAt)) return null;
  if (e.source !== 'alarm' && e.source !== 'manual') return null;
  if (!(BEHAVIORS as readonly string[]).includes(e.behavior)) return null;

  const out: SyncEvent = { id: e.id, ts: e.ts, source: e.source, behavior: e.behavior, updatedAt: e.updatedAt };

  if (e.deviceId !== undefined) {
    if (!isId(e.deviceId)) return null;
    out.deviceId = e.deviceId;
  }
  if (e.deleted === true) {
    // A tombstone says only that the event is gone. It carries no content.
    out.deleted = true;
    return out;
  }

  if (e.hand !== undefined) {
    if (e.hand !== 'left' && e.hand !== 'right' && e.hand !== 'unknown') return null;
    out.hand = e.hand;
  }
  if (e.triggers !== undefined) {
    if (!Array.isArray(e.triggers) || e.triggers.length > SYNC_LIMITS.maxTriggers) return null;
    for (const t of e.triggers) {
      if (typeof t !== 'string' || t.length < 1 || t.length > SYNC_LIMITS.maxTriggerLength || CONTROL_RE.test(t)) return null;
    }
    out.triggers = [...e.triggers];
  }
  if (e.falsePositive !== undefined) {
    if (typeof e.falsePositive !== 'boolean') return null;
    out.falsePositive = e.falsePositive;
  }
  if (e.confirmed !== undefined) {
    if (typeof e.confirmed !== 'boolean') return null;
    out.confirmed = e.confirmed;
  }
  if (e.competingResponse !== undefined) {
    const cr = e.competingResponse;
    if (cr === null || typeof cr !== 'object' || typeof cr.done !== 'boolean') return null;
    const copy: NonNullable<SyncEvent['competingResponse']> = { done: cr.done };
    if (cr.durationSec !== undefined) {
      if (typeof cr.durationSec !== 'number' || !Number.isFinite(cr.durationSec) || cr.durationSec < 0 || cr.durationSec > SYNC_LIMITS.maxDurationSec) return null;
      copy.durationSec = cr.durationSec;
    }
    out.competingResponse = copy;
  }
  return out;
}
