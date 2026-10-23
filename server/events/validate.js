// Strict validation of a POST /api/events/sync body (WS4).
//
// This is the privacy gate on the server side. It is a WHITELIST: a key that is
// not listed below makes the whole request a 400, and nothing from it is stored.
// It does not drop unknown keys quietly (that would hide a client bug that is
// sending landmarks, frames, images or calibration data); it refuses them, so
// the bug shows up at once.
//
// Error messages name the position and the field NAME, never a value, so a
// rejected request cannot echo content back.

import { BEHAVIORS, HANDS, LIMITS, SOURCES } from './limits.js';

export const TOP_KEYS = new Set(['since', 'events', 'deviceId', 'epoch']);
export const EVENT_KEYS = new Set([
  'id', 'ts', 'source', 'behavior', 'hand', 'triggers', 'falsePositive',
  'competingResponse', 'confirmed', 'deviceId', 'updatedAt', 'deleted',
]);
const RESPONSE_KEYS = new Set(['done', 'durationSec']);

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isTime = (x, limits) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= limits.maxTime;

function show(name) {
  const s = String(name).replace(CONTROL_RE, '?');
  return s.length > 40 ? `${s.slice(0, 40)}...` : s;
}

function bad(message, extra = {}) {
  return { ok: false, error: { error: 'invalid_request', message, ...extra } };
}

function isId(x, limits) {
  return typeof x === 'string' && x.length >= 1 && x.length <= limits.maxIdLength && ID_RE.test(x);
}

/**
 * Checks one event and returns it in canonical form (only whitelisted fields,
 * `deleted: false` dropped), or an error result. `index` is for the message.
 */
export function parseEvent(raw, index, limits = LIMITS) {
  const at = `events[${index}]`;
  if (!isObject(raw)) return bad(`${at} must be an object`, { index });

  for (const key of Object.keys(raw)) {
    if (!EVENT_KEYS.has(key)) {
      return bad(`${at}.${show(key)} is not an allowed field`, { index, field: show(key) });
    }
  }

  if (!isId(raw.id, limits)) return bad(`${at}.id is missing or malformed`, { index, field: 'id' });
  if (!isTime(raw.ts, limits)) return bad(`${at}.ts must be a time in milliseconds`, { index, field: 'ts' });
  if (!isTime(raw.updatedAt, limits)) return bad(`${at}.updatedAt must be a time in milliseconds`, { index, field: 'updatedAt' });
  if (!SOURCES.includes(raw.source)) return bad(`${at}.source must be alarm or manual`, { index, field: 'source' });
  if (!BEHAVIORS.includes(raw.behavior)) return bad(`${at}.behavior is not a known behavior`, { index, field: 'behavior' });

  const e = { id: raw.id, ts: raw.ts, source: raw.source, behavior: raw.behavior, updatedAt: raw.updatedAt };

  if (raw.deviceId !== undefined) {
    if (!isId(raw.deviceId, limits)) return bad(`${at}.deviceId is malformed`, { index, field: 'deviceId' });
    e.deviceId = raw.deviceId;
  }
  if (raw.deleted !== undefined) {
    if (typeof raw.deleted !== 'boolean') return bad(`${at}.deleted must be true or false`, { index, field: 'deleted' });
    if (raw.deleted) e.deleted = true;
  }
  if (raw.hand !== undefined) {
    if (!HANDS.includes(raw.hand)) return bad(`${at}.hand must be left, right or unknown`, { index, field: 'hand' });
    e.hand = raw.hand;
  }
  if (raw.triggers !== undefined) {
    if (!Array.isArray(raw.triggers) || raw.triggers.length > limits.maxTriggers) {
      return bad(`${at}.triggers must be a list of at most ${limits.maxTriggers} strings`, { index, field: 'triggers' });
    }
    for (const t of raw.triggers) {
      if (typeof t !== 'string' || t.length < 1 || t.length > limits.maxTriggerLength || CONTROL_RE.test(t)) {
        return bad(`${at}.triggers has an entry that is not a short text`, { index, field: 'triggers' });
      }
    }
    e.triggers = [...raw.triggers];
  }
  if (raw.falsePositive !== undefined) {
    if (typeof raw.falsePositive !== 'boolean') return bad(`${at}.falsePositive must be true or false`, { index, field: 'falsePositive' });
    e.falsePositive = raw.falsePositive;
  }
  if (raw.confirmed !== undefined) {
    if (typeof raw.confirmed !== 'boolean') return bad(`${at}.confirmed must be true or false`, { index, field: 'confirmed' });
    e.confirmed = raw.confirmed;
  }
  if (raw.competingResponse !== undefined) {
    const cr = raw.competingResponse;
    if (!isObject(cr)) return bad(`${at}.competingResponse must be an object`, { index, field: 'competingResponse' });
    for (const key of Object.keys(cr)) {
      if (!RESPONSE_KEYS.has(key)) {
        return bad(`${at}.competingResponse.${show(key)} is not an allowed field`, { index, field: `competingResponse.${show(key)}` });
      }
    }
    if (typeof cr.done !== 'boolean') return bad(`${at}.competingResponse.done must be true or false`, { index, field: 'competingResponse.done' });
    const out = { done: cr.done };
    if (cr.durationSec !== undefined) {
      if (typeof cr.durationSec !== 'number' || !Number.isFinite(cr.durationSec) || cr.durationSec < 0 || cr.durationSec > limits.maxDurationSec) {
        return bad(`${at}.competingResponse.durationSec is out of range`, { index, field: 'competingResponse.durationSec' });
      }
      out.durationSec = cr.durationSec;
    }
    e.competingResponse = out;
  }
  return { ok: true, event: e };
}

/**
 * Validates the whole body: `{ since, events, deviceId, epoch? }`.
 * @returns {{ ok: true, value: { since: number, events: object[], deviceId: string, epoch: string|null } } | { ok: false, error: object }}
 */
export function parseSyncRequest(body, limits = LIMITS) {
  if (!isObject(body)) return bad('the body must be a JSON object');
  for (const key of Object.keys(body)) {
    if (!TOP_KEYS.has(key)) return bad(`${show(key)} is not an allowed field`, { field: show(key) });
  }

  const since = body.since === undefined ? 0 : body.since;
  if (typeof since !== 'number' || !Number.isSafeInteger(since) || since < 0) {
    return bad('since must be a whole number, 0 or more', { field: 'since' });
  }
  if (!isId(body.deviceId, limits)) return bad('deviceId is missing or malformed', { field: 'deviceId' });

  let epoch = null;
  if (body.epoch !== undefined && body.epoch !== null) {
    if (typeof body.epoch !== 'string' || body.epoch.length === 0 || body.epoch.length > limits.maxEpochLength || !ID_RE.test(body.epoch)) {
      return bad('epoch is malformed', { field: 'epoch' });
    }
    epoch = body.epoch;
  }

  const rawEvents = body.events === undefined ? [] : body.events;
  if (!Array.isArray(rawEvents)) return bad('events must be a list', { field: 'events' });
  if (rawEvents.length > limits.maxBatch) {
    return bad(`events holds more than ${limits.maxBatch} entries`, { field: 'events', max: limits.maxBatch });
  }

  const events = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const r = parseEvent(rawEvents[i], i, limits);
    if (!r.ok) return r;
    events.push(r.event);
  }
  return { ok: true, value: { since, events, deviceId: body.deviceId, epoch } };
}
