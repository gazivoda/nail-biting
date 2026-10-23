// The things a button (Watch tab, mini window, tray) can ask for. Each one is a few lines over the pure machine;
// the only thing they add is the time (`Date.now()`) and the one question the machine cannot answer by itself:
// may the camera be let go of during a pause? (pauseMachine.shouldReleaseCamera)

import { dispatchWatch } from './watchStore';
import { shouldReleaseCamera, untilTomorrow } from './pauseMachine';
import { loadSchedule } from './scheduleStore';
import { pauseMorningMinutes } from './schedule';

/** Whether the browser will give the camera back without asking: only then is it released during a pause. */
export async function cameraReleasable(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return false;
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return shouldReleaseCamera(status.state);
  } catch {
    return false; // Firefox and Safari do not answer for the camera
  }
}

export async function pauseForMinutes(minutes: number): Promise<void> {
  const releaseCamera = await cameraReleasable();
  dispatchWatch({ type: 'pause', now: Date.now(), minutes, releaseCamera });
}

/** "Until tomorrow": the start of the person's scheduled hours, else 06:00 (see untilTomorrow). */
export async function pauseUntilTomorrow(): Promise<void> {
  const releaseCamera = await cameraReleasable();
  const now = Date.now();
  const until = untilTomorrow(new Date(now), pauseMorningMinutes(loadSchedule()));
  dispatchWatch({ type: 'pauseUntil', now, until, releaseCamera });
}

export function startMeeting(minutes: number): void {
  dispatchWatch({ type: 'meeting', now: Date.now(), minutes });
}

/** Ends a pause or a meeting at once. */
export function resumeWatching(): void {
  dispatchWatch({ type: 'resume' });
}
