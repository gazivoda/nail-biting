// Logging an urge-timer session through the storage module (WS2).
//
// "I feel an urge" is NOT "I just bit my nails" (PanicButton): it records an
// urge that was felt. It is a manual event whose trigger is `urge`; isBite /
// isUrge keep it out of the streak and every bite count (see eventModel.ts).
// `events.add` is the right call for a manual log from a new surface (it does
// not merge episodes; ARCHITECTURE section 4).

import { events } from '../storage';
import type { CoachingPatch } from './session';

/** Records the urge when the timer starts. Returns the new event's id. */
export function logUrge(): string {
  return events.add({ source: 'manual', triggers: ['urge'] }).id;
}

/** Saves how the timer went: `done` when it ran to the end or was marked done. */
export function finishUrge(eventId: string, patch: CoachingPatch): void {
  events.update(eventId, { competingResponse: patch });
}

/** Undo: removes the entry (a tombstone is kept for sync, like any delete). */
export function undoUrge(eventId: string): void {
  events.softDelete(eventId);
}
