// The pause / meeting-mode state machine (WS7a). Pure: no DOM, no storage, no timers, no clock of its own.
// The caller passes `now` in every event that needs it, so every transition is testable and a pause can never
// depend on a timer having fired on time.
//
//   stopped  the person is not watching (the camera switch is off)
//   running  watching normally
//   paused   watching is suspended until `until`: no inference and (where the browser remembers camera consent)
//            the camera is released, so the indicator light is off and nothing is computed
//   meeting  watching goes on, silent: no sound, no notification, the screen flash only; alarms are still logged
//
// A pause and a meeting both END BY THEMSELVES: `tick(now)` at or after `until` returns to running. Nothing here
// stays on forever, and `restore` refuses a stored end time that is in the past or implausibly far away (a clock
// that was wrong when it was written), so a bad value cannot leave watching switched off or silenced.
//
// The camera switch itself (`cameraEnabled` in the app store) is NOT part of this machine: it is dropped on every
// reload and owned by the Start/Stop buttons. The machine mirrors it (`start` / `stop`) and layers pause and
// meeting on top. Consequence: reloading while paused keeps the pause (camera stays off), and Stop clears it.

/** Same bound the tray enforces in src/desktop/ipc.ts (27 hours): "until tomorrow" is never more than 26. */
export const MAX_PAUSE_MINUTES = 1620;
/** Meeting mode lasts at most this long; the buttons offer 30, 60 and 120 minutes. */
export const MAX_MEETING_MINUTES = 12 * 60;

const MINUTE_MS = 60_000;

export type WatchState =
  | { kind: 'stopped' }
  | { kind: 'running' }
  | { kind: 'paused'; until: number; releaseCamera: boolean }
  | { kind: 'meeting'; until: number };

export type WatchEvent =
  | { type: 'start' }
  | { type: 'stop' }
  /** Pause for `minutes` from `now`. `releaseCamera` false keeps the stream open (see `shouldReleaseCamera`). */
  | { type: 'pause'; now: number; minutes: number; releaseCamera?: boolean }
  /** Pause until an exact time, for "until tomorrow". */
  | { type: 'pauseUntil'; now: number; until: number; releaseCamera?: boolean }
  /** Ends a pause or a meeting. Does nothing when neither is on. */
  | { type: 'resume' }
  | { type: 'meeting'; now: number; minutes: number }
  | { type: 'tick'; now: number };

export const INITIAL_WATCH_STATE: WatchState = { kind: 'running' };

const validMinutes = (m: number, max: number) => Number.isFinite(m) && m >= 1 && m <= max;
const validUntil = (now: number, until: number, maxMinutes: number) =>
  Number.isFinite(now) && Number.isFinite(until) && until > now && until - now <= maxMinutes * MINUTE_MS;

/**
 * The transition function. Returns the SAME object when nothing changes, so a subscriber can compare by identity.
 * Events that make no sense in a state (pausing while stopped, resuming while running) change nothing.
 */
export function reduceWatch(state: WatchState, event: WatchEvent): WatchState {
  switch (event.type) {
    case 'start':
      return state.kind === 'stopped' || state.kind === 'paused' ? { kind: 'running' } : state;

    case 'stop':
      return state.kind === 'stopped' ? state : { kind: 'stopped' };

    case 'pause': {
      if (state.kind === 'stopped' || !validMinutes(event.minutes, MAX_PAUSE_MINUTES)) return state;
      return pausedState(state, event.now + Math.ceil(event.minutes) * MINUTE_MS, event.releaseCamera, event.now);
    }

    case 'pauseUntil': {
      if (state.kind === 'stopped' || !validUntil(event.now, event.until, MAX_PAUSE_MINUTES)) return state;
      return pausedState(state, event.until, event.releaseCamera, event.now);
    }

    case 'resume':
      return state.kind === 'paused' || state.kind === 'meeting' ? { kind: 'running' } : state;

    case 'meeting': {
      if (state.kind === 'stopped' || !validMinutes(event.minutes, MAX_MEETING_MINUTES)) return state;
      const until = event.now + Math.ceil(event.minutes) * MINUTE_MS;
      if (state.kind === 'meeting' && state.until === until) return state;
      return { kind: 'meeting', until };
    }

    case 'tick': {
      if (!Number.isFinite(event.now)) return state;
      if ((state.kind === 'paused' || state.kind === 'meeting') && event.now >= state.until) return { kind: 'running' };
      return state;
    }
  }
}

function pausedState(state: WatchState, until: number, releaseCamera: boolean | undefined, now: number): WatchState {
  if (!validUntil(now, until, MAX_PAUSE_MINUTES)) return state;
  const release = releaseCamera ?? true;
  if (state.kind === 'paused' && state.until === until && state.releaseCamera === release) return state;
  return { kind: 'paused', until, releaseCamera: release };
}

// ─── what the rest of the app reads ──────────────────────────────────────────

export const isPaused = (s: WatchState): s is Extract<WatchState, { kind: 'paused' }> => s.kind === 'paused';
export const isMeeting = (s: WatchState): s is Extract<WatchState, { kind: 'meeting' }> => s.kind === 'meeting';

/** Detection may run: the switch is on and the person has not paused. (Meeting mode keeps watching.) */
export function inferenceEnabled(cameraEnabled: boolean, s: WatchState): boolean {
  return cameraEnabled && s.kind !== 'paused';
}

/** The camera stream may be open: as above, and released while paused when the browser remembers consent. */
export function cameraStreamEnabled(cameraEnabled: boolean, s: WatchState): boolean {
  return cameraEnabled && !(s.kind === 'paused' && s.releaseCamera);
}

/**
 * Release the camera on pause only where the browser will let us have it back without asking. Chromium reports
 * `granted` and remembers it for the site. Firefox and Safari either do not answer the query or ask again on
 * every getUserMedia: an automatic resume (possibly in a tab nobody is looking at) would then fail silently, so
 * there the stream stays open and only the inference stops.
 */
export function shouldReleaseCamera(permission: string | null | undefined): boolean {
  return permission === 'granted';
}

/** What an alarm may do right now. Meeting mode is flash only; a pause has no alarms because nothing runs. */
export function effectiveAlertType(alertType: 'sound' | 'flash' | 'both', s: WatchState): 'sound' | 'flash' | 'both' {
  return s.kind === 'meeting' ? 'flash' : alertType;
}

/** True while alarms must make no sound and raise no notification. */
export const isSilent = (s: WatchState): boolean => s.kind === 'meeting';

/** The end time to show and to report to the tray, or null. */
export function endsAt(s: WatchState): number | null {
  return s.kind === 'paused' || s.kind === 'meeting' ? s.until : null;
}

/** The detail of the `stopbiting:desktop-state` event (src/desktop/events.ts). */
export function desktopPauseDetail(s: WatchState): { paused: boolean; pausedUntil: number | null } {
  return s.kind === 'paused' ? { paused: true, pausedUntil: s.until } : { paused: false, pausedUntil: null };
}

// ─── persistence ─────────────────────────────────────────────────────────────

export type SavedWatch = { v: 1; pausedUntil: number | null; meetingUntil: number | null };

/** What is written to the key-value store. `stopped` is not saved: the camera switch starts on at every load. */
export function serializeWatch(s: WatchState): SavedWatch {
  return {
    v: 1,
    pausedUntil: s.kind === 'paused' ? s.until : null,
    meetingUntil: s.kind === 'meeting' ? s.until : null,
  };
}

/**
 * The state to start from after a load. Anything unreadable, expired, in the past or too far ahead is dropped:
 * a stored end time must be in (now, now + the maximum], or the app simply starts running.
 */
export function restoreWatch(saved: unknown, now: number): WatchState {
  if (typeof saved !== 'object' || saved === null) return INITIAL_WATCH_STATE;
  const { pausedUntil, meetingUntil } = saved as Record<string, unknown>;
  if (typeof pausedUntil === 'number' && validUntil(now, pausedUntil, MAX_PAUSE_MINUTES)) {
    // The camera is not open at load, so there is nothing to keep: releasing is always right here.
    return { kind: 'paused', until: pausedUntil, releaseCamera: true };
  }
  if (typeof meetingUntil === 'number' && validUntil(now, meetingUntil, MAX_MEETING_MINUTES)) {
    return { kind: 'meeting', until: meetingUntil };
  }
  return INITIAL_WATCH_STATE;
}

// ─── "until tomorrow" ────────────────────────────────────────────────────────

/** 06:00, used when the person has no schedule. */
export const DEFAULT_MORNING_MINUTES = 6 * 60;
/** A "tomorrow" that is only minutes away is not tomorrow: at least this far ahead. */
const TOMORROW_MIN_GAP_MS = 2 * 60 * MINUTE_MS;

/**
 * "Until tomorrow": the next local time of `startMinutes` (minutes after midnight; the start of the person's
 * scheduled hours, else 06:00) that is at least two hours away. At 22:00 that is tomorrow morning; at 02:00 with
 * a 06:00 start it is the same morning; at 05:00 it is tomorrow's (an hour away would not be "tomorrow").
 * Built from local calendar fields, so a daylight-saving change moves it with the clock, not by 24 hours.
 * The tray (src/desktop/trayModel.ts) uses a fixed 08:00 and sends minutes; see docs/agents/ws7a-notes.md.
 */
export function untilTomorrow(now: Date, startMinutes: number | null = null): number {
  const start = startMinutes !== null && startMinutes >= 0 && startMinutes < 1440 ? Math.floor(startMinutes) : DEFAULT_MORNING_MINUTES;
  const earliest = now.getTime() + TOMORROW_MIN_GAP_MS;
  const at = (dayOffset: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, Math.floor(start / 60), start % 60, 0, 0).getTime();
  let day = 0;
  while (at(day) < earliest) day += 1;
  return at(day);
}

// ─── words ───────────────────────────────────────────────────────────────────

export type ClockFormatter = (ts: number) => string;
const defaultClock: ClockFormatter = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "3:45 PM", "tomorrow 6:00 AM" or "Sat 6:00 AM": when it ends, in local time, for a label. */
export function describeEnd(until: number, now: number, clock: ClockFormatter = defaultClock): string {
  const d = new Date(until);
  const today = new Date(now);
  const dayDiff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000,
  );
  const time = clock(until);
  if (dayDiff <= 0) return time;
  if (dayDiff === 1) return `tomorrow ${time}`;
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${time}`;
}

/** Whole minutes left, rounded up (never 0 while time remains). */
export function minutesLeft(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / MINUTE_MS));
}
