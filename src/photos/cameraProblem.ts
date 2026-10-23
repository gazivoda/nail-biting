// Why the diary's camera did not open, in words a person can act on. The diary
// opens its OWN camera stream (it never shares or touches the one detection uses),
// so it needs its own small mapping from the browser's error names. The words come
// from the `photos` i18n scope when the message is made, so they are in the language
// showing at that moment.

import { t } from '../i18n/scopes/photos';

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
        title: t('problem.blocked.title'),
        detail: t('problem.blocked.detail'),
        watchingIsUsingIt: false,
      };
    case 'no-camera':
      return {
        kind,
        title: t('problem.noCamera.title'),
        detail: t('problem.noCamera.detail'),
        watchingIsUsingIt: false,
      };
    case 'busy':
      return detectionRunning
        ? {
            kind,
            title: t('problem.watching.title'),
            detail: t('problem.watching.detail'),
            watchingIsUsingIt: true,
          }
        : {
            kind,
            title: t('problem.busy.title'),
            detail: t('problem.busy.detail'),
            watchingIsUsingIt: false,
          };
    case 'insecure-context':
      return {
        kind,
        title: t('problem.insecure.title'),
        detail: t('problem.insecure.detail'),
        watchingIsUsingIt: false,
      };
    default:
      return {
        kind: 'unknown',
        title: t('problem.unknown.title'),
        detail: t('problem.unknown.detail'),
        watchingIsUsingIt: false,
      };
  }
}

export function problemFromError(err: unknown, detectionRunning: boolean): CameraProblem {
  return describeCameraProblem(classifyCameraError(err), detectionRunning);
}
