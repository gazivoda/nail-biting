import type { CameraError } from '../../hooks/useCamera';

/**
 * What to tell someone whose camera didn't start, and how to fix it. Shared by
 * the landing demo and the signed-in app so the two never disagree. The app
 * used to drop these errors entirely and keep saying "Detection Active" over a
 * camera that never started.
 */
export const CAMERA_ERROR_MESSAGE: Record<CameraError['kind'], string> = {
  'permission-denied':
    "Camera access was blocked. Allow it from the camera icon in your browser's address bar, then try again.",
  'no-camera': 'No camera found. The detector needs a webcam to watch for your hands.',
  'insecure-context': 'The camera needs a secure (HTTPS) connection. Open this page over https:// and try again.',
  'unavailable':
    "Your camera couldn't start: it may be in use by another app. Close anything else using it and try again.",
};

/** The detection models failed to download: almost always the connection. */
export const MODEL_ERROR_MESSAGE = "Detection couldn't load. Check your connection and try again.";
