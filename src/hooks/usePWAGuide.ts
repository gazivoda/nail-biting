import { useState, useEffect } from 'react';

const SNOOZED_KEY = 'pwa_guide_snoozed_until';
const SHOW_DELAY_MS = 4000;

export type GuidePlatform = 'ios' | 'chromium' | 'unsupported';

function detectPlatform(): GuidePlatform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Chrome\/|Edg\/|SamsungBrowser\//.test(ua)) return 'chromium';
  return 'unsupported';
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (('standalone' in navigator) && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function isSnoozed(): boolean {
  const until = localStorage.getItem(SNOOZED_KEY);
  return !!until && Date.now() < parseInt(until, 10);
}

export function usePWAGuide() {
  const platform = detectPlatform();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || platform === 'unsupported' || isSnoozed()) return;
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [platform]);

  const snooze = (days = 7) => {
    localStorage.setItem(SNOOZED_KEY, String(Date.now() + days * 86_400_000));
    setVisible(false);
  };

  const dismiss = () => setVisible(false);

  return { visible, platform, snooze, dismiss };
}
