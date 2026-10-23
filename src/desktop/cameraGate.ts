/**
 * What to do with a camera permission request from the page (WS7b), before the
 * operating system asks. Pure: main supplies the platform and the OS status.
 *
 * - allow:   let the request through (the OS may still show its own prompt, or
 *            none at all).
 * - explain: macOS has never asked. Hold the request, show the in-app
 *            explanation, and only then trigger the OS prompt. This is what
 *            keeps the first system dialog from arriving unexplained.
 * - blocked: the OS has the camera switched off for this app. Refuse, and tell
 *            the user where to turn it on.
 */

import type { CameraAccess } from './ipc';

export type CameraGate = 'allow' | 'explain' | 'blocked';

export function cameraGate(platform: string, access: CameraAccess): CameraGate {
  if (platform === 'darwin') {
    if (access === 'not-determined') return 'explain';
    if (access === 'denied' || access === 'restricted') return 'blocked';
    return 'allow';
  }
  // Windows has no per-app prompt for desktop apps, only a privacy switch.
  if (platform === 'win32' && access === 'denied') return 'blocked';
  return 'allow';
}

/** Whether a Chromium `media` permission request includes the camera. */
export function wantsVideo(details: { mediaTypes?: readonly string[] } | undefined): boolean {
  const types = details?.mediaTypes;
  return !types || types.length === 0 || types.includes('video');
}

/** The deep link that opens the camera privacy page, per platform. */
export function cameraSettingsUrl(platform: string): string | null {
  if (platform === 'darwin') return 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera';
  if (platform === 'win32') return 'ms-settings:privacy-webcam';
  return null;
}
