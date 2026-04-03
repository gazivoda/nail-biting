import { useEffect } from 'react';
import type { ReminderInterval } from '../types';

export function useNotifications(enabled: boolean, intervalMinutes: ReminderInterval) {
  useEffect(() => {
    if (!enabled) return;

    const ms = intervalMinutes * 60 * 1000;
    const id = setInterval(() => {
      if (window.electronAPI) {
        // Electron: native OS notification, works even when window is hidden
        window.electronAPI.notify('Nail check!', 'How are your hands? Keep that streak going!');
      } else if ('Notification' in window && Notification.permission === 'granted') {
        // Browser / PWA fallback
        new Notification('Nail check!', {
          body: 'How are your hands? Keep that streak going!',
          icon: '/icons/icon-192x192.png',
          tag: 'nail-reminder',
        });
      }
    }, ms);

    return () => clearInterval(id);
  }, [enabled, intervalMinutes]);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (window.electronAPI) return 'granted';
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

