// The four small connections BackgroundRunner makes, as functions whose every dependency is passed in, so each is
// tested in node with fakes (wiring.test.ts) and the component is only the place that hands them the real ones.
//
//   mirrorCameraSwitch   the Start/Stop switch -> the pause machine
//   runExpiryClock       the machine's clock: a pause or meeting ends by itself
//   connectDesktop       the tray: stopbiting:desktop-command in, stopbiting:desktop-state out (ws7b-notes.md)
//   checkReminder        one evaluation of the "Start watching?" schedule

import { DESKTOP_COMMAND_EVENT, DESKTOP_STATE_EVENT } from '../desktop/events';
import { desktopPauseDetail, type WatchEvent, type WatchState } from './pauseMachine';
import { decideReminder, type NotificationPermissionState, type Schedule } from './schedule';

type Dispatch = (event: WatchEvent) => unknown;

// ─── the camera switch ───────────────────────────────────────────────────────

/**
 * Mirrors the person's own on/off switch into the machine. `cameraEnabled` starts on at every load, so only CHANGES
 * are mirrored (a pause that is still running must survive a reload); the one thing done at start is `stop` when the
 * switch is already off.
 */
export function mirrorCameraSwitch(deps: {
  getCameraEnabled(): boolean;
  /** Calls the listener with (enabled, previouslyEnabled) on every change of the switch. Returns the unsubscribe. */
  subscribe(listener: (enabled: boolean, previous: boolean) => void): () => void;
  dispatch: Dispatch;
}): () => void {
  if (!deps.getCameraEnabled()) deps.dispatch({ type: 'stop' });
  return deps.subscribe((enabled, previous) => {
    if (enabled !== previous) deps.dispatch({ type: enabled ? 'start' : 'stop' });
  });
}

// ─── the clock ───────────────────────────────────────────────────────────────

/**
 * Checks `tick` once a second while (and only while) a pause or meeting is on, and also when the tab wakes up.
 * `every` is the worker-backed ticker, so a hidden tab does not make a pause end late.
 */
export function runExpiryClock(deps: {
  getState(): WatchState;
  subscribe(listener: () => void): () => void;
  every(ms: number, fn: () => void): () => void;
  dispatch: Dispatch;
  now(): number;
  /** (target, event name) pairs that mean "the tab may have been asleep": check the clock now. */
  wake?: ReadonlyArray<readonly [EventTarget, string]>;
  isVisible?(): boolean;
}): () => void {
  let stopClock: (() => void) | null = null;
  const tick = () => { deps.dispatch({ type: 'tick', now: deps.now() }); };
  const arm = () => {
    const kind = deps.getState().kind;
    const needed = kind === 'paused' || kind === 'meeting';
    if (needed && !stopClock) stopClock = deps.every(1000, tick);
    else if (!needed && stopClock) { stopClock(); stopClock = null; }
  };
  const unsubscribe = deps.subscribe(arm);
  const onWake = () => { if (!deps.isVisible || deps.isVisible()) tick(); };
  const wake = deps.wake ?? [];
  for (const [target, name] of wake) target.addEventListener(name, onWake);
  arm();
  tick();
  return () => {
    unsubscribe();
    stopClock?.();
    stopClock = null;
    for (const [target, name] of wake) target.removeEventListener(name, onWake);
  };
}

// ─── the desktop shell ───────────────────────────────────────────────────────

type CommandDetail = { type?: unknown; minutes?: unknown } | null;

/**
 * The tray's side of the contract in docs/agents/ws7b-notes.md.
 *   pause / resume   handled here (`preventDefault()`: the bridge has no default action for them);
 *   start            while paused it is a resume (handled); otherwise the bridge switches the camera on, as ever;
 *   stop             the machine stops too, then the bridge switches the camera off.
 * The pause state goes back to the tray as `stopbiting:desktop-state` on every change, and once at start, which is
 * what switches the tray's pause items on. With `isDesktop` false (a browser) nothing is reported.
 */
export function connectDesktop(deps: {
  target: EventTarget;
  isDesktop: boolean;
  getState(): WatchState;
  subscribe(listener: () => void): () => void;
  dispatch: Dispatch;
  pause(minutes: number): unknown;
  /** Overridable for tests; defaults to setTimeout. */
  later?: (fn: () => void, ms: number) => unknown;
}): () => void {
  const { target } = deps;
  const onCommand = (event: Event) => {
    const detail = (event as CustomEvent<CommandDetail>).detail;
    if (!detail || typeof detail.type !== 'string') return;
    switch (detail.type) {
      case 'pause':
        if (typeof detail.minutes === 'number') {
          void deps.pause(detail.minutes);
          event.preventDefault();
        }
        break;
      case 'resume':
        deps.dispatch({ type: 'resume' });
        event.preventDefault();
        break;
      case 'start':
        if (deps.getState().kind === 'paused') {
          deps.dispatch({ type: 'resume' });
          event.preventDefault();
        } else {
          deps.dispatch({ type: 'start' });
        }
        break;
      case 'stop':
        deps.dispatch({ type: 'stop' });
        break;
    }
  };
  target.addEventListener(DESKTOP_COMMAND_EVENT, onCommand);

  const report = () => {
    const detail = desktopPauseDetail(deps.getState());
    target.dispatchEvent(new CustomEvent(DESKTOP_STATE_EVENT, { detail }));
  };
  const unsubscribe = deps.isDesktop ? deps.subscribe(report) : () => {};
  const later = deps.later ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  if (deps.isDesktop) {
    report();
    // The bridge is loaded by a dynamic import that can finish after this does; it ignores a repeat of what it knows.
    for (const ms of [500, 2000, 5000]) later(report, ms);
  }
  return () => {
    target.removeEventListener(DESKTOP_COMMAND_EVENT, onCommand);
    unsubscribe();
  };
}

// ─── reminders ───────────────────────────────────────────────────────────────

/** One look at the schedule. Shows a reminder (and remembers its window) only when `decideReminder` says so. */
export function checkReminder(deps: {
  loadSchedule(): Schedule;
  getState(): WatchState;
  loadLastReminded(): string | null;
  saveLastReminded(windowId: string): void;
  permission(): NotificationPermissionState;
  appInFront(): boolean;
  show(): boolean;
  now(): number;
}): void {
  const schedule = deps.loadSchedule();
  if (!schedule.enabled) return;
  const decision = decideReminder({
    schedule,
    now: deps.now(),
    watch: deps.getState(),
    lastRemindedId: deps.loadLastReminded(),
    appVisible: deps.appInFront(),
    permission: deps.permission(),
  });
  if (decision.remind && decision.windowId && deps.show()) deps.saveLastReminded(decision.windowId);
}
