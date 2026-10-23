// "Start watching?" notifications. Two rules this file keeps:
//   1. The browser's permission prompt is only ever shown from `askNotificationPermission`, which Settings calls
//      when the person turns the schedule ON, after explaining why. Nothing else asks.
//   2. A notification is only a nudge: its click focuses the app (browser) or shows the window (desktop). It never
//      starts the camera by itself.

import type { NotificationPermissionState } from './schedule';
import { messages, t } from '../i18n/scopes/background';

// The English wording, from the catalog's source of truth. What is actually shown is built when the notification is
// shown (reminderTitle / reminderBody), in the language of the app at that moment.
export const REMINDER_TITLE = messages['reminder.title'];
export const REMINDER_BODY = messages['reminder.body'];

const reminderTitle = () => t('reminder.title');
const reminderBody = () => t('reminder.body');

/** The state of notification permission right now, without asking for anything. */
export function notificationPermission(): NotificationPermissionState {
  // The desktop app shows native notifications through its own API; the OS decides whether they appear.
  if (typeof window !== 'undefined' && window.desktop) return 'granted';
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export type TurnOnPlan = 'enable' | 'explain' | 'denied' | 'unsupported';

/**
 * What turning the reminders ON should do, given what the browser already decided:
 *   enable      permission is already granted: switch on, ask nothing;
 *   explain     never asked: say why first, and only ask when the person presses the button that says so;
 *   denied      the browser will not prompt again: say how to allow it, switch nothing on;
 *   unsupported no notifications in this browser: say so.
 */
export function planTurnOn(permission: NotificationPermissionState): TurnOnPlan {
  switch (permission) {
    case 'granted': return 'enable';
    case 'default': return 'explain';
    case 'denied': return 'denied';
    default: return 'unsupported';
  }
}

/** Shows the browser's permission prompt. Call it from the click that turns the schedule on, and nowhere else. */
export async function askNotificationPermission(): Promise<NotificationPermissionState> {
  const current = notificationPermission();
  if (current !== 'default') return current; // already decided (or not possible): never prompt again
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return notificationPermission();
  }
}

/** Shows the reminder. Returns true if something was shown. */
export function showStartWatchingReminder(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.desktop) {
    window.desktop.notify({ title: reminderTitle(), body: reminderBody(), clickAction: 'open' });
    return true;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const n = new Notification(reminderTitle(), {
      body: reminderBody(),
      icon: '/icons/icon-192x192.png',
      tag: 'stopbiting-schedule', // a second one replaces the first instead of stacking
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false; // e.g. browsers that only allow notifications from a service worker
  }
}
