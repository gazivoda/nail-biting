// What "Not a bite" does (WS3). One place, used by the toast, the minimized window's button, History,
// and the ReplacementPrompt, so they all do the same things in the same order:
//
//   1. If a coaching prompt is running for THIS alarm, end it with Skip. The prompt is optional by
//      design and an alarm the person has just called false needs no "try this instead". Skip saves
//      "not done" on the alarm's event, which is then outranked by the mark (coachingStats leaves
//      false positives out).
//   2. Mark the event `falsePositive: true` through the storage module (stamps updatedAt; the streak and
//      every count re-derive, because isBite and the other predicates follow the mark).
//   3. Tell the engine to stop the alarm that is sounding and not restart it while the hand stays
//      (requestSilence; dropped by the engine if nothing is sounding).
//   4. Remember the pose the alarm started with, on this device only (poseStore), so a like pose is
//      treated with more care next time. Never written to the event.
//
// Undo reverses 2 and 4. `falsePositive: false` rather than removing the field, so a later sync sees a
// newer value.

import { events } from '../storage';
import { alarmCoaching } from '../coaching/controller';
import { requestSilence } from '../detection/controlsRegistry';
import { alarmPoseAt, forgetRejection, learnFromRejection } from './poseStore';

/** Marks an alarm "Not a bite". Returns false if there is no such entry. */
export function markNotABite(eventId: string): boolean {
  const event = events.get(eventId);
  if (!event) return false;

  try {
    const session = alarmCoaching.getState().session;
    if (session.phase === 'running' && session.eventId === eventId) alarmCoaching.skip();
  } catch { /* an optional prompt must never stop this */ }

  events.update(eventId, { falsePositive: true });
  requestSilence();

  try {
    const pose = alarmPoseAt(event.ts);
    if (pose) learnFromRejection(eventId, pose);
  } catch { /* learning is a bonus; the mark above is what the person asked for */ }
  return true;
}

/** Takes the mark off. Returns false if there is no such entry. */
export function undoNotABite(eventId: string): boolean {
  if (!events.get(eventId)) return false;
  events.update(eventId, { falsePositive: false });
  try { forgetRejection(eventId); } catch { /* ignored */ }
  return true;
}
