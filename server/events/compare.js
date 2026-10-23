// Which of two versions of the same event wins. The server and every client
// must reach the SAME answer for any pair, or two devices keep different
// copies for ever. This is the JavaScript twin of `compareEventVersions` in
// src/storage/eventModel.ts; server/events/compare.test.js feeds both the same
// pairs and fails if they ever disagree.
//
// Order (first difference decides):
//   1. higher `updatedAt` wins                  (last write wins)
//   2. a deletion beats a live record           (a delete is not silently undone by a tie)
//   3. higher `deviceId` string wins            (arbitrary but deterministic)
//   4. higher canonical text wins               (total order on the content)
// 0 means the two versions are identical.

const LIVE_ORDER = ['id', 'ts', 'source', 'behavior', 'hand', 'triggers', 'falsePositive', 'competingResponse', 'confirmed', 'deviceId', 'updatedAt'];
const DELETED_ORDER = ['id', 'ts', 'source', 'behavior', 'deviceId', 'updatedAt'];

/** A fixed-key-order JSON text of an event. A deleted record keeps only what a tombstone keeps. */
export function canonicalEvent(e) {
  const deleted = e.deleted === true;
  const out = {};
  for (const key of deleted ? DELETED_ORDER : LIVE_ORDER) {
    const v = e[key];
    if (v === undefined) continue;
    if (key === 'competingResponse') {
      const cr = { done: v.done };
      if (v.durationSec !== undefined) cr.durationSec = v.durationSec;
      out[key] = cr;
    } else {
      out[key] = v;
    }
  }
  if (deleted) out.deleted = true;
  return JSON.stringify(out);
}

/** > 0 when `a` should replace `b`, < 0 when `b` should stay, 0 when they are the same version. */
export function compareEventVersions(a, b) {
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
