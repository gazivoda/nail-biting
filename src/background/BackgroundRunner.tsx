// The part of "keep watching in the background" that has no screen of its own (WS7a). Loaded by BackgroundHost
// only when the `background_watching` flag is on, so with the flag off none of it is downloaded or run.
// Each effect hands the real thing to one function in wiring.ts, where the behaviour is tested:
//
//   1. the camera switch -> the pause machine (Stop clears a pause; Start after Stop runs);
//   2. the clock that ends a pause or meeting by itself (worker-backed, so a hidden tab does not make it late);
//   3. the desktop shell: tray commands in, pause state out (docs/agents/ws7b-notes.md);
//   4. the "Start watching?" reminders of the schedule.

import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { dispatchWatch, getWatchState, subscribeWatch } from './watchStore';
import { getAppTicker } from './appTicker';
import { pauseForMinutes } from './actions';
import { loadLastReminded, loadSchedule, saveLastReminded, subscribeSchedule } from './scheduleStore';
import { notificationPermission, showStartWatchingReminder } from './reminders';
import { checkReminder, connectDesktop, mirrorCameraSwitch, runExpiryClock } from './wiring';

export default function BackgroundRunner(): null {
  useEffect(() => mirrorCameraSwitch({
    getCameraEnabled: () => useAppStore.getState().cameraEnabled,
    subscribe: (listener) => useAppStore.subscribe((state, prev) => listener(state.cameraEnabled, prev.cameraEnabled)),
    dispatch: dispatchWatch,
  }), []);

  useEffect(() => runExpiryClock({
    getState: getWatchState,
    subscribe: subscribeWatch,
    every: (ms, fn) => getAppTicker().every(ms, fn),
    dispatch: dispatchWatch,
    now: Date.now,
    wake: [[document, 'visibilitychange'], [window, 'focus'], [window, 'pageshow'], [window, 'online']],
    isVisible: () => document.visibilityState === 'visible',
  }), []);

  useEffect(() => connectDesktop({
    target: window,
    isDesktop: !!window.desktop,
    getState: getWatchState,
    subscribe: subscribeWatch,
    dispatch: dispatchWatch,
    pause: pauseForMinutes,
  }), []);

  useEffect(() => {
    const check = () => checkReminder({
      loadSchedule,
      getState: getWatchState,
      loadLastReminded,
      saveLastReminded,
      permission: notificationPermission,
      appInFront: () => document.visibilityState === 'visible' && document.hasFocus(),
      show: showStartWatchingReminder,
      now: Date.now,
    });
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
