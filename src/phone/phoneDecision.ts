// When the phone view replaces the camera dashboard (WS6, flag `phone_companion`).
// Pure functions, no React and no DOM imports, so they are tested in node.
//
// The phone view is for a device that cannot watch for the habit: a phone, or a
// computer with no webcam. It is chosen once per page load, never live, so
// turning a phone sideways does not swap the whole screen.

/**
 * A phone: a touch-only pointer AND a small screen. The second clause keeps a
 * phone in landscape (wider than 767 px but never taller than 500 px) on the
 * phone view; `useIsPhone` (marketing pages) does not need it, this does,
 * because here the choice changes the whole app. A tablet is taller than 500 px
 * in both orientations and keeps the full app. A desktop window resized small
 * still has a mouse, so it keeps the full app.
 */
export const PHONE_VIEW_QUERY =
  '(pointer: coarse) and (max-width: 767px), (pointer: coarse) and (max-height: 500px)';

type MatchMedia = (query: string) => { matches: boolean };

export function isPhoneView(matchMedia: MatchMedia | undefined): boolean {
  try {
    return !!matchMedia && matchMedia(PHONE_VIEW_QUERY).matches;
  } catch {
    return false;
  }
}

interface DeviceLister {
  enumerateDevices?: () => Promise<ReadonlyArray<{ kind: string }>>;
}

/**
 * True only when the browser positively says there is no camera: it returned a
 * non-empty device list with no `videoinput` in it. This never asks for
 * permission and never opens a camera.
 *
 * Anything uncertain is false (the full app stays): a browser with no
 * `mediaDevices` (an insecure page), a call that throws, and an EMPTY list.
 * The empty list matters: Safari answers with nothing at all until the page has
 * been granted capture permission, so an empty list says nothing about hardware
 * and must not move a Mac with a camera onto the phone view.
 */
export async function hasNoWebcam(devices: DeviceLister | undefined): Promise<boolean> {
  try {
    if (!devices || typeof devices.enumerateDevices !== 'function') return false;
    const list = await devices.enumerateDevices();
    if (!Array.isArray(list) || list.length === 0) return false;
    return !list.some(d => d.kind === 'videoinput');
  } catch {
    return false;
  }
}

export interface PhoneViewInputs {
  /** `phone_companion` is on (the owner's switch). */
  flagOn: boolean;
  /** `isPhoneView` at page load. */
  phoneLike: boolean;
  /** `hasNoWebcam`, or null while it has not been asked or answered. */
  noWebcam: boolean | null;
  /** The person chose "Open the full app" in this page load. */
  fullApp: boolean;
}

/** Whether the phone view replaces the camera dashboard. */
export function decidePhoneView({ flagOn, phoneLike, noWebcam, fullApp }: PhoneViewInputs): boolean {
  if (!flagOn || fullApp) return false;
  return phoneLike || noWebcam === true;
}
