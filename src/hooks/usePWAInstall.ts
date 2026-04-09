import { useState, useEffect, useCallback } from 'react';

// BeforeInstallPromptEvent is not in the standard TS lib yet
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

/** Whether the app is already running as an installed PWA */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Shared hook for PWA install prompt.
 * Returns the install state and actions for both the bottom banner
 * and the permanent sidebar button.
 */
export function usePWAInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [bannerDismissed, setBannerDismissed] = useState(
    () => !!localStorage.getItem(DISMISSED_KEY)
  );

  useEffect(() => {
    if (installed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    const installHandler = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installHandler);
    };
  }, [installed]);

  const triggerInstall = useCallback(async () => {
    if (!promptEvent) return false;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setPromptEvent(null);
      return true;
    }
    return false;
  }, [promptEvent]);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setBannerDismissed(true);
  }, []);

  return {
    /** Whether the native install prompt is available (Chromium only) */
    canInstall: !!promptEvent && !installed,
    /** Whether the app is already installed as a PWA */
    installed,
    /** Whether the user dismissed the bottom banner */
    bannerDismissed,
    /** Trigger the native install dialog */
    triggerInstall,
    /** Dismiss the bottom banner permanently */
    dismissBanner,
  };
}
