/**
 * The tray menu as plain data (WS7b). `buildTrayMenu` turns the app state into
 * a list of items with stable ids; the Electron side maps each id to an action
 * and rebuilds the menu whenever the state changes. No Electron import, so it
 * is unit-tested in node.
 */

import type { DesktopState } from './ipc';

export type TrayItemId =
  | 'open'
  | 'status'
  | 'toggle'
  | 'pause-15m'
  | 'pause-1h'
  | 'pause-tomorrow'
  | 'resume'
  | 'login'
  | 'quit';

export type TrayMenuItem =
  | { type: 'separator' }
  | {
      type: 'normal' | 'checkbox';
      id: TrayItemId;
      label: string;
      enabled: boolean;
      checked?: boolean;
    };

export type TrayModelInput = {
  state: DesktopState;
  /** The user's choice, mirrored from the OS where the OS can answer. */
  launchAtLogin: boolean;
  /** 'supported' = toggleable; 'dev-only' = the build is not installed, so shown disabled; 'unsupported' = hidden. */
  loginItem: 'supported' | 'dev-only' | 'unsupported';
  now: number;
};

// ─── Pausing ──────────────────────────────────────────────────────────────────

export type PauseChoice = '15m' | '1h' | 'tomorrow';

/** "Until tomorrow" resumes at this local hour. One place to change it. */
export const TOMORROW_RESUME_HOUR = 8;
/** ...but never fewer than this many hours away (7:59 pm is not "tomorrow" in 1 minute). */
const TOMORROW_MIN_GAP_HOURS = 2;

/**
 * The next local 08:00 that is at least two hours away. At 22:00 that is 08:00
 * the next morning; at 02:00 it is 08:00 the same morning; at 07:00 it is
 * tomorrow, not in an hour. Always between 2 and 26 hours, so it stays inside
 * `MAX_PAUSE_MINUTES`.
 */
export function nextMorning(now: Date): Date {
  const earliest = now.getTime() + TOMORROW_MIN_GAP_HOURS * 60 * 60 * 1000;
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TOMORROW_RESUME_HOUR, 0, 0, 0);
  while (candidate.getTime() < earliest) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

/** Whole minutes (rounded up, at least 1) for a pause choice. */
export function pauseMinutes(choice: PauseChoice, now: Date): number {
  if (choice === '15m') return 15;
  if (choice === '1h') return 60;
  return Math.max(1, Math.ceil((nextMorning(now).getTime() - now.getTime()) / 60000));
}

// ─── Wording ──────────────────────────────────────────────────────────────────

/** "3:45 PM" today, "tomorrow 8:00 AM" the next day, "Fri 8:00 AM" beyond that. */
export function formatResumeTime(until: number, now: number): string {
  const d = new Date(until);
  const h = d.getHours();
  const clock = `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayDiff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - startOfToday) / 86400000);
  if (dayDiff <= 0) return clock;
  if (dayDiff === 1) return `tomorrow ${clock}`;
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${clock}`;
}

export function statusLabel(state: DesktopState, now: number): string {
  if (state.paused) {
    return state.pausedUntil ? `Paused until ${formatResumeTime(state.pausedUntil, now)}` : 'Paused';
  }
  return state.watching ? 'Watching' : 'Not watching';
}

export function trayTooltip(state: DesktopState, now: number): string {
  return `Stop Biting: ${statusLabel(state, now).toLowerCase()}`;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export function buildTrayMenu(input: TrayModelInput): TrayMenuItem[] {
  const { state, launchAtLogin, loginItem, now } = input;
  const active = state.watching || state.paused;
  const canPause = state.pauseSupported && state.watching && !state.paused;

  const items: TrayMenuItem[] = [
    { type: 'normal', id: 'open', label: 'Open Stop Biting', enabled: true },
    { type: 'separator' },
    { type: 'normal', id: 'status', label: statusLabel(state, now), enabled: false },
    { type: 'normal', id: 'toggle', label: active ? 'Stop watching' : 'Start watching', enabled: true },
  ];

  if (state.paused) {
    items.push({ type: 'normal', id: 'resume', label: 'Resume', enabled: true });
  } else {
    items.push(
      { type: 'normal', id: 'pause-15m', label: 'Pause for 15 minutes', enabled: canPause },
      { type: 'normal', id: 'pause-1h', label: 'Pause for 1 hour', enabled: canPause },
      { type: 'normal', id: 'pause-tomorrow', label: 'Pause until tomorrow', enabled: canPause },
    );
  }

  if (loginItem !== 'unsupported') {
    items.push(
      { type: 'separator' },
      {
        type: 'checkbox',
        id: 'login',
        label: loginItem === 'supported' ? 'Launch at login' : 'Launch at login (installed app only)',
        enabled: loginItem === 'supported',
        checked: launchAtLogin,
      },
    );
  }

  items.push({ type: 'separator' }, { type: 'normal', id: 'quit', label: 'Quit Stop Biting', enabled: true });
  return items;
}

// ─── Power ────────────────────────────────────────────────────────────────────

/**
 * Keep the OS from suspending the app (macOS App Nap) while detection is
 * running, so a hidden window keeps watching. Paused or stopped: let it sleep.
 */
export function shouldPreventSuspension(state: DesktopState): boolean {
  return state.watching && !state.paused;
}
