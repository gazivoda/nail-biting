import { useState, useEffect, useCallback } from 'react';
import type { RefObject } from 'react';

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window & typeof globalThis>;
      readonly window: (Window & typeof globalThis) | null;
    };
  }
}

function copyStylesToWindow(win: Window) {
  document.querySelectorAll('style').forEach(el => {
    win.document.head.appendChild(el.cloneNode(true));
  });
  document.querySelectorAll('link[rel="stylesheet"]').forEach(el => {
    win.document.head.appendChild(el.cloneNode(true));
  });
  win.document.documentElement.className = document.documentElement.className;
}

export function usePictureInPicture(videoRef: RefObject<HTMLVideoElement | null>) {
  const [pipActive, setPipActive] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const hasDocPiP = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  const hasVideoPiP =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    document.pictureInPictureEnabled;
  const pipSupported = hasDocPiP || hasVideoPiP;

  // Keep theme class in sync with PiP window
  useEffect(() => {
    if (!pipWindow) return;
    const observer = new MutationObserver(() => {
      if (!pipWindow.closed) {
        pipWindow.document.documentElement.className = document.documentElement.className;
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [pipWindow]);

  const togglePiP = useCallback(async () => {
    if (pipActive) {
      if (pipWindow && !pipWindow.closed) {
        pipWindow.close();
      } else if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => {});
      }
      return;
    }

    // Try Document PiP first (custom UI)
    if (hasDocPiP && window.documentPictureInPicture) {
      try {
        const win = await window.documentPictureInPicture.requestWindow({
          width: 300,
          height: 200,
        });
        copyStylesToWindow(win);
        win.addEventListener('pagehide', () => {
          setPipActive(false);
          setPipWindow(null);
        });
        setPipWindow(win);
        setPipActive(true);
        return;
      } catch {
        // fall through to video PiP
      }
    }

    // Video PiP fallback (raw camera feed)
    const video = videoRef.current;
    if (video && hasVideoPiP) {
      try {
        await video.requestPictureInPicture();
      } catch {
        /* ignore */
      }
    }
  }, [pipActive, pipWindow, hasDocPiP, hasVideoPiP, videoRef]);

  // Video PiP events (fallback only — Document PiP manages state itself)
  useEffect(() => {
    if (hasDocPiP) return;
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
  }, [videoRef, hasDocPiP]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipWindow && !pipWindow.closed) pipWindow.close();
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, [pipWindow]);

  return { pipActive, pipWindow, pipSupported, togglePiP };
}
