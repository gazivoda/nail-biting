// What the insights count, in one place.
//
// EVENT SEMANTICS (WS5). A chart, a milestone and the weekly email must agree on what a
// "bite" is, so every client-side count in src/insights goes through the functions below.
//
//  - A BITE is what the rest of the app already calls one (`isBite`, WS2): logged by hand,
//    or an alarm the person confirmed, and not an urge-timer entry.
//  - ... and not a FALSE POSITIVE ("Not a bite", WS3), and not deleted.
//
// ┌─ SWAP POINT ───────────────────────────────────────────────────────────────────────────┐
// │ `isFalsePositive` is the ONE function that reads the `falsePositive` field. WS3 is      │
// │ adding app-wide predicates for the same idea: when its branch merges, replace the body  │
// │ of `isFalsePositive` with a call to WS3's predicate (or delete it and import theirs).   │
// │ Nothing else in src/insights reads the field. The server keeps its own copy of the      │
// │ idea for the weekly email: `isFalsePositiveEvent` in server/weeklyEmail/summary.js.     │
// └─────────────────────────────────────────────────────────────────────────────────────────┘
//
// Tombstones (deleted events) never reach `state.incidents` (deleteIncident moves them to
// `state.tombstones`), but events that arrive from elsewhere carry `deleted: true`, so the
// predicates check it too.

import { isBite } from '../store/useAppStore';
import { isUrge } from '../storage/eventModel';
import type { Incident } from '../types';

/** The fields the insights read. An `Incident` (the store's record) satisfies this; so does a v1-shaped literal. */
export type InsightEvent = Pick<Incident, 'id' | 'timestamp' | 'tag' | 'autoDetected'> &
  Partial<Pick<Incident, 'confirmed' | 'falsePositive' | 'competingResponse' | 'behavior' | 'ts' | 'source' | 'deleted'>>;

/** SWAP POINT for WS3 (see the header). Marked "Not a bite" by the person. */
export function isFalsePositive(e: Pick<InsightEvent, 'falsePositive'>): boolean {
  return e.falsePositive === true;
}

const isDeleted = (e: Pick<InsightEvent, 'deleted'>): boolean => e.deleted === true;

/** A bite that counts: confirmed or hand-logged, not an urge, not a false positive, not deleted. */
export function countsAsBite(e: InsightEvent): boolean {
  return !isDeleted(e) && !isFalsePositive(e) && isBite(e as Incident);
}

/** An alarm the detector raised that still stands: not deleted, not marked "Not a bite". Confirmed or not. */
export function countsAsAlarm(e: InsightEvent): boolean {
  return e.autoDetected === true && !isDeleted(e) && !isFalsePositive(e);
}

/** An alarm or a bite that stands (what the "All" chart counts): never an urge, a false positive or a deleted entry. */
export function countsAsEntry(e: InsightEvent): boolean {
  return !isDeleted(e) && !isFalsePositive(e) && !isUrge(e);
}

/** Every alarm the detector raised that is not deleted, including the ones marked "Not a bite" (the false-alarm rate's denominator). */
export function isRaisedAlarm(e: InsightEvent): boolean {
  return e.autoDetected === true && !isDeleted(e);
}
