// Why the diary's camera did not open, in words a person can act on. The diary
// opens its OWN camera stream (it never shares or touches the one detection uses),
// so it needs its own small mapping from the browser's error names. Pure.

export type CameraProblemKind = 'permission-denied' | 'no-camera' | 'busy' | 'insecure-context' | 'unknown';

export interface CameraProblem {
  kind: CameraProblemKind;
  title: string;
  detail: string;
  /** True when the cause is the app's own watching (detection) holding the camera. */
  watchingIsUsingIt: boolean;
}

/** The browser's error name, from a DOMException or anything shaped like one. */
function errorName(err: unknown): string {
  return typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
}

export function classifyCameraError(err: unknown): CameraProblemKind {
  switch (errorName(err)) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'permission-denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no-camera';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy';
    default:
      return 'unknown';
  }
}

/**
 * The message for a problem. `detectionRunning` is whether Stop Biting itself is
 * watching right now (the Watch tab holds the camera); it only changes the wording
 * of the "busy" case, where it names the likely cause and the fix.
 */
export function describeCameraProblem(kind: CameraProblemKind, detectionRunning: boolean): CameraProblem {
  switch (kind) {
    case 'permission-denied':
      return {
        kind,
        title: 'The camera is blocked',
        detail: 'Your browser did not allow camera access. Allow it for this site in the address bar or in your browser settings, then try again.',
        watchingIsUsingIt: false,
      };
    case 'no-camera':
      return {
        kind,
        title: 'No camera found',
        detail: 'Connect a webcam, or check that it is switched on and not blocked by a privacy switch, then try again.',
        watchingIsUsingIt: false,
      };
    case 'busy':
      return detectionRunning
        ? {
            kind,
            title: 'Watching is using the camera',
            detail: 'Your camera would not open a second time while watching is on. Stop watching, take the photo, then start watching again from the Watch tab.',
            watchingIsUsingIt: true,
          }
        : {
            kind,
            title: 'The camera is busy',
            detail: 'Another app or browser tab is using the camera. Close it, then try again.',
            watchingIsUsingIt: false,
          };
    case 'insecure-context':
      return {
        kind,
        title: 'The camera needs a secure page',
        detail: 'Cameras only work on https pages (or localhost). Open Stop Biting at its https address and try again.',
        watchingIsUsingIt: false,
      };
    default:
      return {
        kind: 'unknown',
        title: 'The camera did not start',
        detail: 'Something went wrong while opening the camera. Try again, or reload the page.',
        watchingIsUsingIt: false,
      };
  }
}

export function problemFromError(err: unknown, detectionRunning: boolean): CameraProblem {
  return describeCameraProblem(classifyCameraError(err), detectionRunning);
}
