// Where the engine finds the false-alarm controls (WS3).
//
// A module-level slot, empty until the app fills it. The app fills it (src/falsePositive/
// FalsePositiveBridge) only while the `false_positive_controls` flag is on and takes it away when
// the flag goes off or the screen goes away, so with the flag off `getDetectionControls()` is null
// and the engine takes the exact path it took before this feature existed.
//
// Why a slot and not a parameter of useDetection: the detection loop belongs to another workstream
// (WS7a). The engine reads this through `createBiteDetector`'s default, and the one line that
// touches the loop file is the hand source (handedness.ts).
//
// No imports of the store, storage or React: src/detection/** is read under plain Node by the
// evaluation harness and by the landing-page demo's bundle.

import type { Hand } from '../storage/eventModel.ts';
import type { DetectionControls, FireInfo } from './controls.ts';

let active: DetectionControls | null = null;
let lastFire: FireInfo | null = null;
let silenceRequested = false;

export function getDetectionControls(): DetectionControls | null {
  return active;
}

/** Registers the controls (or removes them with null). Removing them also forgets any pending silence request. */
export function setDetectionControls(controls: DetectionControls | null): void {
  active = controls;
  if (controls === null) { silenceRequested = false; lastFire = null; }
}

/** The engine reports where it started an alarm; the app reads it to record `hand` and to remember the pose if the alarm is rejected. */
export function noteFire(info: FireInfo): void {
  lastFire = info;
}

/** The most recent alarm start, if it was within `withinMs` of `now` (so a stale one is never attached to a later event). */
export function recentFire(now: number, withinMs = 3000): FireInfo | null {
  return lastFire !== null && Math.abs(now - lastFire.at) <= withinMs ? lastFire : null;
}

/**
 * What to add to the event of an alarm that has just started: the hand it came from, as the person
 * sees it. Empty with no controls registered (the flag off), so the event is exactly what it was
 * before this feature. The extras CameraView.handleAlert passes to logIncident.
 */
export function alarmHandExtras(now: number = Date.now()): { hand?: Hand } {
  const fire = recentFire(now);
  return fire ? { hand: fire.hand } : {};
}

/**
 * "Not a bite" while an alarm is sounding: asks the engine to stop it and not start it again for as
 * long as the hand stays where it is. The engine acts on the request at its next frame only if an
 * alarm is active at that moment, so a stray request (the alarm already ended, or a tap from
 * History hours later) is simply dropped and can never swallow a later, real alarm.
 */
export function requestSilence(): void {
  if (active !== null) silenceRequested = true;
}

/** Engine side: true once if a silence was requested. */
export function takeSilenceRequest(): boolean {
  const was = silenceRequested;
  silenceRequested = false;
  return was;
}
