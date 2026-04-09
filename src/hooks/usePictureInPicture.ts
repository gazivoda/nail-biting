import { useState, useEffect, useCallback } from 'react';
import type { RefObject } from 'react';

/**
 * Hook to manage Picture-in-Picture mode for a video element.
 * When PiP is active, the browser treats the video as visible even when
 * the tab is minimized, allowing detection to continue.
 */
export function usePictureInPicture(videoRef: RefObject<HTMLVideoElement | null>) {
  const [pipActive, setPipActive] = useState(false);

  // Check if PiP is supported
  const supported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

  // Sync state with browser PiP events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setPipActive(true);
    const onLeave = () => setPipActive(false);

    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [videoRef]);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !supported) return;

    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP toggle failed:', err);
    }
  }, [videoRef, supported]);

  // Clean up PiP on unmount (e.g. camera disabled)
  useEffect(() => {
    return () => {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, []);

  return { pipActive, pipSupported: supported, togglePiP };
}
