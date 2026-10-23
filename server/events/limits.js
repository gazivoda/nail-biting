// Limits for the event sync endpoint (WS4). One place, so the route, the
// validator, the store and the tests agree. The client mirrors the per-event
// limits in src/sync/payload.ts (a test keeps the two in step).

export const LIMITS = Object.freeze({
  /** Events accepted in one POST /api/events/sync. */
  maxBatch: 500,
  /** Events returned in one response; `hasMore` says to ask again. */
  pageSize: 1000,
  maxIdLength: 64,
  maxTriggers: 10,
  maxTriggerLength: 64,
  maxEpochLength: 64,
  /** Epoch ms ceiling for `ts` and `updatedAt`: the year 2100. A far-future value would freeze a record under last-write-wins. */
  maxTime: 4102444800000,
  /** A competing response lasts seconds; a day is a generous ceiling. */
  maxDurationSec: 86400,
  /** Stored rows per user, live events and tombstones together. */
  quotaPerUser: 50000,
  /** express.json limit for the sync route only (the global parser is 10 kb). */
  bodyLimit: '512kb',
});

/** The behaviours the app knows. Kept in step with BEHAVIORS in src/storage/eventModel.ts (a test checks it). */
export const BEHAVIORS = Object.freeze([
  'nail_biting',
  'cuticle_skin_biting',
  'nose_picking',
  'eye_area_pulling',
  'face_skin_picking',
  'hair_pulling',
]);

export const SOURCES = Object.freeze(['alarm', 'manual']);
export const HANDS = Object.freeze(['left', 'right', 'unknown']);
