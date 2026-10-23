// The part of "keep watching in the background" that has no screen of its own (WS7a). Loaded by BackgroundHost
// only when the `background_watching` flag is on, so with the flag off none of it is downloaded or run.
//
//   1. mirror the camera switch into the pause machine (Stop clears a pause; Start after Stop runs);
//   2. while a pause or meeting runs, check its end every second from the worker's clock (a hidden tab's own
//      timers are slowed down, a pause would otherwise end up to a minute late) and whenever the tab wakes up;
//   3. answer the desktop shell: `stopbiting:desktop-command` pause / resume / start / stop drive the same
//      machine, and the state goes back to the tray as `stopbiting:desktop-state` (docs/agents/ws7b-notes.md);
//   4. the "Start watching?" reminders of the schedule.

import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { DESKTOP_COMMAND_EVENT, reportPauseState } from '../desktop/events';
import { desktopPauseDetail } from './pauseMachine';
import { dispatchWatch, getWatchState, subscribeWatch } from './watchStore';
import { getAppTicker } from './appTicker';
import { pauseForMinutes } from './actions';
import { decideReminder } from './schedule';
import { loadLastReminded, loadSchedule, saveLastReminded, subscribeSchedule } from './scheduleStore';
import { notificationPermission, showStartWatchingReminder } from './reminders';

/** Matches `DesktopCommand` in src/desktop/ipc.ts; only the fields used here. */
type CommandDetail = { type?: string; minutes?: number } | null;

export default function BackgroundRunner(): null {
  // 1. The camera switch is the person's own on/off (it resets to on at every load, so only CHANGES are mirrored:
  //    the one state we must not guess at load is a pause that is still running).
  useEffect(() => {
    if (!useAppStore.getState().cameraEnabled) dispatchWatch({ type: 'stop' });
    return useAppStore.subscribe((state, prev) => {
      if (state.cameraEnabled !== prev.cameraEnabled) dispatchWatch({ type: state.cameraEnabled ? 'start' : 'stop' });
    });
  }, []);

  // 2. Auto-resume. The clock only runs while a pause or meeting is on.
  useEffect(() => {
    let stopClock: (() => void) | null = null;
    const tick = () => { dispatchWatch({ type: 'tick', now: Date.now() }); };
    const arm = () => {
      const kind = getWatchState().kind;
      const needed = kind === 'paused' || kind === 'meeting';
      if (needed && !stopClock) stopClock = getAppTicker().every(1000, tick);
      else if (!needed && stopClock) { stopClock(); stopClock = null; }
    };
    const unsubscribe = subscribeWatch(arm);
    const onWake = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);
    window.addEventListener('online', onWake);
    arm();
    tick();
    return () => {
      unsubscribe();
      stopClock?.();
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
      window.removeEventListener('online', onWake);
    };
  }, []);

  // 3. The desktop shell. Nothing dispatches these events in a browser, so this is inert there.
  useEffect(() => {
    const onCommand = (event: Event) => {
      const command = (event as CustomEvent<CommandDetail>).detail;
      if (!command || typeof command.type !== 'string') return;
      switch (command.type) {
        case 'pause':
          if (typeof command.minutes === 'number') {
            void pauseForMinutes(command.minutes);
            event.preventDefault(); // handled: the bridge has no default action for pause
          }
          break;
        case 'resume':
          dispatchWatch({ type: 'resume' });
          event.preventDefault();
          break;
        case 'start':
          // Start while paused is a resume. Otherwise let the bridge switch the camera on, as it always did.
          if (getWatchState().kind === 'paused') {
            dispatchWatch({ type: 'resume' });
            event.preventDefault();
          } else {
            dispatchWatch({ type: 'start' });
          }
          break;
        case 'stop':
          dispatchWatch({ type: 'stop' }); // the bridge then switches the camera off
          break;
      }
    };
    window.addEventListener(DESKTOP_COMMAND_EVENT, onCommand);

    const report = () => reportPauseState(desktopPauseDetail(getWatchState()));
    const unsubscribe = window.desktop ? subscribeWatch(report) : () => {};
    // The first report switches the tray's pause items on. The bridge is loaded by a dynamic import that can finish
    // after this does, so say it again shortly (the bridge ignores a repeat of what it already sent).
    const later: ReturnType<typeof setTimeout>[] = [];
    if (window.desktop) {
      report();
      for (const ms of [500, 2000, 5000]) later.push(setTimeout(report, ms));
    }
    return () => {
      window.removeEventListener(DESKTOP_COMMAND_EVENT, onCommand);
      unsubscribe();
      later.forEach(clearTimeout);
    };
  }, []);

  // 4. Reminders. Evaluated every 30 s, when the schedule or the state changes, and when the tab wakes.
  useEffect(() => {
    const check = () => {
      const schedule = loadSchedule();
      if (!schedule.enabled) return;
      const decision = decideReminder({
        schedule,
        now: Date.now(),
        watch: getWatchState(),
        lastRemindedId: loadLastReminded(),
        appVisible: document.visibilityState === 'visible' && document.hasFocus(),
        permission: notificationPermission(),
      });
      if (decision.remind && decision.windowId && showStartWatchingReminder()) saveLastReminded(decision.windowId);
    };
    const id = setInterval(check, 30_000);
    const offSchedule = subscribeSchedule(check);
    const offWatch = subscribeWatch(check);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('blur', check);
    check();
    return () => {
      clearInterval(id);
      offSchedule();
      offWatch();
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('blur', check);
    };
  }, []);

  return null;
}
