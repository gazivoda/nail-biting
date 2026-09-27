import { useEffect, useRef } from 'react';
import type { ReminderInterval } from '../types';
import { SUGGESTIONS } from '../components/dashboard/suggestions';

// A periodic check-in for when detection is off. While the camera is watching,
// the alarm already does this job, and a second nudge every 15 minutes only
// teaches people to ignore both. The body coaches (one thing to do with your
// hands) instead of cheering a streak. `watching` is read through a ref so
// switching the camera on and off does not restart the interval.
export function useNotifications(enabled: boolean, intervalMinutes: ReminderInterval, watching = false) {
  const watchingRef = useRef(watching);
  useEffect(() => { watchingRef.current = watching; }, [watching]);

  useEffect(() => {
    if (!enabled) return;

    const ms = intervalMinutes * 60 * 1000;
    let n = 0;
    const id = setInterval(() => {
      if (watchingRef.current) return;
      const title = 'Hands check';
      const body = `Where are your hands? If they're near your face, try: ${SUGGESTIONS[n++ % SUGGESTIONS.length].toLowerCase()}.`;
      if (window.electronAPI) {
        // Electron: native OS notification, works even when window is hidden
        window.electronAPI.notify(title, body);
      } else if ('Notification' in window && Notification.permission === 'granted') {
        // Browser / PWA fallback
        new Notification(title, {
          body,
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

