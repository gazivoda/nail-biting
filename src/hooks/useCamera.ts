import { useRef, useEffect, useState } from 'react';

/**
 * Why the camera isn't running. Every failure used to collapse into a
 * `console.error`, so a denied permission, a missing webcam and an insecure
 * origin all looked identical to the user: a dead black box.
 */
export type CameraError =
  | { kind: 'insecure-context' }
  | { kind: 'permission-denied' }
  | { kind: 'no-camera' }
  | { kind: 'unavailable' };

// getUserMedia rejects with a DOMException whose `name` is the real signal.
function toCameraError(err: unknown): CameraError {
  const name =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name: unknown }).name)
      : '';

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { kind: 'permission-denied' };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { kind: 'no-camera' };
    default:
      // e.g. NotReadableError — hardware busy in another app
      return { kind: 'unavailable' };
  }
}

export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<CameraError | null>(null);

  useEffect(() => {
    if (!enabled) {
      setError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          console.error('Camera unavailable: page must be served over HTTPS');
          setError({ kind: 'insecure-context' });
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setError(null);
      } catch (err) {
        if (!cancelled) {
          console.error('Camera start failed:', err);
          setError(toCameraError(err));
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled]);

  return { videoRef, error };
}
