// Work-hours schedule and the "Start watching?" reminder decision (WS7a). Pure: no DOM, no storage, no clock of
// its own (callers pass `now`), so every rule below is tested, including overnight windows and daylight-saving days.
//
// A schedule is a set of weekdays and one daily window, start to end, in the person's LOCAL time. A window belongs to
// the day it STARTS on: "Fri 22:00 to 06:00" is Friday night into Saturday morning. If the end is not after the
// start, the window runs past midnight. A reminder is allowed once per window, and only inside it.
//
// Local-time arithmetic always goes through calendar fields (`new Date(y, m, d, h, min)`), never "+ 24 hours", so a
// clock change moves a window with the clock: on a spring-forward day a 02:30 start that does not exist begins at
// 03:30 (the browser's own rule), on a fall-back day the repeated hour is still one window (the window id has no
// time zone offset in it, so it cannot fire twice).

import { weekdayShort, type WatchState } from './pauseMachine';
import { formatTime } from '../i18n/format';
import { t } from '../i18n/scopes/background';

export interface Schedule {
  /** Remind me to start watching during these hours. Off by default. */
  enabled: boolean;
  /** Weekdays the window starts on, 0 = Sunday ... 6 = Saturday. Sorted, no duplicates. */
  days: number[];
  /** Minutes after local midnight, 0..1439. */
  startMinutes: number;
  /** Minutes after local midnight, 0..1439. Not after `startMinutes` means "the next morning". */
  endMinutes: number;
}

export const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
};

/** Never trust what came from storage: anything off falls back to the default for that field. */
export function normalizeSchedule(raw: unknown): Schedule {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] };
  const r = raw as Record<string, unknown>;
  const minutes = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1440 ? v : fallback;
  const days = Array.isArray(r.days)
    ? [...new Set(r.days.filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [...DEFAULT_SCHEDULE.days];
  let startMinutes = minutes(r.startMinutes, DEFAULT_SCHEDULE.startMinutes);
  let endMinutes = minutes(r.endMinutes, DEFAULT_SCHEDULE.endMinutes);
  // Start equal to end would be a window of no length (or of a whole day, depending on who reads it): not allowed.
  if (startMinutes === endMinutes) { startMinutes = DEFAULT_SCHEDULE.startMinutes; endMinutes = DEFAULT_SCHEDULE.endMinutes; }
  return { enabled: r.enabled === true, days, startMinutes, endMinutes };
}

/** "09:30" to minutes, or null. */
export function parseClock(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

/** Minutes to "09:30" (what an <input type="time"> uses). */
export function formatClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export const isOvernight = (s: Schedule): boolean => s.endMinutes <= s.startMinutes;

/** A local timestamp from calendar fields. `day` may be out of range (it rolls over the month). */
function localAt(base: Date, dayOffset: number, minutes: number): number {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, Math.floor(minutes / 60), minutes % 60, 0, 0).getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');

export interface ScheduleWindow {
  /** Stable for one window: the date it starts on and its start time. No offset, so DST cannot change it. */
  id: string;
  start: number;
  end: number;
}

function windowStartingOn(s: Schedule, base: Date, dayOffset: number): ScheduleWindow | null {
  const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset);
  if (!s.days.includes(day.getDay())) return null;
  const start = localAt(day, 0, s.startMinutes);
  const end = localAt(day, isOvernight(s) ? 1 : 0, s.endMinutes);
  return { id: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}@${s.startMinutes}`, start, end };
}

/** The window `now` is inside, or null. */
export function windowAt(s: Schedule, now: number): ScheduleWindow | null {
  const base = new Date(now);
  // Today's window, and (for an overnight schedule) the one that began yesterday and runs into this morning.
  for (const offset of isOvernight(s) ? [0, -1] : [0]) {
    const w = windowStartingOn(s, base, offset);
    if (w && w.start <= now && now < w.end) return w;
  }
  return null;
}

export const isInWindow = (s: Schedule, now: number): boolean => windowAt(s, now) !== null;

/** When the next window begins after `from`, or null (no days chosen). Looks a week ahead. */
export function nextWindowStart(s: Schedule, from: number): number | null {
  const base = new Date(from);
  for (let offset = 0; offset <= 7; offset++) {
    const w = windowStartingOn(s, base, offset);
    if (w && w.start > from) return w.start;
  }
  return null;
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface ReminderInput {
  schedule: Schedule;
  now: number;
  watch: WatchState;
  /** The id of the last window a reminder was shown for. */
  lastRemindedId: string | null;
  /** The app is on screen and in front: the Watch tab already offers to start, so no notification. */
  appVisible: boolean;
  permission: NotificationPermissionState;
}

export type ReminderReason =
  | 'ok'
  | 'disabled'
  | 'outside-window'
  | 'already-reminded'
  | 'already-watching'
  | 'paused'
  | 'app-visible'
  | 'no-permission';

export interface ReminderDecision {
  remind: boolean;
  reason: ReminderReason;
  /** The window to remember once the reminder has been shown. */
  windowId: string | null;
}

/**
 * Should a "Start watching?" notification be shown now? Yes only when: the schedule is on, `now` is inside a window,
 * no reminder has been shown for that window, watching is not already on, the person has not paused, the app is not
 * already in front of them, and notifications are allowed. Everything else is a no. A "not now" for a reason that can
 * pass (the app is in front) does not use up the window.
 */
export function decideReminder(input: ReminderInput): ReminderDecision {
  const { schedule, now, watch, lastRemindedId, appVisible, permission } = input;
  const no = (reason: ReminderReason, windowId: string | null = null): ReminderDecision => ({ remind: false, reason, windowId });
  if (!schedule.enabled) return no('disabled');
  const w = windowAt(schedule, now);
  if (!w) return no('outside-window');
  if (lastRemindedId === w.id) return no('already-reminded', w.id);
  if (permission !== 'granted') return no('no-permission', w.id);
  if (watch.kind === 'paused') return no('paused', w.id);
  if (watch.kind === 'running' || watch.kind === 'meeting') return no('already-watching', w.id);
  if (appVisible) return no('app-visible', w.id);
  return { remind: true, reason: 'ok', windowId: w.id };
}

/** The start of the scheduled hours for "pause until tomorrow", or null when there is no schedule to follow. */
export function pauseMorningMinutes(s: Schedule): number | null {
  return s.enabled && s.days.length > 0 ? s.startMinutes : null;
}

/** "9:00 AM to 5:00 PM, Mon to Fri" in words, for the settings card. */
export function describeSchedule(s: Schedule, clock: (minutes: number) => string = defaultClock): string {
  const days = s.days.length === 0
    ? t('schedule.days.none')
    : s.days.length === 7 ? t('schedule.days.every')
    : s.days.join(',') === '1,2,3,4,5' ? t('schedule.days.weekdays')
    : s.days.map(weekdayShort).join(', ');
  return t(isOvernight(s) ? 'schedule.describe.overnight' : 'schedule.describe', {
    start: clock(s.startMinutes),
    end: clock(s.endMinutes),
    days,
  });
}

function defaultClock(minutes: number): string {
  return formatTime(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
}

const WEEKDAY_LONG = ['day.0.long', 'day.1.long', 'day.2.long', 'day.3.long', 'day.4.long', 'day.5.long', 'day.6.long'] as const;

/** "Sunday" ... "Saturday" for a weekday number (0 = Sunday), in the language of the app. For screen readers. */
export const weekdayLong = (day: number): string => t(WEEKDAY_LONG[day]);
