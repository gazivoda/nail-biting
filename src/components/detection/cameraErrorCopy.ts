import type { CameraError } from '../../hooks/useCamera';
import { messages, t } from '../../i18n/scopes/watch';

/**
 * What to tell someone whose camera didn't start, and how to fix it. Shared by
 * the landing demo and the signed-in app so the two never disagree. The app
 * used to drop these errors entirely and keep saying "Detection Active" over a
 * camera that never started.
 *
 * Each entry is a getter: it is read when a screen renders, in the language
 * showing then (src/i18n). Do not copy the values into a module-level constant.
 */
export const CAMERA_ERROR_MESSAGE: Record<CameraError['kind'], string> = {
  get 'permission-denied'() { return t('camera.error.permissionDenied'); },
  get 'no-camera'() { return t('camera.error.noCamera'); },
  get 'insecure-context'() { return t('camera.error.insecureContext'); },
  get 'unavailable'() { return t('camera.error.unavailable'); },
};

/** The detection models failed to download: almost always the connection. Read at render time. */
export function modelErrorMessage(): string {
  return t('camera.error.model');
}

/**
 * The same text as modelErrorMessage() in English, as a plain constant. Kept for the landing-page demo
 * (src/components/demo/HeroDemo.tsx), which is English-only until the marketing pages are localised and reads it
 * as a string. The signed-in app uses modelErrorMessage().
 */
export const MODEL_ERROR_MESSAGE = messages['camera.error.model'];
