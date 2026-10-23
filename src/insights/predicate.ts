// What the insights count, in one place.
//
// EVENT SEMANTICS (WS5). A chart, a milestone and the weekly email must agree with the History page about
// what a "bite" is, so every client-side count in src/insights goes through the functions below, and they in
// turn use the app-wide predicates (WS3, src/storage/eventModel.ts and `isBite` in the store; the state table
// is in eventModel.ts and docs/agents/ws3-notes.md):
//
//  - a BITE is `isBite`: hand-logged, or an alarm the person confirmed; never an urge-timer entry and never
//    an alarm marked "Not a bite" (`isFalsePositive`, which outranks `confirmed`);
//  - an ALARM that stands is an auto-detected entry that is not marked "Not a bite";
//  - an ENTRY is `isAlarmOrBite` (the History chart's "All"): neither an urge nor a false positive.
//
// Tombstones (deleted events) never reach `state.incidents` (deleteIncident moves them to `state.tombstones`),
// but events that arrive from elsewhere carry `deleted: true`, so the predicates check it too.
//
// The server keeps its own copy of the same rule for the weekly email (server/weeklyEmail/summary.js:
// `isCountedBiteEvent`, with `isFalsePositiveEvent` as its one swap point), because server code cannot import
// from src/. server/weeklyEmail/parity.test.js runs one history through both and fails if they disagree.

import { isBite } from '../store/useAppStore';
import { isAlarmOrBite, isFalsePositive } from '../storage/eventModel';
import type { Incident } from '../types';

/** The fields the insights read. An `Incident` (the store's record) satisfies this; so does a v1-shaped literal. */
export type InsightEvent = Pick<Incident, 'id' | 'timestamp' | 'tag' | 'autoDetected'> &
  Partial<Pick<Incident, 'confirmed' | 'falsePositive' | 'competingResponse' | 'behavior' | 'ts' | 'source' | 'deleted'>>;

/** WS3's predicate, re-exported so the insights tests (and the counts below) read the field in one place. */
export { isFalsePositive };

const isDeleted = (e: Pick<InsightEvent, 'deleted'>): boolean => e.deleted === true;

/** A bite that counts: `isBite` (confirmed or hand-logged, not an urge, not a false positive), and not deleted. */
export function countsAsBite(e: InsightEvent): boolean {
  return !isDeleted(e) && isBite(e as Incident);
}

/** An alarm the detector raised that still stands: not deleted, not marked "Not a bite". Confirmed or not. */
export function countsAsAlarm(e: InsightEvent): boolean {
  return e.autoDetected === true && !isDeleted(e) && !isFalsePositive(e);
}

/** An alarm or a bite that stands (what the "All" chart counts): never an urge, a false positive or a deleted entry. */
export function countsAsEntry(e: InsightEvent): boolean {
  return !isDeleted(e) && isAlarmOrBite(e);
}

/** Every alarm the detector raised that is not deleted, including the ones marked "Not a bite" (the false-alarm rate's denominator). */
export function isRaisedAlarm(e: InsightEvent): boolean {
  return e.autoDetected === true && !isDeleted(e);
}
